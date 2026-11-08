"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Inbox, MessageCircle, Plus, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMember } from "@/context/MemberContext";
import { startSupportMessage } from "@/lib/api";
import { formatDateTime, friendlyError } from "@/lib/utils";
import { Alert, Field, Spinner } from "./ui";
import SupportThread from "./SupportThread";

export default function ProfileMessageBox() {
  const { firebaseUser, profile } = useAuth();
  const { conversations, conversationsLoading, conversationsError, unreadConversations, isUnread } = useMember();
  const [selected, setSelected] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("message");
    if (id && /^support_[A-Za-z0-9_-]+$/.test(id)) setSelected(id);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!firebaseUser || !profile) return;
    setBusy(true); setError(null);
    try {
      const id = await startSupportMessage({ uid: firebaseUser.uid, name: profile.name }, subject, message);
      setSelected(id); setCompose(false); setSubject(""); setMessage("");
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  return (
    <section id="messages" className="card scroll-mt-24 overflow-hidden" aria-labelledby="profile-messages-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-sage/40 p-5 sm:p-6">
        <div><p className="eyebrow">Your message box</p><h2 id="profile-messages-title" className="mt-1 flex items-center gap-2 text-xl font-extrabold"><MessageCircle size={21} />Messages with admin {unreadConversations > 0 && <span className="badge badge-gold">{unreadConversations} new</span>}</h2><p className="mt-1 text-sm text-muted">All messages go to the NeighbourLink admin team. Replies appear here and in Updates.</p></div>
        <div className="flex gap-2"><button type="button" className="btn-primary !px-4 !py-2 !text-sm" onClick={() => { setCompose(v => !v); setSelected(null); }}><Plus size={15} />New message</button><Link href="/inbox" className="btn-outline !px-4 !py-2 !text-sm">Open inbox <ArrowRight size={14} /></Link></div>
      </div>
      {conversationsError && <div className="p-5"><Alert kind="error">{conversationsError}</Alert></div>}
      {compose ? <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
        <h3 className="font-extrabold">Message the admin team</h3>
        <Field label="Subject"><input className="input" value={subject} onChange={e => setSubject(e.target.value)} minLength={3} maxLength={160} required placeholder="What do you need help with?" /></Field>
        <Field label="Message"><textarea className="input" rows={4} value={message} onChange={e => setMessage(e.target.value)} minLength={2} maxLength={2000} required placeholder="Tell us what happened or ask your question…" /></Field>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex gap-2"><button type="submit" disabled={busy} className="btn-primary !py-2.5 !text-sm">{busy ? <Spinner /> : <Send size={15} />}Send to admin</button><button type="button" className="btn-ghost" onClick={() => setCompose(false)}>Cancel</button></div>
      </form> : selected ? <SupportThread key={selected} id={selected} compact onBack={() => setSelected(null)} /> : <div className="p-5 sm:p-6">
        {conversationsLoading ? <div className="skeleton h-24" /> : conversations.length === 0 ? <div className="flex items-start gap-3 rounded-2xl bg-sage/50 p-5"><Inbox size={25} className="shrink-0 text-bronze" /><div><p className="font-bold">No messages yet</p><p className="mt-1 text-sm text-muted">Ask about a listing, report a problem, or contact the team. We’ll reply here.</p></div></div> : <ul className="divide-y divide-line">{conversations.slice(0, 5).map(c => <li key={c.id}><button type="button" onClick={() => setSelected(c.id)} className="flex w-full items-start gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-sage/50"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isUnread(c) ? "bg-gold" : "bg-line"}`} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><span className="font-extrabold">{c.targetTitle}</span><span className="text-xs text-muted">{formatDateTime(c.lastMessageAt)}</span></span><span className="mt-1 block truncate text-sm text-muted">{c.lastSenderId === firebaseUser?.uid ? "You: " : "Admin: "}{c.lastMessage}</span>{c.closedBy && <span className="mt-1 inline-block text-xs font-bold text-muted">Closed</span>}</span></button></li>)}</ul>}
      </div>}
    </section>
  );
}
