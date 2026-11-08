"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, Phone, PlusCircle, ShieldCheck, User, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";

export default function Header() {
  const { settings } = useSite();
  const { firebaseUser, profile, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navLinks = settings.navLinks.filter(l => l.enabled);
  const displayName = profile?.name ?? firebaseUser?.displayName ?? "";
  const phoneHref = `tel:${settings.contactPhone.replace(/[\s-]/g, "")}`;

  useEffect(() => { setOpen(false); }, [pathname]);

  async function handleLogout() {
    try { await logout(); } finally { window.location.href = "/"; }
  }

  return (
    <header className="sticky top-0 z-50">
      {settings.bannerText && <div className="bg-gold px-4 py-2 text-center text-sm font-bold text-forest">{settings.bannerText}</div>}
      <div className="bg-forest text-cream">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${settings.siteName} — home`}>
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-cover" />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold text-lg font-extrabold text-forest">{settings.siteName.slice(0, 1)}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-lg font-extrabold leading-none">{settings.siteName}</span>
              <span className="block truncate text-[11px] text-sage/80">{settings.tagline}</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {navLinks.map(l => (
              <Link key={`${l.label}-${l.href}`} href={l.href} aria-current={pathname === l.href ? "page" : undefined} className={`rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-white/10 hover:text-white ${pathname === l.href ? "bg-white/10 text-white" : "text-sage"}`}>{l.label}</Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <a href={phoneHref} className="flex items-center gap-1.5 text-sm font-bold text-gold transition hover:text-white"><Phone size={15} aria-hidden />{settings.contactPhone}</a>
            {firebaseUser ? (
              <>
                <Link href="/profile" className="btn-ghost !text-cream hover:!bg-white/10"><User size={16} aria-hidden />{displayName.split(" ")[0] || "Profile"}</Link>
                {isAdmin && <Link href="/dashboard" className="btn-gold !px-4 !py-2 text-sm"><ShieldCheck size={16} aria-hidden />Admin</Link>}
                <button type="button" onClick={handleLogout} className="btn-ghost !text-cream hover:!bg-white/10"><LogOut size={16} aria-hidden />Logout</button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-white/10">Login</Link>
                <Link href="/register" className="btn-gold !px-4 !py-2 text-sm"><PlusCircle size={16} aria-hidden />Join free</Link>
              </>
            )}
          </div>
          <button type="button" className="rounded-lg p-2 transition hover:bg-white/10 lg:hidden" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"}>{open ? <X aria-hidden /> : <Menu aria-hidden />}</button>
        </div>
        {open && (
          <div id="mobile-nav" className="space-y-1 border-t border-white/10 px-4 pb-4 pt-3 lg:hidden">
            {navLinks.map(l => <Link key={`${l.label}-${l.href}`} href={l.href} className="block rounded-xl px-3 py-2.5 font-semibold transition hover:bg-white/10">{l.label}</Link>)}
            <div className="flex flex-wrap gap-2 pt-3">
              {firebaseUser ? (
                <>
                  <Link href="/profile" className="btn-outline !border-cream !py-2 !text-sm !text-cream">My profile</Link>
                  {isAdmin && <Link href="/dashboard" className="btn-gold !py-2 text-sm">Admin dashboard</Link>}
                  <button type="button" onClick={handleLogout} className="btn-outline !border-cream !py-2 !text-sm !text-cream">Logout</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-outline !border-cream !py-2 !text-sm !text-cream">Login</Link>
                  <Link href="/register" className="btn-gold !py-2 text-sm">Join free</Link>
                </>
              )}
            </div>
            <a href={phoneHref} className="flex items-center gap-2 pt-3 text-sm font-bold text-gold"><Phone size={15} aria-hidden />{settings.contactPhone}</a>
          </div>
        )}
      </div>
    </header>
  );
}
