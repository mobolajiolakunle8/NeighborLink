// Service layer: every write the app performs goes through here. Each function is a
// thin, typed wrapper around Firestore/Auth, and the rules decide what is allowed.
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, limit, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, deleteUser, EmailAuthProvider,
  reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail,
  signOut, updateProfile, type User,
} from "firebase/auth";
import { adminSignInStep, completeMfaSignIn, emailKey, hasSecondFactor } from "./admin-mfa";
import { deleteObject, listAll, ref as storageRef } from "firebase/storage";
import { getAuthClient, getDb, getStorageClient } from "./firebase";
import { DEFAULT_CATEGORIES, DEFAULT_LEGAL, DEFAULT_NEIGHBOURHOODS, DEFAULT_SETTINGS } from "./defaults";
import type {
  BusinessStatus, HelpStatus, HelpType, MessageStatus, NotificationType, ReportStatus,
  ReportTargetType, Role, SiteSettings,
} from "./types";
import { hasBusinessLocation, slugify } from "./utils";

/** Trims strings and converts empty strings to null so optional fields are stored cleanly. */
function clean<T extends object>(input: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]));
}

/** Audit trail. Failures are swallowed so logging can never block a user action. */
export async function logActivity(uid: string | null | undefined, action: string, details = "") {
  if (!uid) return;
  try {
    await addDoc(collection(getDb(), "activityLogs"), {
      userId: uid, action, details: details.slice(0, 500), createdAt: serverTimestamp(),
    });
  } catch { /* intentionally silent */ }
}

