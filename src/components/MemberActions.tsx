"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Check, MessageCircle, Share2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMember } from "@/context/MemberContext";
import { conversationId, setSaved, startConversation } from "@/lib/api";
import { friendlyError } from "@/lib/utils";
import { Alert, Spinner } from "./ui";

function loginRedirect(router: ReturnType<typeof useRouter>) {
  router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
}

export function SaveButton({ businessId, compact = false }: { businessId: string; compact?: boolean }) {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { savedIds } = useMember();
  const [busy, setBusy] = useState(false);
  const saved = savedIds.has(businessId);
  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!firebaseUser) return loginRedirect(router);
    setBusy(true);
    try { await setSaved(firebaseUser.uid, businessId, !saved); } catch { /* ignore */ } finally { setBusy(false); }
  }
  if (compact) {
    return (
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save business"}
        className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-forest shadow transition hover:bg-sage disabled:opacity-60">
        {saved ? <BookmarkCheck size={17} className="fill-gold text-forest" /> : <Bookmark size={17} />}
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} className="btn-outline !px-4 !py-2 text-sm">
      {busy ? <Spinner /> : saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? "Saved" : "Save"}
    </button>
  );
}

export function ShareButton({ title, path, label = "Share" }: { title: string; path: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true); setTimeout(() => setDone(false), 2000);
    } catch { /* cancelled */ }
  }
  return (
    <button type="button" onClick={share} className="btn-ghost border border-line !py-2 text-sm">
      {done ? <Check size={16} /> : <Share2 size={16} />} {done ? "Link copied" : label}
    </button>
  );
}

/** Opens a private message to the admin team about a business or help post. */
export function MessageButton({
  target, label = "Send a message",
}: { target: { type: "business" | "help"; id: string; title: string; ownerId?: string; ownerName?: string }; label?: string }) {
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();
  const { conversations } = useMember();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = firebaseUser ? conversations.find((c) => c.id === conversationId(target.type, target.id, firebaseUser.uid)) : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setBusy(true); setError(null);
    try {
      const cid = await startConversation({ uid: firebaseUser.uid, name: profile?.name || firebaseUser.displayName || "Neighbour" }, target, text);
      router.push(`/profile?message=${encodeURIComponent(cid)}#messages`);
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary !py-2.5 text-sm" onClick={() => {
        if (!firebaseUser) return loginRedirect(router);
        if (existing) return router.push(`/inbox/${existing.id}`);
        setOpen(true);
      }}>
        <MessageCircle size={16} /> {existing ? "View admin conversation" : label}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="w-full space-y-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold">Message admin about “{target.title}”</p>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-sage"><X size={16} /></button>
      </div>
      <textarea className="input" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hello! I'd like to ask about…" autoFocus />
      <p className="text-xs text-muted">Sent privately to the NeighbourLink admin team, not the listing owner. Replies appear in your profile Messages box. Never share OTPs, PINs or bank details.</p>
      {error && <Alert kind="error">{error}</Alert>}
      <button type="submit" disabled={busy || text.trim().length < 2} className="btn-primary w-full !py-2.5 text-sm">{busy ? <><Spinner /> Sending…</> : "Send to admin"}</button>
    </form>
  );
}
