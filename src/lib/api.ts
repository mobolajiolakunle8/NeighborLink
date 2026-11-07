// Service layer: every write the app performs goes through here. Each function is a
// thin, typed wrapper around Firestore/Auth, and the rules decide what is allowed.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { deleteObject, listAll, ref as storageRef } from "firebase/storage";
import { getAuthClient, getDb, getStorageClient } from "./firebase";
import { DEFAULT_CATEGORIES, DEFAULT_LEGAL, DEFAULT_NEIGHBOURHOODS, DEFAULT_SETTINGS } from "./defaults";
import type {
  BusinessStatus,
  HelpStatus,
  HelpType,
  MessageStatus,
  ReportStatus,
  ReportTargetType,
  Role,
  SiteSettings,
} from "./types";
import { slugify } from "./utils";

/** Trims strings and converts empty strings to null so optional fields are stored cleanly. */
function clean<T extends object>(input: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]),
  );
}

/** Audit trail. Failures are swallowed so logging can never block a user action. */
export async function logActivity(uid: string | null | undefined, action: string, details = "") {
  if (!uid) return;
  try {
    await addDoc(collection(getDb(), "activityLogs"), {
      userId: uid,
      action,
      details: details.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch {
    /* intentionally silent */
  }
}

// ---------------------------------------------------------------- authentication

/** Ensures a users/{uid} profile exists. Creates a resident profile only if missing. */
export async function ensureProfile(user: User) {
  const ref = doc(getDb(), "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    name: user.displayName || "NeighbourLink member",
    email: user.email ?? "",
    role: "resident",
    phone: null,
    neighbourhood: null,
    avatarUrl: null,
    bio: null,
    isSuspended: false,
    fcmTokens: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: "resident" | "business";
  phone: string;
  neighbourhood: string;
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getAuthClient(), input.email.trim(), input.password);
  const user = cred.user;
  await updateProfile(user, { displayName: input.name.trim() });
  await setDoc(doc(getDb(), "users", user.uid), {
    uid: user.uid,
    name: input.name.trim(),
    email: user.email ?? input.email.trim(),
    role: input.role,
    phone: input.phone.trim() || null,
    neighbourhood: input.neighbourhood || null,
    avatarUrl: null,
    bio: null,
    isSuspended: false,
    fcmTokens: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  sendEmailVerification(user).catch(() => undefined);
  await logActivity(user.uid, "register", input.role);
  return user;
}

export async function loginUser(email: string, password: string): Promise<Role> {
  const cred = await signInWithEmailAndPassword(getAuthClient(), email.trim(), password);
  await ensureProfile(cred.user);
  const snap = await getDoc(doc(getDb(), "users", cred.user.uid));
  const data = snap.data() as { role?: Role; isSuspended?: boolean } | undefined;
  if (data?.isSuspended) {
    await signOut(getAuthClient());
    throw new Error("This account has been suspended. Please contact +2349030192034.");
  }
  await logActivity(cred.user.uid, "login");
  return data?.role ?? "resident";
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(getAuthClient(), email.trim());
}

export async function resendVerification(user: User) {
  await sendEmailVerification(user);
}

// ---------------------------------------------------------------- profile

export interface ProfilePatch {
  name: string;
  phone: string | null;
  neighbourhood: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: Role;
}

export async function updateMyProfile(uid: string, patch: ProfilePatch) {
  await updateDoc(doc(getDb(), "users", uid), { ...patch, updatedAt: serverTimestamp() });
  await logActivity(uid, "update_profile");
}

/**
 * Permanently deletes the signed-in account. Requires the password again (re-authentication),
 * removes the user's listings, posts, reviews and photos, then deletes the Auth account.
 */
export async function deleteMyAccount(password: string) {
  const auth = getAuthClient();
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Please log in again to delete your account.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

  const db = getDb();
  const uid = user.uid;
  const [biz, help, reviews] = await Promise.all([
    getDocs(query(collection(db, "businesses"), where("ownerId", "==", uid))),
    getDocs(query(collection(db, "helpPosts"), where("userId", "==", uid))),
    getDocs(query(collection(db, "reviews"), where("userId", "==", uid))),
  ]);
  const refs = [...biz.docs, ...help.docs, ...reviews.docs].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }

  for (const folder of [`businesses/${uid}`, `avatars/${uid}`]) {
    try {
      const listing = await listAll(storageRef(getStorageClient(), folder));
      await Promise.all(listing.items.map((item) => deleteObject(item)));
    } catch {
      /* folder may be empty */
    }
  }

  await deleteDoc(doc(db, "users", uid));
  await deleteUser(user);
}

// ---------------------------------------------------------------- business listings

export interface BusinessInput {
  name: string;
  description: string;
  categoryId: string;
  neighbourhoodId: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  openingHours: string;
  imageUrl: string;
}

export async function createBusiness(owner: { uid: string; name: string }, input: BusinessInput) {
  const ref = await addDoc(collection(getDb(), "businesses"), {
    ...clean(input),
    ownerId: owner.uid,
    ownerName: owner.name,
    status: "pending",
    isFeatured: false,
    views: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logActivity(owner.uid, "submit_business", input.name);
  return ref.id;
}

/** Owner edit. The rules force the listing back to 'pending' for admin review. */
export async function updateBusiness(id: string, input: BusinessInput, actorUid: string) {
  await updateDoc(doc(getDb(), "businesses", id), {
    ...clean(input),
    status: "pending",
    updatedAt: serverTimestamp(),
  });
  await logActivity(actorUid, "update_business", input.name);
}

export async function setBusinessStatus(id: string, status: BusinessStatus, actorUid: string) {
  await updateDoc(doc(getDb(), "businesses", id), { status, updatedAt: serverTimestamp() });
  await logActivity(actorUid, "moderate_business", `${id}:${status}`);
}

export async function setBusinessFeatured(id: string, featured: boolean, actorUid: string) {
  await updateDoc(doc(getDb(), "businesses", id), { isFeatured: featured, updatedAt: serverTimestamp() });
  await logActivity(actorUid, "feature_business", `${id}:${featured}`);
}

export async function deleteBusiness(id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), "businesses", id));
  await logActivity(actorUid, "delete_business", id);
}

/** Increments the view counter by exactly 1 (matches the rule that allows view-only updates). */
export async function recordBusinessView(id: string) {
  try {
    await updateDoc(doc(getDb(), "businesses", id), { views: increment(1) });
  } catch {
    /* counting views is best-effort */
  }
}

// ---------------------------------------------------------------- reviews

export async function addReview(
  businessId: string,
  author: { uid: string; name: string },
  rating: number,
  comment: string,
) {
  await addDoc(collection(getDb(), "reviews"), {
    businessId,
    userId: author.uid,
    authorName: author.name,
    rating,
    comment: comment.trim(),
    createdAt: serverTimestamp(),
  });
  await logActivity(author.uid, "review_business", businessId);
}

// ---------------------------------------------------------------- help board

export interface HelpInput {
  type: HelpType;
  title: string;
  description: string;
  category: string;
  neighbourhoodId: string;
  contactPhone: string;
}

export async function createHelpPost(author: { uid: string; name: string }, input: HelpInput) {
  await addDoc(collection(getDb(), "helpPosts"), {
    ...clean(input),
    userId: author.uid,
    authorName: author.name,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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

export async function createReport(
  reporterUid: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  details: string,
) {
  await addDoc(collection(getDb(), "reports"), {
    reporterId: reporterUid,
    targetType,
    targetId,
    reason,
    details: details.trim() || null,
    status: "open",
    createdAt: serverTimestamp(),
  });
  await logActivity(reporterUid, "report", `${targetType}:${targetId}`);
}

export async function setReportStatus(id: string, status: ReportStatus, actorUid: string) {
  await updateDoc(doc(getDb(), "reports", id), { status });
  await logActivity(actorUid, "report_status", `${id}:${status}`);
}

export async function submitContact(input: { name: string; email: string; phone: string; subject: string; message: string }) {
  await addDoc(collection(getDb(), "contactMessages"), {
    ...clean(input),
    email: input.email.trim().toLowerCase(),
    status: "new",
    createdAt: serverTimestamp(),
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

export async function saveTaxonomy(
  kind: "categories" | "neighbourhoods",
  input: { id?: string; name: string; description: string; icon?: string; sortOrder: number; isActive: boolean },
  actorUid: string,
) {
  const id = input.id ?? slugify(input.name);
  await setDoc(
    doc(getDb(), kind, id),
    {
      name: input.name.trim(),
      slug: id,
      description: input.description.trim(),
      icon: input.icon ?? "store",
      sortOrder: Number(input.sortOrder) || 0,
      isActive: input.isActive,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await logActivity(actorUid, `save_${kind}`, input.name);
}

export async function deleteTaxonomy(kind: "categories" | "neighbourhoods", id: string, actorUid: string) {
  await deleteDoc(doc(getDb(), kind, id));
  await logActivity(actorUid, `delete_${kind}`, id);
}

export interface AnnouncementInput {
  title: string;
  body: string;
  imageUrl: string;
  isPinned: boolean;
  isPublished: boolean;
}

export async function createAnnouncement(input: AnnouncementInput, actorUid: string) {
  await addDoc(collection(getDb(), "announcements"), {
    ...clean(input),
    publishedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
  await setDoc(
    doc(getDb(), "legalPages", id),
    { id, title: title.trim(), content: content.trim(), updatedAt: serverTimestamp() },
    { merge: true },
  );
  await logActivity(actorUid, "update_legal", id);
}

export async function saveSettings(patch: Partial<SiteSettings>, actorUid: string) {
  await setDoc(doc(getDb(), "siteSettings", "main"), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  await logActivity(actorUid, "update_settings");
}

/**
 * Writes built-in defaults for any document that does not exist yet. Existing
 * documents are never overwritten, so administrator edits are preserved.
 */
export async function initializeDefaults(actorUid: string) {
  const db = getDb();
  const settingsRef = doc(db, "siteSettings", "main");
  let settingsCreated = 0;
  if (!(await getDoc(settingsRef)).exists()) {
    await setDoc(settingsRef, { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() });
    settingsCreated = 1;
  }

  const seed = async (collectionName: string, items: Array<{ id: string }>) => {
    const existing = new Set((await getDocs(collection(db, collectionName))).docs.map((d) => d.id));
    const batch = writeBatch(db);
    let count = 0;
    for (const item of items) {
      if (existing.has(item.id)) continue;
      batch.set(doc(db, collectionName, item.id), { ...item, updatedAt: serverTimestamp() });
      count++;
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

export async function adminUpdateUser(uid: string, patch: { role?: Role; isSuspended?: boolean }, actorUid: string) {
  await updateDoc(doc(getDb(), "users", uid), { ...patch, updatedAt: serverTimestamp() });
  await logActivity(actorUid, "admin_update_user", `${uid}:${JSON.stringify(patch)}`);
}

/**
 * Removes the Firestore profile. The Firebase Auth account itself can only be deleted
 * with the Admin SDK or in the Firebase Console; the UI makes this explicit to admins.
 */
export async function adminDeleteUserProfile(uid: string, actorUid: string) {
  await deleteDoc(doc(getDb(), "users", uid));
  await logActivity(actorUid, "admin_delete_user_profile", uid);
}
