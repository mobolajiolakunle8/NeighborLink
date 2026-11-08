"use client";

import Link from "next/link";
import { useMemo } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import {
  ArrowRight, BadgeCheck, HeartHandshake, MapPin, Megaphone, Phone, Search, ShieldCheck, Sparkles, Store, Users,
} from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList } from "@/lib/hooks";
import type { Announcement, Business, HelpPost } from "@/lib/types";
import { formatDate, sortByTimestampDesc } from "@/lib/utils";
import BusinessCard from "@/components/BusinessCard";
import BusinessMapExplorer from "@/components/BusinessMapExplorer";
import SetupNotice from "@/components/SetupNotice";
import { Alert, CardSkeleton, EmptyState, SectionHeader } from "@/components/ui";

export default function HomePage() {
  const { settings, activeCategories, activeNeighbourhoods, categoryName, neighbourhoodName, problem } = useSite();

  // Each query that needs a composite index also provides an index-free fallback,
  // so the homepage works even while Firestore indexes are still being built.
  const businesses = useLiveList<Business>(
    "home-biz",
    () => query(collection(getDb(), "businesses"), where("status", "==", "approved"), orderBy("createdAt", "desc"), limit(200)),
    {
      fallback: () => query(collection(getDb(), "businesses"), where("status", "==", "approved"), limit(200)),
      sort: (rows) => sortByTimestampDesc(rows, "createdAt"),
    },
  );
  const help = useLiveList<HelpPost>("home-help", () =>
    query(collection(getDb(), "helpPosts"), orderBy("createdAt", "desc"), limit(200)),
  );
  const announcements = useLiveList<Announcement>(
    "home-ann",
    () => query(collection(getDb(), "announcements"), where("isPublished", "==", true), orderBy("publishedAt", "desc"), limit(3)),
    {
      fallback: () => query(collection(getDb(), "announcements"), where("isPublished", "==", true), limit(3)),
      sort: (rows) => sortByTimestampDesc(rows, "publishedAt"),
    },
  );

  const featured = useMemo(
    () =>
      [...businesses.data]
        .sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)))
        .slice(0, 6),
    [businesses.data],
  );
  const openHelp = useMemo(() => help.data.filter((h) => h.status === "open").slice(0, 3), [help.data]);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-forest text-cream">
        <div className="absolute inset-0 opacity-25" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={settings.heroImageUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/85 to-forest/40" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
          <div className="fade-up">
            <span className="badge badge-gold"><Sparkles size={13} aria-hidden /> Ibadan, Oyo State</span>
            <h1 className="mt-5 text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight">
              {settings.heroTitle}
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-sage/90">{settings.heroSubtitle}</p>

            <form action="/directory" method="get" role="search" className="mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Search businesses and services</span>
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest/50" aria-hidden />
                <input name="q" placeholder="Search businesses, services…" className="w-full rounded-full bg-white py-3.5 pl-11 pr-4 font-semibold text-forest outline-none placeholder:text-[#8A9A8F]" />
              </label>
              <button type="submit" className="btn-gold shrink-0">Search</button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/directory" className="btn-primary !bg-cream !text-forest !border-cream"><Store size={17} aria-hidden /> {settings.heroCtaLabel || "Browse directory"}</Link>
              <Link href="/help" className="btn-outline !border-cream !text-cream hover:!bg-white/10"><HeartHandshake size={17} aria-hidden /> Community help</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sage/85">
              <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-gold" aria-hidden /> Reviewed listings</span>
              <span className="flex items-center gap-1.5"><Users size={16} className="text-gold" aria-hidden /> Neighbour to neighbour</span>
              <span className="flex items-center gap-1.5"><Phone size={16} className="text-gold" aria-hidden /> {settings.contactPhone}</span>
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-4 lg:grid fade-up">
            <div className="card rotate-[-1.5deg] !bg-white/95 p-5 text-forest">
              <p className="eyebrow">Directory</p>
              <p className="mt-2 text-3xl font-extrabold">{activeCategories.length}</p>
              <p className="text-sm text-muted">Service categories</p>
            </div>
            <div className="card mt-8 rotate-[1.5deg] !bg-gold p-5 text-forest">
              <p className="eyebrow !text-forest/70">Neighbourhoods</p>
              <p className="mt-2 text-3xl font-extrabold">{activeNeighbourhoods.length}</p>
              <p className="text-sm">Areas covered across Ibadan</p>
            </div>
            <div className="card col-span-2 !bg-sage p-5 text-forest">
              <p className="flex items-center gap-2 font-bold"><BadgeCheck size={18} aria-hidden /> Every listing is reviewed before it goes live.</p>
              <p className="mt-1 text-sm text-muted">No paid placements. Just trusted local connections.</p>
            </div>
          </div>
        </div>
      </section>

      {problem ? (
        <SetupNotice problem={problem} className="mx-auto mt-6 max-w-7xl px-4 sm:px-6" />
      ) : null}

      <BusinessMapExplorer businesses={businesses.data} loading={businesses.loading} />

      {/* FEATURED BUSINESSES */}
      <section className="border-y border-line bg-sage/60" aria-labelledby="featured-title">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Featured</p>
              <h2 id="featured-title" className="section-title mt-2">Trusted local businesses</h2>
            </div>
            <Link href="/directory" className="hidden items-center gap-1 text-sm font-bold sm:inline-flex">Open directory <ArrowRight size={16} aria-hidden /></Link>
          </div>
          <div className="mt-8">
            {businesses.loading ? (
              <CardSkeleton count={3} />
            ) : businesses.problem && !problem ? (
              <SetupNotice problem={businesses.problem} />
            ) : featured.length === 0 ? (
              <EmptyState
                icon={Store}
                title="No businesses listed yet"
                text="Be among the first to list your business. It takes two minutes and is free."
                action={<Link href="/register" className="btn-primary">List your business</Link>}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((b) => (
                  <BusinessCard key={b.id} business={b} categoryName={categoryName(b.categoryId)} neighbourhoodName={neighbourhoodName(b.neighbourhoodId)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HELP + ANNOUNCEMENTS */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Community" title="Help board" text="Neighbours requesting and offering help — from errands to skills." />
          <div className="mt-6 space-y-3">
            {help.loading ? (
              <CardSkeleton count={2} className="h-4" />
            ) : openHelp.length === 0 ? (
              <EmptyState icon={HeartHandshake} title="No open requests right now" text="Post a request or offer help to a neighbour." />
            ) : (
              openHelp.map((h) => (
                <Link key={h.id} href="/help" className="card card-hover flex gap-4 p-5">
                  <span className={`badge h-fit shrink-0 ${h.type === "request" ? "badge-gold" : "badge-sage"}`}>{h.type}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold">{h.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{h.description}</span>
                    <span className="mt-1.5 flex items-center gap-1 text-xs font-bold text-bronze"><MapPin size={12} aria-hidden />{neighbourhoodName(h.neighbourhoodId) || "Ibadan"}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
          <Link href="/help" className="btn-outline mt-5">Open help board <ArrowRight size={16} aria-hidden /></Link>
        </div>

        <div>
          <SectionHeader eyebrow="Stay informed" title="Announcements" text="Neighbourhood updates published by the NeighbourLink team." />
          <div className="mt-6 space-y-3">
            {announcements.loading ? (
              <CardSkeleton count={2} className="h-4" />
            ) : announcements.data.length === 0 ? (
              <EmptyState icon={Megaphone} title="No announcements yet" text="Updates from the NeighbourLink team will appear here." />
            ) : (
              announcements.data.map((a) => (
                <Link key={a.id} href="/announcements" className="card card-hover block p-5">
                  <p className="font-extrabold leading-snug">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>
                  <p className="mt-2 text-xs font-bold text-bronze">{formatDate(a.publishedAt, { dateStyle: "medium" })}</p>
                </Link>
              ))
            )}
          </div>
          <Link href="/announcements" className="btn-outline mt-5"><Megaphone size={16} aria-hidden /> All announcements</Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest p-8 text-cream sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-2xl" aria-hidden />
          <div className="relative grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{settings.ctaTitle}</h2>
              <p className="mt-3 leading-relaxed text-sage/85">{settings.ctaText}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register" className="btn-gold">Create free account</Link>
                <Link href="/contact" className="btn-outline !border-cream !text-cream hover:!bg-white/10">Talk to us</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[{ n: "Free", l: "to join" }, { n: "Reviewed", l: "before listing" }, { n: "Local", l: "to Ibadan" }].map((s) => (
                <div key={s.l} className="rounded-2xl border border-white/15 bg-white/10 p-5">
                  <p className="text-xl font-extrabold text-gold">{s.n}</p>
                  <p className="mt-1 text-xs text-sage/80">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
