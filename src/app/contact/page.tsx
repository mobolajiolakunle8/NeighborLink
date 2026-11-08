"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Mail, MapPin, Phone, Send, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { startSupportMessage, submitContact } from "@/lib/api";
import { friendlyError, isEmail, isPhone } from "@/lib/utils";
import { Alert, Field, Spinner } from "@/components/ui";
import { Reveal } from "@/components/motion";

const EMPTY = { name: "", email: "", phone: "", subject: "", message: "" };

export default function ContactPage() {
  const { settings } = useSite();
  const { firebaseUser, profile } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const phoneHref = `tel:${settings.contactPhone.replace(/[\s-]/g, "")}`;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseUser) {
      if (form.name.trim().length < 2) return setError("Please enter your name.");
      if (!isEmail(form.email)) return setError("Please enter a valid email address.");
      if (form.phone && !isPhone(form.phone)) return setError("Please enter a valid phone number.");
    }
    if (form.subject.trim().length < 3) return setError("Please add a subject.");
    if (form.message.trim().length < 10) return setError("Message must be at least 10 characters.");
    setError(null);
    setSaving(true);
    try {
      if (firebaseUser && profile) {
        const cid = await startSupportMessage({ uid: firebaseUser.uid, name: profile.name }, form.subject, form.message);
        router.push(`/profile?message=${encodeURIComponent(cid)}#messages`);
        return;
      }
      await submitContact(form);
      setForm(EMPTY);
      setSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Reveal variant="up">
        <p className="eyebrow">Contact</p>
        <h1 className="section-title mt-2">Talk to us</h1>
        <p className="mt-2 max-w-2xl text-muted">Questions about a listing, your account or NeighbourLink in general? Messages go to the admin team. Signed-in members receive replies in their profile Messages box.</p>
      </Reveal>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <Reveal variant="left" className="space-y-4">
          <div className="space-y-4">
          <a href={phoneHref} className="card card-hover flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-forest text-gold"><Phone size={22} aria-hidden /></span>
            <span><span className="block text-xs font-bold uppercase tracking-wide text-muted">Call us</span><span className="text-lg font-extrabold">{settings.contactPhone}</span></span>
          </a>
          <div className="card flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sage"><Mail size={22} aria-hidden /></span>
            <span><span className="block text-xs font-bold uppercase tracking-wide text-muted">Email</span><span className="font-extrabold">{settings.contactEmail || "Official email coming soon"}</span></span>
          </div>
          <div className="card flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sage"><MapPin size={22} aria-hidden /></span>
            <span><span className="block text-xs font-bold uppercase tracking-wide text-muted">Location</span><span className="font-extrabold">{settings.address}</span></span>
          </div>
          <div className="flex gap-2 rounded-2xl border border-[#EAD9AE] bg-gold-soft p-5 text-sm font-semibold text-[#7A5A1E]">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
            {settings.emergencyDisclaimer}
          </div>
          </div>
        </Reveal>

        <Reveal variant="right" delay={120}>
        <form onSubmit={onSubmit} noValidate className="card p-6 sm:p-8" aria-label="Contact form">
          <h2 className="text-xl font-extrabold">Message the admin team</h2>
          {firebaseUser ? <div className="mt-3"><Alert kind="info">Sending as {profile?.name || firebaseUser.email}. Replies appear in <Link href="/profile#messages" className="underline">your profile Messages box</Link> and Updates.</Alert></div> : <p className="mt-2 text-sm text-muted">Want replies in your profile message box? <Link href="/login?next=/contact" className="font-bold underline">Log in first</Link>.</p>}
          {sent ? (
            <div className="mt-5"><Alert kind="success"><span className="flex items-center gap-2"><CheckCircle2 size={16} aria-hidden /> Message sent to the admin team. Log in next time to receive replies in your profile messages.</span></Alert></div>
          ) : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {!firebaseUser && <><Field label="Full name *"><input className="input" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Your name" autoComplete="name" /></Field>
            <Field label="Email *"><input type="email" className="input" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
            <Field label="Phone (optional)"><input className="input" inputMode="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="+234…" /></Field></>}
            <Field label="Subject *"><input className="input" value={form.subject} onChange={(e) => set("subject")(e.target.value)} placeholder="How can we help?" /></Field>
            <Field label="Message *" className="sm:col-span-2"><textarea className="input" rows={6} maxLength={3000} value={form.message} onChange={(e) => set("message")(e.target.value)} placeholder="Write your message…" /></Field>
          </div>
          {error && <p className="mt-4 flex items-center gap-1.5 text-sm font-bold text-danger" role="alert"><AlertCircle size={16} aria-hidden />{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary mt-5">
            {saving ? <><Spinner /> Sending…</> : <><Send size={16} aria-hidden /> Send to admin</>}
          </button>
        </form>
        </Reveal>
      </div>
    </div>
  );
}
