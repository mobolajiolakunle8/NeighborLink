"use client";

import { collection, limit, query, where } from "firebase/firestore";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { useLiveList } from "@/lib/hooks";
import type { Conversation } from "@/lib/types";
import { toDate } from "@/lib/utils";

export default function AdminMessagesButton({ onClick }: { onClick: () => void }) {
  const { firebaseUser, isAdmin } = useAuth();
  const uid = firebaseUser?.uid ?? "";
  const threads = useLiveList<Conversation>(isAdmin ? "admin-message-badge" : null, () => query(collection(getDb(), "conversations"), where("kind", "==", "admin"), limit(500)));
  const unread = threads.data.filter(c => c.lastSenderId !== uid && (toDate(c.lastMessageAt)?.getTime() ?? 0) > (toDate(c.readAt?.[uid])?.getTime() ?? 0)).length;
  return <button type="button" onClick={onClick} className={unread ? "btn-gold !py-2.5 !text-sm" : "btn-outline !py-2.5 !text-sm"}><MessageCircle size={16} />Member messages{unread > 0 && <span className="rounded-full bg-forest px-2 py-0.5 text-xs text-cream">{unread}</span>}</button>;
}
