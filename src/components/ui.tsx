// Shared presentational primitives: loading, empty, error, pagination and form layout.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, XCircle } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 size={16} className={`animate-spin ${className}`} aria-hidden />;
}

export function CardSkeleton({ count = 3, className = "h-48" }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className={`skeleton ${className}`} />
          <div className="skeleton mt-4 h-5 w-2/3" />
          <div className="skeleton mt-2 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-10 text-center">
      <Icon size={40} className="mx-auto text-muted/70" aria-hidden />
      <p className="mt-3 text-lg font-extrabold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "warning" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "border-danger-line bg-danger-soft text-danger",
    success: "border-[#CFE0D2] bg-sage text-[#1F5C3D]",
    warning: "border-[#EAD9AE] bg-gold-soft text-[#7A5A1E]",
    info: "border-[#CFE0D2] bg-sage text-forest",
  } as const;
  const Icon = kind === "error" ? XCircle : kind === "success" ? CheckCircle2 : kind === "warning" ? AlertTriangle : Info;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${styles[kind]}`}>
      <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      <button type="button" className="btn-ghost border border-line disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} aria-hidden /> Prev
      </button>
      <span className="px-3 text-sm font-bold">Page {page} of {pages}</span>
      <button type="button" className="btn-ghost border border-line disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight size={16} aria-hidden />
      </button>
    </nav>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="section-title mt-2">{title}</h1>
        {text && <p className="mt-2 max-w-2xl text-muted">{text}</p>}
      </div>
      {action}
    </div>
  );
}

const POSITIVE = ["approved", "open", "resolved", "read", "fulfilled", "published", "replied", "active"];
const WAITING = ["pending", "new", "request", "offer"];

export function StatusBadge({ status }: { status: string }) {
  const cls = POSITIVE.includes(status) ? "badge-sage" : WAITING.includes(status) ? "badge-gold" : "badge-red";
  return <span className={`badge ${cls}`}>{status}</span>;
}

/** Wraps a control with its label so the association is accessible to screen readers. */
export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
