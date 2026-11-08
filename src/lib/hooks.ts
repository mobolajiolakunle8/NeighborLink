// Real-time data hooks built on Firestore onSnapshot listeners.
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, type DocumentData, type Query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { classifyFirestoreError, type FirestoreProblem } from "./utils";

const NOT_CONFIGURED = "Firebase is not configured. Check the NEXT_PUBLIC_FIREBASE_* build-time variables and redeploy on Vercel.";

export interface LiveListOptions<T> {
  /** Simpler query used automatically when a composite index is still building. */
  fallback?: () => Query<DocumentData>;
  /** Client-side ordering applied when the fallback query is in use. */
  sort?: (items: T[]) => T[];
}
interface ListState<T> {
  data: T[]; loading: boolean; error: string | null; problem: FirestoreProblem | null; degraded: boolean;
}

export function useLiveList<T extends { id: string }>(key: string | null, build: () => Query<DocumentData>, options?: LiveListOptions<T>) {
  const [state, setState] = useState<ListState<T>>({ data: [], loading: key !== null, error: null, problem: null, degraded: false });
  useEffect(() => {
    if (key === null) { setState({ data: [], loading: false, error: null, problem: null, degraded: false }); return undefined; }
    if (!isFirebaseConfigured) {
      const problem = classifyFirestoreError({ code: "not-configured", message: NOT_CONFIGURED });
      setState({ data: [], loading: false, error: problem.message, problem, degraded: false });
      return undefined;
    }
    setState(s => ({ ...s, loading: true, error: null, problem: null }));
    let unsubscribe: (() => void) | undefined;
    const fail = (err: unknown) => { const problem = classifyFirestoreError(err); setState({ data: [], loading: false, error: problem.message, problem, degraded: false }); };
    const subscribe = (makeQuery: () => Query<DocumentData>, degraded: boolean) => {
      try {
        unsubscribe = onSnapshot(makeQuery(), snap => {
          let data = snap.docs.map(d => ({ ...(d.data() as object), id: d.id }) as T);
          if (degraded && options?.sort) data = options.sort(data);
          setState({ data, loading: false, error: null, problem: null, degraded });
        }, err => {
          const problem = classifyFirestoreError(err);
          if (!degraded && problem.kind === "index-missing" && options?.fallback) {
            console.warn(`[NeighbourLink] A Firestore index is still being created; using a simpler query for "${key}".` + (problem.indexUrl ? ` Create it here: ${problem.indexUrl}` : ""));
            unsubscribe?.(); subscribe(options.fallback, true);
            return;
          }
          fail(err);
        });
      } catch (err) { fail(err); }
    };
    subscribe(build, false);
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useLiveDoc<T extends { id: string }>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null; problem: FirestoreProblem | null }>({ data: null, loading: path !== null, error: null, problem: null });
  useEffect(() => {
    if (path === null) { setState({ data: null, loading: false, error: null, problem: null }); return undefined; }
    if (!isFirebaseConfigured) {
      const problem = classifyFirestoreError({ code: "not-configured", message: NOT_CONFIGURED });
      setState({ data: null, loading: false, error: problem.message, problem });
      return undefined;
    }
    setState(s => ({ ...s, loading: true, error: null, problem: null }));
    try {
      return onSnapshot(doc(getDb(), path), snap => {
        const data = snap.exists() ? ({ ...(snap.data() as object), id: snap.id }) as T : null;
        setState({ data, loading: false, error: null, problem: null });
      }, err => { const problem = classifyFirestoreError(err); setState({ data: null, loading: false, error: problem.message, problem }); });
    } catch (err) { const problem = classifyFirestoreError(err); setState({ data: null, loading: false, error: problem.message, problem }); return undefined; }
  }, [path]);
  return state;
}

/** Client-side pagination over an in-memory list. */
export function usePagination<T>(items: T[], size: number) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  const pageItems = useMemo(() => items.slice((current - 1) * size, current * size), [items, current, size]);
  return { page: current, setPage, pages, total: items.length, pageItems };
}

export type Notice = { kind: "success" | "error"; text: string } | null;
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const show = useCallback((kind: "success" | "error", text: string) => setNotice({ kind, text }), []);
  const clear = useCallback(() => setNotice(null), []);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(null), 4500); return () => clearTimeout(timer); }, [notice]);
  return { notice, show, clear };
}
