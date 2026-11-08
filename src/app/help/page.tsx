"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { HandHeart, HeartHandshake, MapPin, Phone, ShieldAlert, Trash2, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList, useNotice, usePagination } from "@/lib/hooks";
import { createHelpPost, deleteHelpPost, setHelpStatus, type HelpInput } from "@/lib/api";
import type { HelpPost } from "@/lib/types";
import { friendlyError, formatDate } from "@/lib/utils";
import { Alert, CardSkeleton, EmptyState, Field, Pagination, Spinner, StatusBadge } from "@/components/ui";
import SetupNotice from "@/components/SetupNotice";
import { Reveal } from "@/components/motion";
import { MessageButton } from "@/components/MemberActions";

const PAGE_SIZE = 12;
const HELP_CATEGORIES = ["General", "Errands", "Skills & tutoring", "Food & supplies", "Transport", "Home repairs", "Childcare", "Elderly care", "Other"];
const EMPTY: HelpInput = { type: "request", title: "", description: "", category: "General", neighbourhoodId: "", contactPhone: "" };

export default function HelpPage() {
  const { firebaseUser, profile } = useAuth();
  const { activeNeighbourhoods, neighbourhoodName } = useSite();
  const { notice, show } = useNotice();
  const posts = useLiveList<HelpPost>("help-all", () => query(collection(getDb(), "helpPosts"), orderBy("createdAt", "desc"), limit(300)));
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [hoodFilter, setHoodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<HelpInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("type")) setTypeFilter(p.get("type") ?? ""); }, []);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.data.filter(p => (!typeFilter || p.type === typeFilter) && (!statusFilter || p.status === statusFilter) && (!hoodFilter || p.neighbourhoodId === hoodFilter) && (!term || `${p.title} ${p.description}`.toLowerCase().includes(term)));
  }, [posts.data, typeFilter, statusFilter, hoodFilter, search]);
  const pager = usePagination(filtered, PAGE_SIZE);
  const { setPage } = pager;
  useEffect(() => setPage(1), [typeFilter, statusFilter, hoodFilter, search, setPage]);
  const set = <K extends keyof HelpInput>(key: K, value: HelpInput[K]) => setForm(f => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseUser) return;
    if (form.title.trim().length < 5) return setFormError("Title must be at least 5 characters.");
    if (form.description.trim().length < 20) return setFormError("Please describe it in at least 20 characters.");
    setFormError(null); setSaving(true);
    try { await createHelpPost({ uid: firebaseUser.uid, name: profile?.name ?? firebaseUser.displayName ?? "Neighbour" }, form); setForm(EMPTY); setShowForm(false); show("success", "Posted! Your neighbours can now see it."); }
    catch (err) { setFormError(friendlyError(err)); }
    finally { setSaving(false); }
  }
  async function run(action: () => Promise<void>, ok: string) { try { await action(); show("success", ok); } catch (err) { show("error", friendlyError(err)); } }
  const canManage = (p: HelpPost) => firebaseUser?.uid === p.userId || profile?.role === "admin";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Reveal variant="up"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Community help board</p><h1 className="section-title mt-2">Neighbours helping neighbours</h1><p className="mt-2 max-w-2xl text-muted">Request help or offer your time, skills and resources. Be kind, be safe, and never share sensitive financial details.</p></div>{firebaseUser ? <button type="button" onClick={() => setShowForm(o => !o)} aria-expanded={showForm} className="btn-gold"><HeartHandshake size={17} aria-hidden /> {showForm ? "Close" : "Post to board"}</button> : <Link href="/login" className="btn-gold"><HeartHandshake size={17} aria-hidden /> Log in to post</Link>}</div></Reveal>
      <div className="mt-4 flex gap-2 rounded-2xl border border-[#EAD9AE] bg-gold-soft px-4 py-3 text-sm font-semibold text-[#7A5A1E]"><ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />This board is not for emergencies. For emergencies call 112 (Police) or 122 (FRSC) immediately.</div>
      {notice && <div className="mt-4"><Alert kind={notice.kind}>{notice.text}</Alert></div>}
      {showForm && firebaseUser && <form onSubmit={onSubmit} noValidate className="card mt-6 space-y-4 p-6" aria-label="New help post"><h2 className="text-xl font-extrabold">New post</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="I want to…"><select className="input" value={form.type} onChange={e => set("type", e.target.value as HelpInput["type"])}><option value="request">Request help</option><option value="offer">Offer help</option></select></Field><Field label="Category"><select className="input" value={form.category} onChange={e => set("category", e.target.value)}>{HELP_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Title *" className="sm:col-span-2"><input className="input" maxLength={200} value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Need help moving a fridge this Saturday" /></Field><Field label="Details *" className="sm:col-span-2"><textarea className="input" rows={4} maxLength={3000} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe what you need or what you can offer…" /></Field><Field label="Neighbourhood"><select className="input" value={form.neighbourhoodId} onChange={e => set("neighbourhoodId", e.target.value)}><option value="">Anywhere in Ibadan</option>{activeNeighbourhoods.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field><Field label="Contact phone (optional — shown publicly)"><input className="input" inputMode="tel" value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} placeholder="+234…" /></Field></div>{formError && <Alert kind="error">{formError}</Alert>}<div className="flex gap-2"><button type="submit" disabled={saving} className="btn-primary">{saving ? <><Spinner /> Posting…</> : "Post to board"}</button><button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button></div></form>}
      <div className="card mt-6 grid gap-3 p-4 md:grid-cols-[1fr_170px_170px_200px_auto]"><label className="relative"><span className="sr-only">Search posts</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…" className="input" /></label><label><span className="sr-only">Type</span><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input"><option value="">Requests & offers</option><option value="request">Requests</option><option value="offer">Offers</option></select></label><label><span className="sr-only">Status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input"><option value="">All statuses</option><option value="open">Open</option><option value="fulfilled">Fulfilled</option><option value="closed">Closed</option></select></label><label><span className="sr-only">Neighbourhood</span><select value={hoodFilter} onChange={e => setHoodFilter(e.target.value)} className="input"><option value="">All neighbourhoods</option>{activeNeighbourhoods.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label><button type="button" className="btn-ghost border border-line" onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter("open"); setHoodFilter(""); }}>Reset</button></div>
      <p className="mt-6 text-sm font-bold text-muted" aria-live="polite">{posts.loading ? "Loading…" : `${filtered.length} post${filtered.length === 1 ? "" : "s"}`}</p>
      <div className="mt-4">{posts.problem ? <SetupNotice problem={posts.problem} /> : posts.loading ? <CardSkeleton count={6} className="h-4" /> : pager.total === 0 ? <EmptyState icon={HandHeart} title="No posts match your filters" text="Try clearing filters, or be the first to post." /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{pager.pageItems.map((p) => <article key={p.id} className="card card-hover flex flex-col p-5"><div className="flex flex-wrap items-center gap-2"><span className={`badge ${p.type === "request" ? "badge-gold" : "badge-sage"}`}>{p.type}</span><StatusBadge status={p.status} /><span className="ml-auto text-xs font-bold text-[#8A9A8F]">{formatDate(p.createdAt)}</span></div><h2 className="mt-3 font-extrabold leading-snug">{p.title}</h2><p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted">{p.description}</p><p className="mt-3 flex items-center gap-1 text-xs font-bold text-bronze"><MapPin size={12} aria-hidden />{neighbourhoodName(p.neighbourhoodId) || "Ibadan"} • by {p.authorName || "Neighbour"}</p>{p.contactPhone && <a href={`tel:${p.contactPhone.replace(/[\s-]/g, "")}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold"><Phone size={14} aria-hidden />{p.contactPhone}</a>}{p.status === "open" && <div className="mt-4"><MessageButton target={{ type: "help", id: p.id, title: p.title, ownerId: p.userId, ownerName: p.authorName }} label="Message admin about this" /></div>}{canManage(p) && <div className="mt-4 flex flex-wrap gap-2">{p.status === "open" ? <button type="button" className="btn-primary !px-4 !py-2 text-sm" onClick={() => run(() => setHelpStatus(p.id, "fulfilled", firebaseUser?.uid ?? ""), "Marked as fulfilled.")}><Check size={15} aria-hidden /> Mark fulfilled</button> : <button type="button" className="btn-ghost border border-line !py-2 text-sm" onClick={() => run(() => setHelpStatus(p.id, "open", firebaseUser?.uid ?? ""), "Post reopened.")}><RotateCcw size={15} aria-hidden /> Reopen</button>}<button type="button" aria-label="Delete post" className="btn-ghost border border-danger-line !py-2 text-danger" onClick={() => confirm("Delete this post?") && run(() => deleteHelpPost(p.id, firebaseUser?.uid ?? ""), "Post deleted.")}><Trash2 size={15} aria-hidden /></button></div>}</article>)}</div>}</div>
      <Pagination page={pager.page} pages={pager.pages} onChange={setPage} />
    </div>
  );
}