// ---------------------------------------------------------------- authentication
export async function ensureProfile(user: User) {
  const ref = doc(getDb(), "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const email = (user.email ?? "").toLowerCase();
  try {
    await setDoc(ref, {
      uid: user.uid, name: user.displayName || "NeighbourLink member", email,
      emailHash: await emailKey(email),
      role: "resident", phone: null, neighbourhood: null, avatarUrl: null, bio: null,
      isSuspended: false, fcmTokens: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code === "permission-denied") {
      await signOut(getAuthClient());
      throw new Error("This email is not allowed to register. Please contact +2349030192034.");
    }
    throw err;
  }
}

export interface RegisterInput {
  name: string; email: string; password: string; role: "resident" | "business";
  phone: string; neighbourhood: string;
}

function baseProfile(user: User, name: string, role: Role, extra: Record<string, unknown> = {}) {
  return {
    uid: user.uid, name, email: (user.email ?? "").toLowerCase(), role,
    phone: null, neighbourhood: null, avatarUrl: null, bio: null,
    isSuspended: false, fcmTokens: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    ...extra,
  };
}

const MFA_REQUIRED_MESSAGE = "MFA_CODE_REQUIRED";
export { MFA_REQUIRED_MESSAGE };

export async function completeMfaLogin(otp: string): Promise<Role> {
  return finishLogin(await completeMfaSignIn(otp));
}

/** Shared post-sign-in checks for password-only and MFA logins. */
async function finishLogin(user: User): Promise<Role> {
  await ensureProfile(user);
  const snap = await getDoc(doc(getDb(), "users", user.uid));
  const data = snap.data() as { role?: Role; isSuspended?: boolean; suspendedReason?: string } | undefined;
  if (data?.isSuspended) {
    await signOut(getAuthClient());
    throw new Error(`This account has been suspended${data.suspendedReason ? `: ${data.suspendedReason}` : ""}. Please contact +2349030192034.`);
  }
  const [sec] = await Promise.all([getDoc(doc(getDb(), "config", "security"))]);
  if (data?.role === "admin" && sec.data()?.requireAdminMfa === true && !(await hasSecondFactor(user))) {
    await signOut(getAuthClient());
    throw new Error("Administrator MFA is required. Enrol an authenticator app and sign in again.");
  }
  await logActivity(user.uid, "login");
  return data?.role ?? "resident";
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getAuthClient(), input.email.trim(), input.password);
  const user = cred.user;
  await updateProfile(user, { displayName: input.name.trim() });
  const extra = { phone: input.phone.trim() || null, neighbourhood: input.neighbourhood || null };
  const standardRole: Role = input.role === "business" ? "business" : "resident";
  const email = (user.email ?? "").toLowerCase();
  await setDoc(doc(getDb(), "users", user.uid), baseProfile(user, input.name.trim(), standardRole, { ...extra, email, emailHash: await emailKey(email) }));
  sendEmailVerification(user).catch(() => undefined);
  await logActivity(user.uid, "register", standardRole);
  return user;
}

export async function loginUser(email: string, password: string): Promise<Role> {
  const result = await adminSignInStep(email, password);
  if (result === "MFA_REQUIRED") throw new Error(MFA_REQUIRED_MESSAGE);
  return finishLogin(result);
}
export async function sendPasswordReset(email: string) { await sendPasswordResetEmail(getAuthClient(), email.trim()); }
export async function resendVerification(user: User) { await sendEmailVerification(user); }

// ---------------------------------------------------------------- profile
export interface ProfilePatch {
  name: string; phone: string | null; neighbourhood: string | null; bio: string | null;
  avatarUrl: string | null; role: Role;
}
export async function updateMyProfile(uid: string, patch: ProfilePatch) {
  await updateDoc(doc(getDb(), "users", uid), { ...patch, updatedAt: serverTimestamp() });
  await logActivity(uid, "update_profile");
}
/** Permanently deletes the signed-in account after password re-authentication. */
export async function deleteMyAccount(password: string) {
  const auth = getAuthClient();
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Please log in again to delete your account.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const db = getDb(); const uid = user.uid;
  // Private conversations (both participants' copies are the same documents).
  const convs = await getDocs(query(collection(db, "conversations"), where("members", "array-contains", uid)));
  for (const c of convs.docs) {
    const msgs = await getDocs(collection(c.ref, "messages"));
    for (let i = 0; i < msgs.docs.length; i += 400) {
      const b = writeBatch(db); msgs.docs.slice(i, i + 400).forEach(m => b.delete(m.ref)); await b.commit();
    }
    await deleteDoc(c.ref);
  }
  const [biz, help, reviews, saved, notes] = await Promise.all([
    getDocs(query(collection(db, "businesses"), where("ownerId", "==", uid))),
    getDocs(query(collection(db, "helpPosts"), where("userId", "==", uid))),
    getDocs(query(collection(db, "reviews"), where("userId", "==", uid))),
    getDocs(collection(db, "users", uid, "saved")),
    getDocs(collection(db, "users", uid, "notifications")),
  ]);
  const refs = [...biz.docs, ...help.docs, ...reviews.docs, ...saved.docs, ...notes.docs].map(d => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db); refs.slice(i, i + 400).forEach(r => batch.delete(r)); await batch.commit();
  }
  for (const folder of [`businesses/${uid}`, `avatars/${uid}`]) {
    try { const listing = await listAll(storageRef(getStorageClient(), folder)); await Promise.all(listing.items.map(item => deleteObject(item))); }
    catch { /* folder may be empty */ }
  }
  await deleteDoc(doc(db, "users", uid));
  await deleteUser(user);
}

export async function setMyNeighbourhood(uid: string, neighbourhoodId: string | null) {
  await updateDoc(doc(getDb(), "users", uid), { neighbourhood: neighbourhoodId, updatedAt: serverTimestamp() });
}

// ---------------------------------------------------------------- notifications
/** Writes an in-app notification for another user. Failures never block the main action. */
export type NotificationSource = "review" | "business" | "conversation" | "user";
/** Notifications must reference a verifiable source document; Firestore rules reject fabricated alerts. */
export async function notifyUser(toUid: string, n: {
  type: NotificationType; title: string; body: string; link: string;
  sourceType: NotificationSource; sourceId: string;
}) {
  const actor = getAuthClient().currentUser;
  if (!actor || !toUid || actor.uid === toUid || !n.sourceId) return;
  try {
    await addDoc(collection(getDb(), "users", toUid, "notifications"), {
      type: n.type, title: n.title.slice(0, 160), body: n.body.slice(0, 400), link: n.link,
      sourceType: n.sourceType, sourceId: n.sourceId,
      actorId: actor.uid, read: false, createdAt: serverTimestamp(),
    });
  } catch { /* best-effort; rules may require MFA before admin notices */ }
}

