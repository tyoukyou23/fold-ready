/**
 * Decide by what the user can do, not by how wide the screen is.
 *
 * A wide screen is not a mouse: an unfolded iPhone Duo held sideways is 951 CSS px wide
 * (desktop territory for most breakpoints) and still has no hover. These hooks answer the
 * three questions a layout actually needs:
 *
 *   touch  — the primary pointer is a finger      (pointer: coarse)
 *   hover  — the primary pointer can hover        (hover: hover) and (pointer: fine)
 *   short  — the viewport is short                (max-height: 600px) e.g. Duo unfolded sideways (543)
 *
 * SSR-safe: everything is `false` on the server and on the first client render (no hydration
 * mismatch), then flips to the real value and follows changes (fold / unfold / rotate / Split View).
 */
import { useEffect, useState } from "react";

export const TOUCH_QUERY = "(pointer: coarse)";
export const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
export const SHORT_QUERY = "(max-height: 600px)";

export interface InputMode {
  /** Primary pointer is a finger (or a stylus without hover). */
  touch: boolean;
  /** Primary pointer can hover precisely — the only case where hover-to-reveal is safe. */
  hover: boolean;
  /** Viewport is short (≤ 600 CSS px). Compact your chrome. */
  short: boolean;
}

/* ─── override (devtools, demos, tests) ─────────────────────────────────────────── */

type Listener = () => void;

/**
 * `?fr-simulate=touch` (or `touch,short`) in the page URL starts with that override.
 * Duo Lab and the Inspector use it to show a page as a finger would get it — a desktop
 * browser inside an iframe cannot otherwise pretend to be `(pointer: coarse)`.
 */
function overrideFromUrl(): Partial<InputMode> | null {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get("fr-simulate");
    if (!v) return null;
    const parts = new Set(v.split(","));
    const o: Partial<InputMode> = {};
    if (parts.has("touch")) { o.touch = true; o.hover = false; }
    if (parts.has("mouse")) { o.touch = false; o.hover = true; }
    if (parts.has("short")) o.short = true;
    return o;
  } catch { return null; }
}

let override: Partial<InputMode> | null = overrideFromUrl();
const listeners = new Set<Listener>();

/**
 * Force the input mode (e.g. pretend to be a finger on a desktop to preview the touch layout).
 * Pass `null` to go back to the real media queries. Used by the Inspector and the demo.
 */
export function setInputModeOverride(next: Partial<InputMode> | null): void {
  override = next;
  listeners.forEach((l) => l());
}

export function getInputModeOverride(): Partial<InputMode> | null {
  return override;
}

function subscribeOverride(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// React 17 compatible (no useSyncExternalStore)
function useOverride() {
  const [, force] = useState(0);
  useEffect(() => subscribeOverride(() => force((n) => n + 1)), []);
  return override;
}

/* ─── media queries ──────────────────────────────────────────────────────────────── */

/** SSR-safe `matchMedia` hook. `false` until mounted, then follows the query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    // Safari < 14 only has addListener
    if (mql.addEventListener) mql.addEventListener("change", update);
    else mql.addListener(update);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", update);
      else mql.removeListener(update);
    };
  }, [query]);
  return matches;
}

/** Read the current input mode once, outside React (respects the override). */
export function readInputMode(): InputMode {
  const m = (q: string) => (typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  return {
    touch: override?.touch ?? m(TOUCH_QUERY),
    hover: override?.hover ?? m(HOVER_QUERY),
    short: override?.short ?? m(SHORT_QUERY),
  };
}

/** `{ touch, hover, short }`, live. See the module comment. */
export function useInputMode(): InputMode {
  const touch = useMediaQuery(TOUCH_QUERY);
  const hover = useMediaQuery(HOVER_QUERY);
  const short = useMediaQuery(SHORT_QUERY);
  const o = useOverride();
  return {
    touch: o?.touch ?? touch,
    hover: o?.hover ?? hover,
    short: o?.short ?? short,
  };
}

export const useIsTouch = () => useInputMode().touch;
export const useCanHover = () => useInputMode().hover;
export const useIsShort = () => useInputMode().short;
