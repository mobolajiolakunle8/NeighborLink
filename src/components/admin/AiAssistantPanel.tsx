"use client";

import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, orderBy, query } from "firebase/firestore";
import { Bot, Check, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { useLiveList, useNotice } from "@/lib/hooks";
import type { AssistantLog } from "@/lib/types";
import { formatDateTime, friendlyError } from "@/lib/utils";
import { Alert, CardSkeleton, EmptyState, Spinner } from "@/components/ui";

const INTENT_LABELS: Record<string, string> = {
  fallback: "Not answered",
  empty: "Empty question",
  emergency: "Emergency query",
};
function intentLabel(intent: string) { return INTENT_LABELS[intent] ?? intent.replace(/-/g, " "); }

export default function AiAssistantPanel() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? "";
  const logs = useLiveList<AssistantLog>("ai-assistant-logs", () =>
    query(collection(getDb(), "assistantLogs"), orderBy("createdAt", "desc"), limit(500)),
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "gaps" | "emergency" | "reviewed">("all");
  const [shown, setShown] = useState(20);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { notice, show } = useNotice();

  const rows = useMemo(() => logs.data.filter(l => {
    if (filter === "gaps" && l.intent !== "fallback" && l.intent !== "empty") return false;
    if (filter === "emergency" && l.intent !== "emergency") return false;
    if (filter === "reviewed" && l.reviewed) return false;
    const q = search.trim().toLowerCase();
    return !q || `${l.question} ${l.answer} ${l.intent}`.toLowerCase().includes(q);
  }), [logs.data, filter, search]);

  async function act(fn: () => Promise<void>, ok: string, id: string) {
    setBusyId(id);
    try { await fn(); show("success", ok); } catch (err) { show("error", friendlyError(err)); } finally { setBusyId(null); }
  }

  const gaps = logs.data.filter(l => l.intent === "fallback" || l.intent === "empty").length;
  const emergencies = logs.data.filter(l => l.intent === "emergency").length;
  const unreviewed = logs.data.filter(l => !l.reviewed).length;

  return (
    <div className="space-y-4">
      <Alert kind="info">Every question asked to the on-site assistant and the answer it gave is logged here. Use the “Not answered” filter to find gaps in the assistant’s knowledge.</Alert>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total questions", value: logs.data.length },
          { label: "Not answered", value: gaps },
          { label: "Emergency queries", value: emergencies },
          { label: "Unreviewed", value: unreviewed },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-2xl font-extrabold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "gaps", "emergency", "reviewed"] as const).map(f => (
            <button key={f} type="button" className={`tab-btn !py-2 !text-xs ${filter === f ? "active" : ""}`} onClick={() => { setFilter(f); setShown(20); }}>
              {f === "all" ? "All" : f === "gaps" ? `Not answered (${gaps})` : f === "emergency" ? `Emergency (${emergencies})` : `Unreviewed (${unreviewed})`}
            </button>
          ))}
          <label className="relative ml-auto min-w-52 flex-1 sm:max-w-xs">
            <span className="sr-only">Search assistant questions</span>
            <Search size={15} className="absolute left-3 top-3 text-muted" aria-hidden />
            <input className="input !py-2 !pl-9 !text-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…" />
          </label>
        </div>
      </div>

      {logs.error ? <Alert kind="error">{logs.error}</Alert> : logs.loading ? <CardSkeleton count={2} className="h-16" /> : rows.length === 0 ? (
        <EmptyState icon={Bot} title="No assistant conversations yet" text="Questions asked on the website appear here in real time." />
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, shown).map(l => (
            <li key={l.id} className={`card p-4 ${l.reviewed ? "" : "border-l-4 border-l-gold"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${l.intent === "emergency" ? "badge-red" : l.intent === "fallback" || l.intent === "empty" ? "badge-gold" : "badge-sage"}`}>{intentLabel(l.intent)}</span>
                {!l.reviewed && <span className="text-xs font-bold text-bronze">New</span>}
                <span className="ml-auto text-xs text-muted">{formatDateTime(l.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm font-bold">{l.question}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted">{l.answer}</p>
              {l.links?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.links.map(link => <Link key={link.href + link.label} href={link.href} className="rounded-full bg-sage px-2.5 py-1 text-xs font-bold text-forest transition hover:bg-gold-soft">{link.label} →</Link>)}
                </div>
              )}
              <p className="mt-2 text-[11px] text-[#8A9A8F]">Asked from {l.pagePath || "unknown page"}{l.uid ? ` · member ${l.uid.slice(0, 8)}…` : " · guest"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!l.reviewed && (
                  <button type="button" disabled={busyId === l.id} className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => act(async () => {
                    await import("@/lib/api").then(m => m.markAssistantLogReviewed(l.id, uid));
                  }, "Marked as reviewed.", l.id)}>{busyId === l.id ? <Spinner /> : <Check size={13} aria-hidden />} Mark reviewed</button>
                )}
                <button type="button" disabled={busyId === l.id} aria-label="Delete log" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" onClick={() => {
                  if (!confirm("Delete this assistant log?")) return;
                  void act(async () => { await import("@/lib/api").then(m => m.deleteAssistantLog(l.id, uid)); }, "Log deleted.", l.id);
                }}><Trash2 size={13} aria-hidden /></button>
              </div>
            </li>
          ))}
          {rows.length > shown && <li className="text-center"><button type="button" className="btn-outline !py-2 !text-sm" onClick={() => setShown(n => n + 20)}>Show more</button></li>}
        </ul>
      )}
    </div>
  );
}
