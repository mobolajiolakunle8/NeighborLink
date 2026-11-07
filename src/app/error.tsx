"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset?: () => void;
  /** Provided by Next.js 16.2+: re-fetches and re-renders the failed segment. */
  unstable_retry?: () => void;
};

/** Route-level error boundary. Keeps the header and footer, and offers a retry. */
export default function RouteError({ error, reset, unstable_retry }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  function retry() {
    if (unstable_retry) unstable_retry();
    else if (reset) reset();
    else window.location.reload();
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle size={26} aria-hidden />
      </span>
      <h1 className="section-title mt-6">Something went wrong</h1>
      <p className="mt-3 text-muted">This page hit an unexpected problem. Please try again. If it keeps happening, contact us.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} className="btn-primary">
          <RotateCcw size={16} aria-hidden /> Try again
        </button>
        <Link href="/" className="btn-outline">Back to home</Link>
      </div>
    </div>
  );
}
