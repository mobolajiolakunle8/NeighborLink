"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, KeyRound } from "lucide-react";
import { loginUser, sendPasswordReset } from "@/lib/api";
import { friendlyError, isEmail } from "@/lib/utils";
import { Alert, Field, Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: "login" | "reset") { setMode(next); setError(null); setSuccess(null); }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!isEmail(email)) return setError("Please enter a valid email address.");
    setBusy(true);
    try {
      if (mode === "reset") {
        await sendPasswordReset(email);
        setSuccess("If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.");
        return;
      }
      if (!password) return setError("Please enter your password.");
      const role = await loginUser(email, password);
      router.push(role === "admin" ? "/dashboard" : "/profile");
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest text-gold">{mode === "login" ? <LogIn size={22} aria-hidden /> : <KeyRound size={22} aria-hidden />}</span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{mode === "login" ? "Welcome back" : "Reset your password"}</h1>
        <p className="mt-1 text-sm text-muted">{mode === "login" ? "Log in to manage your listings, posts and profile." : "We'll email you a link to choose a new password."}</p>
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" aria-label={mode === "login" ? "Login form" : "Password reset form"}>
          <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="you@example.com" autoComplete="email" /></Field>
          {mode === "login" && <Field label="Password"><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="Your password" autoComplete="current-password" /></Field>}
          {error && <Alert kind="error">{error}</Alert>}
          {success && <Alert kind="success">{success}</Alert>}
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? <><Spinner /> {mode === "login" ? "Logging in…" : "Sending…"}</> : mode === "login" ? "Log in" : "Send reset link"}</button>
        </form>
        <div className="mt-5 flex flex-col gap-2 text-center text-sm text-muted">
          {mode === "login" ? <button type="button" className="font-bold text-forest underline" onClick={() => switchMode("reset")}>Forgot password?</button> : <button type="button" className="font-bold text-forest underline" onClick={() => switchMode("login")}>Back to login</button>}
          <p>New to NeighbourLink? <Link href="/register" className="font-extrabold text-forest underline">Create a free account</Link></p>
        </div>
      </div>
    </div>
  );
}
