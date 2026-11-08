"use client";

import { useMemo, useState } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { Inbox, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { useLiveList } from "@/lib/hooks";
import type { Conversation } from "@/lib/types";
import { formatDateTime, sortByTimestampDesc, toDate } from "@/lib/utils";
import SupportThread from "@/components/SupportThread";
import { Alert, CardSkeleton, EmptyState } from "@/components/ui";

export default function SupportInboxPanel({ initialThreadId }: { initialThreadId?: string }) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? "";
  const threads = useLiveList<Conversation>("admin-support-threads", () => query(collection(getDb(), "conversations"), where("kind", "==", "admin"), orderBy("lastMessageAt", "desc"), limit(500)), {
    fallback: () => query(collection(getDb(), "conversations"), where("kind", "==", "admin"), limit(500)),
    sort: rows => sortByTimestampDesc(rows, "lastMessageAt"),
  });
  const [selected, setSelected] = useState<string | null>(initialThreadId ?? null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "open" | "closed">("all");
  const [shown, setShown] = useState(25);
  const unread = (c: Conversation) => c.lastSenderId !== uid && (toDate(c.lastMessageAt)?.getTime() ?? 0) > (toDate(c.readAt?.[uid])?.getTime() ?? 0);
  const rows = useMemo(() => threads.data.filter(c => {
    if (filter === "unread" && !unread(c)) return false;
    if (filter === "open" && c.closedBy) return false;
    if (filter === "closed" && !c.closedBy) return false;
    const q = search.trim().toLowerCase();
    return !q || `${c.userName} ${c.targetTitle} ${c.lastMessage}`.toLowerCase().includes(q);
  }), [threads.data, filter, search, uid]);

  return <div className="space-y-4">
    <Alert kind="info">Member messages are routed here. Reply as the admin team; the member is notified in their profile Messages box and Updates.</Alert>
    <div className="card p-4"><div className="flex flex-wrap gap-2">{(["all", "unread", "open", "closed"] as const).map(f => <button key={f} type="button" className={`tab-btn !py-2 !text-xs ${filter === f ? "active" : ""}`} onClick={() => { setFilter(f); setShown(25); }}>{f[0].toUpperCase() + f.slice(1)}{f === "unread" ? ` (${threads.data.filter(unread).length})` : ""}</button>)}<label className="relative ml-auto min-w-52 flex-1 sm:max-w-xs"><span className="sr-only">Search member messages</span><Search size={15} className="absolute left-3 top-3 text-muted" /><input className="input !py-2 !pl-9 !text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member or subject…" /></label></div></div>
    {threads.error ? <Alert kind="error">{threads.error}</Alert> : threads.loading ? <CardSkeleton count={2} className="h-12" /> : <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-line bg-white xl:grid-cols-[300px_1fr]">
      <aside className={`${selected ? "hidden xl:block" : ""} border-line xl:border-r`}>
        {rows.length === 0 ? <div className="p-5"><EmptyState icon={Inbox} title="No matching messages" text="New member messages appear here automatically." /></div> : <ul className="max-h-[650px] overflow-y-auto">{rows.slice(0, shown).map(c => <li key={c.id}><button type="button" onClick={() => setSelected(c.id)} className={`block w-full border-b border-line p-4 text-left transition hover:bg-sage/50 ${selected === c.id ? "bg-sage" : ""}`}><span className="flex items-center gap-2"><span className="truncate text-sm font-extrabold">{c.userName}</span>{unread(c) && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-gold" aria-label="Unread" />}</span><span className="mt-1 block truncate text-xs font-bold text-bronze">{c.targetTitle}</span><span className="mt-1 block truncate text-xs text-muted">{c.lastMessage}</span><span className="mt-1 block text-[10px] text-muted">{formatDateTime(c.lastMessageAt)}{c.closedBy ? " · Closed" : ""}</span></button></li>)}{rows.length > shown && <li className="p-3"><button className="btn-ghost w-full border border-line !text-xs" onClick={() => setShown(n => n + 25)}>Load more</button></li>}</ul>}
      </aside>
      <section className={`${selected ? "" : "hidden xl:grid xl:place-items-center"} min-w-0`}>{selected ? <SupportThread key={selected} id={selected} adminMode onBack={() => setSelected(null)} onDeleted={() => setSelected(null)} /> : <div className="p-8 text-center text-sm text-muted"><Inbox size={30} className="mx-auto mb-2" />Select a member message to reply.</div>}</section>
    </div>}
  </div>;
}
