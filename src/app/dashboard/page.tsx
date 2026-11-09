"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3, FileText, Flag, HeartHandshake, Mail, Megaphone, MapPin, ScrollText,
  Settings2, ShieldCheck, Store, Tags, Users, MessageCircle, Bot, LockKeyhole,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Alert, CardSkeleton, EmptyState } from "@/components/ui";
import Overview from "@/components/admin/Overview";
import SettingsPanel from "@/components/admin/SettingsPanel";
import SupportInboxPanel from "@/components/admin/SupportInboxPanel";
import AiAssistantPanel from "@/components/admin/AiAssistantPanel";
import AdminMessagesButton from "@/components/admin/AdminMessagesButton";
import { AnnouncementsPanel, LegalPanel, TaxonomyPanel } from "@/components/admin/ContentPanels";
import {
  BusinessesPanel, HelpPanel, LogsPanel, MessagesPanel, ReportsPanel, UsersPanel,
} from "@/components/admin/OperationsPanels";

type TabId =
  | "overview" | "settings" | "categories" | "neighbourhoods" | "businesses" | "users"
  | "announcements" | "help" | "reports" | "messages" | "memberMessages" | "assistant" | "legal" | "logs";

const TABS: { id: TabId; label: string; icon: typeof BarChart3; group: "Insights" | "Content" | "Operations" }[] = [
  { id: "overview", label: "Overview", icon: BarChart3, group: "Insights" },
  { id: "logs", label: "Activity logs", icon: ScrollText, group: "Insights" },
  { id: "settings", label: "Website settings", icon: Settings2, group: "Content" },
  { id: "categories", label: "Categories", icon: Tags, group: "Content" },
  { id: "neighbourhoods", label: "Neighbourhoods", icon: MapPin, group: "Content" },
  { id: "announcements", label: "Announcements", icon: Megaphone, group: "Content" },
  { id: "legal", label: "Legal pages", icon: FileText, group: "Content" },
  { id: "businesses", label: "Businesses", icon: Store, group: "Operations" },
  { id: "users", label: "Users", icon: Users, group: "Operations" },
  { id: "help", label: "Help board", icon: HeartHandshake, group: "Operations" },
  { id: "reports", label: "Reports", icon: Flag, group: "Operations" },
  { id: "memberMessages", label: "Member messages", icon: MessageCircle, group: "Operations" },
  { id: "assistant", label: "AI assistant", icon: Bot, group: "Operations" },
  { id: "messages", label: "Contact form", icon: Mail, group: "Operations" },
];

export default function DashboardPage() {
  const { isAdmin, isSignedIn, loading, profile, firebaseUser, adminMfaRequired, mfaVerified } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");
  const [threadId, setThreadId] = useState<string | undefined>();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested && TABS.some(t => t.id === requested)) setTab(requested as TabId);
    const thread = params.get("thread");
    if (thread && /^support_[A-Za-z0-9_-]+$/.test(thread)) { setThreadId(thread); setTab("memberMessages"); }
  }, []);
  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-10"><CardSkeleton count={2} className="h-24" /></div>;
  }

  const roleLabel = profile?.role || "resident";
  const mfaMissing = profile?.role === "admin" && adminMfaRequired && !mfaVerified;
  const locked = !isAdmin || mfaMissing;
  const lockedText = !isSignedIn
    ? "Please log in with an administrator account to continue."
    : profile?.isSuspended
      ? "This account has been suspended."
      : mfaMissing
        ? "Administrator MFA is required. Sign out, sign in with your authenticator code, or complete MFA setup from your profile."
        : `You are signed in as ${profile?.name || firebaseUser?.email || "member"} (current role: ${roleLabel}). Administrator access is granted only by an existing administrator or directly in the Firebase Console."`;

  if (locked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={mfaMissing ? LockKeyhole : ShieldCheck}
          title={mfaMissing ? "Administrator MFA required" : "Administrator access required"}
          text={lockedText}
          action={<div className="flex flex-wrap justify-center gap-2">
            {!isSignedIn ? <><Link href="/login" className="btn-primary">Log in</Link><Link href="/register" className="btn-outline">Register</Link></> : <Link href="/profile" className="btn-primary">Open my profile</Link>}
          </div>}
        />
      </div>
    );
  }

  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const groups = ["Insights", "Content", "Operations"] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Admin dashboard</p>
          <h1 className="section-title mt-2">Manage NeighbourLink</h1>
          <p className="mt-1 text-sm text-muted">Signed in as {profile?.name}. Every change you publish is saved to Firebase and appears live on all connected devices.</p>
        </div>
        <AdminMessagesButton onClick={() => setTab("memberMessages")} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Dashboard sections" className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)} className={`tab-btn flex shrink-0 items-center gap-1.5 ${tab === t.id ? "active" : ""}`}>
                <t.icon size={15} aria-hidden />{t.label}
              </button>
            ))}
          </div>
          <div className="hidden space-y-5 lg:block">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-bronze">{g}</p>
                <ul className="space-y-1">
                  {TABS.filter((t) => t.group === g).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-current={tab === t.id ? "page" : undefined}
                        onClick={() => setTab(t.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${tab === t.id ? "bg-forest text-cream" : "text-forest hover:bg-sage"}`}
                      >
                        <t.icon size={16} aria-hidden />{t.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <section aria-label={current.label} className="min-w-0">
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight">{current.label}</h2>
          {tab === "overview" && <Overview />}
          {tab === "settings" && <SettingsPanel />}
          {tab === "categories" && <TaxonomyPanel kind="categories" />}
          {tab === "neighbourhoods" && <TaxonomyPanel kind="neighbourhoods" />}
          {tab === "announcements" && <AnnouncementsPanel />}
          {tab === "legal" && <LegalPanel />}
          {tab === "businesses" && <BusinessesPanel />}
          {tab === "users" && <UsersPanel />}
          {tab === "help" && <HelpPanel />}
          {tab === "reports" && <ReportsPanel />}
          {tab === "memberMessages" && <SupportInboxPanel initialThreadId={threadId} />}
          {tab === "assistant" && <AiAssistantPanel />}
          {tab === "messages" && <MessagesPanel />}
          {tab === "logs" && <LogsPanel />}
        </section>
      </div>
      {profile?.role === "admin" && <Alert kind="info">Tip: changes are saved only when you press the publish or save button for that section.</Alert>}
    </div>
  );
}