/** Enforce MFA for all privileged administrator writes. Can only be enabled by an MFA-verified admin. */
export async function enableAdminMfaRequirement(actorUid: string) {
  await setDoc(doc(getDb(), "config", "security"), { requireAdminMfa: true, updatedAt: serverTimestamp(), enabledBy: actorUid }, { merge: true });
  await logActivity(actorUid, "enable_admin_mfa");
}

export async function markNotificationRead(uid: string, id: string) {
  await updateDoc(doc(getDb(), "users", uid, "notifications", id), { read: true });
}
export async function markAllNotificationsRead(uid: string, ids: string[]) {
  const db = getDb();
  for (let i = 0; i < ids.length; i += 400) {
    const b = writeBatch(db); ids.slice(i, i + 400).forEach(id => b.update(doc(db, "users", uid, "notifications", id), { read: true })); await b.commit();
  }
}
export async function deleteNotification(uid: string, id: string) {
  await deleteDoc(doc(getDb(), "users", uid, "notifications", id));
}

// ------------------------------------------------- assistant logs (admin reporting)
export async function markAssistantLogReviewed(id: string, actorUid: string) {
  await updateDoc(doc(getDb(), "assistantLogs", id), { reviewed: true, reviewedAt: serverTimestamp(), reviewedBy: actorUid });
  await logActivity(actorUid, "assistant_log_reviewed", id);
}
export async function deleteAssistantLog(id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), "assistantLogs", id));
  await logActivity(actorUid, "assistant_log_deleted", id);
}

// ---------------------------------------------------------------- saved businesses
export async function setSaved(uid: string, businessId: string, saved: boolean) {
  const ref = doc(getDb(), "users", uid, "saved", businessId);
  if (saved) await setDoc(ref, { businessId, savedAt: serverTimestamp() });
  else await deleteDoc(ref);
}

