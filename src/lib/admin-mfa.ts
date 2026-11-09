// Administrator multi-factor authentication (TOTP) helpers.
// Firebase Auth must have TOTP MFA enabled in the project (Identity Platform).
// Firestore rules additionally require a second-factor claim for privileged admin
// writes once config/security.requireAdminMfa is enabled.
import {
  EmailAuthProvider,
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
  getIdTokenResult,
  multiFactor,
  reauthenticateWithCredential,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from "firebase/auth";
import { getAuthClient } from "./firebase";

let pendingResolver: MultiFactorResolver | null = null;
let pendingSecret: TotpSecret | null = null;

export function hasPendingMfaChallenge() { return pendingResolver !== null; }

export async function adminSignInStep(email: string, password: string): Promise<User | "MFA_REQUIRED"> {
  const auth = getAuthClient();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code === "auth/multi-factor-auth-required") {
      pendingResolver = getMultiFactorResolver(auth, err as Parameters<typeof getMultiFactorResolver>[1]);
      return "MFA_REQUIRED";
    }
    throw err;
  }
}

export async function completeMfaSignIn(otp: string): Promise<User> {
  if (!pendingResolver) throw new Error("The sign-in challenge expired. Please try again.");
  const hint = pendingResolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) throw new Error("No authenticator-app factor is enrolled on this account.");
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, otp.trim());
  try {
    const result = await pendingResolver.resolveSignIn(assertion);
    pendingResolver = null;
    return result.user;
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code === "auth/invalid-verification-code") throw new Error("That one-time code is incorrect or expired. Try again.");
    throw err;
  }
}

/** Returns true only when the current ID token proves a second factor was used. */
export async function hasSecondFactor(user: User): Promise<boolean> {
  const result = await getIdTokenResult(user);
  const firebaseClaims = result.claims.firebase as Record<string, unknown> | undefined;
  return Boolean(result.signInSecondFactor && firebaseClaims?.second_factor_identifier);
}

export interface TotpEnrollment {
  secretKey: string;
  qrUri: string;
}

/** Requires a fresh password, then generates a secret for an authenticator app. */
export async function beginTotpEnrollment(user: User, password: string): Promise<TotpEnrollment> {
  if (!user.email) throw new Error("Please verify your email before setting up MFA.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  pendingSecret = secret;
  return {
    secretKey: secret.secretKey,
    qrUri: secret.generateQrCodeUrl(user.email, "NeighbourLink Admin"),
  };
}

export async function finishTotpEnrollment(user: User, otp: string): Promise<void> {
  if (!pendingSecret) throw new Error("Start the authenticator setup first.");
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(pendingSecret, otp.trim());
  try {
    await multiFactor(user).enroll(assertion, "NeighbourLink admin");
    pendingSecret = null;
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code === "auth/invalid-verification-code") throw new Error("That one-time code is incorrect or expired. Try again.");
    throw err;
  }
}

export function enrolledFactorCount(user: User): number {
  return multiFactor(user).enrolledFactors.length;
}

/** SHA-256 of a lowercased email. Used as the private account-ban document ID. */
export async function emailKey(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
