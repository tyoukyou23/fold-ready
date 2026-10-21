/**
 * Unfold without losing your place.
 *
 * When a foldable (iPhone Duo, Galaxy Fold…) unfolds, a tablet rotates, or Split View is dragged,
 * the viewport width changes without a reload. Text reflows, every block changes height — and the
 * browser keeps the *pixel* scroll offset. That offset now points at a different paragraph or row:
 * the reader lands somewhere else. A focused input can end up off-screen (or under the keyboard),
 * and a layout that re-renders on the breakpoint can drop the caret.
 *
 * `useKeepPlace` keeps the *content* in place instead of the pixel offset:
 *
 *   1. While the user scrolls (passive, rAF-throttled) it remembers an anchor — the first block
 *      crossing the top edge of the visible area — and how far that block sits from the edge.
 *      The edge sits below sticky headers: `topInset`, or the scroller's `scroll-padding-top`.
 *   2. When the scroller's size changes (width by ≥ 1px, or height by a lot — rotation), it waits
 *      for layout to settle and scrolls so the anchor is back at the same distance from the top.
 *      It does this twice (next frame and the one after) because some engines reflow late.
 *      Its own scrolling is not mistaken for the user's.
 *   3. If the user is typing (focused input / textarea / contenteditable inside the scroller),
 *      that field wins: it is brought back into view (above the on-screen keyboard, using
 *      `visualViewport`) and its selection is put back if a re-render moved it.
 *
 * Anchors: mark the items that make good anchors (list rows, cards, paragraphs) with
 * `data-keep-anchor` for exact results — they are searched by binary search, so long lists stay
 * cheap (this assumes they are in document order top to bottom). Without marks, the anchor is
 * found with `document.elementFromPoint` just inside the top edge, falling back to a walk down the
 * content tree; inline elements, tiny boxes and sticky / fixed elements are skipped.
 *
 * Only size changes trigger a restore. Normal scrolling, the iOS URL bar collapsing and the
 * keyboard opening (small height changes) are left alone.
 *
 * SSR-safe: nothing touches `window` / `document` at module level or during render.
 */
import {
  createElement, Fragment, useEffect, useRef,
  type HTMLAttributes, type ReactNode, type RefObject,
} from "react";

/* ─── pure helpers (exported for tests and for people building their own) ─────────────── */

/**
 * The scrollTop that puts the anchor back where it was.
 *
 * @param prevOffset       anchor top − scroller top, recorded before the resize
 * @param anchorTopNow     anchor's `getBoundingClientRect().top` after the reflow
 * @param scrollerTopNow   top of the scroller's visible area now (0 for the document)
 * @param currentScrollTop the scroller's scrollTop now
 */
export function computeRestoreScrollTop(
  prevOffset: number, anchorTopNow: number, scrollerTopNow: number, currentScrollTop: number,
): number {
  return currentScrollTop + (anchorTopNow - scrollerTopNow) - prevOffset;
}

/**
 * How far to scroll (positive = down) so `[itemTop, itemBottom]` is inside `[viewTop, viewBottom]`,
 * moving as little as possible (`block: "nearest"`). 0 if it is already visible.
 * An item taller than the view is aligned to the top.
 */
export function computeRevealDelta(
  itemTop: number, itemBottom: number, viewTop: number, viewBottom: number, margin = 8,
): number {
  const room = viewBottom - viewTop;
  if (itemBottom - itemTop + margin * 2 > room) {
    return itemTop < viewTop || itemTop > viewBottom ? itemTop - viewTop - margin : 0;
  }
  if (itemTop < viewTop) return itemTop - viewTop - margin;
  if (itemBottom > viewBottom) return itemBottom - viewBottom + margin;
  return 0;
}

export interface Size { width: number; height: number }

/**
 * Is this size change one that reflows content (and so needs a restore)?
 * Any width change of ≥ 1px; a height change only when it is large (≥ 1/3 — rotation, unfold),
 * so the iOS URL bar and the on-screen keyboard don't trigger it.
 */
export function isReflowingResize(prev: Size, next: Size): boolean {
  if (Math.abs(next.width - prev.width) >= 1) return true;
  const base = Math.max(prev.height, 1);
  return Math.abs(next.height - prev.height) / base >= 1 / 3;
}

