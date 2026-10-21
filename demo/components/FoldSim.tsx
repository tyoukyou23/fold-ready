import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Fold simulation — what your hand does, and what the page gets.
 *
 * The story (every motion is the consequence of the step before it):
 *   1. You open the phone.           → left: the cover (left half, outer screen on its back) swings
 *                                       open from right to left on the hinge, like a book.
 *   2. Mid-swing, Safari changes screen → right: the page jumps to 466 × 498 — a size that belongs
 *                                       to no pose (measured). The frame outline flashes: "resize".
 *   3. The phone is open.            → right: the page jumps to 951 × 543 and the orientation flips.
 *   Closing runs the same three steps backwards (466 × 498, then 382 × 580).
 *
 * Sizes and their order are measured in the iPhone Duo simulator (Safari 27, 2026-10-21).
 * Sizes JUMP — they never animate. A browser never hands a page the in-between sizes, so
 * neither do we (that was the mistake in a smooth-resize preview).
 * Timing within the swing is approximate; the measurements only tell us the order.
 */

type Size = { w: number; h: number };
const FOLDED: Size = { w: 382, h: 580 };
const OPEN: Size = { w: 951, h: 543 };
const TRANSIENT: Size = { w: 466, h: 498 };
// folded is the TALLEST page (580) — reserve that, or the folded frame covers the caption
const MAX_H = Math.max(FOLDED.h, OPEN.h, TRANSIENT.h);

const SWING_MS = 900;
const TRANSIENT_AT = 380;

interface LogLine { t: number; text: string; kind: "resize" | "orientation" | "note" }

