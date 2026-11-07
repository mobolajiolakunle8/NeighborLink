// Firebase Cloud Messaging (web push). The user opts in, the browser issues a token,
// and the token is stored on their private profile. Sending pushes is done by a
// trusted backend (Cloud Functions / Admin SDK), never from the browser.
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDb, getFirebaseApp } from "./firebase";

export const PUSH_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

export async function enablePushNotifications(uid: string): Promise<string> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Push notifications are not configured yet. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY.");
  }
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Your browser doesn't support push notifications.");
  }
  if (!(await isSupported())) throw new Error("Push notifications are not supported in this browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(getMessaging(getFirebaseApp()), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Could not create a notification token. Please try again.");

  await updateDoc(doc(getDb(), "users", uid), { fcmTokens: arrayUnion(token), updatedAt: serverTimestamp() });
  return token;
}
