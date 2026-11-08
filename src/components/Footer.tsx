"use client";

import Link from "next/link";
import { Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { isHttpUrl } from "@/lib/utils";

export default function Footer() {
  const { settings } = useSite();
  const social = Object.entries(settings.socialLinks ?? {}).filter(([, url]) => isHttpUrl(url));
  const navLinks = settings.navLinks.filter(l => l.enabled);
  return (
    <footer className="mt-16 bg-forest text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <p className="text-xl font-extrabold">{settings.siteName}</p>
          <p className="mt-2 text-sm leading-relaxed text-sage/80">{settings.footerText}</p>
          <div className="mt-4 space-y-2 text-sm">
            <p className="flex items-center gap-2"><Phone size={15} className="text-gold" aria-hidden /><a href={`tel:${settings.contactPhone.replace(/[\s-]/g, "")}`} className="hover:text-gold">{settings.contactPhone}</a></p>
            {settings.contactEmail ? <p className="flex items-center gap-2"><Mail size={15} className="text-gold" aria-hidden /><a href={`mailto:${settings.contactEmail}`} className="hover:text-gold">{settings.contactEmail}</a></p> : <p className="text-xs text-sage/60">Official email address coming soon — reach us by phone or the contact form.</p>}
            <p className="flex items-center gap-2"><MapPin size={15} className="text-gold" aria-hidden />{settings.address}</p>
          </div>
          {social.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{social.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="badge badge-gold capitalize">{name}</a>)}</div>}
        </div>
        <div>
          <p className="mb-3 font-bold">Explore</p>
          <ul className="space-y-2 text-sm text-sage/85">{navLinks.map(l => <li key={`${l.label}-${l.href}`}><Link href={l.href} className="hover:text-gold">{l.label}</Link></li>)}<li><Link href="/register" className="hover:text-gold">List your business</Link></li></ul>
        </div>
        <div>
          <p className="mb-3 font-bold">Account</p>
          <ul className="space-y-2 text-sm text-sage/85"><li><Link href="/login" className="hover:text-gold">Login</Link></li><li><Link href="/register" className="hover:text-gold">Create account</Link></li><li><Link href="/profile" className="hover:text-gold">My profile</Link></li><li><Link href="/contact" className="hover:text-gold">Contact us</Link></li></ul>
        </div>
        <div>
          <p className="mb-3 font-bold">Legal & safety</p>
          <ul className="space-y-2 text-sm text-sage/85"><li><Link href="/privacy" className="hover:text-gold">Privacy Policy</Link></li><li><Link href="/terms" className="hover:text-gold">Terms of Service</Link></li></ul>
          <p className="mt-4 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-sage/80"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />{settings.emergencyDisclaimer}</p>
        </div>
      </div>
      <div className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-sage/60 sm:flex-row sm:px-6"><p>© {new Date().getFullYear()} {settings.siteName}. Made for Ibadan.</p><p>{settings.tagline}</p></div></div>
    </footer>
  );
}
