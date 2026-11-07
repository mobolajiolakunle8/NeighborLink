"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import {
  BadgeCheck, Bell, CheckCircle2, HeartHandshake, LogIn, LogOut, Pencil, PlusCircle, ShieldAlert, Store, Trash2, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList, useNotice } from "@/lib/hooks";
import {
  deleteBusiness, deleteHelpPost, deleteMyAccount, ensureProfile, setHelpStatus, updateMyProfile,
} from "@/lib/api";
import { enablePushNotifications, PUSH_CONFIGURED } from "@/lib/messaging";
import ImageUploadField from "@/components/ImageUploadField";
import BusinessForm from "@/components/BusinessForm";
import { Alert, EmptyState, Field, Spinner, StatusBadge } from "@/components/ui";
import type { Business, HelpPost, Role, UserProfile } from "@/lib/types";
import { friendlyError, isPhone } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { firebaseUser, profile, loading, logout } = useAuth();
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-10"><div className="skeleton h-10 w-64" /><div className="skeleton mt-6 h-64" /></div>;
  }

  if (!firebaseUser) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={LogIn}
          title="Log in to view your profile"
          text="Manage your details, listings, help posts and notifications in one place."
          action={<><Link href="/login" className="btn-primary">Log in</Link><Link href="/register" className="btn-outline">Create account</Link></>}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={BadgeCheck}
          title="Finish setting up your profile"
          text="Your account exists, but your profile details are missing. This takes one click."
          action={
            <button
              type="button"
              disabled={settingUp}
              onClick={async () => {
                setSettingUp(true);
                setSetupError(null);
                try { await ensureProfile(firebaseUser); } catch (err) { setSetupError(friendlyError(err)); } finally { setSettingUp(false); }
              }}
              className="btn-primary"
            >
              {settingUp ? <><Spinner /> Setting up…</> : "Complete setup"}
            </button>
          }
        />
        {setupError && <div className="mt-4"><Alert kind="error">{setupError}</Alert></div>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">My account</p>
          <h1 className="section-title mt-2 truncate">{profile.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {profile.email}
            <span className="badge badge-sage capitalize">{profile.role}</span>
            {firebaseUser.emailVerified ? <span className="badge badge-forest">Email verified</span> : <VerifyEmailButton />}
          </p>
        </div>
        <div className="flex gap-2">
          {profile.role === "admin" && <Link href="/dashboard" className="btn-gold">Admin dashboard</Link>}
          <button type="button" onClick={async () => { await logout(); router.push("/"); }} className="btn-ghost border border-line"><LogOut size={16} aria-hidden /> Logout</button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProfileForm profile={profile} />
        <div className="space-y-6">
          <MyListings uid={firebaseUser.uid} ownerName={profile.name} />
          <MyPosts uid={firebaseUser.uid} />
          <PushCard uid={firebaseUser.uid} />
          <DangerZone />
        </div>
      </div>
    </div>
  );
}

function VerifyEmailButton() {
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || !firebaseUser}
        className="badge badge-gold cursor-pointer disabled:opacity-60"
        onClick={async () => {
          if (!firebaseUser) return;
          setBusy(true);
          try { await sendEmailVerification(firebaseUser); show("success", "Verification email sent. Check your inbox."); }
          catch (err) { show("error", friendlyError(err)); }
          finally { setBusy(false); }
        }}
      >
        {busy ? "Sending…" : "Verify email"}
      </button>
      {notice && <span className={`text-xs font-bold ${notice.kind === "error" ? "text-danger" : "text-[#1F5C3D]"}`}>{notice.text}</span>}
    </span>
  );
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const { activeNeighbourhoods } = useSite();
  const { notice, show } = useNotice();
  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone ?? "",
    neighbourhood: profile.neighbourhood ?? "",
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    role: (profile.role === "admin" ? "resident" : profile.role) as Role,
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.name.trim().length < 2) return show("error", "Please enter your name.");
    if (form.phone && !isPhone(form.phone)) return show("error", "Please enter a valid phone number.");
    setBusy(true);
    try {
      await updateMyProfile(profile.uid, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        neighbourhood: form.neighbourhood || null,
        bio: form.bio.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        // Admins keep their role; everyone else can switch between resident and business.
        role: profile.role === "admin" ? "admin" : form.role,
      });
      show("success", "Profile saved.");
    } catch (err) {
      show("error", friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4 p-6" aria-label="Edit profile">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><Pencil size={18} aria-hidden /> Your details</h2>
      <Field label="Full name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone"><input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234…" /></Field>
        <Field label="Neighbourhood">
          <select className="input" value={form.neighbourhood} onChange={(e) => setForm({ ...form, neighbourhood: e.target.value })}>
            <option value="">Select…</option>
            {activeNeighbourhoods.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Bio"><textarea className="input" rows={3} maxLength={400} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="A little about you…" /></Field>
      <ImageUploadField label="Profile photo" value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} folder={`avatars/${profile.uid}`} />
      {profile.role !== "admin" && (
        <Field label="Account type" hint="Business owners can list businesses. Admin rights are granted only by administrators.">
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="resident">Resident</option>
            <option value="business">Business owner</option>
          </select>
        </Field>
      )}
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      <button type="submit" disabled={busy} className="btn-primary">{busy ? <><Spinner /> Saving…</> : "Save profile"}</button>
    </form>
  );
}