/**
 * Index of the first rect whose bottom is below `edge` (i.e. crosses or follows the top edge),
 * assuming rects are in top-to-bottom order. `-1` if none.
 */
export function firstBelowEdge(count: number, bottomAt: (i: number) => number, edge: number): number {
  let lo = 0;
  let hi = count - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bottomAt(mid) > edge + 0.5) { found = mid; hi = mid - 1; } else lo = mid + 1;
  }
  return found;
}

/* ─── scroller abstraction ────────────────────────────────────────────────────────────── */

export interface View { top: number; bottom: number; left: number; width: number }

interface Scroller {
  /** Element that contains the content (searched for anchors). */
  content: Element;
  /** The scrolling element itself (never chosen as an anchor). */
  self: Element;
  getScrollTop(): number;
  setScrollTop(y: number): void;
  view(): View;
  size(): Size;
}

function elementScroller(el: HTMLElement): Scroller {
  return {
    content: el,
    self: el,
    getScrollTop: () => el.scrollTop,
    setScrollTop: (y) => { el.scrollTop = y; },
    view: () => {
      const r = el.getBoundingClientRect();
      const h = el.clientHeight || r.height;
      return { top: r.top + (el.clientTop || 0), bottom: r.top + (el.clientTop || 0) + h, left: r.left, width: r.width };
    },
    size: () => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    },
  };
}

function documentScroller(): Scroller {
  const se = (document.scrollingElement || document.documentElement) as HTMLElement;
  return {
    content: document.body,
    self: se,
    getScrollTop: () => window.pageYOffset || se.scrollTop || 0,
    setScrollTop: (y) => {
      if (typeof window.scrollTo === "function") {
        try { window.scrollTo(window.pageXOffset || 0, y); return; } catch { /* jsdom */ }
      }
      se.scrollTop = y;
    },
    view: () => ({ top: 0, bottom: window.innerHeight, left: 0, width: window.innerWidth }),
    size: () => ({ width: window.innerWidth, height: window.innerHeight }),
  };
}

/** Bottom of what the user can actually see (the keyboard shrinks the visual viewport). */
function visibleBottom(view: View): number {
  const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
  const vvBottom = vv ? vv.offsetTop + vv.height : (typeof window !== "undefined" ? window.innerHeight : Infinity);
  return Math.min(view.bottom, vvBottom);
}

function visibleTop(view: View, inset = 0): number {
  const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
  return Math.max(view.top + inset, vv ? vv.offsetTop : 0);
}

/**
 * The scroller's `scroll-padding-top` in px (0 for `auto` or anything unparsable).
 * It is the CSS-native way a page says "a sticky header covers this much of the top" —
 * the same value that keeps `#anchor` jumps and `scrollIntoView()` clear of the header.
 */
