"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, MapPin, Store } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import type { Business } from "@/lib/types";
import { businessCoordinates, hasBusinessLocation } from "@/lib/utils";
import MapPanel, { type MapPoint } from "./MapPanel";

export default function BusinessMapExplorer({ businesses, loading = false }: { businesses: Business[]; loading?: boolean }) {
  const { activeCategories, activeNeighbourhoods, neighbourhoodName, categoryName } = useSite();
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const filtered = useMemo(
    () => businesses.filter(b => b.status === "approved" && (!category || b.categoryId === category) && (!area || b.neighbourhoodId === area)),
    [businesses, category, area],
  );
  const mapped = useMemo(() => filtered.flatMap(b => { const c = businessCoordinates(b); return c ? [{ business: b, ...c }] : []; }), [filtered]);
  const missing = useMemo(() => filtered.filter(b => !hasBusinessLocation(b)), [filtered]);
  const points = useMemo<MapPoint[]>(
    () => mapped.map(({ business: b, lat, lng }) => ({
      id: b.id,
      lat,
      lng,
      title: b.name,
      subtitle: [b.address, neighbourhoodName(b.neighbourhoodId) || "Ibadan"].filter(Boolean).join(" · "),
      href: `/business/${b.id}`,
    })),
    [mapped, neighbourhoodName],
  );
  const directoryQuery = new URLSearchParams();
  if (category) directoryQuery.set("category", category);
  if (area) directoryQuery.set("neighbourhood", area);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6" aria-labelledby="business-map-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Live business locations</p>
          <h2 id="business-map-title" className="section-title mt-2">Find what you need, nearby.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Every approved business with an owner-saved geotag is pinned at its exact latitude and longitude. Select a pin or a business name to focus it.
          </p>
        </div>
        <Link href={`/directory${directoryQuery.size ? `?${directoryQuery}` : ""}`} className="btn-outline !py-2.5 !text-sm">Open directory <ArrowRight size={15} /></Link>
      </div>

      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:max-w-2xl">
        <label><span className="label">What are you looking for?</span><select className="input" value={category} onChange={e => { setCategory(e.target.value); setSelectedId(undefined); }}><option value="">All services</option>{activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="label">Where in Ibadan?</span><select className="input" value={area} onChange={e => { setArea(e.target.value); setSelectedId(undefined); }}><option value="">Anywhere in Ibadan</option>{activeNeighbourhoods.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        {loading ? <div className="skeleton h-[420px]" /> : <MapPanel points={points} height={460} label="Map of every approved geotagged business in Ibadan" selectedId={selectedId} onSelect={setSelectedId} />}
        <aside className="card flex max-h-[520px] flex-col p-5">
          <p className="flex items-center gap-2 text-sm font-extrabold"><MapPin size={17} className="text-bronze" />{mapped.length} of {filtered.length} businesses tagged</p>
          <p className="mt-1 text-xs text-muted">All geotagged matches are listed here. Select one to centre its exact pin.</p>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            {mapped.map(({ business: b, lat, lng }) => (
              <div key={b.id} className={`rounded-xl border p-3 transition ${selectedId === b.id ? "border-forest bg-sage" : "border-line hover:bg-sage/60"}`}>
                <button type="button" className="block w-full text-left" onClick={() => setSelectedId(b.id)} aria-pressed={selectedId === b.id}>
                  <span className="block truncate text-sm font-extrabold">{b.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{categoryName(b.categoryId) || "Local service"} · {neighbourhoodName(b.neighbourhoodId) || "Ibadan"}</span>
                  <span className="mt-1 block text-[11px] font-bold text-bronze">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
                </button>
                <Link href={`/business/${b.id}`} className="mt-1 inline-block text-xs font-bold underline">View business</Link>
              </div>
            ))}
            {!loading && mapped.length === 0 && (
              <div className="rounded-xl bg-sage/60 p-4 text-sm text-muted"><Store size={24} className="mb-2" /><p className="font-bold text-forest">No geotagged businesses match</p><p className="mt-1 text-xs">Try another service or area. A business appears only after its owner saves an exact map pin and the listing is approved.</p></div>
            )}
          </div>

          {missing.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-extrabold text-bronze">{missing.length} approved {missing.length === 1 ? "listing has" : "listings have"} no map pin yet</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted">{missing.slice(0, 3).map(b => b.name).join(", ")}{missing.length > 3 ? "…" : ""}</p>
              <p className="mt-1 text-[11px] text-muted">Owners can add the exact location from My profile → My businesses.</p>
            </div>
          )}
          <p className="mt-3 border-t border-line pt-3 text-[11px] text-muted">Pins use the exact coordinates saved by the business owner or an administrator.</p>
        </aside>
      </div>
    </section>
  );
}
