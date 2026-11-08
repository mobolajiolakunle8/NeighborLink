// Pure helpers shared by client and server code. No Firebase imports here.

export function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

/** Converts a Firestore Timestamp, Date, millisecond number or null into a Date. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
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
export function isEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function isPhone(value: string): boolean { return /^\+?[0-9\s-]{7,20}$/.test(value.trim()); }
export function isHttpUrl(value: string): boolean {
  try { const url = new URL(value.trim()); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}
/** Accepts only 6-digit hex colours, so admin input can never inject CSS. */
export function safeHex(value: string | undefined, fallback: string): string { return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback; }

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
  "storage/unauthorized": "You are not allowed to upload this file.",
  "storage/retry-limit-exceeded": "Upload timed out. Please try a smaller image.",
};

export type FirestoreProblemKind = "rules-not-deployed" | "api-disabled" | "database-missing" | "index-missing" | "offline" | "permission" | "not-configured" | "unknown";
export interface FirestoreProblem {
  kind: FirestoreProblemKind;
  /** Short, visitor-safe explanation. */
  message: string;
  /** Console link to create a missing index, when Firestore provides one. */
  indexUrl?: string;
  /** True when the site owner must finish Firebase setup (not a user mistake). */
  setupRequired: boolean;
}

function errorCode(err: unknown): string {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
}
function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) : "";
}

/** Explains why Firestore refused a read. The message text distinguishes setup problems. */
export function classifyFirestoreError(err: unknown): FirestoreProblem {
  const code = errorCode(err);
  const text = errorText(err);
  const lower = text.toLowerCase();

  if (code === "not-configured") return { kind: "not-configured", setupRequired: true, message: "Firebase configuration is missing from this deployment." };
  if (lower.includes("has not been used in project") || lower.includes("it is disabled") || lower.includes("service_disabled")) return { kind: "api-disabled", setupRequired: true, message: "Cloud Firestore hasn't been enabled for this Firebase project yet." };
  if (code === "not-found" && lower.includes("does not exist")) return { kind: "database-missing", setupRequired: true, message: "The Firestore database hasn't been created for this Firebase project yet." };
  if (code === "permission-denied" && lower.includes("missing or insufficient permissions")) return { kind: "rules-not-deployed", setupRequired: true, message: "Live content is unavailable because the Firestore security rules for this project haven't been published yet." };
  if (code === "failed-precondition" && lower.includes("index")) {
    const match = text.match(/https:\/\/console\.firebase\.google\.com\S+/);
    return { kind: "index-missing", setupRequired: true, indexUrl: match?.[0], message: "This list needs a Firestore index that is still being created." };
  }
  if (code === "unavailable" || code === "auth/network-request-failed") return { kind: "offline", setupRequired: false, message: ERROR_MESSAGES.unavailable };
  if (code === "permission-denied") return { kind: "permission", setupRequired: false, message: ERROR_MESSAGES["permission-denied"] };
  return { kind: "unknown", setupRequired: false, message: friendlyError(err) };
}

/** Sorts newest first by a Firestore timestamp field, for client-side fallbacks. */
export function sortByTimestampDesc<T>(items: T[], field: keyof T): T[] {
  return [...items].sort((a, b) => (toDate(b[field])?.getTime() ?? 0) - (toDate(a[field])?.getTime() ?? 0));
}

/** Maps Firebase and application errors to a message that is safe to show users. */
export function friendlyError(err: unknown): string {
  const code = errorCode(err);
  const text = errorText(err).toLowerCase();
  if (code === "permission-denied" && (text.includes("has not been used") || text.includes("it is disabled"))) return "Cloud Firestore hasn't been enabled for this Firebase project yet.";
  if (code === "permission-denied" && text.includes("missing or insufficient permissions")) return "Live content is unavailable until the site's Firestore security rules are published.";
  if (code === "not-found" && text.includes("does not exist")) return "The Firestore database hasn't been created for this project yet.";
  if (code === "failed-precondition" && text.includes("index")) return "This list needs a Firestore index that is still being created. Please try again in a few minutes.";
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (err instanceof Error && err.message && !code.startsWith("auth/") && !code.startsWith("storage/")) return err.message;
  return "Something went wrong. Please try again.";
}

/** Google Maps directions link (no API key needed). */
export function directionsUrl(name: string, address: string | null | undefined, area: string): string {
  const q = [name, address, area, "Ibadan", "Nigeria"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
/** Converts a Nigerian phone number to WhatsApp's international format, or null if invalid. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let n = phone.replace(/[^0-9]/g, "");
  if (n.startsWith("0") && n.length === 11) n = `234${n.slice(1)}`;
  return /^234[789][01][0-9]{8}$/.test(n) ? n : null;
}
/** Simple spam/scam signal check for moderation. Returns the matched phrases. */
export const SPAM_PHRASES = [
  "send money", "transfer", "bank details", "account number", "bvn", "otp", "pin", "bitcoin", "crypto",
  "investment", "double your", "loan", "western union", "gift card", "click this link", "whatsapp me", "urgent payment",
];
export function spamSignals(text: string): string[] {
  const t = text.toLowerCase();
  return SPAM_PHRASES.filter((p) => new RegExp(`\\b${p.replace(/\s+/g, "\\s+")}\\b`).test(t));
}

export function hasBusinessLocation(b: { latitude?: number | null; longitude?: number | null }): boolean {
  return typeof b.latitude === "number" && typeof b.longitude === "number" && Number.isFinite(b.latitude) && Number.isFinite(b.longitude) && Math.abs(b.latitude) <= 90 && Math.abs(b.longitude) <= 180;
}
export function coordinatesDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}
