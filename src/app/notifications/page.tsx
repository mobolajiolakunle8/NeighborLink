"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Bell, CheckCheck, LogIn, MessageCircle, ShieldAlert, Star, Store, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMember } from "@/context/MemberContext";
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import type { NotificationType } from "@/lib/types";
import { formatDateTime, friendlyError } from "@/lib/utils";
import { Alert, CardSkeleton, EmptyState } from "@/components/ui";

const ICONS: Record<NotificationType, typeof Bell> = { review: Star, message: MessageCircle, listing: Store, verification: BadgeCheck, account: ShieldAlert };

export default function NotificationsPage() {
  const { firebaseUser, loading } = useAuth();
  const { notifications, notificationsLoading, unreadNotifications } = useMember();
  const [error, setError] = useState<string | null>(null);
  const uid = firebaseUser?.uid;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Stay in the loop</p>
          <h1 className="section-title mt-2">Updates</h1>
          <p className="mt-2 text-muted">New reviews, messages and listing decisions.</p>
        </div>
        {uid && unreadNotifications > 0 && (
          <button type="button" className="btn-ghost border border-line" onClick={async () => {
            try { await markAllNotificationsRead(uid, notifications.filter((n) => !n.read).map((n) => n.id)); } catch (err) { setError(friendlyError(err)); }
          }}><CheckCheck size={16} /> Mark all read</button>
        )}
      </div>
      {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
      <div className="mt-8">
        {loading || (uid && notificationsLoading) ? <CardSkeleton count={2} className="h-6" /> : !uid ? (
          <EmptyState icon={LogIn} title="Log in to see your updates" action={<Link href="/login?next=/notifications" className="btn-primary">Log in</Link>} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" text="We'll let you know when something needs your attention." />
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id} className={`card flex items-start gap-3 p-4 ${n.read ? "" : "border-gold/60 bg-gold-soft/40"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage"><Icon size={18} aria-hidden /></span>
                  <Link href={n.link} onClick={() => { if (!n.read) void markNotificationRead(uid, n.id).catch(() => undefined); }} className="min-w-0 flex-1">
                    <p className="font-extrabold leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-[#8A9A8F]">{formatDateTime(n.createdAt)}</p>
                  </Link>
                  <button type="button" aria-label="Delete notification" className="rounded-full p-2 text-muted hover:bg-sage" onClick={() => void deleteNotification(uid, n.id).catch(() => undefined)}><Trash2 size={15} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
