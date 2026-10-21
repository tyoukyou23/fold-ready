/**
 * The height you can actually see — with the keyboard up, too.
 *
 * Measured in Safari on iPhone Duo (folded, 382×580 page):
 *   100vh = 598   ← 18 px taller than the page; a "full height" hero hides its button
 *   100lvh = 598
 *   100dvh = 580  ← correct at rest
 *   100svh = 580
 * So at rest `dvh` is right and `vh` is not. What no CSS unit gives you is the space left
 * when the on-screen keyboard is open: `visualViewport` shrinks, every `*vh` stays.
 *
 * `useVisibleViewport()` returns the live visual viewport; `installViewportVars()` writes it to
 * CSS custom properties on <html> so plain CSS can use it:
 *
 *   --fr-visible-height   visual viewport height (keyboard-aware)
 *   --fr-visible-width    visual viewport width
 *   --fr-keyboard-inset   px hidden under the keyboard at the bottom (0 when closed)
 *
 *   .sticky-actions { position: fixed; bottom: var(--fr-keyboard-inset, 0px); }
 *   .sheet { max-height: var(--fr-visible-height, 100dvh); }
 */
import { useEffect, useState } from "react";

export interface VisibleViewport {
  width: number;
  height: number;
  /** Distance from the layout viewport top (non-zero when iOS scrolls the page under the keyboard). */
  offsetTop: number;
  /** Pixels at the bottom covered by the keyboard or other browser UI that appeared. */
  keyboardInset: number;
  /** Heuristic: keyboard (or similar) is covering ≥ 120 px. */
  keyboardOpen: boolean;
}

const KEYBOARD_MIN = 120;

export function readVisibleViewport(): VisibleViewport {
  if (typeof window === "undefined") return { width: 0, height: 0, offsetTop: 0, keyboardInset: 0, keyboardOpen: false };
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  const offsetTop = Math.round(vv?.offsetTop ?? 0);
  const keyboardInset = Math.max(0, Math.round(window.innerHeight - height - offsetTop));
  return { width, height, offsetTop, keyboardInset, keyboardOpen: keyboardInset >= KEYBOARD_MIN };
}

function subscribe(cb: () => void): () => void {
  const vv = window.visualViewport;
  window.addEventListener("resize", cb);
  vv?.addEventListener("resize", cb);
  vv?.addEventListener("scroll", cb);
  return () => {
    window.removeEventListener("resize", cb);
    vv?.removeEventListener("resize", cb);
    vv?.removeEventListener("scroll", cb);
  };
}

/** Live visual viewport. Zeros during SSR and the first render. */
export function useVisibleViewport(): VisibleViewport {
  const [v, setV] = useState<VisibleViewport>({ width: 0, height: 0, offsetTop: 0, keyboardInset: 0, keyboardOpen: false });
  useEffect(() => {
    let raf = 0;
    const update = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setV(readVisibleViewport())); };
    setV(readVisibleViewport());
    const off = subscribe(update);
    return () => { off(); cancelAnimationFrame(raf); };
  }, []);
  return v;
}

/**
 * Keep `--fr-visible-height`, `--fr-visible-width` and `--fr-keyboard-inset` on <html> up to date.
 * Call once on the client; returns an uninstall function. Safe to call more than once.
 */
export function installViewportVars(root?: HTMLElement): () => void {
  if (typeof window === "undefined") return () => {};
  const el = root ?? document.documentElement;
  let raf = 0;
  const write = () => {
    const v = readVisibleViewport();
    el.style.setProperty("--fr-visible-height", `${v.height}px`);
    el.style.setProperty("--fr-visible-width", `${v.width}px`);
    el.style.setProperty("--fr-keyboard-inset", `${v.keyboardInset}px`);
  };
  const update = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(write); };
  write();
  const off = subscribe(update);
  return () => { off(); cancelAnimationFrame(raf); };
}

/** Component form of installViewportVars. Renders nothing. */
export function ViewportVars(): null {
  useEffect(() => installViewportVars(), []);
  return null;
}

/**
 * The viewport size after a fold / unfold / rotate has *finished*.
 *
 * Measured on iPhone Duo: one fold fires 2–3 `resize` events, passing through sizes that belong
 * to no pose (466×498, 382×498) before landing on 382×580 or 951×543. Code that re-lays out on
 * every resize does that work for a size the user never sees. This updates once the events have
 * been quiet for `quietMs` (default 150).
 */
export function useSettledViewport(quietMs = 150): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const read = () => ({ width: window.innerWidth, height: window.innerHeight });
    setSize(read());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = () => { clearTimeout(timer); timer = setTimeout(() => setSize(read()), quietMs); };
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("resize", on); clearTimeout(timer); };
  }, [quietMs]);
  return size;
}
