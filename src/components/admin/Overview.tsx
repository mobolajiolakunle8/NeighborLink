"use client";

import { useEffect, useState } from "react";
import {
  collection, getCountFromServer, getDocs, limit, orderBy, query, where, type DocumentData, type Query,
} from "firebase/firestore";
import { Database, Flag, HeartHandshake, Mail, Megaphone, RefreshCw, Store, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList, useNotice } from "@/lib/hooks";
import { initializeDefaults } from "@/lib/api";
import type { ActivityLog, Business } from "@/lib/types";
import { formatDateTime, friendlyError } from "@/lib/utils";
import { Alert, CardSkeleton, Spinner } from "@/components/ui";

export default function Overview() {
  const { usingDefaults, problem } = useSite();
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const logs = useLiveList<ActivityLog>("admin-logs-recent", () =>
    query(collection(getDb(), "activityLogs"), orderBy("createdAt", "desc"), limit(8)),
  );
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [top, setTop] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    const db = getDb();
    const counts: Record<string, Query<DocumentData>> = {
      users: collection(db, "users"),
      approved: query(collection(db, "businesses"), where("status", "==", "approved")),
      pending: query(collection(db, "businesses"), where("status", "==", "pending")),
      helpPosts: collection(db, "helpPosts"),
      openReports: query(collection(db, "reports"), where("status", "==", "open")),
      newMessages: query(collection(db, "contactMessages"), where("status", "==", "new")),
      announcements: collection(db, "announcements"),
    };
    setError(null);
    Promise.all(
      Object.entries(counts).map(async ([key, q]) => [key, (await getCountFromServer(q)).data().count] as const),
    )
      .then((entries) => setStats(Object.fromEntries(entries)))
      .catch((err) => setError(friendlyError(err)));

    getDocs(query(collection(db, "businesses"), where("status", "==", "approved"), orderBy("views", "desc"), limit(5)))
      .then((snap) => setTop(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Business)))
      .catch(() => setTop([]));
  }, [version]);

  const cards = [
    { label: "Registered users", value: stats?.users, icon: Users },
    { label: "Approved listings", value: stats?.approved, icon: Store },
    { label: "Awaiting approval", value: stats?.pending, icon: Store },
    { label: "Help-board posts", value: stats?.helpPosts, icon: HeartHandshake },
    { label: "Announcements", value: stats?.announcements, icon: Megaphone },
    { label: "Open reports", value: stats?.openReports, icon: Flag },
    { label: "New messages", value: stats?.newMessages, icon: Mail },
  ];

  return (
    <div className="space-y-6">
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      {problem?.setupRequired && (
        <Alert kind="warning">
          Live data is temporarily unavailable. Please contact your site administrator.
        </Alert>
      )}
      {error && !problem && <Alert kind="error">{error}</Alert>}

      {usingDefaults && !problem && (
        <div className="card flex flex-col gap-4 border-gold/60 bg-gold-soft p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-extrabold text-[#7A5A1E]"><Database size={18} aria-hidden /> Initialise editable content</p>
            <p className="mt-1 text-sm text-[#7A5A1E]/85">Categories and neighbourhoods are currently built in. Save them to Firestore so you can edit, hide or add to them live. Existing items are never overwritten.</p>
          </div>
          <button
            type="button"
            disabled={initializing || !firebaseUser}
            className="btn-primary shrink-0"
            onClick={async () => {
              setInitializing(true);
              try {
                const created = await initializeDefaults(firebaseUser?.uid ?? "");
                show("success", `Saved defaults: ${created.categories} categories, ${created.neighbourhoods} neighbourhoods, ${created.legal} legal pages.`);
                setVersion((v) => v + 1);
              } catch (err) {
                show("error", friendlyError(err));
              } finally {
                setInitializing(false);
              }
            }}
          >
            {initializing ? <><Spinner /> Saving…</> : "Initialise defaults"}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Overview</h2>
        <button type="button" onClick={() => setVersion((v) => v + 1)} className="btn-ghost border border-line"><RefreshCw size={15} aria-hidden /> Refresh counts</button>
      </div>

      {!stats && !error ? (
        <CardSkeleton count={3} className="h-16" />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="card p-5">
              <c.icon size={20} className="text-bronze" aria-hidden />
              <p className="mt-2 text-3xl font-extrabold">{c.value ?? "—"}</p>
              <p className="text-sm text-muted">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-lg font-extrabold">Most viewed listings</h3>
          {top.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No approved listings with views yet.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {top.map((b, i) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl bg-sage/60 px-4 py-2.5">
                  <span className="truncate text-sm font-bold">{i + 1}. {b.name}</span>
                  <span className="badge badge-sage shrink-0">{b.views} views</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-extrabold">Recent activity</h3>
          {logs.loading ? (
            <div className="mt-3 skeleton h-40" />
          ) : logs.data.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No activity recorded yet.</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
              {logs.data.map((l) => (
                <li key={l.id} className="border-b border-[#EEF1ED] pb-2 text-sm last:border-0">
                  <p className="font-bold">{l.action.replace(/_/g, " ")}</p>
                  {l.details && <p className="truncate text-xs text-muted">{l.details}</p>}
                  <p className="text-xs text-[#8A9A8F]">{formatDateTime(l.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