// ---------------------------------------------------------------- business listings
export interface BusinessInput {
  name: string; description: string; categoryId: string; neighbourhoodId: string;
  phone: string; email: string; address: string; website: string; openingHours: string; imageUrl: string;
  whatsappEnabled: boolean; latitude: number | null; longitude: number | null;
}
export async function createBusiness(owner: { uid: string; name: string }, input: BusinessInput) {
  const ref = await addDoc(collection(getDb(), "businesses"), {
    ...clean(input), ownerId: owner.uid, ownerName: owner.name, status: "pending",
    isFeatured: false, views: 0, verificationStatus: "none", locationUpdatedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logActivity(owner.uid, "submit_business", input.name);
  return ref.id;
}
export async function updateBusinessLocation(id: string, latitude: number, longitude: number, actorUid: string) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error("Please set a valid map location.");
  }
  await updateDoc(doc(getDb(), "businesses", id), { latitude, longitude, locationUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logActivity(actorUid, "update_business_location", id);
}
export async function updateBusiness(id: string, input: BusinessInput, actorUid: string) {
  await updateDoc(doc(getDb(), "businesses", id), { ...clean(input), status: "pending", locationUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logActivity(actorUid, "update_business", input.name);
}
export async function setBusinessStatus(id: string, status: BusinessStatus, actorUid: string) {
  const ref = doc(getDb(), "businesses", id);
  const snap = await getDoc(ref);
  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
  await logActivity(actorUid, "moderate_business", `${id}:${status}`);
  const b = snap.data();
  if (status === "approved" && !hasBusinessLocation({ latitude: b?.latitude, longitude: b?.longitude })) {
    throw new Error("This listing has no exact map pin yet. Add its latitude and longitude before approval so it appears on the map.");
  }
  if (b?.ownerId && (status === "approved" || status === "rejected")) {
    await notifyUser(b.ownerId, {
      type: "listing",
      title: status === "approved" ? `“${b.name}” is now live` : `“${b.name}” needs changes`,
      body: status === "approved" ? "Your listing was approved and now appears in the directory." : "Your listing was not approved. Review the details and resubmit, or contact us for help.",
      link: status === "approved" ? `/business/${id}` : "/profile#my-listings",
      sourceType: "business", sourceId: id,
    });
  }
}
/** Approve or reject several listings at once. Returns the number processed. */
export async function bulkSetBusinessStatus(ids: string[], status: BusinessStatus, actorUid: string) {
  let n = 0;
  for (const id of ids) { await setBusinessStatus(id, status, actorUid); n++; }
  return n;
}
export async function adminUpdateBusinessLocation(id: string, latitude: number | null, longitude: number | null, actorUid: string) {
  if ((latitude === null) !== (longitude === null)) throw new Error("Set both coordinates or clear both.");
  if (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude!) || Math.abs(longitude!) > 180)) throw new Error("Invalid coordinates.");
  await updateDoc(doc(getDb(), "businesses", id), { latitude, longitude, locationUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await logActivity(actorUid, "admin_update_location", id);
}
export async function setBusinessFeatured(id: string, featured: boolean, actorUid: string) {
  await updateDoc(doc(getDb(), "businesses", id), { isFeatured: featured, updatedAt: serverTimestamp() });
  await logActivity(actorUid, "feature_business", `${id}:${featured}`);
}
export async function deleteBusiness(id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), "businesses", id));
  await logActivity(actorUid, "delete_business", id);
}
export async function recordBusinessView(id: string) {
  try { await updateDoc(doc(getDb(), "businesses", id), { views: increment(1) }); } catch { /* counting views is best-effort */ }
}

// ---------------------------------------------------------------- verification
export async function requestVerification(id: string, cacNumber: string, note: string, actorUid: string) {
  const cac = cacNumber.trim().toUpperCase();
  if (cac.length < 4 || cac.length > 40) throw new Error("Please enter a valid CAC registration number (e.g. RC 1234567 or BN 1234567).");
  await updateDoc(doc(getDb(), "businesses", id), {
    verificationStatus: "requested", cacNumber: cac, verificationNote: note.trim().slice(0, 500) || null,
    verificationRequestedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logActivity(actorUid, "request_verification", id);
}
export async function setVerification(id: string, status: "verified" | "rejected", actorUid: string) {
  const ref = doc(getDb(), "businesses", id);
  const snap = await getDoc(ref);
  await updateDoc(ref, { verificationStatus: status, updatedAt: serverTimestamp() });
  await logActivity(actorUid, "set_verification", `${id}:${status}`);
  const b = snap.data();
  if (b?.ownerId) {
    await notifyUser(b.ownerId, {
      type: "verification",
      title: status === "verified" ? `“${b.name}” is now a Verified business` : `Verification for “${b.name}” was not approved`,
      body: status === "verified" ? "Your verified badge is now shown on your listing." : "We couldn't confirm your registration details. Check your CAC number and request again.",
      link: `/business/${id}`,
      sourceType: "business", sourceId: id,
    });
  }
}

// ---------------------------------------------------------------- reviews
export async function addReview(businessId: string, author: { uid: string; name: string }, rating: number, comment: string) {
  const reviewRef = await addDoc(collection(getDb(), "reviews"), {
    businessId, userId: author.uid, authorName: author.name, rating, comment: comment.trim(), createdAt: serverTimestamp(),
  });
  await logActivity(author.uid, "review_business", businessId);
  const b = (await getDoc(doc(getDb(), "businesses", businessId))).data();
  if (b?.ownerId) {
    await notifyUser(b.ownerId, { type: "review", title: `New ${rating}-star review for “${b.name}”`, body: comment.trim().slice(0, 200), link: `/business/${businessId}`, sourceType: "review", sourceId: reviewRef.id });
  }
}

// ---------------------------------------------------------------- admin support inbox
export function conversationId(targetType: "business" | "help", targetId: string, uid: string) {
  return `support_${targetType}_${targetId}_${uid}`;
}

async function createAdminThread(
  me: { uid: string; name: string },
  target: { type: "support" | "business" | "help"; id: string | null; title: string },
  text: string,
  cid: string,
) {
  const msg = text.trim();
  if (msg.length < 2 || msg.length > 2000) throw new Error("Please write a message between 2 and 2000 characters.");
  const db = getDb();
  const ref = doc(db, "conversations", cid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    if (existing.data().closedBy) throw new Error("This conversation is closed. Please start a new message to the admin team.");
    await sendMessage(cid, me.uid, msg); return cid;
  }
  const batch = writeBatch(db);
  batch.set(ref, {
    kind: "admin", targetType: target.type, targetId: target.id, targetTitle: target.title.trim().slice(0, 200),
    userId: me.uid, userName: me.name, members: [me.uid],
    lastMessage: msg, lastSenderId: me.uid, lastMessageAt: serverTimestamp(),
    readAt: { [me.uid]: serverTimestamp() }, closedBy: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(ref, "messages")), { senderId: me.uid, text: msg, createdAt: serverTimestamp() });
  await batch.commit();
  await logActivity(me.uid, "message_admin", target.title);
  return cid;
}

/** Every new listing enquiry is routed to the admin team, never to the listing owner. */
export async function startConversation(
  me: { uid: string; name: string },
  target: { type: "business" | "help"; id: string; title: string; ownerId?: string; ownerName?: string },
  text: string,
) {
  return createAdminThread(me, target, text, conversationId(target.type, target.id, me.uid));
}

export async function startSupportMessage(me: { uid: string; name: string }, subject: string, text: string) {
  if (subject.trim().length < 3 || subject.trim().length > 160) throw new Error("Please add a subject between 3 and 160 characters.");
  const cid = `support_${me.uid}_${doc(collection(getDb(), "conversations")).id}`;
  return createAdminThread(me, { type: "support", id: null, title: subject.trim() }, text, cid);
}

/** Sends a member follow-up or an admin reply. Only admin replies notify the member. */
export async function sendMessage(cid: string, senderUid: string, text: string) {
  const msg = text.trim();
  if (!msg || msg.length > 2000) throw new Error("Messages must be between 1 and 2000 characters.");
  const db = getDb();
  const ref = doc(db, "conversations", cid);
  const conversation = await getDoc(ref);
  if (!conversation.exists() || conversation.data().kind !== "admin") throw new Error("This conversation is no longer available for replies.");
  const batch = writeBatch(db);
  batch.set(doc(collection(ref, "messages")), { senderId: senderUid, text: msg, createdAt: serverTimestamp() });
  batch.update(ref, {
    lastMessage: msg, lastSenderId: senderUid, lastMessageAt: serverTimestamp(),
    [`readAt.${senderUid}`]: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await batch.commit();
  const memberUid = conversation.data().userId as string;
  if (senderUid !== memberUid) {
    await notifyUser(memberUid, {
      type: "message", title: "Reply from the NeighbourLink admin team",
      body: msg.slice(0, 200), link: `/profile?message=${encodeURIComponent(cid)}#messages`,
      sourceType: "conversation", sourceId: cid,
    });
    await logActivity(senderUid, "admin_reply", cid);
  }
}
export async function markConversationRead(cid: string, uid: string) {
  try { await updateDoc(doc(getDb(), "conversations", cid), { [`readAt.${uid}`]: serverTimestamp() }); } catch { /* best-effort */ }
}
export async function setConversationClosed(cid: string, uid: string, closed: boolean) {
  await updateDoc(doc(getDb(), "conversations", cid), { closedBy: closed ? uid : null, updatedAt: serverTimestamp() });
}
export async function deleteConversation(cid: string) {
  const db = getDb(); const ref = doc(db, "conversations", cid);
  while (true) {
    const msgs = await getDocs(query(collection(ref, "messages"), limit(300)));
    if (!msgs.empty) { const b = writeBatch(db); msgs.docs.forEach(m => b.delete(m.ref)); await b.commit(); }
    if (msgs.size < 300) break;
  }
  await deleteDoc(ref);
}

// ---------------------------------------------------------------- help board
export interface HelpInput {
  type: HelpType; title: string; description: string; category: string;
  neighbourhoodId: string; contactPhone: string;
}
export async function createHelpPost(author: { uid: string; name: string }, input: HelpInput) {
  await addDoc(collection(getDb(), "helpPosts"), {
    ...clean(input), userId: author.uid, authorName: author.name, status: "open",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logActivity(author.uid, `create_help_${input.type}`, input.title);
}
export async function setHelpStatus(id: string, status: HelpStatus, actorUid: string) {
  await updateDoc(doc(getDb(), "helpPosts", id), { status, updatedAt: serverTimestamp() });
  await logActivity(actorUid, "help_status", `${id}:${status}`);
}
export async function deleteHelpPost(id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), "helpPosts", id));
  await logActivity(actorUid, "delete_help", id);
}

// ---------------------------------------------------------------- moderation & contact
export async function createReport(reporterUid: string, targetType: ReportTargetType, targetId: string, reason: string, details: string) {
  await addDoc(collection(getDb(), "reports"), {
    reporterId: reporterUid, targetType, targetId, reason, details: details.trim() || null,
    status: "open", createdAt: serverTimestamp(),
  });
  await logActivity(reporterUid, "report", `${targetType}:${targetId}`);
}
export async function setReportStatus(id: string, status: ReportStatus, actorUid: string) {
  await updateDoc(doc(getDb(), "reports", id), { status });
  await logActivity(actorUid, "report_status", `${id}:${status}`);
}
export async function submitContact(input: { name: string; email: string; phone: string; subject: string; message: string }) {
  await addDoc(collection(getDb(), "contactMessages"), {
    ...clean(input), email: input.email.trim().toLowerCase(), status: "new", createdAt: serverTimestamp(),
  });
}
export async function setMessageStatus(id: string, status: MessageStatus, actorUid: string) {
  await updateDoc(doc(getDb(), "contactMessages", id), { status });
  await logActivity(actorUid, "message_status", `${id}:${status}`);
}
export async function deleteMessage(id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), "contactMessages", id));
  await logActivity(actorUid, "delete_message", id);
}

// ---------------------------------------------------------------- admin: content
export async function saveTaxonomy(kind: "categories" | "neighbourhoods", input: { id?: string; name: string; description: string; icon?: string; sortOrder: number; isActive: boolean }, actorUid: string) {
  const id = input.id ?? slugify(input.name);
  await setDoc(doc(getDb(), kind, id), {
    name: input.name.trim(), slug: id, description: input.description.trim(), icon: input.icon ?? "store",
    sortOrder: Number(input.sortOrder) || 0, isActive: input.isActive, updatedAt: serverTimestamp(),
  }, { merge: true });
  await logActivity(actorUid, `save_${kind}`, input.name);
}
export async function deleteTaxonomy(kind: "categories" | "neighbourhoods", id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), kind, id));
  await logActivity(actorUid, `delete_${kind}`, id);
}
export interface AnnouncementInput { title: string; body: string; imageUrl: string; isPinned: boolean; isPublished: boolean; neighbourhoodId?: string; }
export async function createAnnouncement(input: AnnouncementInput, actorUid: string) {
  await addDoc(collection(getDb(), "announcements"), {
    ...clean(input), publishedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await logActivity(actorUid, "create_announcement", input.title);
}
export async function updateAnnouncement(id: string, input: Partial<AnnouncementInput>, actorUid: string) {
  await updateDoc(doc(getDb(), "announcements", id), { ...clean(input), updatedAt: serverTimestamp() });
  await logActivity(actorUid, "update_announcement", id);
}
export async function deleteAnnouncement(id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), "announcements", id));
  await logActivity(actorUid, "delete_announcement", id);
}
export async function saveLegal(id: string, title: string, content: string, actorUid: string) {
  await setDoc(doc(getDb(), "legalPages", id), { id, title: title.trim(), content: content.trim(), updatedAt: serverTimestamp() }, { merge: true });
  await logActivity(actorUid, "update_legal", id);
}
export async function saveSettings(patch: Partial<SiteSettings>, actorUid: string) {
  await setDoc(doc(getDb(), "siteSettings", "main"), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  await logActivity(actorUid, "update_settings");
}
/** Writes built-in defaults for any document that does not exist yet. */
export async function initializeDefaults(actorUid: string) {
  const db = getDb();
  const settingsRef = doc(db, "siteSettings", "main");
  let settingsCreated = 0;
  if (!(await getDoc(settingsRef)).exists()) {
    await setDoc(settingsRef, { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
    settingsCreated = 1;
  }
  const seed = async (collectionName: string, items: Array<{ id: string }>) => {
    const existing = new Set((await getDocs(collection(db, collectionName))).docs.map(d => d.id));
    const batch = writeBatch(db); let count = 0;
    for (const item of items) {
      if (existing.has(item.id)) continue;
      batch.set(doc(db, collectionName, item.id), { ...item, updatedAt: serverTimestamp() }); count++;
    }
    if (count) await batch.commit();
    return count;
  };
  const created = {
    settings: settingsCreated,
    categories: await seed("categories", DEFAULT_CATEGORIES),
    neighbourhoods: await seed("neighbourhoods", DEFAULT_NEIGHBOURHOODS),
    legal: await seed("legalPages", DEFAULT_LEGAL),
  };
  await logActivity(actorUid, "initialize_defaults", JSON.stringify(created));
  return created;
}

// ---------------------------------------------------------------- admin: users
async function accountBanData(uid: string) {
  const snap = await getDoc(doc(getDb(), "users", uid));
  const email = String(snap.data()?.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("This user has no email on file and cannot be suspended safely.");
  const key = await emailKey(email);
  return { key, email };
}

/** Suspensions survive profile deletion: a SHA-256 ban blocks recreating the same email. */
export async function adminUpdateUser(uid: string, patch: { role?: Role; isSuspended?: boolean; suspendedReason?: string | null }, actorUid: string) {
  const db = getDb();
  const ref = doc(db, "users", uid);
  const ban = patch.isSuspended !== undefined ? await accountBanData(uid) : null;
  const batch = writeBatch(db);
  batch.update(ref, { ...patch, updatedAt: serverTimestamp() });
  if (ban) {
    if (patch.isSuspended) batch.set(doc(db, "accountBans", ban.key), { uid, email: ban.email, emailHash: ban.key, active: true, createdAt: serverTimestamp() });
    else batch.delete(doc(db, "accountBans", ban.key));
  }
  await batch.commit();
  await logActivity(actorUid, "admin_update_user", `${uid}:${JSON.stringify(patch)}`);
  if (patch.isSuspended !== undefined) {
    await notifyUser(uid, {
      type: "account",
      title: patch.isSuspended ? "Your account has been suspended" : "Your account has been restored",
      body: patch.isSuspended ? (patch.suspendedReason || "Contact +2349030192034 for details.") : "You can post, review and message again.",
      link: "/profile", sourceType: "user", sourceId: uid,
    });
  }
}

/** Deletes the Firestore profile but leaves an email ban so the same email cannot re-register. */
export async function adminDeleteUserProfile(uid: string, actorUid: string) {
  const db = getDb();
  let ban: { key: string; email: string } | null = null;
  try { ban = await accountBanData(uid); } catch { /* no email on file */ }
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid));
  if (ban) batch.set(doc(db, "accountBans", ban.key), { uid, email: ban.email, emailHash: ban.key, active: true, createdAt: serverTimestamp() });
  await batch.commit();
  await logActivity(actorUid, "admin_delete_user_profile", uid);
}
