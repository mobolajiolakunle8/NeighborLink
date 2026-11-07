"use client";

import { useState, type FormEvent } from "react";
import { createBusiness, updateBusiness, type BusinessInput } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import type { Business } from "@/lib/types";
import { friendlyError, isEmail, isHttpUrl, isPhone } from "@/lib/utils";
import { Alert, Field, Spinner } from "@/components/ui";
import ImageUploadField from "@/components/ImageUploadField";

type FormState = Record<keyof BusinessInput, string>;

function toForm(b?: Business): FormState {
  return {
    name: b?.name ?? "",
    description: b?.description ?? "",
    categoryId: b?.categoryId ?? "",
    neighbourhoodId: b?.neighbourhoodId ?? "",
    phone: b?.phone ?? "",
    email: b?.email ?? "",
    address: b?.address ?? "",
    website: b?.website ?? "",
    openingHours: b?.openingHours ?? "",
    imageUrl: b?.imageUrl ?? "",
  };
}

function validate(f: FormState): string | null {
  if (f.name.trim().length < 3) return "Business name must be at least 3 characters.";
  if (f.description.trim().length < 20) return "Please describe your business in at least 20 characters.";
  if (f.description.trim().length > 4000) return "Description is too long (4000 characters maximum).";
  if (f.phone && !isPhone(f.phone)) return "Please enter a valid phone number, e.g. +234 903 000 0000.";
  if (f.email && !isEmail(f.email)) return "Please enter a valid business email address.";
  if (f.website && !isHttpUrl(f.website)) return "Website must start with https://";
  if (f.imageUrl && !isHttpUrl(f.imageUrl)) return "Image link must start with https://";
  return null;
}

/** Create or edit a business listing. Every save goes through admin review. */
export default function BusinessForm({
  mode,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: Business;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { firebaseUser, profile } = useAuth();
  const { activeCategories, activeNeighbourhoods } = useSite();
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseUser) return setError("Please log in to continue.");
    const problem = validate(form);
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    try {
      if (mode === "create") {
        await createBusiness({ uid: firebaseUser.uid, name: profile?.name ?? firebaseUser.displayName ?? "Owner" }, form);
      } else if (initial) {
        await updateBusiness(initial.id, form, firebaseUser.uid);
      }
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  const selectClass = "input";
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label={mode === "create" ? "New business listing" : "Edit business listing"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name *" className="sm:col-span-2">
          <input className="input" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Adebayo Fresh Provisions" maxLength={180} />
        </Field>
        <Field label="Category">
          <select className={selectClass} value={form.categoryId} onChange={(e) => set("categoryId")(e.target.value)}>
            <option value="">Select a category…</option>
            {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Neighbourhood">
          <select className={selectClass} value={form.neighbourhoodId} onChange={(e) => set("neighbourhoodId")(e.target.value)}>
            <option value="">Select a neighbourhood…</option>
            {activeNeighbourhoods.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Description * (min. 20 characters)" className="sm:col-span-2">
          <textarea className="input" rows={4} value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="What do you offer, and what makes you trusted?" />
        </Field>
        <Field label="Phone">
          <input className="input" value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="+234…" inputMode="tel" />
        </Field>
        <Field label="Business email">
          <input className="input" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="optional" />
        </Field>
        <Field label="Address / landmark">
          <input className="input" value={form.address} onChange={(e) => set("address")(e.target.value)} placeholder="e.g. Beside Iwo Road Mosque" />
        </Field>
        <Field label="Opening hours">
          <input className="input" value={form.openingHours} onChange={(e) => set("openingHours")(e.target.value)} placeholder="Mon–Sat 8am–6pm" />
        </Field>
        <Field label="Website (https://)" className="sm:col-span-2">
          <input className="input" value={form.website} onChange={(e) => set("website")(e.target.value)} placeholder="optional" />
        </Field>
        <div className="sm:col-span-2">
          <ImageUploadField label="Listing photo" value={form.imageUrl} onChange={set("imageUrl")} folder={`businesses/${firebaseUser?.uid ?? "unknown"}`} hint="JPG, PNG, WEBP or GIF — up to 5 MB." />
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {mode === "edit" && (
        <Alert kind="warning">Saving changes sends this listing back for admin review before it is shown publicly again.</Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <><Spinner /> Saving…</> : mode === "create" ? "Submit for approval" : "Save & resubmit"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost border border-line">Cancel</button>
      </div>
    </form>
  );
}
