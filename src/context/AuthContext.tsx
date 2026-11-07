"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuthClient, getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

type AuthValue = {
  firebaseUser: User | null;
  profile: UserProfile | null;
  /** True while the auth session or the user's profile is still loading. */
  loading: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Tracks the Firebase Auth session and subscribes to the signed-in user's private
 * profile, so role changes and suspensions take effect in real time.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthReady(true);
      return undefined;
    }
    return onAuthStateChanged(getAuthClient(), (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setProfileReady(true);
      } else {
        setProfileReady(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    return onSnapshot(
      doc(getDb(), "users", firebaseUser.uid),
      (snap) => {
        setProfile(snap.exists() ? ({ ...(snap.data() as object), id: snap.id, uid: snap.id } as UserProfile) : null);
        setProfileReady(true);
      },
      () => setProfileReady(true),
    );
  }, [firebaseUser]);

  // A suspended account is signed out immediately, wherever it is open.
  useEffect(() => {
    if (profile?.isSuspended) signOut(getAuthClient()).catch(() => undefined);
  }, [profile]);

  const value = useMemo<AuthValue>(
    () => ({
      firebaseUser,
      profile,
      loading: !authReady || (!!firebaseUser && !profileReady),
      isSignedIn: !!firebaseUser,
      isAdmin: profile?.role === "admin" && !profile.isSuspended,
      logout: async () => {
        await signOut(getAuthClient());
      },
    }),
    [firebaseUser, profile, authReady, profileReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