export function readScrollPaddingTop(el: Element): number {
  try {
    const v = parseFloat(window.getComputedStyle(el).scrollPaddingTop);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}

/** Bars narrower than this share of the view are columns (a sticky map, a side nav), not headers. */
const MIN_BAR_SHARE = 0.9;
/** Never treat more than this share of the view as covered — a full-screen overlay is not a header. */
const MAX_CHROME_SHARE = 0.5;

function stuckBarAt(x: number, y: number, view: View, within?: Element): Element | null {
  let hit: Element | null = null;
  try { hit = document.elementFromPoint(x, y); } catch { hit = null; }
  // Walk up to (not into) the scroller: a fixed drawer that *contains* the scroller is not a bar over it.
  while (hit && hit !== document.body && hit !== document.documentElement && !(within && hit.contains(within))) {
    const s = styleOf(hit);
    if (s && (s.position === "fixed" || s.position === "sticky")) {
      const r = hit.getBoundingClientRect();
      if (r.width >= view.width * MIN_BAR_SHARE && r.top <= y && r.bottom > y) return hit;
    }
    hit = hit.parentElement;
  }
  return null;
}

/**
 * Px at the top of `view` covered by fixed / sticky bars, measured now: a header, and whatever
 * is stuck right below it (a section nav, a tab bar) — stacked bars are followed down.
 * Only bars at least 90% as wide as the view count, so a sticky map or side column doesn't.
 * Capped at half the view. 0 when nothing covers the top (or `elementFromPoint` is missing).
 * `within`: the scroller, for a scroll container — its own fixed / sticky ancestors are skipped.
 *
 * This is what `topInset: "auto"` uses. Unlike `scroll-padding-top` it follows bars that
 * appear, collapse or change height with the breakpoint — e.g. a 56 px header that is 64 px
 * from 600 px up, plus a section nav that only exists below 900 px.
 */
export function measureTopChrome(view: View, within?: Element): number {
  if (typeof document === "undefined" || typeof document.elementFromPoint !== "function") return 0;
  const limit = view.top + (view.bottom - view.top) * MAX_CHROME_SHARE;
  const x = view.left + view.width / 2;
  let y = view.top;
  for (let i = 0; i < 6; i++) {
    const bar = stuckBarAt(x, y + 1, view, within);
    if (!bar) break;
    const bottom = bar.getBoundingClientRect().bottom;
    if (bottom <= y + 0.5) break;
    y = Math.min(bottom, limit);
    if (y >= limit) break;
  }
  return Math.max(0, y - view.top);
}

/* ─── anchor search ───────────────────────────────────────────────────────────────────── */

interface Anchor { el: Element; offset: number }

const MIN_ANCHOR_HEIGHT = 8;
const MAX_DEPTH = 12;

function styleOf(el: Element): CSSStyleDeclaration | null {
  try { return window.getComputedStyle(el); } catch { return null; }
}

/** Blocks that move with the content and are big enough to mean something. */
function isGoodAnchor(el: Element): boolean {
  const s = styleOf(el);
  if (s) {
    if (s.display === "none" || s.display === "contents") return false;
    if (s.display.indexOf("inline") === 0 && s.display !== "inline-block" && s.display !== "inline-flex" && s.display !== "inline-grid") return false;
    if (s.position === "fixed" || s.position === "sticky") return false;
  }
  return el.getBoundingClientRect().height >= MIN_ANCHOR_HEIGHT;
}

function fromMarked(sc: Scroller, edge: number): Element | null {
  const list = sc.content.querySelectorAll("[data-keep-anchor]");
  if (!list.length) return null;
  const i = firstBelowEdge(list.length, (k) => list[k].getBoundingClientRect().bottom, edge);
  return i < 0 ? null : list[i];
}

function fromPoint(sc: Scroller, view: View, edge: number): Element | null {
  if (typeof document.elementFromPoint !== "function") return null;
  const y = edge + 4;
  const xs = [view.left + view.width / 2, view.left + Math.min(24, view.width / 4)];
  for (const x of xs) {
    let hit: Element | null = null;
    try { hit = document.elementFromPoint(x, y); } catch { hit = null; }
    while (hit && hit !== sc.self && hit !== sc.content && sc.content.contains(hit)) {
      if (isGoodAnchor(hit)) return hit;
      hit = hit.parentElement;
    }
  }
  return null;
}

/** Walk down the content: at each level take the first child that reaches below the edge. */
function fromWalk(sc: Scroller, edge: number): Element | null {
  let parent: Element = sc.content;
  let best: Element | null = null;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    let next: Element | null = null;
    for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
      if (!isGoodAnchor(c)) continue;
      if (c.getBoundingClientRect().bottom > edge + 0.5) { next = c; break; }
    }
    if (!next) break;
    best = next;
    // Fully below the edge: that's the block. Straddling: look for a finer block inside.
    if (next.getBoundingClientRect().top >= edge) break;
    parent = next;
  }
  return best;
}

/** `inset`: px at the top hidden by sticky headers — the reading edge sits below them. */
function findAnchor(sc: Scroller, inset = 0): Anchor | null {
  const view = sc.view();
  const edge = view.top + inset;
  const el = fromMarked(sc, edge) || fromPoint(sc, view, edge) || fromWalk(sc, edge);
  if (!el) return null;
  return { el, offset: el.getBoundingClientRect().top - edge };
}

/* ─── focus / caret ───────────────────────────────────────────────────────────────────── */

const TEXT_INPUTS = /^(?:text|search|email|url|tel|password|number|date|datetime-local|month|time|week)$/;

function isEditable(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUTS.test(el.type || "text");
  return !!(el as HTMLElement).isContentEditable;
}

interface Caret { el: HTMLInputElement | HTMLTextAreaElement; start: number; end: number; dir: "forward" | "backward" | "none" }

