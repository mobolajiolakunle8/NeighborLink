// Serves the Firebase Messaging service worker with the project's public web config
// injected from environment variables, so the config is never hard-coded twice.
export const dynamic = "force-dynamic";

export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const body = [
    'importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");',
    'importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");',
    `firebase.initializeApp(${JSON.stringify(config)});`,
    "const messaging = firebase.messaging();",
    "messaging.onBackgroundMessage(function (payload) {",
    "  var n = payload.notification || {};",
    '  self.registration.showNotification(n.title || "NeighbourLink", {',
    '    body: n.body || "New update from NeighbourLink",',
    '    data: { url: (payload.fcmOptions && payload.fcmOptions.link) || "/" }',
    "  });",
    "});",
    'self.addEventListener("notificationclick", function (event) {',
    "  event.notification.close();",
    '  var url = (event.notification.data && event.notification.data.url) || "/";',
    "  event.waitUntil(clients.openWindow(url));",
    "});",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
