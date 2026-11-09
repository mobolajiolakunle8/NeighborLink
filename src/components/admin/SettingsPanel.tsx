"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { saveSettings } from "@/lib/api";
import type { NavLink, SiteSettings } from "@/lib/types";
import { friendlyError, isHttpUrl, isPhone, safeHex } from "@/lib/utils";
import { Alert, Field, Spinner } from "@/components/ui";
import ImageUploadField from "@/components/ImageUploadField";

type SocialRow = { name: string; url: string };
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Every site-wide setting. Edits are kept as a draft, so incoming live updates from
 * other admins never wipe what you are typing. Saving publishes to every browser.
 */
export default function SettingsPanel() {
  const { settings } = useSite();
  const { firebaseUser } = useAuth();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [social, setSocial] = useState<SocialRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (dirty) return;
    setForm(settings);
    setSocial(Object.entries(settings.socialLinks ?? {}).map(([name, url]) => ({ name, url })));
  }, [settings, dirty]);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
  };

  function updateNav(index: number, patch: Partial<NavLink>) {
    set("navLinks", form.navLinks.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function moveNav(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= form.navLinks.length) return;
    const next = [...form.navLinks];
    [next[index], next[target]] = [next[target], next[index]];
    set("navLinks", next);
  }

  function updateSocial(index: number, patch: Partial<SocialRow>) {
    setDirty(true);
    setSocial((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (form.siteName.trim().length < 2) return setError("Website name is required.");
    if (!isPhone(form.contactPhone)) return setError("Enter a valid contact phone number.");
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) return setError("Enter a valid contact email, or leave it blank.");
    for (const key of ["primaryColor", "sageColor", "goldColor", "bgColor"] as const) {
      if (!HEX.test(form[key])) return setError("Colours must be 6-digit hex values such as #172D2A.");
    }
    if (form.logoUrl && !isHttpUrl(form.logoUrl)) return setError("Logo link must start with https://");
    if (form.heroImageUrl && !isHttpUrl(form.heroImageUrl)) return setError("Hero image link must start with https://");
    if (form.navLinks.some((l) => !l.label.trim() || !(l.href.startsWith("/") || isHttpUrl(l.href)))) {
      return setError("Every navigation item needs a label and a link (starting with / or https://).");
    }
    const socialLinks: Record<string, string> = {};
    for (const row of social) {
      const name = row.name.trim().toLowerCase();
      if (!name && !row.url.trim()) continue;
      if (!name || !isHttpUrl(row.url)) return setError("Each social link needs a name and a full https:// URL.");
      socialLinks[name] = row.url.trim();
    }

    setSaving(true);
    try {
      await saveSettings({ ...form, socialLinks, navLinks: form.navLinks.map((l) => ({ ...l, label: l.label.trim() })) }, firebaseUser?.uid ?? "");
      setDirty(false);
      setSuccess("Settings published. Every open browser has been updated.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  const text = (key: keyof SiteSettings, label: string, hint?: string, multi = false) => (
    <Field label={label} hint={hint} className={multi ? "sm:col-span-2" : ""}>
      {multi ? (
        <textarea className="input" rows={3} value={String(form[key] ?? "")} onChange={(e) => set(key, e.target.value as SiteSettings[typeof key])} />
      ) : (
        <input className="input" value={String(form[key] ?? "")} onChange={(e) => set(key, e.target.value as SiteSettings[typeof key])} />
      )}
    </Field>
  );

  const colour = (key: "primaryColor" | "sageColor" | "goldColor" | "bgColor", label: string) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={safeHex(form[key], "#000000")} onChange={(e) => set(key, e.target.value)} className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-white p-1" />
        <input className="input" value={form[key]} onChange={(e) => set(key, e.target.value)} />
      </div>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Website settings">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-xl font-extrabold">Website settings</h2>
          <p className="text-sm text-muted">Branding, homepage, contact details, SEO, navigation and footer. Changes publish to every visitor instantly.</p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button type="button" className="btn-ghost border border-line" onClick={() => { setDirty(false); setError(null); }}>
              <RotateCcw size={15} aria-hidden /> Discard edits
            </button>
          )}
          <button type="submit" disabled={saving || !dirty} className="btn-primary">
            {saving ? <><Spinner /> Publishing…</> : <><Save size={16} aria-hidden /> Save settings</>}
          </button>
        </div>
      </div>
      {dirty && <Alert kind="warning">You have unsaved changes. Live updates from other admins won&apos;t overwrite your draft.</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="px-1 text-sm font-extrabold uppercase tracking-wider text-bronze">Brand</legend>
        {text("siteName", "Website name")}
        {text("tagline", "Tagline")}
        <div className="sm:col-span-2">
          <ImageUploadField label="Logo" value={form.logoUrl} onChange={(url) => set("logoUrl", url)} folder="site" variant="square" hint="A square image works best." />
        </div>
        {text("bannerText", "Top banner message (leave empty to hide)", undefined, true)}
        {colour("primaryColor", "Primary colour — Deep Forest")}
        {colour("goldColor", "Accent colour — Warm Gold")}
        {colour("sageColor", "Soft accent — Soft Sage")}
        {colour("bgColor", "Page background — Off-white")}
      </fieldset>

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="px-1 text-sm font-extrabold uppercase tracking-wider text-bronze">Homepage</legend>
        {text("heroTitle", "Hero headline", undefined, true)}
        {text("heroSubtitle", "Hero text", undefined, true)}
        <div className="sm:col-span-2">
          <ImageUploadField label="Hero banner image" value={form.heroImageUrl} onChange={(url) => set("heroImageUrl", url)} folder="site" variant="cover" />
        </div>
        {text("heroCtaLabel", "Hero button label")}
        {text("ctaTitle", "Call-to-action title")}
        {text("ctaText", "Call-to-action text", undefined, true)}
      </fieldset>

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="px-1 text-sm font-extrabold uppercase tracking-wider text-bronze">Contact</legend>
        {text("contactPhone", "Telephone", "Shown in the header, footer and contact page.")}
        {text("contactEmail", "Email (add when official)", "Leave blank — the site shows “coming soon”.")}
        {text("address", "Address / area", undefined, true)}
      </fieldset>

      <fieldset className="card space-y-4 p-6">
        <legend className="px-1 text-sm font-extrabold uppercase tracking-wider text-bronze">Social links</legend>
        {social.length === 0 && <p className="text-sm text-muted">No social links yet. Add them when your official handles exist.</p>}
        {social.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <input className="input" aria-label="Platform name" placeholder="facebook, instagram, x…" value={row.name} onChange={(e) => updateSocial(i, { name: e.target.value })} />
            <input className="input" aria-label="Profile URL" placeholder="https://…" value={row.url} onChange={(e) => updateSocial(i, { url: e.target.value })} />
            <button type="button" className="btn-ghost border border-danger-line text-danger" aria-label="Remove social link" onClick={() => { setDirty(true); setSocial((r) => r.filter((_, j) => j !== i)); }}><Trash2 size={15} aria-hidden /></button>
          </div>
        ))}
        <button type="button" className="btn-ghost border border-line" onClick={() => { setDirty(true); setSocial((r) => [...r, { name: "", url: "" }]); }}>
          <Plus size={15} aria-hidden /> Add social link
        </button>
      </fieldset>

      <fieldset className="card space-y-4 p-6">
        <legend className="px-1 text-sm font-extrabold uppercase tracking-wider text-bronze">Navigation menu</legend>
        {form.navLinks.map((l, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
            <input className="input" aria-label="Menu label" value={l.label} onChange={(e) => updateNav(i, { label: e.target.value })} />
            <input className="input" aria-label="Menu link" value={l.href} onChange={(e) => updateNav(i, { href: e.target.value })} />
            <label className="flex items-center gap-2 px-2 text-sm font-bold">
              <input type="checkbox" checked={l.enabled} onChange={(e) => updateNav(i, { enabled: e.target.checked })} className="h-4 w-4" /> Show
            </label>
            <div className="flex gap-1">
              <button type="button" className="btn-ghost border border-line !p-2" aria-label="Move up" onClick={() => moveNav(i, -1)}><ArrowUp size={14} aria-hidden /></button>
              <button type="button" className="btn-ghost border border-line !p-2" aria-label="Move down" onClick={() => moveNav(i, 1)}><ArrowDown size={14} aria-hidden /></button>
            </div>
            <button type="button" className="btn-ghost border border-danger-line text-danger !p-2" aria-label="Remove menu item" onClick={() => set("navLinks", form.navLinks.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden /></button>
          </div>
        ))}
        <button type="button" className="btn-ghost border border-line" onClick={() => set("navLinks", [...form.navLinks, { label: "New page", href: "/", enabled: true }])}>
          <Plus size={15} aria-hidden /> Add menu item
        </button>
      </fieldset>

      <fieldset className="card grid gap-4 p-6 sm:grid-cols-2">
        <legend className="px-1 text-sm font-extrabold uppercase tracking-wider text-bronze">SEO & footer</legend>
        {text("seoTitle", "Search title (meta title)", "Appears in Google results and browser tabs.", true)}
        {text("seoDescription", "Search description (meta description)", undefined, true)}
        {text("footerText", "Footer tagline", undefined, true)}

      </fieldset>
    </form>
  );
}
