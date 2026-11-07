"use client";

import { useEffect, useState, type FormEvent } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { Eye, EyeOff, Pencil, Pin, Plus, Save, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { DEFAULT_LEGAL } from "@/lib/defaults";
import { useLiveDoc, useLiveList, useNotice, usePagination } from "@/lib/hooks";
import {
  createAnnouncement, deleteAnnouncement, deleteTaxonomy, saveLegal, saveTaxonomy, updateAnnouncement,
  type AnnouncementInput,
} from "@/lib/api";
import type { Announcement, LegalPage } from "@/lib/types";
import { formatDate, friendlyError, isHttpUrl, slugify } from "@/lib/utils";
import { Alert, CardSkeleton, EmptyState, Field, Pagination, Spinner } from "@/components/ui";
import ImageUploadField from "@/components/ImageUploadField";

// ------------------------------------------------------------------ categories & neighbourhoods

type Kind = "categories" | "neighbourhoods";
type TaxItem = { id: string; name: string; description?: string; icon?: string; sortOrder: number; isActive: boolean };

export function TaxonomyPanel({ kind }: { kind: Kind }) {
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const label = kind === "categories" ? "category" : "neighbourhood";
  const items = useLiveList<TaxItem>(`admin-${kind}`, () => query(collection(getDb(), kind), orderBy("sortOrder")));
  const emptyForm = { name: "", description: "", icon: "store", sortOrder: 0, isActive: true };
  const [editing, setEditing] = useState<TaxItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const uid = firebaseUser?.uid ?? "";

  function startEdit(item: TaxItem) {
    setEditing(item);
    setForm({ name: item.name, description: item.description ?? "", icon: item.icon ?? "store", sortOrder: item.sortOrder, isActive: item.isActive });
  }
  function reset() {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: items.data.length + 1 });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) return show("error", `Please enter a ${label} name.`);
    const id = editing?.id ?? slugify(name);
    if (!editing && items.data.some((i) => i.id === id)) return show("error", `A ${label} called “${name}” already exists.`);
    setBusy(true);
    try {
      await saveTaxonomy(kind, { id, ...form, name }, uid);
      show("success", editing ? `${label[0].toUpperCase()}${label.slice(1)} saved.` : `${label[0].toUpperCase()}${label.slice(1)} added.`);
      reset();
    } catch (err) {
      show("error", friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={onSubmit} noValidate className="card h-fit space-y-4 p-6" aria-label={`${editing ? "Edit" : "Add"} ${label}`}>
        <h2 className="text-lg font-extrabold">{editing ? `Edit ${label}` : `Add ${label}`}</h2>
        <Field label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></Field>
        <Field label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sort order"><input type="number" className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></Field>
          {kind === "categories" && <Field label="Icon key"><input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></Field>}
        </div>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4" /> Visible on the public site</label>
        {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">{busy ? <Spinner /> : <Save size={15} aria-hidden />} {editing ? "Save changes" : `Add ${label}`}</button>
          {editing && <button type="button" onClick={reset} className="btn-ghost border border-line"><X size={15} aria-hidden /> Cancel</button>}
        </div>
      </form>

      <div className="card p-6">
        <h2 className="text-lg font-extrabold">All {kind} ({items.data.length})</h2>
        {items.error ? <div className="mt-4"><Alert kind="error">{items.error}</Alert></div> : items.loading ? <div className="mt-4"><CardSkeleton count={1} className="h-8" /></div> : items.data.length === 0 ? (
          <div className="mt-4"><EmptyState icon={Plus} title={`No ${kind} saved yet`} text="Use Overview → Initialise defaults to save the built-in list, or add your own." /></div>
        ) : (
          <div className="table-wrap mt-4">
            <table className="data">
              <thead><tr><th>Name</th><th>Order</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {items.data.map((i) => (
                  <tr key={i.id}>
                    <td><p className="font-bold">{i.name}</p><p className="text-xs text-muted">{i.description}</p></td>
                    <td>{i.sortOrder}</td>
                    <td><span className={`badge ${i.isActive ? "badge-sage" : "badge-red"}`}>{i.isActive ? "Visible" : "Hidden"}</span></td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => startEdit(i)}>Edit</button>
                        <button type="button" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" aria-label={`Delete ${i.name}`} onClick={async () => {
                          if (!confirm(`Delete "${i.name}"? Listings keep their data but will lose this label.`)) return;
                          try { await deleteTaxonomy(kind, i.id, uid); show("success", "Deleted."); } catch (err) { show("error", friendlyError(err)); }
                        }}><Trash2 size={13} aria-hidden /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ announcements

const EMPTY_ANN: AnnouncementInput = { title: "", body: "", imageUrl: "", isPinned: false, isPublished: true };

export function AnnouncementsPanel() {
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const items = useLiveList<Announcement>("admin-announcements", () =>
    query(collection(getDb(), "announcements"), orderBy("publishedAt", "desc"), limit(200)),
  );
  const pager = usePagination(items.data, 8);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementInput>(EMPTY_ANN);
  const [busy, setBusy] = useState(false);
  const uid = firebaseUser?.uid ?? "";

  function startEdit(a: Announcement) {
    setEditing(a);
    setForm({ title: a.title, body: a.body, imageUrl: a.imageUrl ?? "", isPinned: a.isPinned, isPublished: a.isPublished });
  }
  function reset() {
    setEditing(null);
    setForm(EMPTY_ANN);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.title.trim().length < 4) return show("error", "Please add a title (at least 4 characters).");
    if (form.body.trim().length < 10) return show("error", "The announcement body needs at least 10 characters.");
    if (form.imageUrl && !isHttpUrl(form.imageUrl)) return show("error", "Image link must start with https://");
    setBusy(true);
    try {
      if (editing) await updateAnnouncement(editing.id, form, uid);
      else await createAnnouncement(form, uid);
      show("success", editing ? "Announcement updated." : "Announcement published.");
      reset();
    } catch (err) {
      show("error", friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={onSubmit} noValidate className="card h-fit space-y-4 p-6" aria-label="Announcement editor">
        <h2 className="text-lg font-extrabold">{editing ? "Edit announcement" : "Publish announcement"}</h2>
        <Field label="Title *"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={220} /></Field>
        <Field label="Message *"><textarea className="input" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={5000} /></Field>
        <ImageUploadField label="Image (optional)" value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} folder="announcements" />
        <div className="flex flex-wrap gap-4 text-sm font-bold">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} className="h-4 w-4" /> Pin to top</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="h-4 w-4" /> Published</label>
        </div>
        {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">{busy ? <Spinner /> : null} {editing ? "Save changes" : "Publish"}</button>
          {editing && <button type="button" onClick={reset} className="btn-ghost border border-line">Cancel</button>}
        </div>
      </form>

      <div className="card p-6">
        <h2 className="text-lg font-extrabold">All announcements ({items.data.length})</h2>
        {items.error ? <div className="mt-4"><Alert kind="error">{items.error}</Alert></div> : items.loading ? <div className="mt-4"><CardSkeleton count={1} className="h-8" /></div> : items.data.length === 0 ? (
          <div className="mt-4"><EmptyState icon={Plus} title="No announcements yet" text="Publish your first update using the form." /></div>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {pager.pageItems.map((a) => (
                <li key={a.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold">{a.title}</p>
                    {a.isPinned && <span className="badge badge-gold"><Pin size={11} aria-hidden /> Pinned</span>}
                    <span className={`badge ${a.isPublished ? "badge-sage" : "badge-red"}`}>{a.isPublished ? "Published" : "Draft"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{a.body}</p>
                  <p className="mt-1 text-xs text-[#8A9A8F]">{formatDate(a.publishedAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={() => startEdit(a)}><Pencil size={13} aria-hidden /> Edit</button>
                    <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={async () => {
                      try { await updateAnnouncement(a.id, { isPublished: !a.isPublished }, uid); show("success", a.isPublished ? "Unpublished." : "Published."); } catch (err) { show("error", friendlyError(err)); }
                    }}>{a.isPublished ? <><EyeOff size={13} aria-hidden /> Unpublish</> : <><Eye size={13} aria-hidden /> Publish</>}</button>
                    <button type="button" className="btn-ghost border border-line !px-3 !py-1.5 text-xs" onClick={async () => {
                      try { await updateAnnouncement(a.id, { isPinned: !a.isPinned }, uid); } catch (err) { show("error", friendlyError(err)); }
                    }}><Pin size={13} aria-hidden /> {a.isPinned ? "Unpin" : "Pin"}</button>
                    <button type="button" className="btn-ghost border border-danger-line !px-3 !py-1.5 text-xs text-danger" aria-label={`Delete ${a.title}`} onClick={async () => {
                      if (!confirm("Delete this announcement permanently?")) return;
                      try { await deleteAnnouncement(a.id, uid); show("success", "Announcement deleted."); } catch (err) { show("error", friendlyError(err)); }
                    }}><Trash2 size={13} aria-hidden /></button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={pager.page} pages={pager.pages} onChange={pager.setPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ legal pages

export function LegalPanel() {
  const { firebaseUser } = useAuth();
  const { notice, show } = useNotice();
  const [active, setActive] = useState<"privacy" | "terms">("privacy");
  const privacy = useLiveDoc<LegalPage>("legalPages/privacy");
  const terms = useLiveDoc<LegalPage>("legalPages/terms");
  const source = active === "privacy" ? privacy : terms;
  const fallback = DEFAULT_LEGAL.find((p) => p.id === active) as LegalPage;
  const current = source.data ?? fallback;

  const [draft, setDraft] = useState({ title: current.title, content: current.content });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft({ title: current.title, content: current.content });
  }, [current.title, current.content, dirty]);

  function switchTo(id: "privacy" | "terms") {
    setActive(id);
    setDirty(false);
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Legal pages">
        {(["privacy", "terms"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => switchTo(id)} className={`tab-btn ${active === id ? "active" : ""}`}>
            {id === "privacy" ? "Privacy Policy" : "Terms of Service"}
          </button>
        ))}
      </div>
      {source.error && <Alert kind="warning">Showing the built-in text. {source.error}</Alert>}
      <Field label="Page title"><input className="input" value={draft.title} onChange={(e) => { setDirty(true); setDraft({ ...draft, title: e.target.value }); }} /></Field>
      <Field label="Content" hint="Plain text. Blank lines create new paragraphs.">
        <textarea className="input font-[inherit]" rows={16} value={draft.content} onChange={(e) => { setDirty(true); setDraft({ ...draft, content: e.target.value }); }} />
      </Field>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      <div className="flex gap-2">
        <button type="button" disabled={busy || !dirty} className="btn-primary" onClick={async () => {
          setBusy(true);
          try {
            await saveLegal(active, draft.title, draft.content, firebaseUser?.uid ?? "");
            setDirty(false);
            show("success", "Legal page published.");
          } catch (err) {
            show("error", friendlyError(err));
          } finally {
            setBusy(false);
          }
        }}>{busy ? <Spinner /> : <Save size={15} aria-hidden />} Publish changes</button>
        {dirty && <button type="button" className="btn-ghost border border-line" onClick={() => setDirty(false)}>Discard</button>}
      </div>
    </div>
  );
}
