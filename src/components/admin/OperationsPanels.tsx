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
  adminDeleteUserProfile, adminUpdateUser, deleteBusiness, deleteHelpPost, deleteMessage, setBusinessFeatured,
  setBusinessStatus, setHelpStatus, setMessageStatus, setReportStatus,
} from "@/lib/api";
import type {
  ActivityLog, Business, BusinessStatus, ContactMessage, HelpPost, Report, Role, UserProfile,
} from "@/lib/types";
import { formatDate, formatDateTime, friendlyError } from "@/lib/utils";
import { Alert, CardSkeleton, EmptyState, Pagination, StatusBadge } from "@/components/ui";

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

export function BusinessesPanel() {
  const { firebaseUser } = useAuth();
  const { categoryName, neighbourhoodName } = useSite();
  const { notice, show } = useNotice();
  const items = useLiveList<Business>("admin-businesses", () =>
    query(collection(getDb(), "businesses"), orderBy("createdAt", "desc"), limit(500)),
  );
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const rows = useMemo(() => (filter === "all" ? items.data : items.data.filter((b) => b.status === filter)), [items.data, filter]);
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
      title="Business listings"
      loading={items.loading}
      error={items.error}
      items={rows}
      emptyTitle={filter === "pending" ? "Nothing waiting for approval" : "No listings in this view"}
      emptyText="New submissions appear here in real time."
      notice={notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      pager={pager}
      filters={
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} className={`tab-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Business</th><th>Category / area</th><th>Owner</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {pager.pageItems.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/business/${b.id}`} className="font-bold hover:underline">{b.name}</Link>
                  {b.isFeatured && <span className="badge badge-gold ml-2">Featured</span>}
                  <p className="mt-0.5 max-w-xs truncate text-xs text-muted">{b.description}</p>
                </td>
                <td className="text-muted">{categoryName(b.categoryId) || "—"} / {neighbourhoodName(b.neighbourhoodId) || "Ibadan"}</td>
                <td>{b.ownerName || "—"}</td>
                <td><StatusBadge status={b.status} /></td>
                <td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {b.status !== "approved" && (
                      <button type="button" className="btn-ghost border border-[#CFE0D2] !px-3 !py-1.5 text-xs" onClick={() => act(() => setBusinessStatus(b.id, "approved", uid), "Listing approved and published.")}><Check size={13} aria-hidden /> Approve</button>
                    )}
                    {b.status !== "rejected" && (
                      <button type="button" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => act(() => setBusinessStatus(b.id, "rejected", uid), "Listing rejected.")}><X size={13} aria-hidden /> Reject</button>
                    )}
                    <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => act(() => setBusinessFeatured(b.id, !b.isFeatured, uid), b.isFeatured ? "Removed from featured." : "Featured on homepage.")}>
                      <Star size={13} aria-hidden /> {b.isFeatured ? "Unfeature" : "Feature"}
                    </button>
                    <button type="button" aria-label={`Delete ${b.name}`} className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => {
                      if (confirm(`Permanently delete "${b.name}"?`)) act(() => deleteBusiness(b.id, uid), "Listing deleted.");
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
                  <td><span className={`badge ${u.isSuspended ? "badge-red" : "badge-sage"}`}>{u.isSuspended ? "Suspended" : "Active"}</span></td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" disabled={self} className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => act(() => adminUpdateUser(u.uid, { isSuspended: !u.isSuspended }, uid), u.isSuspended ? "Account restored." : "Account suspended.")}>
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
  const pager = usePagination(items.data, PAGE);
  const uid = firebaseUser?.uid ?? "";

  return (
    <ListShell title="Help board" loading={items.loading} error={items.error} items={items.data} emptyTitle="No help posts yet" emptyText="Requests and offers from neighbours appear here." notice={notice && <Alert kind={notice.kind}>{notice.text}</Alert>} pager={pager}>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Post</th><th>Type</th><th>Area</th><th>Author</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {pager.pageItems.map((p) => (
              <tr key={p.id}>
                <td><p className="font-bold">{p.title}</p><p className="max-w-xs truncate text-xs text-muted">{p.description}</p></td>
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
              <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="btn-ghost border border-line !px-3 !py-1.5 text-xs"><Mail size={13} aria-hidden /> Reply by email</a>
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
  const items = useLiveList<ActivityLog>("admin-logs", () => query(collection(getDb(), "activityLogs"), orderBy("createdAt", "desc"), limit(300)));
  const pager = usePagination(items.data, PAGE);
  return (
    <ListShell title="Activity logs" loading={items.loading} error={items.error} items={items.data} emptyTitle="No activity yet" emptyText="Sign-ins, submissions and admin actions are recorded here." pager={pager}>
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
