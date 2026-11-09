"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getIdTokenResult, onIdTokenChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuthClient, getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

type AuthValue = {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  /** True only when the current ID token proves a second factor was used. */
  mfaVerified: boolean;
  /** Site-wide flag set by an MFA-verified administrator. */
  adminMfaRequired: boolean;
  emailVerified: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function hasSecondFactor(user: User): Promise<boolean> {
  const result = await getIdTokenResult(user);
  const firebase = result.claims.firebase as Record<string, unknown> | undefined;
  const second = (result as { signInSecondFactor?: string | null }).signInSecondFactor
    ?? firebase?.sign_in_second_factor;
  return Boolean(second && firebase?.second_factor_identifier);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [adminMfaRequired, setAdminMfaRequired] = useState(false);

  // ID-token listener refreshes MFA status after enrolment or challenge completion.
  useEffect(() => {
    if (!isFirebaseConfigured) { setAuthReady(true); return undefined; }
    return onIdTokenChanged(getAuthClient(), user => {
      setFirebaseUser(user);
      setAuthReady(true);
      setEmailVerified(Boolean(user?.emailVerified));
      if (!user) {
        setProfile(null); setProfileReady(true); setMfaVerified(false);
      } else {
        setProfileReady(false);
        hasSecondFactor(user).then(setMfaVerified).catch(() => setMfaVerified(false));
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    return onSnapshot(doc(getDb(), "users", firebaseUser.uid), snap => {
      setProfile(snap.exists() ? ({ ...(snap.data() as object), id: snap.id, uid: snap.id } as UserProfile) : null);
      setProfileReady(true);
    }, () => setProfileReady(true));
  }, [firebaseUser]);

  // Public, non-sensitive security flag. Rules enforce it server-side too.
  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return onSnapshot(doc(getDb(), "config", "security"), snap => {
      setAdminMfaRequired(snap.data()?.requireAdminMfa === true);
    }, () => setAdminMfaRequired(false));
  }, []);

  // A suspended account is signed out immediately in every open tab.
  useEffect(() => { if (profile?.isSuspended) signOut(getAuthClient()).catch(() => undefined); }, [profile]);

  const value = useMemo<AuthValue>(() => ({
    firebaseUser, profile,
    loading: !authReady || (!!firebaseUser && !profileReady),
    isSignedIn: !!firebaseUser,
    isAdmin: profile?.role === "admin" && !profile.isSuspended && emailVerified && (!adminMfaRequired || mfaVerified),
    mfaVerified, adminMfaRequired, emailVerified,
    logout: async () => { await signOut(getAuthClient()); },
  }), [firebaseUser, profile, authReady, profileReady, mfaVerified, adminMfaRequired, emailVerified]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