function readCaret(el: Element | null): Caret | null {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return null;
  try {
    if (el.selectionStart == null || el.selectionEnd == null) return null;
    return { el, start: el.selectionStart, end: el.selectionEnd, dir: (el.selectionDirection as Caret["dir"]) || "none" };
  } catch { return null; } // input types without selection API throw
}

function restoreCaret(c: Caret | null): void {
  if (!c || document.activeElement !== c.el) return;
  try {
    if (c.end > c.el.value.length) return;
    if (c.el.selectionStart !== c.start || c.el.selectionEnd !== c.end) c.el.setSelectionRange(c.start, c.end, c.dir);
  } catch { /* ignore */ }
}

/* ─── the hook ────────────────────────────────────────────────────────────────────────── */

export interface KeepPlaceRestoreInfo {
  /** The element kept in place (the anchor, or the focused field). */
  anchor: Element;
  /** How far the restore scrolled, in px (positive = down). */
  delta: number;
}

export interface KeepPlaceOptions {
  /** Turn it off without unmounting. Default true. */
  enabled?: boolean;
  /** Called after each restore that moved something. */
  onRestore?: (info: KeepPlaceRestoreInfo) => void;
  /**
   * Px at the top of the scroller covered by sticky headers / tab bars. The reading position is
   * taken just below them, so what the user was actually reading is what comes back.
   *
   * Default: the scroller's CSS `scroll-padding-top` (for `document`, the `<html>` element's)
   * when it is set; otherwise `"auto"`.
   * `"auto"`: measure the fixed / sticky bars covering the top right now (`measureTopChrome`) —
   * follows headers that change height with the breakpoint and section navs stuck below them.
   * A number, or a function when you know better (e.g. a header that collapses).
   */
  topInset?: number | "auto" | (() => number);
}

const raf = (cb: () => void): number =>
  typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
const caf = (id: number): void => {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id); else clearTimeout(id);
};

/**
 * Keep the reading position of a scroll container across size changes (unfold, rotate, Split View).
 * Pass the scroller's ref; omit it (or pass `null`) to keep the document's scroll position.
 * See the module comment for what counts as "position".
 */
