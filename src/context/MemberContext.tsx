"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { getDb } from "@/lib/firebase";
import { useLiveList } from "@/lib/hooks";
import { sortByTimestampDesc, toDate } from "@/lib/utils";
import type { AppNotification, Conversation, SavedBusiness } from "@/lib/types";

type MemberValue = {
  savedIds: Set<string>;
  saved: SavedBusiness[];
  savedLoading: boolean;
  notifications: AppNotification[];
  notificationsLoading: boolean;
  unreadNotifications: number;
  conversations: Conversation[];
  conversationsLoading: boolean;
  conversationsError: string | null;
  unreadConversations: number;
  isUnread: (c: Conversation) => boolean;
};

const MemberContext = createContext<MemberValue | null>(null);

/** One live subscription per signed-in member for saved items, notifications and inbox. */
export function MemberProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser && profile && !profile.isSuspended ? firebaseUser.uid : null;

  const saved = useLiveList<SavedBusiness>(uid ? `saved-${uid}` : null, () =>
    query(collection(getDb(), "users", uid!, "saved"), orderBy("savedAt", "desc")),
  );
  const notifications = useLiveList<AppNotification>(uid ? `notes-${uid}` : null, () =>
    query(collection(getDb(), "users", uid!, "notifications"), orderBy("createdAt", "desc"), limit(50)),
  );
  const conversations = useLiveList<Conversation>(
    uid ? `convs-${uid}` : null,
    () => query(collection(getDb(), "conversations"), where("kind", "==", "admin"), where("userId", "==", uid), orderBy("lastMessageAt", "desc"), limit(100)),
    {
      fallback: () => query(collection(getDb(), "conversations"), where("kind", "==", "admin"), where("userId", "==", uid), limit(100)),
      sort: (rows) => sortByTimestampDesc(rows, "lastMessageAt"),
    },
  );

  const value = useMemo<MemberValue>(() => {
    const isUnread = (c: Conversation) =>
      !!uid && c.lastSenderId !== uid && (toDate(c.lastMessageAt)?.getTime() ?? 0) > (toDate(c.readAt?.[uid])?.getTime() ?? 0);
    return {
      savedIds: new Set(saved.data.map((s) => s.businessId)),
      saved: saved.data,
      savedLoading: saved.loading,
      notifications: notifications.data,
      notificationsLoading: notifications.loading,
      unreadNotifications: notifications.data.filter((n) => !n.read).length,
      conversations: conversations.data,
      conversationsLoading: conversations.loading,
      conversationsError: conversations.error,
      unreadConversations: conversations.data.filter(isUnread).length,
      isUnread,
    };
  }, [uid, saved.data, saved.loading, notifications.data, notifications.loading, conversations.data, conversations.loading, conversations.error]);

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

export function useMember(): MemberValue {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMember must be used within MemberProvider");
  return ctx;
}
