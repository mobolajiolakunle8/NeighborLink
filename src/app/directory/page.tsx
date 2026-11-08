"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { Search, Store } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { getDb } from "@/lib/firebase";
import { useLiveList, usePagination } from "@/lib/hooks";
import { sortByTimestampDesc, toDate } from "@/lib/utils";
import type { Business } from "@/lib/types";
import BusinessCard from "@/components/BusinessCard";
import SetupNotice from "@/components/SetupNotice";
import { CardSkeleton, EmptyState, Pagination } from "@/components/ui";

const PAGE_SIZE = 12;
type SortKey = "featured" | "newest" | "popular" | "az";

export default function DirectoryPage() {
  const { activeCategories, activeNeighbourhoods, categoryName, neighbourhoodName } = useSite();
  const listing = useLiveList<Business>("directory-approved", () =>
    query(collection(getDb(), "businesses"), where("status", "==", "approved"), orderBy("createdAt", "desc"), limit(500)),
    {
      fallback: () => query(collection(getDb(), "businesses"), where("status", "==", "approved"), limit(500)),
      sort: rows => sortByTimestampDesc(rows, "createdAt"),
    },
  );
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("");
  const [hood, setHood] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") ?? "";
    setDraft(q); setTerm(q); setCategory(params.get("category") ?? ""); setHood(params.get("neighbourhood") ?? "");
  }, []);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const rows = listing.data.filter(b => {
      if (category && b.categoryId !== category) return false;
      if (hood && b.neighbourhoodId !== hood) return false;
      if (!needle) return true;
      return [b.name, b.description, b.address ?? "", categoryName(b.categoryId), neighbourhoodName(b.neighbourhoodId)].join(" ").toLowerCase().includes(needle);
    });
    switch (sort) {
      case "newest": return [...rows].sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
      case "popular": return [...rows].sort((a, b) => b.views - a.views);
      case "az": return [...rows].sort((a, b) => a.name.localeCompare(b.name));
      default: return [...rows].sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)));
    }
  }, [listing.data, term, category, hood, sort, categoryName, neighbourhoodName]);

  const pager = usePagination(filtered, PAGE_SIZE);
  const { setPage } = pager;
  useEffect(() => setPage(1), [term, category, hood, sort, setPage]);

  function onSearch(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setTerm(draft); }
  function reset() { setDraft(""); setTerm(""); setCategory(""); setHood(""); setSort("featured"); window.history.replaceState(null, "", "/directory"); }
  const hasFilters = Boolean(term || category || hood);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Service directory</p>
      <h1 className="section-title mt-2">Find local businesses</h1>
      <p className="mt-2 max-w-2xl text-muted">Search trusted businesses across Ibadan. Every listing is reviewed by our team before it appears here.</p>
      <form onSubmit={onSearch} role="search" className="card mt-7 grid gap-3 p-4 sm:p-5 md:grid-cols-[1fr_200px_200px_160px]">
        <label className="relative"><span className="sr-only">Search by name or service</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9A8F]" aria-hidden /><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Search by name or service…" className="input !pl-10" /></label>
        <label><span className="sr-only">Category</span><select value={category} onChange={e => setCategory(e.target.value)} className="input"><option value="">All categories</option>{activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="sr-only">Neighbourhood</span><select value={hood} onChange={e => setHood(e.target.value)} className="input"><option value="">All neighbourhoods</option>{activeNeighbourhoods.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <div className="flex gap-2"><button type="submit" className="btn-primary flex-1">Search</button><button type="button" onClick={reset} className="btn-ghost border border-line" disabled={!hasFilters && !draft && sort === "featured"}>Reset</button></div>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-muted" aria-live="polite">{listing.loading ? "Loading listings…" : `${filtered.length} listing${filtered.length === 1 ? "" : "s"} found`}</p><label className="flex items-center gap-2 text-sm font-bold text-muted">Sort by<select value={sort} onChange={e => setSort(e.target.value as SortKey)} className="input !w-auto !py-2 text-sm"><option value="featured">Featured first</option><option value="newest">Newest</option><option value="popular">Most viewed</option><option value="az">A → Z</option></select></label></div>
      <div className="mt-5">
        {listing.problem ? <SetupNotice problem={listing.problem} /> : listing.loading ? <CardSkeleton count={6} /> : pager.total === 0 ? (
          <EmptyState icon={Store} title="No businesses match your search" text={hasFilters ? "Try a different keyword, category or neighbourhood." : "No approved listings yet. Check back soon."} action={hasFilters ? <button type="button" onClick={reset} className="btn-primary">Clear filters</button> : undefined} />
        ) : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{pager.pageItems.map(b => <BusinessCard key={b.id} business={b} categoryName={categoryName(b.categoryId)} neighbourhoodName={neighbourhoodName(b.neighbourhoodId)} />)}</div>}
      </div>
      <Pagination page={pager.page} pages={pager.pages} onChange={setPage} />
      <p className="mt-8 text-center text-sm text-muted">Own a business? <a href="/register" className="font-bold underline">Create a free account</a> to list it.</p>
    </div>
  );
}
