"use client";

import Link from "next/link";
import { useMemo } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import {
  ArrowRight, BadgeCheck, ChevronDown, HeartHandshake, MapPin, Megaphone, Phone, Search, ShieldCheck, Sparkles, Store, Users,
} from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList } from "@/lib/hooks";
import type { Announcement, Business, HelpPost } from "@/lib/types";
import { formatDate, sortByTimestampDesc } from "@/lib/utils";
import BusinessCard from "@/components/BusinessCard";
import BusinessMapExplorer from "@/components/BusinessMapExplorer";
import SetupNotice from "@/components/SetupNotice";
import { AnimatedNumber, Parallax, Reveal } from "@/components/motion";
import { CardSkeleton, EmptyState, SectionHeader } from "@/components/ui";

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
  const marqueeAreas = useMemo(
    () => (activeNeighbourhoods.length ? activeNeighbourhoods : []).map((h) => h.name),
    [activeNeighbourhoods]
  );

  return (
    <div className="min-w-0 overflow-x-clip">
      {/* HERO — brighter image, parallax, staggered entrance */}
      <section className="relative overflow-hidden bg-forest text-cream">
        <Parallax speed={0.14} className="absolute inset-0">
          <div className="hero-media absolute inset-0 overflow-hidden" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.heroImageUrl}
              alt=""
              fetchPriority="high"
              className="h-[115%] w-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/65 to-forest/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest/85 via-transparent to-forest/25" />
          </div>
        </Parallax>
        <div className="hero-glow pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/25 blur-3xl" aria-hidden />
        <div className="hero-glow pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-sage/15 blur-3xl" aria-hidden style={{ animationDelay: "3s" }} />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:py-24">
          <div>
            <Reveal variant="fade">
              <span className="badge badge-gold"><Sparkles size={13} aria-hidden /> Ibadan, Oyo State</span>
            </Reveal>
            <Reveal variant="up" delay={90}>
              <h1 className="text-balance mt-5 text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight">
                {settings.heroTitle}
              </h1>
            </Reveal>
            <Reveal variant="up" delay={180}>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-sage/90 sm:text-lg">{settings.heroSubtitle}</p>
            </Reveal>

            <Reveal variant="up" delay={260}>
              <form action="/directory" method="get" role="search" className="mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Search businesses and services</span>
                  <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest/50" aria-hidden />
                  <input name="q" placeholder="Search businesses, services…" className="w-full rounded-full bg-white py-3.5 pl-11 pr-4 font-semibold text-forest outline-none placeholder:text-[#8A9A8F]" />
                </label>
                <button type="submit" className="btn-gold shrink-0">Search</button>
              </form>
            </Reveal>

            <Reveal variant="up" delay={340}>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/directory" className="btn-primary !border-cream !bg-cream !text-forest"><Store size={17} aria-hidden /> {settings.heroCtaLabel || "Browse directory"}</Link>
                <Link href="/help" className="btn-outline !border-cream !text-cream hover:!bg-white/10"><HeartHandshake size={17} aria-hidden /> Community help</Link>
              </div>
            </Reveal>
            <Reveal variant="fade" delay={420}>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sage/85">
                <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-gold" aria-hidden /> Reviewed listings</span>
                <span className="flex items-center gap-1.5"><Users size={16} className="text-gold" aria-hidden /> Neighbour to neighbour</span>
                <span className="flex items-center gap-1.5"><Phone size={16} className="text-gold" aria-hidden /> {settings.contactPhone}</span>
              </div>
            </Reveal>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid">
            <Reveal variant="right" delay={200} className="animate-float-soft" >
              <div className="card rotate-[-1.5deg] !bg-white/95 p-5 text-forest backdrop-blur">
                <p className="eyebrow">Directory</p>
                <p className="mt-2 text-3xl font-extrabold tabular-nums"><AnimatedNumber value={activeCategories.length} /></p>
                <p className="text-sm text-muted">Service categories</p>
              </div>
            </Reveal>
            <Reveal variant="left" delay={300} className="mt-6 sm:mt-8">
              <div className="card rotate-[1.5deg] !bg-gold p-5 text-forest">
                <p className="eyebrow !text-forest/70">Neighbourhoods</p>
                <p className="mt-2 text-3xl font-extrabold tabular-nums"><AnimatedNumber value={activeNeighbourhoods.length} /></p>
                <p className="text-sm">Areas covered across Ibadan</p>
              </div>
            </Reveal>
            <Reveal variant="up" delay={400} className="col-span-2">
              <div className="card col-span-2 !bg-sage/95 p-5 text-forest backdrop-blur">
                <p className="flex items-center gap-2 font-bold"><BadgeCheck size={18} aria-hidden /> Every listing is reviewed before it goes live.</p>
                <p className="mt-1 text-sm text-muted">No paid placements. Just trusted local connections.</p>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="relative flex justify-center pb-6" aria-hidden>
          <a href="#explore" className="scroll-hint flex flex-col items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sage/70 transition hover:text-cream">
            Scroll
            <ChevronDown size={18} />
          </a>
        </div>
      </section>

      {/* Lively areas marquee */}
      {marqueeAreas.length > 0 && (
        <div className="marquee border-b border-line bg-cream py-3" aria-hidden>
          <div className="marquee-track gap-8 pr-8">
            {[...marqueeAreas, ...marqueeAreas].map((name, i) => (
              <span key={`${name}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-muted">
                <MapPin size={14} className="text-bronze" /> {name}
                <span className="ml-6 inline-block h-1 w-1 rounded-full bg-gold" />
              </span>
            ))}
          </div>
        </div>
      )}

      <div id="explore" className="scroll-mt-24" />

      {problem ? (
        <Reveal variant="fade">
          <SetupNotice problem={problem} className="mx-auto mt-6 max-w-7xl px-4 sm:px-6" />
        </Reveal>
      ) : null}

      <Reveal variant="up">
        <BusinessMapExplorer businesses={businesses.data} loading={businesses.loading} />
      </Reveal>

      {/* FEATURED BUSINESSES */}
      <section className="border-y border-line bg-sage/60" aria-labelledby="featured-title">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
          <Reveal variant="up">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Featured</p>
                <h2 id="featured-title" className="section-title mt-2">Trusted local businesses</h2>
              </div>
              <Link href="/directory" className="hidden items-center gap-1 text-sm font-bold transition-all hover:gap-2 sm:inline-flex">Open directory <ArrowRight size={16} aria-hidden /></Link>
            </div>
          </Reveal>
          <div className="mt-8">
            {businesses.loading ? (
              <CardSkeleton count={3} />
            ) : businesses.problem && !problem ? (
              <SetupNotice problem={businesses.problem} />
            ) : featured.length === 0 ? (
              <Reveal variant="fade">
                <EmptyState
                  icon={Store}
                  title="No businesses listed yet"
                  text="Be among the first to list your business. It takes two minutes and is free."
                  action={<Link href="/register" className="btn-primary">List your business</Link>}
                />
              </Reveal>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((b, i) => (
                  <Reveal key={b.id} variant="up" delay={Math.min(i * 90, 450)}>
                    <BusinessCard business={b} categoryName={categoryName(b.categoryId)} neighbourhoodName={neighbourhoodName(b.neighbourhoodId)} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HELP + ANNOUNCEMENTS */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-2">
        <Reveal variant="left">
          <div>
            <SectionHeader eyebrow="Community" title="Help board" text="Neighbours requesting and offering help — from errands to skills." />
            <div className="mt-6 space-y-3">
              {help.loading ? (
                <CardSkeleton count={2} className="h-4" />
              ) : openHelp.length === 0 ? (
                <EmptyState icon={HeartHandshake} title="No open requests right now" text="Post a request or offer help to a neighbour." />
              ) : (
                openHelp.map((h, i) => (
                  <Reveal key={h.id} variant="up" delay={i * 90}>
                    <Link href="/help" className="card card-hover flex gap-4 p-5">
                      <span className={`badge h-fit shrink-0 ${h.type === "request" ? "badge-gold" : "badge-sage"}`}>{h.type}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold">{h.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{h.description}</span>
                        <span className="mt-1.5 flex items-center gap-1 text-xs font-bold text-bronze"><MapPin size={12} aria-hidden />{neighbourhoodName(h.neighbourhoodId) || "Ibadan"}</span>
                      </span>
                    </Link>
                  </Reveal>
                ))
              )}
            </div>
            <Link href="/help" className="btn-outline mt-5">Open help board <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </Reveal>

        <Reveal variant="right" delay={120}>
          <div>
            <SectionHeader eyebrow="Stay informed" title="Announcements" text="Neighbourhood updates published by the NeighbourLink team." />
            <div className="mt-6 space-y-3">
              {announcements.loading ? (
                <CardSkeleton count={2} className="h-4" />
              ) : announcements.data.length === 0 ? (
                <EmptyState icon={Megaphone} title="No announcements yet" text="Updates from the NeighbourLink team will appear here." />
              ) : (
                announcements.data.map((a, i) => (
                  <Reveal key={a.id} variant="up" delay={i * 90}>
                    <Link href="/announcements" className="card card-hover block p-5">
                      <p className="font-extrabold leading-snug">{a.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>
                      <p className="mt-2 text-xs font-bold text-bronze">{formatDate(a.publishedAt, { dateStyle: "medium" })}</p>
                    </Link>
                  </Reveal>
                ))
              )}
            </div>
            <Link href="/announcements" className="btn-outline mt-5"><Megaphone size={16} aria-hidden /> All announcements</Link>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <Reveal variant="zoom">
          <div className="relative overflow-hidden rounded-[2rem] bg-forest p-8 text-cream sm:p-12">
            <div className="hero-glow absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-2xl" aria-hidden />
            <Parallax speed={0.06} className="relative grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{settings.ctaTitle}</h2>
                <p className="mt-3 leading-relaxed text-sage/85">{settings.ctaText}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/register" className="btn-gold">Create free account</Link>
                  <Link href="/contact" className="btn-outline !border-cream !text-cream hover:!bg-white/10">Talk to us</Link>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
                {[{ n: "Free", l: "to join" }, { n: "Reviewed", l: "before listing" }, { n: "Local", l: "to Ibadan" }].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5">
                    <p className="text-lg font-extrabold text-gold sm:text-xl">{s.n}</p>
                    <p className="mt-1 text-xs text-sage/80">{s.l}</p>
                  </div>
                ))}
              </div>
            </Parallax>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
