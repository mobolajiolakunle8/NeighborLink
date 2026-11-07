// Pure helpers shared by client and server code. No Firebase imports here.

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

/** Converts a Firestore Timestamp, Date, millisecond number or null into a Date. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function formatDate(value: unknown, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-NG", options) : "—";
}

export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d ? d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isPhone(value: string): boolean {
  return /^\+?[0-9\s-]{7,20}$/.test(value.trim());
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Accepts only 6-digit hex colours, so admin input can never inject CSS. */
export function safeHex(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Client-side image validation. Storage rules enforce the same limits server-side. */
export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Please upload a JPG, PNG, WEBP or GIF image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 5 MB or smaller.";
  return null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "permission-denied": "You don't have permission to do that.",
  unavailable: "We couldn't reach the server. Check your connection and try again.",
  "not-found": "That item no longer exists.",
  "resource-exhausted": "Too many requests. Please wait a moment and try again.",
  "failed-precondition": "This action isn't available right now. Please refresh and try again.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
  "auth/weak-password": "Password must be at least 8 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/requires-recent-login": "For your security, please log out, log in again and retry.",
  "auth/invalid-api-key": "The Firebase API key is invalid. Check your environment variables.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase yet.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "The Firebase API key is invalid. Check the NEXT_PUBLIC_FIREBASE_* settings.",
  "auth/configuration-not-found": "Firebase Authentication isn't set up yet. Site owner: enable Email/Password sign-in in the Firebase Console.",
  "auth/unauthorized-domain": "This website address isn't authorised in Firebase yet. Site owner: add it under Authentication → Settings → Authorized domains.",
  "auth/unauthorized-continue-uri": "This website address isn't authorised in Firebase yet. Site owner: add it under Authentication → Settings → Authorized domains.",
  "storage/unauthorized": "You are not allowed to upload this file.",
  "storage/retry-limit-exceeded": "Upload timed out. Please try a smaller image.",
};

/** Project-setup problems get explicit, actionable messages instead of a misleading generic one. */
const SETUP_PATTERNS: Array<[RegExp, string]> = [
  [
    /has not been used in project|SERVICE_DISABLED|before or it is disabled/i,
    "NeighbourLink's database isn't switched on yet. Site owner: create Cloud Firestore in the Firebase Console, then refresh.",
  ],
  [
    /database \(default\) does not exist|does not exist for project/i,
    "NeighbourLink's database hasn't been created yet. Site owner: create Cloud Firestore in the Firebase Console, then refresh.",
  ],
  [
    /requires an index|index is currently building/i,
    "This list is still being prepared while a database index builds. Please try again in a few minutes.",
  ],
];

/** Maps Firebase and application errors to a message that is safe to show users. */
export function friendlyError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
  const message =
    typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) : "";
  for (const [pattern, text] of SETUP_PATTERNS) {
    if (pattern.test(message)) return text;
  }
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  // Errors thrown by our own code (validation etc.) carry no Firebase code and are written for users.
  if (!code && message) return message;
  return "Something went wrong. Please try again.";
}
