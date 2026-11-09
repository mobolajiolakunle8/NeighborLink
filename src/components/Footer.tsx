"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { isHttpUrl } from "@/lib/utils";
import { Reveal } from "@/components/motion";

export default function Footer() {
  const { settings } = useSite();
  const social = Object.entries(settings.socialLinks ?? {}).filter(([, url]) => isHttpUrl(url));
  const navLinks = settings.navLinks.filter(l => l.enabled);
  return (
    <footer className="mt-16 bg-forest text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <Reveal variant="up">
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
        </Reveal>
        <Reveal variant="up" delay={90}>
          <div>
            <p className="mb-3 font-bold">Explore</p>
            <ul className="space-y-2 text-sm text-sage/85">{navLinks.map(l => <li key={`${l.label}-${l.href}`}><Link href={l.href} className="transition hover:text-gold">{l.label}</Link></li>)}<li><Link href="/register" className="transition hover:text-gold">List your business</Link></li></ul>
          </div>
        </Reveal>
        <Reveal variant="up" delay={180}>
          <div>
            <p className="mb-3 font-bold">Account</p>
            <ul className="space-y-2 text-sm text-sage/85"><li><Link href="/login" className="transition hover:text-gold">Login</Link></li><li><Link href="/register" className="transition hover:text-gold">Create account</Link></li><li><Link href="/profile" className="transition hover:text-gold">My profile</Link></li><li><Link href="/contact" className="transition hover:text-gold">Contact us</Link></li></ul>
          </div>
        </Reveal>
        <Reveal variant="up" delay={270}>
          <div>
            <p className="mb-3 font-bold">Legal & safety</p>
            <ul className="space-y-2 text-sm text-sage/85"><li><Link href="/privacy" className="transition hover:text-gold">Privacy Policy</Link></li><li><Link href="/terms" className="transition hover:text-gold">Terms of Service</Link></li></ul>
          </div>
        </Reveal>
      </div>
      <div className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-sage/60 sm:flex-row sm:px-6"><p>© {new Date().getFullYear()} {settings.siteName}. Made for Ibadan.</p><p>{settings.tagline}</p></div></div>
    </footer>
  );
}
