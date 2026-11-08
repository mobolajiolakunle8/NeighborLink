"use client";

import Link from "next/link";
import { useState } from "react";
import { Inbox, LockKeyhole, LogIn, MessageCircle, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMember } from "@/context/MemberContext";
import { formatDateTime } from "@/lib/utils";
import { Alert, EmptyState } from "./ui";
import SupportThread from "./SupportThread";

export default function InboxView({ activeId }: { activeId?: string }) {
  const { firebaseUser, loading } = useAuth();
  const { conversations, conversationsLoading, conversationsError, isUnread } = useMember();
  const [search, setSearch] = useState("");
  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10"><div className="skeleton h-[480px]" /></div>;
  if (!firebaseUser) return <div className="mx-auto max-w-lg px-4 py-16"><EmptyState icon={LogIn} title="Log in to see your messages" action={<Link href="/login?next=/inbox" className="btn-primary">Log in</Link>} /></div>;
  const rows = conversations.filter(c => `${c.targetTitle} ${c.lastMessage}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Admin support</p><h1 className="section-title mt-2">Your messages</h1><p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><LockKeyhole size={14} />Messages go to the admin team. Replies also appear in your profile message box.</p></div><Link href="/profile#messages" className="btn-primary !py-2.5 !text-sm"><Plus size={15} />New message</Link></div>
      <div className="mt-6 grid min-h-[520px] overflow-hidden rounded-3xl border border-line bg-white lg:grid-cols-[320px_1fr]">
        <aside className={`${activeId ? "hidden lg:block" : ""} border-line lg:border-r`} aria-label="Conversations">
          <div className="border-b border-line p-3"><input className="input !py-2 !text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages…" aria-label="Search messages" /></div>
          {conversationsLoading ? <div className="p-4"><div className="skeleton h-24" /></div> : conversationsError ? <div className="p-4"><Alert kind="error">{conversationsError}</Alert></div> : rows.length === 0 ? <div className="p-8 text-center text-sm text-muted"><MessageCircle className="mx-auto mb-2" size={26} />No messages yet. Use “New message” to contact the admin team.</div> : <ul className="max-h-[600px] overflow-y-auto">{rows.map(c => <li key={c.id}><Link href={`/inbox/${c.id}`} className={`block border-b border-line px-5 py-4 transition hover:bg-sage/50 ${activeId === c.id ? "bg-sage" : ""}`}><div className="flex items-center gap-2"><p className="truncate font-extrabold">{c.targetTitle}</p>{isUnread(c) && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-gold" aria-label="Unread" />}</div><p className="mt-0.5 truncate text-sm text-muted">{c.closedBy ? "Closed · " : ""}{c.lastSenderId === firebaseUser.uid ? "You: " : "Admin: "}{c.lastMessage}</p><p className="mt-1 text-[10px] text-muted">{formatDateTime(c.lastMessageAt)}</p></Link></li>)}</ul>}
        </aside>
        <section className={`${activeId ? "" : "hidden lg:grid lg:place-items-center"} min-w-0`}>{activeId ? <SupportThread key={activeId} id={activeId} /> : <div className="p-10 text-center text-muted"><Inbox className="mx-auto mb-2" size={30} />Select a conversation.</div>}</section>
      </div>
    </div>
  );
}