export function FoldSim({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<Size>(FOLDED);
  const [flash, setFlash] = useState(0);
  const [log, setLog] = useState<LogLine[]>([{ t: 0, text: "folded · page 382 × 580", kind: "note" }]);
  const [settle, setSettle] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t0 = useRef(0);
  const [colRef, colW] = useWidth<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, reduced ? ms / 3 : ms)); };
  const jump = (s: Size, label: string) => {
    setSize(s);
    setFlash((n) => n + 1);
    setLog((l) => [...l, { t: Math.round(performance.now() - t0.current), text: `resize → ${s.w} × ${s.h}${label}`, kind: "resize" as const }].slice(-7));
  };
  const note = (text: string, kind: LogLine["kind"] = "note") =>
    setLog((l) => [...l, { t: Math.round(performance.now() - t0.current), text, kind }].slice(-7));

  const toggle = () => {
    if (busy) return;
    const opening = !open;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    t0.current = performance.now();
    setBusy(true);
    setOpen(opening);
    setLog([{ t: 0, text: opening ? "you start opening the phone" : "you start folding the phone", kind: "note" }]);
    at(TRANSIENT_AT, () => jump(TRANSIENT, "   (transient — no pose has this size)"));
    at(SWING_MS, () => {
      note(opening ? "orientation → landscape" : "orientation → portrait", "orientation");
      jump(opening ? OPEN : FOLDED, opening ? "   open" : "   folded");
    });
    at(SWING_MS + 250, () => { setBusy(false); note(opening ? "done — one gesture, 2 resizes, 1 size nobody designs for" : "done"); });
  };

  // the page column: scale the real-size iframe down to fit
  const maxW = OPEN.w;
  const scale = colW ? Math.min(1, colW / maxW) : 0;
  const frameSrc = settle ? src : withQuery(src, "settle", "0");

  return (
    <section className="foldsim lab-section" aria-labelledby="foldsim-h">
      <div className="player-head">
        <h2 id="foldsim-h">Fold it — what really happens</h2>
        <button type="button" className="btn btn-primary btn-big" onClick={toggle} disabled={busy}>
          {open ? "Fold the phone" : "Open the phone"}
        </button>
      </div>
      <p className="player-caption">
        Left: what your hand does. Right: what the page actually receives — the sizes <strong>jump</strong>, and halfway
        through Safari hands the page <strong>466 × 498</strong>, a size that belongs to no pose. Code that re-lays out on
        every resize does it for a frame nobody sees, and a list–detail flips to a drawer and back.
      </p>

      <div className="foldsim-grid">
        <figure className="foldsim-hand">
          <div className={`hinge-stage${open ? " is-open" : ""}${reduced ? " no-motion" : ""}`} aria-hidden="true">
            {/* Like a book: the outer screen is the front cover (left half, folded over the right half).
                Opening swings the cover from right to left around the hinge in the middle.
                Each visual is a consequence (see styles.css "the hand"):
                  outer screen dims + blurs  → it is switching off, handing the display over
                  inner screen blurs → sharp → it lights up; it is sharp exactly when the page gets 951 × 543,
                                               so the 466 × 498 frame happens while nothing is in focus
                  sheen sweeps the cover      → the glass turns through the light
                  shadow widens               → the open phone is twice as wide */}
            <div className="book">
              <div className="book-shadow" />
              <div className="leaf leaf-right">
                <div className="dev-frame dev-frame-right">
                  <div className="dev-glass screen-inner"><MiniDetail /></div>
                </div>
              </div>
              <div className="leaf leaf-left">
                <div className="face face-front">
                  <div className="dev-frame dev-frame-left">
                    <div className="dev-glass screen-inner"><MiniList /></div>
                  </div>
                </div>
                <div className="face face-back">
                  <div className="dev-frame dev-frame-outer">
                    <div className="dev-glass screen-outer">
                      <MiniDetail compact />
                      <span className="fmini-safari-col"><i /><i /><i /></span>
                    </div>
                  </div>
                  <span className="sheen" />
                </div>
              </div>
            </div>
          </div>
          <figcaption>Your hand · {open ? "open" : "folded"}</figcaption>
        </figure>

        <figure className="foldsim-page" ref={colRef}>
          <div className="foldsim-pagebox" style={{ height: scale ? MAX_H * scale + 2 : undefined }}>
            {scale > 0 && (
              // the iframe must never remount — that would be a reload, which a fold never causes
              <div className="foldsim-viewport" style={{ width: size.w * scale, height: size.h * scale }}>
                {flash > 0 && <span key={flash} className="foldsim-flash" aria-hidden="true" />}
                <iframe
                  key={frameSrc}
                  src={frameSrc}
                  title="Page during the fold"
                  style={{ width: size.w, height: size.h, transform: `scale(${scale})` }}
                />
                <span className="foldsim-size">{size.w} × {size.h}{size === TRANSIENT ? " · transient" : ""}</span>
              </div>
            )}
          </div>
          <figcaption>What the page gets</figcaption>
        </figure>
      </div>

      <div className="foldsim-foot">
        <ol className="foldsim-log" aria-live="polite">
          {log.map((l, i) => (
            <li key={i} data-kind={l.kind}><span className="foldsim-t">+{String(l.t).padStart(4, " ")} ms</span>{l.text}</li>
          ))}
        </ol>
        <label className="check">
          <input type="checkbox" checked={settle} onChange={(e) => setSettle(e.target.checked)} />
          <span>
            Wait for the size to settle <span className="muted">(SplitHost default, 150 ms)</span>
            <br />
            <span className="muted small">Turn off, then fold with a message open: the reader flips to a drawer and back.</span>
          </span>
        </label>
      </div>
      <p className="muted small">Sizes and their order measured in the iPhone Duo simulator (Safari 27). Timing inside the swing is approximate.</p>
    </section>
  );
}

/* Tiny stand-ins for the demo inbox, so the hand shows the same layout the page gets:
   folded → the message fills the outer screen; open → list on the left, message on the right. */
function MiniList() {
  return (
    <div className="fmini fmini-list">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`fmini-row${i === 2 ? " is-on" : ""}`}><i className="fmini-av" /><span><b /><b /></span></div>
      ))}
    </div>
  );
}
function MiniDetail({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`fmini fmini-detail${compact ? " is-compact" : ""}`}>
      <b className="fmini-h" />
      <span className="fmini-meta"><i className="fmini-av" /><b /></span>
      <b /><b /><b className="w80" /><b /><b className="w60" />
    </div>
  );
}

function withQuery(url: string, key: string, value: string) {
  try {
    const u = new URL(url, window.location.href);
    u.searchParams.set(key, value);
    return u.toString();
  } catch { return url; }
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}
