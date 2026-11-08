"use client";

import Link from "next/link";
import { Bookmark, LogIn, Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMember } from "@/context/MemberContext";
import { useSite } from "@/context/SiteContext";
import { useLiveDoc } from "@/lib/hooks";
import type { Business } from "@/lib/types";
import BusinessCard from "@/components/BusinessCard";
import { SaveButton } from "@/components/MemberActions";
import { CardSkeleton, EmptyState } from "@/components/ui";

function SavedItem({ id }: { id: string }) {
  const { categoryName, neighbourhoodName } = useSite();
  const biz = useLiveDoc<Business>(`businesses/${id}`);
  if (biz.loading) return <div className="card p-5"><div className="skeleton h-56" /></div>;
  if (!biz.data || biz.data.status !== "approved") {
    return (
      <div className="card flex flex-col items-start gap-3 p-6">
        <Store size={26} className="text-muted" aria-hidden />
        <p className="font-bold">This listing is no longer available</p>
        <p className="text-sm text-muted">It may be under review or removed by its owner.</p>
        <SaveButton businessId={id} />
      </div>
    );
  }
  return <BusinessCard business={biz.data} categoryName={categoryName(biz.data.categoryId)} neighbourhoodName={neighbourhoodName(biz.data.neighbourhoodId)} />;
}

export default function SavedPage() {
  const { firebaseUser, loading } = useAuth();
  const { saved, savedLoading } = useMember();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Your shortlist</p>
      <h1 className="section-title mt-2">Saved businesses</h1>
      <p className="mt-2 text-muted">Businesses you&apos;ve bookmarked. Only you can see this list.</p>
      <div className="mt-8">
        {loading || (firebaseUser && savedLoading) ? <CardSkeleton count={3} /> : !firebaseUser ? (
          <EmptyState icon={LogIn} title="Log in to see your saved businesses" text="Save businesses from the directory and find them here on any device." action={<Link href="/login?next=/saved" className="btn-primary">Log in</Link>} />
        ) : saved.length === 0 ? (
          <EmptyState icon={Bookmark} title="Nothing saved yet" text="Tap the bookmark on any business to add it to your shortlist." action={<Link href="/directory" className="btn-primary">Browse the directory</Link>} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{saved.map((s) => <SavedItem key={s.id} id={s.businessId} />)}</div>
        )}
      </div>
    </div>
  );
}