export function useKeepPlace(ref?: RefObject<HTMLElement> | null, options: KeepPlaceOptions = {}): void {
  const { enabled = true } = options;
  const onRestore = useRef(options.onRestore);
  onRestore.current = options.onRestore;
  const topInset = useRef(options.topInset);
  topInset.current = options.topInset;
  const isDocument = !ref;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const el = ref ? ref.current : null;
    if (!isDocument && !el) return undefined;
    const sc = el ? elementScroller(el) : documentScroller();

    let anchor: Anchor | null = null;
    let caret: Caret | null = null;
    let lastSize = sc.size();
    let restoring = false;
    let recordFrame = 0;
    let recordPending = false;
    let restoreFrame = 0;

    const inset = (): number => {
      const t = topInset.current;
      const v = typeof t === "function" ? t()
        : typeof t === "number" ? t
        : t === "auto" ? measureTopChrome(sc.view(), el || undefined)
        : readScrollPaddingTop(sc.self) || measureTopChrome(sc.view(), el || undefined);
      return Number.isFinite(v) && v > 0 ? v : 0;
    };

    const record = () => {
      const a = findAnchor(sc, inset());
      if (a) anchor = a;
    };

    const focusedField = (): HTMLElement | null => {
      const a = document.activeElement;
      return isEditable(a) && sc.content.contains(a) ? a : null;
    };

    const applyOnce = (): { el: Element; delta: number } | null => {
      const field = focusedField();
      if (field) {
        if (caret && caret.el === field) restoreCaret(caret);
        const view = sc.view();
        const r = field.getBoundingClientRect();
        const d = computeRevealDelta(r.top, r.bottom, visibleTop(view, inset()), visibleBottom(view));
        if (d) sc.setScrollTop(sc.getScrollTop() + d);
        return { el: field, delta: d };
      }
      const a = anchor;
      if (!a || !a.el.isConnected || !sc.content.contains(a.el)) return null;
      const cur = sc.getScrollTop();
      const target = computeRestoreScrollTop(a.offset, a.el.getBoundingClientRect().top, sc.view().top + inset(), cur);
      const d = target - cur;
      if (Math.abs(d) < 1) return { el: a.el, delta: 0 };
      sc.setScrollTop(target);
      return { el: a.el, delta: d };
    };

    const scheduleRestore = () => {
      // Snapshot the caret now, before any re-render that the resize triggers can move it.
      const f = focusedField();
      if (f) { const c = readCaret(f); if (c && !(caret && caret.el === f)) caret = c; }
      restoring = true;
      caf(restoreFrame);
      let total = 0;
      let target: Element | null = null;
      const step = (n: number) => {
        restoreFrame = raf(() => {
          if (n < 2) {
            const r = applyOnce();
            if (r) { total += r.delta; target = r.el; }
            step(n + 1);
          } else {
            // Our own scroll events have been dispatched by now; listen to the user again.
            restoring = false;
            if (target && Math.abs(total) >= 1) onRestore.current?.({ anchor: target, delta: total });
          }
        });
      };
      step(0);
    };

    const onResize = () => {
      const next = sc.size();
      const prev = lastSize;
      lastSize = next;
      if (isReflowingResize(prev, next)) scheduleRestore();
    };

    const onScroll = () => {
      if (restoring || recordPending) return;
      recordPending = true;
      recordFrame = raf(() => {
        recordPending = false;
        if (restoring) return;
        // A reflow can clamp scrollTop and fire "scroll" before the resize is reported:
        // don't record that as the user's position.
        const next = sc.size();
        if (isReflowingResize(lastSize, next)) { onResize(); return; }
        lastSize = next;
        record();
      });
    };

    const onCaret = () => {
      const f = focusedField();
      if (!f) return;
      const c = readCaret(f);
      if (c) caret = c;
    };

    const scrollTarget: EventTarget = el || window;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);

    const caretEvents = ["keyup", "input", "select", "mouseup", "pointerup", "focusin"];
    const caretTarget: EventTarget = el || document;
    caretEvents.forEach((t) => caretTarget.addEventListener(t, onCaret, true));
    document.addEventListener("selectionchange", onCaret);

    let ro: ResizeObserver | null = null;
    const vv = window.visualViewport;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => onResize());
      ro.observe(el);
    } else {
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      if (vv) vv.addEventListener("resize", onResize);
    }

    recordPending = true;
    recordFrame = raf(() => { recordPending = false; record(); });

    return () => {
      caf(recordFrame);
      caf(restoreFrame);
      scrollTarget.removeEventListener("scroll", onScroll);
      caretEvents.forEach((t) => caretTarget.removeEventListener(t, onCaret, true));
      document.removeEventListener("selectionchange", onCaret);
      if (ro) ro.disconnect();
      else {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
        if (vv) vv.removeEventListener("resize", onResize);
      }
    };
  }, [ref, isDocument, enabled]);
}

/* ─── the component ───────────────────────────────────────────────────────────────────── */

export interface KeepPlaceProps extends HTMLAttributes<HTMLElement>, KeepPlaceOptions {
  /** Element to render as the scroll container. Default "div". */
  as?: string;
  /** Keep the window's scroll position instead; renders `children` only (no wrapper). */
  document?: boolean;
  children?: ReactNode;
}

function KeepDocumentPlace({ children, enabled, onRestore, topInset }: { children?: ReactNode } & KeepPlaceOptions) {
  useKeepPlace(null, { enabled, onRestore, topInset });
  return createElement(Fragment, null, children);
}

function KeepElementPlace({ as = "div", children, enabled, onRestore, topInset, ...rest }: Omit<KeepPlaceProps, "document">) {
  const ref = useRef<HTMLElement>(null);
  useKeepPlace(ref, { enabled, onRestore, topInset });
  return createElement(as, { ...rest, ref }, children);
}

/**
 * A scroll container that keeps its reading position when it changes size.
 *
 *   <KeepPlace className="overflow-y-auto h-full">…rows with data-keep-anchor…</KeepPlace>
 *
 * Making it scroll is your job (`overflow-y: auto` and a bounded height via className / style) —
 * it renders a plain element so it fits whatever layout you already have.
 *
 *   <KeepPlace document>…</KeepPlace>   // keep the page's own scroll position instead
 */
export function KeepPlace({ document: isDocument, ...props }: KeepPlaceProps) {
  if (isDocument) {
    return createElement(KeepDocumentPlace, { enabled: props.enabled, onRestore: props.onRestore, topInset: props.topInset }, props.children);
  }
  return createElement(KeepElementPlace, props);
}
