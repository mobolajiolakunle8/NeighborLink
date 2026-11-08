// Firebase client bootstrap. Every service is created lazily so that importing this
// module on the server (during SSR or the build) never touches the network.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import webConfig from "@/config/firebase.web.json";

/** Web app configuration, read from NEXT_PUBLIC_* variables. These are public identifiers. */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || webConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || webConfig.authDomain,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || webConfig.databaseURL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || webConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || webConfig.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || webConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || webConfig.appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || webConfig.measurementId,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured. Check .env.local for local development, or .env.production / Vercel build-time environment variables for deployment.");
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}
export function getAuthClient(): Auth { if (!auth) auth = getAuth(getFirebaseApp()); return auth; }
export function getDb(): Firestore {
  if (!db) {
    const instance = getFirebaseApp();
    if (typeof window === "undefined") db = getFirestore(instance);
    else {
      try { db = initializeFirestore(instance, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
      catch { db = getFirestore(instance); }
    }
  }
  return db;
}
export function getStorageClient(): FirebaseStorage { if (!storage) storage = getStorage(getFirebaseApp()); return storage; }
/** Google Analytics runs only in supported browsers and only when a measurementId is set. */
export async function initAnalytics() {
  if (typeof window === "undefined" || !isFirebaseConfigured || !firebaseConfig.measurementId) return null;
  if (!(await isSupported())) return null;
  return getAnalytics(getFirebaseApp());
}
