// Real-time data hooks built on Firestore onSnapshot listeners. Any change written
// from any browser or device is pushed to every connected client without a reload.
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, type DocumentData, type Query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { friendlyError } from "./utils";

const NOT_CONFIGURED = "Firebase is not configured yet. Add your NEXT_PUBLIC_FIREBASE_* variables.";

/**
 * Live collection/query subscription. `key` identifies the query: pass null to pause,
 * and change the key whenever the query's inputs change.
 */
export function useLiveList<T extends { id: string }>(key: string | null, build: () => Query<DocumentData>) {
  const [state, setState] = useState<{ data: T[]; loading: boolean; error: string | null }>({
    data: [],
    loading: key !== null,
    error: null,
  });

  useEffect(() => {
    if (key === null) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    if (!isFirebaseConfigured) {
      setState({ data: [], loading: false, error: NOT_CONFIGURED });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(
        build(),
        (snap) => {
          const data = snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
          setState({ data, loading: false, error: null });
        },
        (err) => setState({ data: [], loading: false, error: friendlyError(err) }),
      );
    } catch (err) {
      setState({ data: [], loading: false, error: friendlyError(err) });
    }
    return () => unsubscribe?.();
    // `build` is intentionally excluded: `key` must capture every input to the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/** Live single-document subscription, e.g. "siteSettings/main" or "businesses/abc". */
export function useLiveDoc<T extends { id: string }>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: path !== null,
    error: null,
  });

  useEffect(() => {
    if (path === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    if (!isFirebaseConfigured) {
      setState({ data: null, loading: false, error: NOT_CONFIGURED });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      return onSnapshot(
        doc(getDb(), path),
        (snap) => {
          const data = snap.exists() ? (({ ...(snap.data() as object), id: snap.id }) as T) : null;
          setState({ data, loading: false, error: null });
        },
        (err) => setState({ data: null, loading: false, error: friendlyError(err) }),
      );
    } catch (err) {
      setState({ data: null, loading: false, error: friendlyError(err) });
      return undefined;
    }
  }, [path]);

  return state;
}

/** Client-side pagination over an in-memory list. Clamps the page if the list shrinks. */
export function usePagination<T>(items: T[], size: number) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  const pageItems = useMemo(() => items.slice((current - 1) * size, current * size), [items, current, size]);
  return { page: current, setPage, pages, total: items.length, pageItems };
}

export type Notice = { kind: "success" | "error"; text: string } | null;

/** Short-lived success/error message that clears itself after a few seconds. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const show = useCallback((kind: "success" | "error", text: string) => setNotice({ kind, text }), []);
  const clear = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  return { notice, show, clear };
}
