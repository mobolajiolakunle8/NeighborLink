import Link from "next/link";
import { ArrowLeft, Compass, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-sage text-forest">
        <Compass size={30} aria-hidden />
      </span>
      <p className="eyebrow mt-6">NeighbourLink · 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-muted">
        This link may be old or mistyped. Let&apos;s get you back to your community.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary"><ArrowLeft size={16} aria-hidden /> Back to home</Link>
        <Link href="/directory" className="btn-outline"><Search size={16} aria-hidden /> Browse directory</Link>
      </div>
    </div>
  );
}
