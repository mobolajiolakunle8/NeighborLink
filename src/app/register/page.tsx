"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeartHandshake, Store, UserPlus } from "lucide-react";
import { registerUser, type RegisterInput } from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { friendlyError, isEmail, isPhone } from "@/lib/utils";
import { Alert, Field, Spinner } from "@/components/ui";

type FormState = RegisterInput & { confirm: string; terms: boolean };
const EMPTY: FormState = { name: "", email: "", password: "", confirm: "", role: "resident", phone: "", neighbourhood: "", terms: false };

export default function RegisterPage() {
  const router = useRouter();
  const { activeNeighbourhoods } = useSite();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  function validate(): string | null {
    if (form.name.trim().length < 2) return "Please enter your full name.";
    if (!isEmail(form.email)) return "Please enter a valid email address.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    if (form.phone && !isPhone(form.phone)) return "Please enter a valid phone number.";
    if (!form.terms) return "Please accept the Terms and Privacy Policy to continue.";
    return null;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await registerUser(form);
      router.push("/profile");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const roleCard = (value: "resident" | "business", title: string, text: string, Icon: typeof Store) => (
    <button
      type="button"
      onClick={() => set("role", value)}
      aria-pressed={form.role === value}
      className={`rounded-2xl border-2 p-4 text-left transition ${form.role === value ? "border-forest bg-sage" : "border-line hover:border-forest/40"}`}
    >
      <Icon size={22} aria-hidden />
      <span className="mt-2 block font-extrabold">{title}</span>
      <span className="mt-0.5 block text-xs text-muted">{text}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <div className="card p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest text-gold"><UserPlus size={22} aria-hidden /></span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Join NeighbourLink</h1>
        <p className="mt-1 text-sm text-muted">Free forever. Choose how you&apos;ll use the community:</p>

        <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Account type">
          {roleCard("resident", "Resident", "Browse, review, request & offer help", HeartHandshake)}
          {roleCard("business", "Business owner", "List your business in the directory", Store)}
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" aria-label="Create account">
          <Field label="Full name *"><input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="e.g. Adaeze Okafor" autoComplete="name" /></Field>
          <Field label="Email *"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input" placeholder="you@example.com" autoComplete="email" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password * (min. 8)"><input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} className="input" autoComplete="new-password" /></Field>
            <Field label="Confirm password *"><input type="password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} className="input" autoComplete="new-password" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone (optional)"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" placeholder="+234…" inputMode="tel" /></Field>
            <Field label="Neighbourhood">
              <select value={form.neighbourhood} onChange={(e) => set("neighbourhood", e.target.value)} className="input">
                <option value="">Select…</option>
                {activeNeighbourhoods.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
          </div>

          <label className="flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-forest)]" />
            <span>I agree to the <Link href="/terms" className="font-bold text-forest underline">Terms of Service</Link> and <Link href="/privacy" className="font-bold text-forest underline">Privacy Policy</Link>.</span>
          </label>

          {error && <Alert kind="error">{error}</Alert>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <><Spinner /> Creating account…</> : "Create free account"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-extrabold text-forest underline">Log in</Link></p>
      </div>
    </div>
  );
}