function MyListings({ uid, ownerName }: { uid: string; ownerName: string }) {
  const { categoryName, neighbourhoodName } = useSite();
  const { notice, show } = useNotice();
  const listings = useLiveList<Business>(`my-biz-${uid}`, () =>
    query(collection(getDb(), "businesses"), where("ownerId", "==", uid), orderBy("createdAt", "desc")),
  );
  const [mode, setMode] = useState<"none" | "create" | "edit">("none");
  const [editing, setEditing] = useState<Business | null>(null);

  return (
    <section id="my-listings" className="card scroll-mt-24 p-6" aria-labelledby="my-listings-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="my-listings-title" className="flex items-center gap-2 text-xl font-extrabold"><Store size={18} aria-hidden /> My businesses ({listings.data.length})</h2>
        {mode === "none" ? (
          <button type="button" onClick={() => setMode("create")} className="btn-primary !px-4 !py-2 text-sm"><PlusCircle size={15} aria-hidden /> New listing</button>
        ) : (
          <button type="button" onClick={() => { setMode("none"); setEditing(null); }} className="btn-ghost text-sm"><X size={15} aria-hidden /> Close</button>
        )}
      </div>

      {notice && <div className="mt-3"><Alert kind={notice.kind}>{notice.text}</Alert></div>}

      {mode !== "none" && (
        <div className="mt-5 rounded-2xl border border-[#CFE0D2] bg-sage/60 p-5">
          <BusinessForm
            mode={mode === "edit" ? "edit" : "create"}
            initial={editing ?? undefined}
            onDone={() => {
              setMode("none");
              setEditing(null);
              show("success", mode === "edit" ? "Listing updated and sent for review." : "Submitted! An administrator will review your listing shortly.");
            }}
            onCancel={() => { setMode("none"); setEditing(null); }}
          />
          {ownerName && <span className="sr-only">Listing owner: {ownerName}</span>}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {listings.error ? (
          <Alert kind="error">{listings.error}</Alert>
        ) : listings.loading ? (
          <div className="skeleton h-20" />
        ) : listings.data.length === 0 ? (
          <p className="text-sm text-muted">No listings yet. Add your first business above.</p>
        ) : (
          listings.data.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <div className="min-w-0 flex-1">
                <Link href={`/business/${b.id}`} className="block truncate font-extrabold hover:underline">{b.name}</Link>
                <p className="truncate text-xs text-muted">{categoryName(b.categoryId) || "No category"} • {neighbourhoodName(b.neighbourhoodId) || "Ibadan"}</p>
                <div className="mt-1.5"><StatusBadge status={b.status} /></div>
              </div>
              <button type="button" className="btn-ghost border border-line !p-2.5" aria-label={`Edit ${b.name}`} onClick={() => { setEditing(b); setMode("edit"); }}>
                <Pencil size={15} aria-hidden />
              </button>
              <button
                type="button"
                className="btn-ghost border border-danger-line !p-2.5 text-danger"
                aria-label={`Delete ${b.name}`}
                onClick={async () => {
                  if (!confirm(`Delete "${b.name}"? This cannot be undone.`)) return;
                  try { await deleteBusiness(b.id, uid); show("success", "Listing deleted."); } catch (err) { show("error", friendlyError(err)); }
                }}
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MyPosts({ uid }: { uid: string }) {
  const { neighbourhoodName } = useSite();
  const { notice, show } = useNotice();
  const posts = useLiveList<HelpPost>(`my-help-${uid}`, () =>
    query(collection(getDb(), "helpPosts"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(50)),
  );
  return (
    <section className="card p-6" aria-labelledby="my-posts-title">
      <h2 id="my-posts-title" className="flex items-center gap-2 text-xl font-extrabold"><HeartHandshake size={18} aria-hidden /> My help posts ({posts.data.length})</h2>
      {notice && <div className="mt-3"><Alert kind={notice.kind}>{notice.text}</Alert></div>}
      <div className="mt-4 space-y-3">
        {posts.loading ? (
          <div className="skeleton h-16" />
        ) : posts.data.length === 0 ? (
          <p className="text-sm text-muted">No posts yet. <Link href="/help" className="font-bold underline">Post to the help board</Link>.</p>
        ) : (
          posts.data.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.title}</p>
                <p className="text-xs text-muted">{p.type} • {neighbourhoodName(p.neighbourhoodId) || "Ibadan"} • <StatusBadge status={p.status} /></p>
              </div>
              {p.status === "open" && (
                <button type="button" className="btn-ghost border border-line !py-2 text-xs" onClick={async () => {
                  try { await setHelpStatus(p.id, "fulfilled", uid); show("success", "Marked as fulfilled."); } catch (err) { show("error", friendlyError(err)); }
                }}>Fulfilled</button>
              )}
              <button type="button" className="btn-ghost border border-danger-line !p-2.5 text-danger" aria-label="Delete post" onClick={async () => {
                if (!confirm("Delete this post?")) return;
                try { await deleteHelpPost(p.id, uid); show("success", "Post deleted."); } catch (err) { show("error", friendlyError(err)); }
              }}>
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PushCard({ uid }: { uid: string }) {
  const { notice, show } = useNotice();
  const [permission, setPermission] = useState<string>("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  return (
    <section className="card p-6" aria-labelledby="push-title">
      <h2 id="push-title" className="flex items-center gap-2 text-xl font-extrabold"><Bell size={18} aria-hidden /> Notifications</h2>
      <p className="mt-2 text-sm text-muted">Get a push alert for important neighbourhood announcements. You can turn this off in your browser settings at any time.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !PUSH_CONFIGURED || permission === "granted" || permission === "denied"}
          className="btn-outline !py-2 text-sm"
          onClick={async () => {
            setBusy(true);
            try {
              await enablePushNotifications(uid);
              setPermission("granted");
              show("success", "Notifications enabled on this device.");
            } catch (err) {
              show("error", friendlyError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {permission === "granted" ? <><CheckCircle2 size={15} aria-hidden /> Enabled</> : "Enable notifications"}
        </button>
        {permission === "denied" && <span className="text-xs font-bold text-danger">Blocked in browser settings.</span>}
        {!PUSH_CONFIGURED && <span className="text-xs font-bold text-muted">Available once a web push key is configured.</span>}
      </div>
      {notice && <div className="mt-3"><Alert kind={notice.kind}>{notice.text}</Alert></div>}
    </section>
  );
}

function DangerZone() {
  const router = useRouter();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (profile?.role === "admin") {
    return (
      <section className="rounded-2xl border border-danger-line bg-danger-soft p-5">
        <h2 className="flex items-center gap-2 font-extrabold text-danger"><ShieldAlert size={18} aria-hidden /> Delete account</h2>
        <p className="mt-1 text-sm text-danger/80">Administrator accounts can&apos;t be self-deleted. Ask another administrator for help.</p>
      </section>
    );
  }

  async function onDelete(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password) return setError("Enter your password to confirm.");
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(password);
      router.push("/?deleted=1");
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-danger-line bg-danger-soft p-5" aria-labelledby="danger-title">
      <h2 id="danger-title" className="flex items-center gap-2 font-extrabold text-danger"><ShieldAlert size={18} aria-hidden /> Delete account</h2>
      <p className="mt-1 text-sm text-danger/80">This permanently removes your profile, listings, help posts, reviews and photos. This cannot be undone.</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-danger mt-3 !px-5 !py-2.5 text-sm">I want to delete my account</button>
      ) : (
        <form onSubmit={onDelete} className="mt-3 space-y-3" aria-label="Confirm account deletion">
          <Field label="Confirm with your password">
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="btn-danger !py-2.5 text-sm">{busy ? <><Spinner /> Deleting…</> : "Permanently delete"}</button>
            <button type="button" onClick={() => { setOpen(false); setPassword(""); setError(null); }} className="btn-ghost border border-danger-line">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
