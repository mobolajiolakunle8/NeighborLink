#!/usr/bin/env node
// Creates the FIRST NeighbourLink administrator using the one-time setup key.
// The key is read from the command line or ADMIN_SETUP_KEY (e.g. in .env.local) and is
// checked by the Firestore rules against its SHA-256 hash. No service-account key needed.
//
// Usage: node scripts/setup-admin.mjs <email> <password> [setupKey]
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webConfig = JSON.parse(readFileSync(join(root, "src/config/firebase.web.json"), "utf8"));
const envFile = join(root, ".env.local");
const localKey = existsSync(envFile) ? (readFileSync(envFile, "utf8").match(/^ADMIN_SETUP_KEY=(.+)$/m)?.[1] ?? "").trim() : "";

const [email, password, argKey] = process.argv.slice(2);
const setupKey = (argKey || process.env.ADMIN_SETUP_KEY || localKey).trim();
if (!email || !password || !setupKey) {
  console.log("Usage: node scripts/setup-admin.mjs <email> <password> [setupKey]\n(setupKey may also come from ADMIN_SETUP_KEY in .env.local)");
  process.exit(1);
}

const app = initializeApp(webConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let user;
try {
  user = (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
} catch (err) {
  if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
    user = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
    console.log("Created new account.");
  } else { console.error("Sign-in failed:", err.message); process.exit(1); }
}

const ref = doc(db, "users", user.uid);
const batch = writeBatch(db);
const snap = await getDoc(ref).catch(() => null);
if (snap?.exists()) batch.update(ref, { role: "admin", updatedAt: serverTimestamp() });
else batch.set(ref, { uid: user.uid, name: "Administrator", email: email.trim(), role: "admin", phone: null, neighbourhood: null, avatarUrl: null, bio: null, isSuspended: false, fcmTokens: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
batch.set(doc(db, "config", "bootstrap"), { adminUid: user.uid, setupKey, claimedAt: serverTimestamp() });
try {
  await batch.commit();
  console.log(`Administrator ready: ${email} (UID ${user.uid}). Sign in and open /dashboard.`);
  process.exit(0);
} catch (err) {
  console.error(err.code === "permission-denied"
    ? "Denied: the key is wrong, the first admin already exists, or the latest firestore.rules are not published yet."
    : err.message);
  process.exit(1);
}
