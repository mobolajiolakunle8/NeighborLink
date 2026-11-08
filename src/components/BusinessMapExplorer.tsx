"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, MapPin, Store } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import type { Business } from "@/lib/types";
import { hasBusinessLocation } from "@/lib/utils";
import MapPanel, { type MapPoint } from "./MapPanel";

export default function BusinessMapExplorer({ businesses, loading = false }: { businesses: Business[]; loading?: boolean }) {
  const { activeCategories, activeNeighbourhoods, neighbourhoodName, categoryName } = useSite();
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const filtered = useMemo(() => businesses.filter(b => b.status === "approved" && (!category || b.categoryId === category) && (!area || b.neighbourhoodId === area)), [businesses, category, area]);
  const mapped = useMemo(() => filtered.filter(hasBusinessLocation), [filtered]);
  const points = useMemo<MapPoint[]>(() => mapped.map(b => ({ id: b.id, lat: b.latitude!, lng: b.longitude!, title: b.name, subtitle: [b.address, neighbourhoodName(b.neighbourhoodId) || "Ibadan"].filter(Boolean).join(" · "), href: `/business/${b.id}` })), [mapped, neighbourhoodName]);
  const directoryQuery = new URLSearchParams(); if (category) directoryQuery.set("category", category); if (area) directoryQuery.set("neighbourhood", area);
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6" aria-labelledby="business-map-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Live business locations</p><h2 id="business-map-title" className="section-title mt-2">Find what you need, nearby.</h2><p className="mt-2 max-w-2xl text-sm text-muted">Explore businesses on the map. Pins reflect published business locations and update when location changes are approved — no long category or neighbourhood lists.</p></div>
        <Link href={`/directory${directoryQuery.size ? `?${directoryQuery}` : ""}`} className="btn-outline !py-2.5 !text-sm">Open directory <ArrowRight size={15} /></Link>
      </div>
      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:max-w-2xl">
        <label><span className="label">What are you looking for?</span><select className="input" value={category} onChange={e => setCategory(e.target.value)}><option value="">All services</option>{activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="label">Where in Ibadan?</span><select className="input" value={area} onChange={e => setArea(e.target.value)}><option value="">Anywhere in Ibadan</option>{activeNeighbourhoods.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        {loading ? <div className="skeleton h-[420px]" /> : <MapPanel points={points} height={420} label="Map of approved business locations in Ibadan" />}
        <aside className="card flex flex-col p-5">
          <p className="flex items-center gap-2 text-sm font-extrabold"><MapPin size={17} className="text-bronze" />{mapped.length} mapped {mapped.length === 1 ? "business" : "businesses"}</p>
          <p className="mt-1 text-xs text-muted">Select a pin for details, or open a listing below.</p>
          <div className="mt-4 flex-1 space-y-2">
            {mapped.slice(0, 6).map(b => <Link key={b.id} href={`/business/${b.id}`} className="block rounded-xl border border-line p-3 transition hover:bg-sage"><p className="truncate text-sm font-extrabold">{b.name}</p><p className="mt-0.5 truncate text-xs text-muted">{categoryName(b.categoryId) || "Local service"} · {neighbourhoodName(b.neighbourhoodId) || "Ibadan"}</p></Link>)}
            {!loading && mapped.length === 0 && <div className="rounded-xl bg-sage/60 p-4 text-sm text-muted"><Store size={24} className="mb-2" /><p className="font-bold text-forest">No mapped businesses here yet</p><p className="mt-1 text-xs">Try another filter. Business owners can add a location from their listing form.</p></div>}
          </div>
          {mapped.length > 6 && <Link href={`/directory${directoryQuery.size ? `?${directoryQuery}` : ""}`} className="mt-3 text-xs font-bold underline">See all matching businesses</Link>}
          <p className="mt-4 border-t border-line pt-3 text-[11px] text-muted">Only businesses with a saved location are shown. Map data © OpenStreetMap contributors.</p>
        </aside>
      </div>
    </section>
  );
}
