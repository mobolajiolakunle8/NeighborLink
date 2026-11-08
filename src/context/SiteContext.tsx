"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { DEFAULT_CATEGORIES, DEFAULT_NEIGHBOURHOODS, DEFAULT_SETTINGS } from "@/lib/defaults";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { Category, Neighbourhood, SiteSettings } from "@/lib/types";
import { classifyFirestoreError, safeHex, type FirestoreProblem } from "@/lib/utils";

type SiteValue = {
  settings: SiteSettings;
  categories: Category[];
  neighbourhoods: Neighbourhood[];
  activeCategories: Category[];
  activeNeighbourhoods: Neighbourhood[];
  usingDefaults: boolean;
  loading: boolean;
  error: string | null;
  problem: FirestoreProblem | null;
  categoryName: (id?: string | null) => string;
  neighbourhoodName: (id?: string | null) => string;
};
const SiteContext = createContext<SiteValue | null>(null);

/** Live site configuration: admin edits appear on every open browser immediately. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [cats, setCats] = useState<Category[] | null>(null);
  const [hoods, setHoods] = useState<Neighbourhood[] | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [problem, setProblem] = useState<FirestoreProblem | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setProblem(classifyFirestoreError({ code: "not-configured", message: "Firebase is not configured." }));
      setSettingsReady(true); setCats([]); setHoods([]);
      return undefined;
    }
    const db = getDb();
    const fail = (err: unknown) => {
      const next = classifyFirestoreError(err);
      setProblem(current => (current?.setupRequired ? current : next));
    };
    const unsubs = [
      onSnapshot(doc(db, "siteSettings", "main"), snap => {
        const data = (snap.exists() ? snap.data() : {}) as Partial<SiteSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...data, socialLinks: data.socialLinks ?? {}, navLinks: data.navLinks ?? DEFAULT_SETTINGS.navLinks });
        setSettingsReady(true); setProblem(null);
      }, err => { fail(err); setSettingsReady(true); }),
      onSnapshot(query(collection(db, "categories"), orderBy("sortOrder")), snap => setCats(snap.docs.map(d => ({ ...(d.data() as object), id: d.id }) as Category)), err => { fail(err); setCats([]); }),
      onSnapshot(query(collection(db, "neighbourhoods"), orderBy("sortOrder")), snap => setHoods(snap.docs.map(d => ({ ...(d.data() as object), id: d.id }) as Neighbourhood)), err => { fail(err); setHoods([]); }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--brand-forest", safeHex(settings.primaryColor, "#172D2A"));
    style.setProperty("--brand-sage", safeHex(settings.sageColor, "#E8F0E9"));
    style.setProperty("--brand-gold", safeHex(settings.goldColor, "#D5A85C"));
    style.setProperty("--brand-cream", safeHex(settings.bgColor, "#F8F8F5"));
  }, [settings.primaryColor, settings.sageColor, settings.goldColor, settings.bgColor]);

  const value = useMemo<SiteValue>(() => {
    const categories = cats && cats.length ? cats : DEFAULT_CATEGORIES;
    const neighbourhoods = hoods && hoods.length ? hoods : DEFAULT_NEIGHBOURHOODS;
    const catMap = new Map<string, string>(categories.map(c => [c.id, c.name]));
    const hoodMap = new Map<string, string>(neighbourhoods.map(h => [h.id, h.name]));
    return {
      settings, categories, neighbourhoods,
      activeCategories: categories.filter(c => c.isActive),
      activeNeighbourhoods: neighbourhoods.filter(h => h.isActive),
      usingDefaults: (cats !== null && cats.length === 0) || (hoods !== null && hoods.length === 0),
      loading: !settingsReady || cats === null || hoods === null,
      error: problem?.message ?? null,
      problem,
      categoryName: id => (id ? catMap.get(id) ?? "" : ""),
      neighbourhoodName: id => (id ? hoodMap.get(id) ?? "" : ""),
    };
  }, [settings, cats, hoods, settingsReady, problem]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
export function useSite(): SiteValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within SiteProvider");
  return ctx;
}
