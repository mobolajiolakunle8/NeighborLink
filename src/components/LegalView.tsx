"use client";

import { FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import { DEFAULT_LEGAL } from "@/lib/defaults";
import { useLiveDoc } from "@/lib/hooks";
import { formatDate } from "@/lib/utils";
import type { LegalPage } from "@/lib/types";
import { Alert, CardSkeleton } from "@/components/ui";

/** Renders a legal page live from Firestore, falling back to the built-in text. */
export default function LegalView({ id }: { id: "privacy" | "terms" }) {
  const { data, loading, error } = useLiveDoc<LegalPage>(`legalPages/${id}`);
  const fallback = DEFAULT_LEGAL.find(p => p.id === id);
  const page = data ?? fallback;
  const Icon: LucideIcon = id === "privacy" ? ShieldCheck : FileText;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest text-gold"><Icon size={22} aria-hidden /></span>
      {loading ? <div className="mt-6"><CardSkeleton count={1} className="h-6" /></div> : (
        <>
          {error && !data && <div className="mt-4"><Alert kind="warning">Showing the standard version. {error}</Alert></div>}
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{page?.title}</h1>
          <p className="mt-1 text-sm text-muted">Last updated: {data ? formatDate(data.updatedAt, { dateStyle: "full" }) : "—"}</p>
          <article className="card mt-6 p-6 sm:p-8"><p className="whitespace-pre-line leading-relaxed text-forest/85">{page?.content}</p></article>
        </>
      )}
    </div>
  );
}
