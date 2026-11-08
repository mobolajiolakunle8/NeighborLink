#!/usr/bin/env node
// Standalone CLI script to create or promote an administrator account.
// Uses the client SDK with the Admin Setup Key, so it runs without service-account credentials.
//
// Usage:
//   node scripts/setup-admin.mjs <email> <password> [setupKey]
// Example:
//   node scripts/setup-admin.mjs admin@neighbourlink.ng AdminPassword123!

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webConfig = JSON.parse(readFileSync(join(__dirname, "../src/config/firebase.web.json"), "utf8"));

const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;
const setupKey = process.argv[4] || process.env.ADMIN_SETUP_KEY || "NEIGHBOURLINK_ADMIN_2026";

if (!email || !password) {
  console.log(`
NeighbourLink — Administrator Setup Script

Usage:
  node scripts/setup-admin.mjs <email> <password> [setupKey]

Example:
  node scripts/setup-admin.mjs admin@neighbourlink.ng AdminPass123!

Or set environment variables:
  ADMIN_EMAIL=admin@neighbourlink.ng ADMIN_PASSWORD=AdminPass123! node scripts/setup-admin.mjs
`);
  process.exit(1);
}

const app = initializeApp(webConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log(`[setup-admin] Project: ${webConfig.projectId}`);
console.log(`[setup-admin] Target email: ${email}`);

let user;
try {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  user = cred.user;
  console.log(`[setup-admin] Signed in to existing account (UID: ${user.uid})`);
} catch (err) {
  if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
    console.log(`[setup-admin] Account does not exist yet. Creating...`);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      user = cred.user;
      console.log(`[setup-admin] Created new account (UID: ${user.uid})`);
    } catch (createErr) {
      console.error(`[setup-admin] Failed to create account:`, createErr.message);
      process.exit(1);
    }
  } else {
    console.error(`[setup-admin] Authentication error:`, err.message);
    process.exit(1);
  }
}

try {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: "Administrator",
    email: email.trim(),
    role: "admin",
    adminSetupKey: setupKey.trim(),
    phone: null,
    neighbourhood: null,
    avatarUrl: null,
    bio: null,
    isSuspended: false,
    fcmTokens: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  console.log(`
==================================================
 SUCCESS: Administrator Account Configured
==================================================
 Email:   ${email}
 UID:     ${user.uid}
 Role:    admin
 Project: ${webConfig.projectId}
==================================================

You can now:
1. Open the website: /login
2. Sign in with ${email}
3. Open /dashboard to manage NeighbourLink
`);
  process.exit(0);
} catch (err) {
  console.error(`\n[setup-admin] Firestore write error:`, err.message);
  if (err.code === "permission-denied") {
    console.error(`
NOTE: Firestore returned 'permission-denied'.
This means firestore.rules has not been deployed to Firebase Console yet.
To deploy rules:
  1. Open Firebase Console -> Firestore Database -> Rules
  2. Paste the contents of firestore.rules and click Publish
  3. Re-run this script: node scripts/setup-admin.mjs ${email} <password>
`);
  }
  process.exit(1);
}
