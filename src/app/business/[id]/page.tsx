"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { ArrowLeft, Clock, Eye, Flag, Globe, Mail, MapPin, Pencil, Phone, Star, Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveDoc, useLiveList, useNotice } from "@/lib/hooks";
import { addReview, createReport, recordBusinessView } from "@/lib/api";
import type { Business, Review } from "@/lib/types";
import { formatDate, friendlyError } from "@/lib/utils";
import { Alert, EmptyState, Field, Spinner, StatusBadge } from "@/components/ui";

const REPORT_REASONS = ["Spam or scam", "Wrong or misleading information", "Inappropriate content", "Business is closed", "Other"];

export default function BusinessPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { categoryName, neighbourhoodName } = useSite();
  const { firebaseUser, profile, isAdmin } = useAuth();

  const biz = useLiveDoc<Business>(id ? `businesses/${id}` : null);
  const reviews = useLiveList<Review>(id ? `reviews-${id}` : null, () =>
    query(collection(getDb(), "reviews"), where("businessId", "==", id), orderBy("createdAt", "desc"), limit(100)),
  );

  const viewedFor = useRef<string | null>(null);
  const { notice, show } = useNotice();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  // Count one view per visit to an approved listing.
  useEffect(() => {
    if (biz.data?.status === "approved" && viewedFor.current !== id) {
      viewedFor.current = id;
      void recordBusinessView(id);
    }
  }, [biz.data, id]);

  if (biz.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="skeleton h-72" />
        <div className="skeleton mt-6 h-6 w-1/2" />
        <div className="skeleton mt-3 h-4 w-full" />
      </div>
    );
  }

  if (!biz.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={Store}
          title="Listing not available"
          text={biz.error ?? "This business may have been removed, or it is awaiting approval."}
          action={<Link href="/directory" className="btn-primary"><ArrowLeft size={16} aria-hidden /> Back to directory</Link>}
        />
      </div>
    );
  }

  const b = biz.data;
  const isOwner = firebaseUser?.uid === b.ownerId;
  const avg = reviews.data.length ? reviews.data.reduce((sum, r) => sum + r.rating, 0) / reviews.data.length : 0;

  async function submitReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseUser) return;
    if (comment.trim().length < 3) return show("error", "Please write a short review (at least 3 characters).");
    setBusy(true);
    try {
      await addReview(b.id, { uid: firebaseUser.uid, name: profile?.name ?? firebaseUser.displayName ?? "Neighbour" }, rating, comment);
      setComment("");
      setRating(5);
      show("success", "Thank you! Your review is live.");
    } catch (err) {
      show("error", friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firebaseUser) return show("error", "Please log in to report a listing.");
    setReporting(true);
    try {
      await createReport(firebaseUser.uid, "business", b.id, reason, details);
      setDetails("");
      setReportOpen(false);
      show("success", "Thanks — our team will review this report.");
    } catch (err) {
      show("error", friendlyError(err));
    } finally {
      setReporting(false);
    }
  }

  const phoneHref = b.phone ? `tel:${b.phone.replace(/[\s-]/g, "")}` : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/directory" className="btn-ghost !px-0"><ArrowLeft size={16} aria-hidden /> Back to directory</Link>

      {b.status !== "approved" && (
        <div className="mt-4"><Alert kind="warning">This listing is {b.status} and is only visible to you and administrators.</Alert></div>
      )}

      <article className="card mt-4 overflow-hidden">
        <div className="relative h-64 bg-forest sm:h-80">
          {b.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt={b.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-gold"><Store size={72} aria-hidden /></div>
          )}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
            {categoryName(b.categoryId) && <span className="badge badge-gold">{categoryName(b.categoryId)}</span>}
            {b.status === "approved" && <span className="badge badge-forest">Verified listing</span>}
            {b.isFeatured && <span className="badge badge-sage">Featured</span>}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold tracking-tight">{b.name}</h1>
              <p className="mt-2 flex items-center gap-1.5 font-bold text-bronze">
                <MapPin size={16} aria-hidden />
                {neighbourhoodName(b.neighbourhoodId) || "Ibadan"}{b.address ? ` — ${b.address}` : ""}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted">
                <span className="flex items-center gap-1 font-bold text-forest">
                  <Star size={15} className="fill-gold text-gold" aria-hidden />
                  {avg ? avg.toFixed(1) : "No ratings yet"}{reviews.data.length ? ` (${reviews.data.length})` : ""}
                </span>
                <span className="flex items-center gap-1"><Eye size={14} aria-hidden />{b.views} views</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOwner && (
                <Link href="/profile#my-listings" className="btn-outline !py-2 text-sm"><Pencil size={15} aria-hidden /> Edit listing</Link>
              )}
              {isAdmin && <StatusBadge status={b.status} />}
              <button type="button" onClick={() => setReportOpen((o) => !o)} aria-expanded={reportOpen} className="btn-ghost border border-line text-sm">
                <Flag size={15} aria-hidden /> Report
              </button>
            </div>
          </div>

          {reportOpen && (
            <form onSubmit={submitReport} className="mt-4 space-y-3 rounded-2xl border border-danger-line bg-danger-soft p-4">
              <Field label="Reason for reporting">
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
                  {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Details (optional)">
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} className="input" maxLength={800} />
              </Field>
              {!firebaseUser && <p className="text-sm font-bold text-danger">Please <Link href="/login" className="underline">log in</Link> to submit a report.</p>}
              <button type="submit" disabled={reporting || !firebaseUser} className="btn-primary">
                {reporting ? <><Spinner /> Sending…</> : "Submit report"}
              </button>
            </form>
          )}

          <p className="mt-5 whitespace-pre-line leading-relaxed text-forest/85">{b.description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {phoneHref && (
              <a href={phoneHref} className="card flex items-center gap-3 p-4 transition hover:border-forest">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage"><Phone size={18} aria-hidden /></span>
                <span><span className="block text-xs font-bold uppercase tracking-wide text-muted">Phone</span><span className="font-extrabold">{b.phone}</span></span>
              </a>
            )}
            {b.email && (
              <a href={`mailto:${b.email}`} className="card flex items-center gap-3 p-4 transition hover:border-forest">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage"><Mail size={18} aria-hidden /></span>
                <span className="min-w-0"><span className="block text-xs font-bold uppercase tracking-wide text-muted">Email</span><span className="block truncate font-extrabold">{b.email}</span></span>
              </a>
            )}
            {b.openingHours && (
              <div className="card flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage"><Clock size={18} aria-hidden /></span>
                <span><span className="block text-xs font-bold uppercase tracking-wide text-muted">Opening hours</span><span className="font-extrabold">{b.openingHours}</span></span>
              </div>
            )}
            {b.website && (
              <a href={b.website} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 transition hover:border-forest">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage"><Globe size={18} aria-hidden /></span>
                <span className="min-w-0"><span className="block text-xs font-bold uppercase tracking-wide text-muted">Website</span><span className="block truncate font-extrabold">{b.website}</span></span>
              </a>
            )}
          </div>
          <p className="mt-4 text-xs text-[#8A9A8F]">Listed by {b.ownerName || "a business owner"} • {formatDate(b.createdAt, { dateStyle: "medium" })}</p>
        </div>
      </article>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-6" aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="text-xl font-extrabold">Reviews ({reviews.data.length})</h2>
          {reviews.loading ? (
            <div className="mt-4 space-y-3"><div className="skeleton h-16" /><div className="skeleton h-16" /></div>
          ) : reviews.error ? (
            <div className="mt-4"><Alert kind="error">{reviews.error}</Alert></div>
          ) : reviews.data.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No reviews yet. Be the first to share your experience.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {reviews.data.map((r) => (
                <li key={r.id} className="border-b border-[#EEF1ED] pb-4 last:border-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    {r.authorName}
                    <span className="flex" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < r.rating ? "fill-gold text-gold" : "text-[#C9D6CB]"} aria-hidden />
                      ))}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-forest/85">{r.comment}</p>
                  <p className="mt-1 text-xs text-[#8A9A8F]">{formatDate(r.createdAt, { dateStyle: "medium" })}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card h-fit p-6" aria-labelledby="write-review">
          <h2 id="write-review" className="text-xl font-extrabold">Write a review</h2>
          {!firebaseUser ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted">Log in to share your experience with neighbours.</p>
              <Link href="/login" className="btn-primary w-full">Log in to review</Link>
            </div>
          ) : isOwner ? (
            <p className="mt-4 text-sm text-muted">You can&apos;t review your own business.</p>
          ) : (
            <form onSubmit={submitReview} className="mt-4 space-y-3" noValidate>
              <fieldset>
                <legend className="label">Your rating</legend>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n} className="rounded p-1">
                      <Star size={26} className={n <= rating ? "fill-gold text-gold" : "text-[#C9D6CB]"} aria-hidden />
                    </button>
                  ))}
                </div>
              </fieldset>
              <Field label="Your review">
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={1500} placeholder="How was your experience?" className="input" />
              </Field>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? <><Spinner /> Submitting…</> : "Submit review"}
              </button>
            </form>
          )}
          <div className="mt-4"><span className="sr-only">Notifications</span>{notice && <Alert kind={notice.kind}>{notice.text}</Alert>}</div>
        </section>
      </div>
    </div>
  );
}
