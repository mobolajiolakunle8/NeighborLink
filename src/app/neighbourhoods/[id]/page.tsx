"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { collection, limit, query, where } from "firebase/firestore";
import { ArrowLeft, Check, HeartHandshake, MapPin, Megaphone, Store, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList } from "@/lib/hooks";
import { setMyNeighbourhood } from "@/lib/api";
import type { Announcement, Business, HelpPost } from "@/lib/types";
import { formatDate, friendlyError, sortByTimestampDesc } from "@/lib/utils";
import BusinessCard from "@/components/BusinessCard";
import { ShareButton } from "@/components/MemberActions";
import { Alert, CardSkeleton, EmptyState } from "@/components/ui";

export default function NeighbourhoodPage() {
  const { id } = useParams<{ id: string }>();
  const { neighbourhoods, categoryName, neighbourhoodName } = useSite();
  const { firebaseUser, profile } = useAuth();
  const hood = neighbourhoods.find((h) => h.id === id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Equality-only filters need no composite indexes; ordering happens on the client.
  const biz = useLiveList<Business>(`hood-biz-${id}`, () =>
    query(collection(getDb(), "businesses"), where("status", "==", "approved"), where("neighbourhoodId", "==", id), limit(60)));
  const help = useLiveList<HelpPost>(`hood-help-${id}`, () =>
    query(collection(getDb(), "helpPosts"), where("neighbourhoodId", "==", id), limit(60)));
  const anns = useLiveList<Announcement>(`hood-ann`, () =>
    query(collection(getDb(), "announcements"), where("isPublished", "==", true), limit(40)));

  const businesses = useMemo(() => [...biz.data].sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured)), [biz.data]);
  const openHelp = useMemo(() => sortByTimestampDesc(help.data.filter((h) => h.status === "open"), "createdAt").slice(0, 6), [help.data]);
  const localNews = useMemo(() => sortByTimestampDesc(anns.data.filter((a) => !a.neighbourhoodId || a.neighbourhoodId === id), "publishedAt").slice(0, 4), [anns.data, id]);
  const joined = profile?.neighbourhood === id;

  if (!hood) {
    return <div className="mx-auto max-w-xl px-4 py-16"><EmptyState icon={MapPin} title="Neighbourhood not found" action={<Link href="/neighbourhoods" className="btn-primary">All neighbourhoods</Link>} /></div>;
  }

  async function join() {
    if (!firebaseUser) { window.location.href = `/login?next=/neighbourhoods/${id}`; return; }
    setBusy(true); setMsg(null);
    try { await setMyNeighbourhood(firebaseUser.uid, joined ? null : id); setMsg({ kind: "success", text: joined ? "You left this neighbourhood." : `Welcome to ${hood!.name}! Local updates will be easier to find.` }); }
    catch (err) { setMsg({ kind: "error", text: friendlyError(err) }); } finally { setBusy(false); }
  }

  return (
    <div>
      <section className="bg-forest text-cream">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <Link href="/neighbourhoods" className="inline-flex items-center gap-1 text-sm font-bold text-sage/80 hover:text-white"><ArrowLeft size={15} /> All neighbourhoods</Link>
          <h1 className="mt-4 flex items-center gap-2 text-4xl font-extrabold tracking-tight"><MapPin className="text-gold" /> {hood.name}</h1>
          <p className="mt-2 max-w-xl text-sage/85">{hood.description || `Local businesses, help and news from ${hood.name}, Ibadan.`}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={join} className={joined ? "btn-outline !border-cream !text-cream hover:!bg-white/10" : "btn-gold"}>
              {joined ? <><Check size={16} /> You&apos;re a member</> : <><UserPlus size={16} /> Join {hood.name}</>}
            </button>
            <ShareButton title={`${hood.name} on NeighbourLink`} path={`/neighbourhoods/${id}`} label="Share neighbourhood" />
          </div>
          {msg && <div className="mt-4 max-w-xl"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-3"><h2 className="section-title flex items-center gap-2"><Store /> Local businesses</h2><Link href={`/directory?neighbourhood=${id}`} className="text-sm font-bold underline">Open in directory</Link></div>
        <div className="mt-6">
          {biz.loading ? <CardSkeleton count={3} /> : businesses.length === 0 ? (
            <EmptyState icon={Store} title={`No businesses listed in ${hood.name} yet`} text="Know a great local business? Invite them to list for free." action={<Link href="/register" className="btn-primary">List a business</Link>} />
          ) : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{businesses.map((b) => <BusinessCard key={b.id} business={b} categoryName={categoryName(b.categoryId)} neighbourhoodName={neighbourhoodName(b.neighbourhoodId)} />)}</div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2"><HeartHandshake /> Open help nearby</h2>
          <div className="mt-4 space-y-3">
            {help.loading ? <CardSkeleton count={2} className="h-4" /> : openHelp.length === 0 ? <p className="text-sm text-muted">No open requests or offers in {hood.name} right now.</p> : openHelp.map((h) => (
              <Link key={h.id} href="/help" className="card card-hover block p-4">
                <span className={`badge ${h.type === "request" ? "badge-gold" : "badge-sage"}`}>{h.type}</span>
                <p className="mt-2 font-extrabold">{h.title}</p>
                <p className="line-clamp-2 text-sm text-muted">{h.description}</p>
              </Link>
            ))}
          </div>
          <Link href="/help" className="btn-outline mt-4">Post to the help board</Link>
        </div>
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2"><Megaphone /> Local news</h2>
          <div className="mt-4 space-y-3">
            {anns.loading ? <CardSkeleton count={2} className="h-4" /> : localNews.length === 0 ? <p className="text-sm text-muted">No announcements yet.</p> : localNews.map((a) => (
              <Link key={a.id} href="/announcements" className="card card-hover block p-4">
                {a.neighbourhoodId === id && <span className="badge badge-gold">{hood.name}</span>}
                <p className="mt-1 font-extrabold">{a.title}</p>
                <p className="line-clamp-2 text-sm text-muted">{a.body}</p>
                <p className="mt-1 text-xs text-bronze">{formatDate(a.publishedAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
