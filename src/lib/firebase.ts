// Firebase client bootstrap. Every service is created lazily so that importing this
// module on the server (during SSR or the build) never touches the network.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

/**
 * Web app configuration, read from NEXT_PUBLIC_* variables (.env.local locally,
 * apphosting.yaml on Firebase App Hosting). These identify the project and are safe
 * to ship to browsers. They are NOT secrets — rules protect the data.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* variables to .env.local.");
  }
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getAuthClient(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

/**
 * Firestore with offline persistence and multi-tab sync in the browser, so a user
 * with several tabs open sees one consistent, live view of the data.
 */
export function getDb(): Firestore {
  if (!db) {
    const instance = getFirebaseApp();
    if (typeof window === "undefined") {
      db = getFirestore(instance);
    } else {
      try {
        db = initializeFirestore(instance, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
      } catch {
        // Already initialised (e.g. hot reload) — reuse the existing instance.
        db = getFirestore(instance);
      }
    }
  }
  return db;
}

export function getStorageClient(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp());
  return storage;
}

/** Google Analytics runs only in supported browsers and only when a measurementId is set. */
export async function initAnalytics() {
  if (typeof window === "undefined" || !isFirebaseConfigured || !firebaseConfig.measurementId) return null;
  if (!(await isSupported())) return null;
  return getAnalytics(getFirebaseApp());
}
