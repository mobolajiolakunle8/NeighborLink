"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { Megaphone, Pin } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { useLiveList } from "@/lib/hooks";
import type { Announcement } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { CardSkeleton, EmptyState, Alert } from "@/components/ui";

const PAGE = 12;

export default function AnnouncementsPage() {
  const [count, setCount] = useState(PAGE);
  const anns = useLiveList<Announcement>(`announcements-${count}`, () =>
    query(collection(getDb(), "announcements"), where("isPublished", "==", true), orderBy("publishedAt", "desc"), limit(count)),
  );

  const ordered = useMemo(
    () => [...anns.data].sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))),
    [anns.data],
  );
  const mayHaveMore = anns.data.length === count;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Announcements</p>
      <h1 className="section-title mt-2">Neighbourhood updates</h1>
      <p className="mt-2 text-muted">Official updates from the NeighbourLink team for Ibadan residents.</p>

      <div className="mt-8">
        {anns.error ? (
          <Alert kind="error">{anns.error}</Alert>
        ) : anns.loading ? (
          <div className="space-y-4"><div className="skeleton h-40" /><div className="skeleton h-40" /></div>
        ) : ordered.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" text="Check back soon. Updates will appear here as soon as they are published." />
        ) : (
          <div className="space-y-5">
            {ordered.map((a) => (
              <article key={a.id} className="card overflow-hidden">
                {a.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageUrl} alt="" loading="lazy" className="h-56 w-full object-cover" />
                )}
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.isPinned && <span className="badge badge-gold"><Pin size={12} aria-hidden /> Pinned</span>}
                    <span className="text-xs font-bold text-[#8A9A8F]">{formatDate(a.publishedAt, { dateStyle: "full" })}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-extrabold leading-tight">{a.title}</h2>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-forest/85">{a.body}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {mayHaveMore && !anns.loading && (
        <div className="mt-8 text-center">
          <button type="button" className="btn-outline" onClick={() => setCount((c) => c + PAGE)}>Load more announcements</button>
        </div>
      )}
      {anns.loading && count > PAGE && <div className="mt-6"><CardSkeleton count={1} className="h-24" /></div>}

      <p className="mt-10 text-center text-sm text-muted">
        Questions? <Link href="/contact" className="font-bold underline">Contact us</Link>.
      </p>
    </div>
  );
}
