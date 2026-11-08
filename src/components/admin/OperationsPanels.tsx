"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { Ban, Check, CheckCircle2, Mail, RotateCcw, ShieldCheck, Star, Trash2, UserMinus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList, useNotice, usePagination } from "@/lib/hooks";
import {
  adminDeleteUserProfile, adminUpdateBusinessLocation, adminUpdateUser, bulkSetBusinessStatus, deleteBusiness, setVerification, deleteHelpPost, deleteMessage, setBusinessFeatured,
  setBusinessStatus, setHelpStatus, setMessageStatus, setReportStatus,
} from "@/lib/api";
import type {
  ActivityLog, Business, BusinessStatus, ContactMessage, HelpPost, Report, Role, UserProfile,
} from "@/lib/types";
import { formatDate, formatDateTime, friendlyError, spamSignals } from "@/lib/utils";
import { Alert, CardSkeleton, EmptyState, Field, Pagination, Spinner, StatusBadge } from "@/components/ui";
import BusinessLocationFields, { validCoordinatePair } from "@/components/BusinessLocationFields";

const PAGE = 10;

/** Shared table chrome: loading, error, empty and pagination handled once. */
function ListShell<T>({
  title, loading, error, items, emptyTitle, emptyText, notice, filters, children, pager,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  items: T[];
  emptyTitle: string;
  emptyText: string;
  notice?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  pager: ReturnType<typeof usePagination<T>>;
}) {
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{title} ({items.length})</h2>
        {filters}
      </div>
      {notice && <div className="mt-4">{notice}</div>}
      <div className="mt-4">
        {error ? <Alert kind="error">{error}</Alert> : loading ? <CardSkeleton count={1} className="h-10" /> : items.length === 0 ? (
          <EmptyState icon={Check} title={emptyTitle} text={emptyText} />
        ) : (
          <>
            {children}
            <Pagination page={pager.page} pages={pager.pages} onChange={pager.setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ business moderation

function AdminLocationEditor({ business, onClose }: { business: Business; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [latitude, setLatitude] = useState(business.latitude != null ? String(business.latitude) : "");
  const [longitude, setLongitude] = useState(business.longitude != null ? String(business.longitude) : "");
  const [busy, setBusy] = useState(false);
  const { notice, show } = useNotice();
  return <div className="mb-5 rounded-2xl border border-line bg-sage/30 p-5">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-extrabold">Map location: {business.name}</h3><button type="button" className="btn-ghost !text-xs" onClick={onClose}>Cancel</button></div>
    <BusinessLocationFields latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
    {notice && <div className="mt-3"><Alert kind={notice.kind}>{notice.text}</Alert></div>}
    <button type="button" disabled={busy || !validCoordinatePair(latitude, longitude)} className="btn-primary mt-4 !py-2 !text-sm" onClick={async () => {
      setBusy(true);
      try { await adminUpdateBusinessLocation(business.id, latitude.trim() ? Number(latitude) : null, longitude.trim() ? Number(longitude) : null, firebaseUser?.uid ?? ""); show("success", "Location saved. The public map updates immediately for approved listings."); }
      catch (err) { show("error", friendlyError(err)); } finally { setBusy(false); }
    }}>{busy && <Spinner />}Save location</button>
  </div>;
}

export function BusinessesPanel() {
  const { firebaseUser } = useAuth();
  const { categoryName, neighbourhoodName } = useSite();
  const { notice, show } = useNotice();
  const items = useLiveList<Business>("admin-businesses", () =>
    query(collection(getDb(), "businesses"), orderBy("createdAt", "desc"), limit(500)),
  );
  const [filter, setFilter] = useState<"pending" | "verification" | "approved" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [locationEdit, setLocationEdit] = useState<Business | null>(null);
  const rows = useMemo(() => {
    if (filter === "all") return items.data;
    if (filter === "verification") return items.data.filter((b) => b.verificationStatus === "requested");
    return items.data.filter((b) => b.status === filter);
  }, [items.data, filter]);
  const pager = usePagination(rows, PAGE);
  const uid = firebaseUser?.uid ?? "";
  const pageIds = pager.pageItems.map((b) => b.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  async function act(fn: () => Promise<void>, ok: string) {
    try { await fn(); show("success", ok); } catch (err) { show("error", friendlyError(err)); }
  }
  async function bulk(status: BusinessStatus) {
    const ids = [...selected];
    if (!ids.length || !confirm(`${status === "approved" ? "Approve" : "Reject"} ${ids.length} listing(s)?`)) return;
    setBulkBusy(true);
    try { const n = await bulkSetBusinessStatus(ids, status, uid); setSelected(new Set()); show("success", `${n} listing(s) ${status}.`); }
    catch (err) { show("error", friendlyError(err)); } finally { setBulkBusy(false); }
  }
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <ListShell
      title="Business listings"
      loading={items.loading}
      error={items.error}
      items={rows}
      emptyTitle={filter === "pending" ? "Nothing waiting for approval" : filter === "verification" ? "No verification requests" : "No listings in this view"}
      emptyText="New submissions appear here in real time."
      notice={notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      pager={pager}
      filters={
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
          {(["pending", "verification", "approved", "rejected", "all"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} className={`tab-btn ${filter === f ? "active" : ""}`} onClick={() => { setFilter(f); setSelected(new Set()); }}>
              {f === "verification" ? `Verification (${items.data.filter((b) => b.verificationStatus === "requested").length})` : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      {locationEdit && <AdminLocationEditor key={locationEdit.id} business={locationEdit} onClose={() => setLocationEdit(null)} />}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-sage p-3 text-sm">
          <span className="font-bold">{selected.size} selected</span>
          <button type="button" disabled={bulkBusy} className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => bulk("approved")}><Check size={13} /> Approve selected</button>
          <button type="button" disabled={bulkBusy} className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => bulk("rejected")}><X size={13} /> Reject selected</button>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      <div className="table-wrap">
        <table className="data">
          <thead><tr>
            <th><input type="checkbox" aria-label="Select all on page" checked={allOnPage} onChange={() => setSelected((s) => { const n = new Set(s); if (allOnPage) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id)); return n; })} /></th>
            <th>Business</th><th>Category / area</th><th>Owner</th><th>Status</th><th><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {pager.pageItems.map((b) => (
              <tr key={b.id}>
                <td><input type="checkbox" aria-label={`Select ${b.name}`} checked={selected.has(b.id)} onChange={() => toggle(b.id)} /></td>
                <td>
                  <Link href={`/business/${b.id}`} className="font-bold hover:underline">{b.name}</Link>
                  {b.isFeatured && <span className="badge badge-gold ml-2">Featured</span>}
                  {b.verificationStatus === "verified" && <span className="badge badge-forest ml-2">Verified</span>}
                  {b.verificationStatus === "requested" && <p className="mt-1 text-xs font-bold text-bronze">CAC: {b.cacNumber}{b.verificationNote ? ` — ${b.verificationNote}` : ""}</p>}
                  <p className="mt-0.5 max-w-xs truncate text-xs text-muted">{b.description}</p>
                </td>
                <td className="text-muted">{categoryName(b.categoryId) || "—"} / {neighbourhoodName(b.neighbourhoodId) || "Ibadan"}</td>
                <td>{b.ownerName || "—"}</td>
                <td><StatusBadge status={b.status} /></td>
                <td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {b.verificationStatus === "requested" && (<>
                      <a href="https://search.cac.gov.ng/" target="_blank" rel="noopener noreferrer" className="btn-ghost border border-line !px-3 !py-1.5 text-xs">Check CAC</a>
                      <button type="button" className="btn-ghost border border-[#CFE0D2] !px-3 !py-1.5 text-xs" onClick={() => act(() => setVerification(b.id, "verified", uid), "Business verified.")}><ShieldCheck size={13} /> Verify</button>
                      <button type="button" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => act(() => setVerification(b.id, "rejected", uid), "Verification declined.")}>Decline</button>
                    </>)}
                    {b.status !== "approved" && <button type="button" className="btn-ghost border border-[#CFE0D2] !px-3 !py-1.5 text-xs" onClick={() => act(() => setBusinessStatus(b.id, "approved", uid), "Listing approved and published.")}><Check size={13} aria-hidden /> Approve</button>}
                    {b.status !== "rejected" && <button type="button" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => act(() => setBusinessStatus(b.id, "rejected", uid), "Listing rejected.")}><X size={13} aria-hidden /> Reject</button>}
                    <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => act(() => setBusinessFeatured(b.id, !b.isFeatured, uid), b.isFeatured ? "Removed from featured." : "Featured on homepage.")}><Star size={13} aria-hidden /> {b.isFeatured ? "Unfeature" : "Feature"}</button>
                    <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => setLocationEdit(b)}>Location</button>
                    <button type="button" aria-label={`Delete ${b.name}`} className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => { if (confirm(`Permanently delete "${b.name}"?`)) act(() => deleteBusiness(b.id, uid), "Listing deleted."); }}><Trash2 size={13} aria-hidden /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}

// ------------------------------------------------------------------ users

export function UsersPanel() {
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const items = useLiveList<UserProfile>("admin-users", () => query(collection(getDb(), "users"), orderBy("createdAt", "desc"), limit(500)));
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.data.filter((u) => `${u.name} ${u.email} ${u.neighbourhood ?? ""}`.toLowerCase().includes(term)) : items.data;
  }, [items.data, search]);
  const pager = usePagination(rows, PAGE);
  const uid = firebaseUser?.uid ?? "";

  async function act(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      show("success", ok);
    } catch (err) {
      show("error", friendlyError(err));
    }
  }

  return (
    <ListShell
      title="Users"
      loading={items.loading}
      error={items.error}
      items={rows}
      emptyTitle="No users match"
      emptyText="Registered residents and business owners appear here."
      notice={notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      pager={pager}
      filters={
        <label className="w-full sm:w-72">
          <span className="sr-only">Search users</span>
          <input className="input !py-2 text-sm" placeholder="Search name, email, area…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      }
    >
      <p className="mb-3 text-xs text-muted">Users cannot grant themselves admin rights. Only an administrator can change a role here. Removing a profile does not delete the Firebase Auth login; that must be done in the Firebase Console.</p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {pager.pageItems.map((u) => {
              const self = u.uid === uid;
              return (
                <tr key={u.uid}>
                  <td><p className="font-bold">{u.name}{self && <span className="badge badge-sage ml-2">You</span>}</p><p className="text-xs text-muted">{u.email}</p></td>
                  <td>
                    <label className="sr-only" htmlFor={`role-${u.uid}`}>Role for {u.name}</label>
                    <select id={`role-${u.uid}`} disabled={self} value={u.role} className="input !w-36 !py-1.5 text-sm" onChange={(e) => act(() => adminUpdateUser(u.uid, { role: e.target.value as Role }, uid), "Role updated.")}>
                      <option value="resident">Resident</option><option value="business">Business</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="text-muted">{formatDate(u.createdAt)}</td>
                  <td><span className={`badge ${u.isSuspended ? "badge-red" : "badge-sage"}`}>{u.isSuspended ? "Suspended" : "Active"}</span>{u.isSuspended && u.suspendedReason && <p className="mt-1 max-w-[12rem] text-xs text-muted">{u.suspendedReason}</p>}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" disabled={self} className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => {
                        if (u.isSuspended) { act(() => adminUpdateUser(u.uid, { isSuspended: false, suspendedReason: null }, uid), "Account restored."); return; }
                        const reason = prompt(`Reason for suspending ${u.name}? (shown to the user)`, "Breach of community guidelines");
                        if (reason === null) return;
                        act(() => adminUpdateUser(u.uid, { isSuspended: true, suspendedReason: reason.trim().slice(0, 200) || "Breach of community guidelines" }, uid), "Account suspended.");
                      }}>
                        {u.isSuspended ? <><RotateCcw size={13} aria-hidden /> Restore</> : <><Ban size={13} aria-hidden /> Suspend</>}
                      </button>
                      <button type="button" disabled={self} aria-label={`Remove profile of ${u.name}`} className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => {
                        if (confirm(`Remove ${u.name}'s profile? They will no longer be able to use NeighbourLink.`)) act(() => adminDeleteUserProfile(u.uid, uid), "Profile removed.");
                      }}><UserMinus size={13} aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}

// ------------------------------------------------------------------ help board moderation

export function HelpPanel() {
  const { firebaseUser } = useAuth();
  const { neighbourhoodName } = useSite();
  const { notice, show } = useNotice();
  const items = useLiveList<HelpPost>("admin-help", () => query(collection(getDb(), "helpPosts"), orderBy("createdAt", "desc"), limit(500)));
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const helpRows = useMemo(() => flaggedOnly ? items.data.filter((p) => spamSignals(`${p.title} ${p.description}`).length > 0) : items.data, [items.data, flaggedOnly]);
  const pager = usePagination(helpRows, PAGE);
  const uid = firebaseUser?.uid ?? "";

  return (
    <ListShell title="Help board" loading={items.loading} error={items.error} items={helpRows} filters={<label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} /> Possible scams only</label>} emptyTitle="No help posts yet" emptyText="Requests and offers from neighbours appear here." notice={notice && <Alert kind={notice.kind}>{notice.text}</Alert>} pager={pager}>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Post</th><th>Type</th><th>Area</th><th>Author</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {pager.pageItems.map((p) => (
              <tr key={p.id}>
                <td><p className="font-bold">{p.title}</p><p className="max-w-xs truncate text-xs text-muted">{p.description}</p>{spamSignals(`${p.title} ${p.description}`).length > 0 && <p className="mt-1 text-xs font-bold text-danger">⚠ Possible scam: {spamSignals(`${p.title} ${p.description}`).join(", ")}</p>}</td>
                <td><span className={`badge ${p.type === "request" ? "badge-gold" : "badge-sage"}`}>{p.type}</span></td>
                <td className="text-muted">{neighbourhoodName(p.neighbourhoodId) || "Ibadan"}</td>
                <td>{p.authorName}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    {p.status === "open" ? (
                      <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={async () => { try { await setHelpStatus(p.id, "closed", uid); show("success", "Post closed."); } catch (err) { show("error", friendlyError(err)); } }}>Close</button>
                    ) : (
                      <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={async () => { try { await setHelpStatus(p.id, "open", uid); show("success", "Post reopened."); } catch (err) { show("error", friendlyError(err)); } }}>Reopen</button>
                    )}
                    <button type="button" aria-label="Delete post" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={async () => {
                      if (!confirm("Delete this post?")) return;
                      try { await deleteHelpPost(p.id, uid); show("success", "Post deleted."); } catch (err) { show("error", friendlyError(err)); }
                    }}><Trash2 size={13} aria-hidden /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}

// ------------------------------------------------------------------ reports

export function ReportsPanel() {
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const items = useLiveList<Report>("admin-reports", () => query(collection(getDb(), "reports"), orderBy("createdAt", "desc"), limit(300)));
  const [status, setStatus] = useState<"open" | "all">("open");
  const rows = useMemo(() => (status === "open" ? items.data.filter((r) => r.status === "open") : items.data), [items.data, status]);
  const pager = usePagination(rows, PAGE);
  const uid = firebaseUser?.uid ?? "";

  return (
    <ListShell
      title="Reports"
      loading={items.loading}
      error={items.error}
      items={rows}
      emptyTitle={status === "open" ? "No open reports" : "No reports yet"}
      emptyText="The community is quiet. Reports from residents appear here."
      notice={notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      pager={pager}
      filters={
        <div className="flex gap-2">
          <button type="button" aria-pressed={status === "open"} className={`tab-btn ${status === "open" ? "active" : ""}`} onClick={() => setStatus("open")}>Open</button>
          <button type="button" aria-pressed={status === "all"} className={`tab-btn ${status === "all" ? "active" : ""}`} onClick={() => setStatus("all")}>All</button>
        </div>
      }
    >
      <ul className="space-y-3">
        {pager.pageItems.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-gold">{r.targetType}</span>
              <span className="font-bold">{r.reason}</span>
              <span className="ml-auto"><StatusBadge status={r.status} /></span>
            </div>
            {r.details && <p className="mt-2 text-sm text-muted">{r.details}</p>}
            <p className="mt-2 text-xs text-[#8A9A8F]">Target ID: {r.targetId} • {formatDateTime(r.createdAt)}</p>
            {r.status === "open" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-ghost border border-[#CFE0D2] !px-3 !py-1.5 text-xs" onClick={async () => { try { await setReportStatus(r.id, "resolved", uid); show("success", "Report resolved."); } catch (err) { show("error", friendlyError(err)); } }}><CheckCircle2 size={13} aria-hidden /> Resolve</button>
                <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={async () => { try { await setReportStatus(r.id, "dismissed", uid); show("success", "Report dismissed."); } catch (err) { show("error", friendlyError(err)); } }}><X size={13} aria-hidden /> Dismiss</button>
                {r.targetType === "business" && (
                  <button type="button" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={async () => {
                    if (!confirm("Reject this business listing and resolve the report?")) return;
                    try {
                      await setBusinessStatus(r.targetId, "rejected" as BusinessStatus, uid);
                      await setReportStatus(r.id, "resolved", uid);
                      show("success", "Listing rejected and report resolved.");
                    } catch (err) { show("error", friendlyError(err)); }
                  }}><ShieldCheck size={13} aria-hidden /> Reject listing</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </ListShell>
  );
}

// ------------------------------------------------------------------ contact messages

export function MessagesPanel() {
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const items = useLiveList<ContactMessage>("admin-messages", () => query(collection(getDb(), "contactMessages"), orderBy("createdAt", "desc"), limit(300)));
  const pager = usePagination(items.data, PAGE);
  const uid = firebaseUser?.uid ?? "";

  return (
    <ListShell title="Contact messages" loading={items.loading} error={items.error} items={items.data} emptyTitle="No messages yet" emptyText="Messages from the contact form appear here." notice={notice && <Alert kind={notice.kind}>{notice.text}</Alert>} pager={pager}>
      <ul className="space-y-3">
        {pager.pageItems.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-extrabold">{m.subject}</p>
              <span className="ml-auto"><StatusBadge status={m.status} /></span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-forest/85">{m.message}</p>
            <p className="mt-2 text-xs text-[#8A9A8F]">From {m.name} • {m.email}{m.phone ? ` • ${m.phone}` : ""} • {formatDateTime(m.createdAt)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="btn-ghost border border-line !px-3 !py-1.5 text-xs"><Mail size={13} aria-hidden /> Reply by email</a>
              {m.status === "new" && <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={async () => { try { await setMessageStatus(m.id, "read", uid); } catch (err) { show("error", friendlyError(err)); } }}>Mark read</button>}
              {m.status !== "replied" && <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={async () => { try { await setMessageStatus(m.id, "replied", uid); show("success", "Marked as replied."); } catch (err) { show("error", friendlyError(err)); } }}>Mark replied</button>}
              <button type="button" aria-label="Delete message" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={async () => {
                if (!confirm("Delete this message?")) return;
                try { await deleteMessage(m.id, uid); show("success", "Message deleted."); } catch (err) { show("error", friendlyError(err)); }
              }}><Trash2 size={13} aria-hidden /></button>
            </div>
          </li>
        ))}
      </ul>
    </ListShell>
  );
}

// ------------------------------------------------------------------ activity logs

export function LogsPanel() {
  const items = useLiveList<ActivityLog>("admin-logs", () => query(collection(getDb(), "activityLogs"), orderBy("createdAt", "desc"), limit(500)));
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const actions = useMemo(() => [...new Set(items.data.map((l) => l.action))].sort(), [items.data]);
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.data.filter((l) => (!action || l.action === action) && (!t || `${l.details} ${l.userId ?? ""}`.toLowerCase().includes(t)));
  }, [items.data, action, search]);
  const pager = usePagination(rows, PAGE);
  return (
    <ListShell title="Activity logs" loading={items.loading} error={items.error} items={rows} emptyTitle="No matching activity" emptyText="Sign-ins, submissions and admin actions are recorded here." pager={pager}
      filters={<div className="flex flex-wrap gap-2">
        <select className="input !w-auto !py-2 text-sm" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action"><option value="">All actions</option>{actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}</select>
        <input className="input !w-56 !py-2 text-sm" placeholder="Search details or user ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search logs" />
      </div>}>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Action</th><th>Details</th><th>User ID</th><th>When</th></tr></thead>
          <tbody>
            {pager.pageItems.map((l) => (
              <tr key={l.id}>
                <td className="font-bold">{l.action.replace(/_/g, " ")}</td>
                <td className="max-w-xs truncate text-muted">{l.details || "—"}</td>
                <td className="font-mono text-xs text-muted">{l.userId ?? "system"}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListShell>
  );
}
