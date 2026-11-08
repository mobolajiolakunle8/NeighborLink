"use client";

import Link from "next/link";
import { CloudOff } from "lucide-react";
import type { FirestoreProblem } from "@/lib/utils";

/** Visitor-facing availability notice. Never render raw SDK errors or deployment guidance. */
export default function SetupNotice({ problem, className = "" }: { problem: FirestoreProblem | null; className?: string }) {
  if (!problem) return null;
  return (
    <div className={className}>
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-sage/50 px-5 py-4 text-sm">
        <CloudOff size={19} className="shrink-0 text-muted" aria-hidden />
        <p className="flex-1 text-muted">We can’t load the latest updates right now. Please try again shortly.</p>
        <Link href="/contact" className="font-bold text-forest underline underline-offset-4">Contact support</Link>
      </div>
    </div>
  );
}
