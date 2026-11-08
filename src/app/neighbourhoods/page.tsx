"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";

export default function NeighbourhoodsPage() {
  const { activeNeighbourhoods } = useSite();
  const { profile } = useAuth();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Find near you</p>
      <h1 className="section-title mt-2">Neighbourhoods in Ibadan</h1>
      <p className="mt-2 max-w-2xl text-muted">Pick your area to see local businesses, open help posts and neighbourhood news.</p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {activeNeighbourhoods.map((h) => (
          <Link key={h.id} href={`/neighbourhoods/${h.id}`} className={`card card-hover flex items-center gap-2 p-4 font-extrabold ${profile?.neighbourhood === h.id ? "border-forest bg-sage" : ""}`}>
            <MapPin size={16} className="shrink-0 text-bronze" aria-hidden /> <span className="truncate">{h.name}</span>
            {profile?.neighbourhood === h.id && <span className="badge badge-forest ml-auto !text-[9px]">Yours</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
