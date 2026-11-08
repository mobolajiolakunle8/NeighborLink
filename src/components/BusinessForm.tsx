"use client";

import { useState, type FormEvent } from "react";
import { createBusiness, updateBusiness, type BusinessInput } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import type { Business } from "@/lib/types";
import { friendlyError, isEmail, isHttpUrl, isPhone, whatsappNumber } from "@/lib/utils";
import { Alert, Field, Spinner } from "@/components/ui";
import ImageUploadField from "@/components/ImageUploadField";
import BusinessLocationFields, { validCoordinatePair } from "@/components/BusinessLocationFields";

type FormState = Omit<Record<keyof BusinessInput, string>, "whatsappEnabled" | "latitude" | "longitude"> & { whatsappEnabled: boolean; latitude: string; longitude: string };
function toForm(b?: Business): FormState {
  return {
    name: b?.name ?? "", description: b?.description ?? "", categoryId: b?.categoryId ?? "",
    neighbourhoodId: b?.neighbourhoodId ?? "", phone: b?.phone ?? "", email: b?.email ?? "",
    address: b?.address ?? "", website: b?.website ?? "", openingHours: b?.openingHours ?? "",
    imageUrl: b?.imageUrl ?? "",
    whatsappEnabled: b?.whatsappEnabled ?? false,
    latitude: b?.latitude != null ? String(b.latitude) : "", longitude: b?.longitude != null ? String(b.longitude) : "",
  };
}
function validate(f: FormState): string | null {
  if (!validCoordinatePair(f.latitude, f.longitude)) return "Please set both map coordinates correctly, or leave both empty.";
  if (f.name.trim().length < 3) return "Business name must be at least 3 characters.";
  if (f.description.trim().length < 20) return "Please describe your business in at least 20 characters.";
  if (f.description.trim().length > 4000) return "Description is too long (4000 characters maximum).";
  if (f.phone && !isPhone(f.phone)) return "Please enter a valid phone number, e.g. +234 903 000 0000.";
  if (f.whatsappEnabled && !whatsappNumber(f.phone)) return "WhatsApp needs a valid Nigerian phone number, e.g. 0803 000 0000.";
  if (f.email && !isEmail(f.email)) return "Please enter a valid business email address.";
  if (f.website && !isHttpUrl(f.website)) return "Website must start with https://";
  if (f.imageUrl && !isHttpUrl(f.imageUrl)) return "Image link must start with https://";
  return null;
}

export default function BusinessForm({ mode, initial, onDone, onCancel }: { mode: "create" | "edit"; initial?: Business; onDone: () => void; onCancel: () => void }) {
  const { firebaseUser, profile } = useAuth();
  const { activeCategories, activeNeighbourhoods } = useSite();
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: Exclude<keyof FormState, "whatsappEnabled" | "latitude" | "longitude">) => (value: string) => setForm(f => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseUser) return setError("Please log in to continue.");
    const problem = validate(form);
    if (problem) return setError(problem);
    setError(null); setSaving(true);
    const input: BusinessInput = { ...form, latitude: form.latitude.trim() ? Number(form.latitude) : null, longitude: form.longitude.trim() ? Number(form.longitude) : null };
    try {
      if (mode === "create") await createBusiness({ uid: firebaseUser.uid, name: profile?.name ?? firebaseUser.displayName ?? "Owner" }, input);
      else if (initial) await updateBusiness(initial.id, input, firebaseUser.uid);
      onDone();
    } catch (err) { setError(friendlyError(err)); }
    finally { setSaving(false); }
  }

  const selectClass = "input";
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={mode === "create" ? "New business listing" : "Edit business listing"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name *" className="sm:col-span-2"><input className="input" value={form.name} onChange={e => set("name")(e.target.value)} placeholder="e.g. Adebayo Fresh Provisions" maxLength={180} /></Field>
        <Field label="Category"><select className={selectClass} value={form.categoryId} onChange={e => set("categoryId")(e.target.value)}><option value="">Select a category…</option>{activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Neighbourhood"><select className={selectClass} value={form.neighbourhoodId} onChange={e => set("neighbourhoodId")(e.target.value)}><option value="">Select a neighbourhood…</option>{activeNeighbourhoods.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
        <Field label="Description * (min. 20 characters)" className="sm:col-span-2"><textarea className="input" rows={4} value={form.description} onChange={e => set("description")(e.target.value)} placeholder="What do you offer, and what makes you trusted?" /></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={e => set("phone")(e.target.value)} placeholder="+234…" inputMode="tel" /></Field>
        <label className="flex items-start gap-2 self-end pb-3 text-sm text-muted"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.whatsappEnabled} onChange={e => setForm(f => ({ ...f, whatsappEnabled: e.target.checked }))} /><span>Customers can reach me on <strong className="text-forest">WhatsApp</strong> at this number</span></label>
        <Field label="Business email"><input className="input" type="email" value={form.email} onChange={e => set("email")(e.target.value)} placeholder="optional" /></Field>
        <Field label="Address / landmark"><input className="input" value={form.address} onChange={e => set("address")(e.target.value)} placeholder="e.g. Beside Iwo Road Mosque" /></Field>
        <Field label="Opening hours"><input className="input" value={form.openingHours} onChange={e => set("openingHours")(e.target.value)} placeholder="Mon–Sat 8am–6pm" /></Field>
        <Field label="Website (https://)" className="sm:col-span-2"><input className="input" value={form.website} onChange={e => set("website")(e.target.value)} placeholder="optional" /></Field>
        <BusinessLocationFields latitude={form.latitude} longitude={form.longitude} onChange={(latitude, longitude) => setForm(f => ({ ...f, latitude, longitude }))} />
        <div className="sm:col-span-2"><ImageUploadField label="Business cover photo" value={form.imageUrl} onChange={set("imageUrl")} folder={`businesses/${firebaseUser?.uid ?? "unknown"}`} variant="cover" /></div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {mode === "edit" && <Alert kind="warning">Saving changes sends this listing back for admin review before it is shown publicly again.</Alert>}
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving} className="btn-primary">{saving ? <><Spinner /> Saving…</> : mode === "create" ? "Submit for approval" : "Save & resubmit"}</button><button type="button" onClick={onCancel} className="btn-ghost border border-line">Cancel</button></div>
    </form>
  );
}
