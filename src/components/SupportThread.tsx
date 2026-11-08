"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { ArrowLeft, CheckCheck, LockKeyhole, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { useLiveDoc, useLiveList } from "@/lib/hooks";
import { deleteConversation, markConversationRead, sendMessage, setConversationClosed } from "@/lib/api";
import type { ChatMessage, Conversation } from "@/lib/types";
import { formatDateTime, friendlyError, toDate } from "@/lib/utils";
import { Alert, EmptyState, Spinner } from "./ui";

type LegacyThread = Conversation & { kind?: string; initiatorId?: string; recipientName?: string; initiatorName?: string };

export default function SupportThread({ id, adminMode = false, compact = false, onBack, onDeleted }: { id: string; adminMode?: boolean; compact?: boolean; onBack?: () => void; onDeleted?: () => void }) {
  const { firebaseUser, isAdmin } = useAuth();
  const uid = firebaseUser?.uid ?? "";
  const thread = useLiveDoc<LegacyThread>(`conversations/${id}`);
  const c = thread.data;
  const legacy = !!c && c.kind !== "admin";
  const allowed = !!c && (legacy ? c.members.includes(uid) : adminMode ? isAdmin : c.userId === uid || isAdmin);
  const messages = useLiveList<ChatMessage>(allowed ? `support-msgs-${uid}-${id}` : null, () => query(collection(getDb(), "conversations", id, "messages"), orderBy("createdAt", "desc"), limit(150)));
  const ordered = useMemo(() => [...messages.data].reverse(), [messages.data]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastAt = toDate(c?.lastMessageAt)?.getTime() ?? 0;
  const readAt = toDate(c?.readAt?.[uid])?.getTime() ?? 0;

  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [ordered.length]);
  useEffect(() => {
    if (c && !legacy && allowed && c.lastSenderId !== uid && lastAt > readAt) void markConversationRead(id, uid);
  }, [c, legacy, allowed, id, uid, lastAt, readAt]);

  if (thread.loading) return <div className="p-5"><div className="skeleton h-72" /></div>;
  if (!c || !allowed) return <div className="p-5"><EmptyState icon={LockKeyhole} title="Conversation unavailable" text="It may have been deleted or belong to another account." /></div>;
  const memberUid = legacy ? c.initiatorId ?? "" : c.userId;
  const memberName = legacy ? c.initiatorName ?? "Member" : c.userName;
  const memberRead = toDate(c.readAt?.[memberUid])?.getTime() ?? 0;
  const sourceHref = c.targetType === "business" && c.targetId ? `/business/${c.targetId}` : c.targetType === "help" ? "/help" : null;

  async function send(e: FormEvent) {
    e.preventDefault(); if (!text.trim() || legacy) return;
    setBusy(true); setError(null);
    try { await sendMessage(id, uid, text); setText(""); }
    catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  async function close() {
    setError(null);
    try { await setConversationClosed(id, uid, !c!.closedBy); setNotice(c!.closedBy ? "Conversation reopened." : "Conversation closed."); }
    catch (err) { setError(friendlyError(err)); }
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-white">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line p-4">
        <div className="min-w-0">
          {onBack && <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-muted"><ArrowLeft size={13} />Back to messages</button>}
          <p className="truncate font-extrabold">{adminMode ? memberName : "NeighbourLink admin team"}</p>
          <p className="truncate text-xs font-bold text-bronze">{c.targetTitle}</p>
          {sourceHref && <Link href={sourceHref} className="text-[11px] underline">View related page</Link>}
        </div>
        {!legacy && <div className="flex gap-1.5">
          {(!c.closedBy || c.closedBy === uid) && <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={close}>{c.closedBy ? "Reopen" : "Close"}</button>}
          {!compact && <button type="button" aria-label="Delete conversation" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={async () => {
            if (!confirm("Delete this conversation and its messages? This cannot be undone.")) return;
            try { await deleteConversation(id); onDeleted?.(); } catch (err) { setError(friendlyError(err)); }
          }}><Trash2 size={13} /></button>}
        </div>}
      </header>
      <div className={`flex flex-col gap-3 overflow-y-auto p-4 ${compact ? "h-[280px]" : "h-[420px] flex-1"}`} role="log" aria-label="Conversation messages" aria-live="polite">
        {legacy && <Alert kind="warning">This is an older conversation and is now read-only. Start a new message to contact the admin team.</Alert>}
        {messages.loading && <p className="text-center text-xs text-muted">Loading messages…</p>}
        {messages.error && <Alert kind="error">{messages.error}</Alert>}
        {ordered.map(m => {
          const mine = m.senderId === uid;
          const fromAdmin = !legacy && m.senderId !== memberUid;
          const read = mine && (fromAdmin || adminMode ? memberRead >= (toDate(m.createdAt)?.getTime() ?? Infinity) : Object.entries(c.readAt ?? {}).some(([key, value]) => key !== memberUid && (toDate(value)?.getTime() ?? 0) >= (toDate(m.createdAt)?.getTime() ?? Infinity)));
          return <div key={m.id} className={`max-w-[85%] ${mine ? "self-end" : "self-start"}`}>
            {!mine && <p className="mb-1 text-[10px] font-bold text-muted">{fromAdmin ? "Admin team" : adminMode ? memberName : "Member"}</p>}
            <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${mine ? "rounded-br-sm bg-forest text-cream" : "rounded-bl-sm bg-sage"}`}>{m.text}</div>
            <p className={`mt-1 flex items-center gap-1 text-[10px] text-muted ${mine ? "justify-end" : ""}`}>{formatDateTime(m.createdAt)}{read && <><CheckCheck size={12} />Read</>}</p>
          </div>;
        })}
        <div ref={bottom} />
      </div>
      <div className="border-t border-line p-4">
        {error && <div className="mb-2"><Alert kind="error">{error}</Alert></div>}
        {notice && <div className="mb-2"><Alert kind="success">{notice}</Alert></div>}
        {legacy ? <Link href="/profile#messages" className="btn-primary !py-2 !text-sm">Message admin</Link> : c.closedBy ? <p className="rounded-xl bg-sage p-3 text-sm text-muted">{c.closedBy === uid ? "You closed this conversation. Reopen it to continue." : "This conversation was closed. Start a new message if you still need help."}</p> : <form onSubmit={send}>
          <label className="sr-only" htmlFor={`reply-${id}`}>{adminMode ? "Reply to member" : "Message to admin"}</label>
          <div className="flex items-end gap-2"><textarea id={`reply-${id}`} rows={2} maxLength={2000} className="input" value={text} onChange={e => setText(e.target.value)} placeholder={adminMode ? "Write your reply as the admin team…" : "Write to the admin team…"} /><button type="submit" disabled={busy || !text.trim()} className="btn-primary !p-3.5" aria-label={adminMode ? "Send reply" : "Send to admin"}>{busy ? <Spinner /> : <Send size={18} />}</button></div>
          <p className="mt-2 text-[11px] text-muted">{adminMode ? "The member will be notified in their profile Messages box and Updates." : "Only you and the admin team can read this. Never share OTPs, PINs or bank details."}</p>
        </form>}
      </div>
    </div>
  );
}
