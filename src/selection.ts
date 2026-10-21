/**
 * Keep "which item is open" in the URL (`?sel=42`), so reload, back and shared links reopen it.
 *
 * Framework-agnostic by default (History API + popstate, `replaceState` so it doesn't spam
 * history). Routers that keep their own copy of the URL (Next.js, React Router…) pass an adapter:
 *
 *   // Next.js pages router
 *   const router = useRouter();
 *   const [sel, setSel] = useSelection("sel", {
 *     get: (k) => (typeof router.query[k] === "string" ? router.query[k] : null),
 *     set: (k, v) => { const { [k]: _, ...q } = router.query;
 *                      router.replace({ pathname: router.pathname, query: v ? { ...q, [k]: v } : q }, undefined, { shallow: true, scroll: false }); },
 *   });
 */
import { useCallback, useEffect, useState } from "react";

export interface SelectionAdapter {
  get: (key: string) => string | null;
  set: (key: string, value: string | null) => void;
}

const historyAdapter: SelectionAdapter = {
  get: (key) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(key)),
  set: (key, value) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event("fr-selection"));
  },
};

export function useSelection(key = "sel", adapter?: SelectionAdapter): [string | null, (v: string | null) => void] {
  const a = adapter ?? historyAdapter;
  const [own, setOwn] = useState<string | null>(null);

  useEffect(() => {
    if (adapter) return undefined;
    const sync = () => setOwn(historyAdapter.get(key));
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("fr-selection", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("fr-selection", sync); };
  }, [adapter, key]);

  const value = adapter ? adapter.get(key) : own;
  const set = useCallback((v: string | null) => a.set(key, v), [a, key]);
  return [value || null, set];
}
