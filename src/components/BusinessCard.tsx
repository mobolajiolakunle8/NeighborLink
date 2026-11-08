"use client";

import Link from "next/link";
import { BadgeCheck, Clock, MapPin, Phone, ShieldCheck, Store } from "lucide-react";
import type { Business } from "@/lib/types";
import { SaveButton } from "./MemberActions";

export function TrustBadge({ business, className = "" }: { business: Business; className?: string }) {
  if (business.verificationStatus === "verified") {
    return <span className={`badge badge-forest ${className}`} title="Registration details confirmed by NeighbourLink"><BadgeCheck size={12} aria-hidden /> Verified business</span>;
  }
  if (business.status === "approved") {
    return <span className={`badge badge-sage ${className}`} title="Reviewed by our team before publishing. Not an identity check."><ShieldCheck size={12} aria-hidden /> Listing reviewed</span>;
  }
  return null;
}

export default function BusinessCard({ business: b, categoryName, neighbourhoodName }: { business: Business; categoryName: string; neighbourhoodName: string }) {
  return (
    <Link href={`/business/${b.id}`} className="card card-hover group relative flex flex-col overflow-hidden">
      <div className="relative aspect-video overflow-hidden bg-forest">
        {b.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.imageUrl} alt={b.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : <div className="grid h-full w-full place-items-center text-gold"><Store size={44} aria-hidden /></div>}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">{categoryName && <span className="badge badge-gold">{categoryName}</span>}{b.isFeatured && <span className="badge badge-forest">Featured</span>}</div>
        <div className="absolute right-3 top-3"><SaveButton businessId={b.id} compact /></div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-extrabold leading-tight">{b.name}</h3>
        <div className="mt-1.5"><TrustBadge business={b} /></div>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{b.description}</p>
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex items-center gap-1.5 font-bold text-bronze"><MapPin size={14} aria-hidden />{neighbourhoodName || "Ibadan"}</p>
          {b.openingHours && <p className="flex items-center gap-1.5 text-muted"><Clock size={14} aria-hidden />{b.openingHours}</p>}
          {b.phone && <p className="flex items-center gap-1.5 text-muted"><Phone size={14} aria-hidden />{b.phone}</p>}
        </div>
      </div>
    </Link>
  );
}
