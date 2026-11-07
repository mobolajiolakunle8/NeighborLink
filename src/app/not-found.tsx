import Link from "next/link";
import { Compass, Home, Search } from "lucide-react";

/**
 * Branded 404. If you ever see this page, Next.js is running correctly and the
 * URL simply doesn't exist. Vercel's grey "404 NOT_FOUND" page means the app
 * itself isn't being served (see DEPLOYMENT.md → Troubleshooting).
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-forest text-gold">
        <Compass size={26} aria-hidden />
      </span>
      <p className="eyebrow mt-6">Error 404</p>
      <h1 className="section-title mt-2">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">
        The link may be broken, or the page may have moved. Try the business directory, or head back home.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          <Home size={16} aria-hidden /> Back to home
        </Link>
        <Link href="/directory" className="btn-outline">
          <Search size={16} aria-hidden /> Browse directory
        </Link>
      </div>
    </div>
  );
}
