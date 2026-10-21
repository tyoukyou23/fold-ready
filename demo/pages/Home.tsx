import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { getInputModeOverride, setInputModeOverride, TOUCH_QUERY, useInputMode } from "fold-ready";
import { InboxApp } from "../components/InboxApp";
import { Code } from "../components/Code";

const WIDTHS = [
  { w: 0, label: "Fit", hint: "this window", h: 600 },
  { w: 382, label: "382", hint: "folded", h: 580 },
  { w: 669, label: "669", hint: "unfolded", h: 640 },
  { w: 951, label: "951", hint: "sideways", h: 543 },
  { w: 1280, label: "1280", hint: "laptop", h: 600 },
];

const MIN_DOCK = 860; // SplitHost's default minWidth

export function Home() {
  return (
    <>
      <section className="hero wrap">
        <p className="eyebrow">React · 0 dependencies · iPhone Duo, iPad, Android foldables</p>
        <h1>Web apps that keep working when the phone unfolds.</h1>
        <p className="lede">
          fold-ready decides by what the user can do — finger or mouse — not by how wide the screen is,
          so the same page fits a folded phone, an unfolded one and a laptop without breaking any of them.
        </p>
        <div className="install">
          <Code lang="sh">npm i fold-ready</Code>
        </div>
      </section>

      <LiveDemo />

      <section className="wrap section" aria-labelledby="breaks">
        <h2 id="breaks">What breaks on iPhone Duo</h2>
        <p className="section-lede">
          Measured in Safari on the iPhone Duo simulator. Folded the page gets <b>382 × 580</b>, unfolded <b>669 × 825</b>,
          sideways <b>951 × 543</b> — and no pose can hover.
        </p>
        <div className="cards">
          {BREAKS.map((b) => (
            <article className="card" key={b.id}>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
              <div className="ba">
                <figure className="ba-cell">
                  <figcaption>Before</figcaption>
                  <div className="mini" aria-hidden="true">{b.before}</div>
                </figure>
                <figure className="ba-cell ba-after">
                  <figcaption>After</figcaption>
                  <div className="mini" aria-hidden="true">{b.after}</div>
                </figure>
              </div>
              <p className="ba-alt">{b.alt}</p>
              <a className="card-link" href={`#/docs/${b.id}`}>{b.api} →</a>
            </article>
          ))}
        </div>
        <p className="section-foot">
          Want to see your own site in those three sizes? <a href="#/lab">Open Duo Lab</a>.
        </p>
      </section>
    </>
  );
}

/* ─── the live demo ─────────────────────────────────────────────────────────────── */

function LiveDemo() {
  const [choice, setChoice] = useState(0);
  const [finger, setFinger] = useState(() => getInputModeOverride()?.touch === true);
  const [realTouch, setRealTouch] = useState(false);
  const [keep, setKeep] = useState(true);
  const { touch } = useInputMode();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);
  useScopedDrawer(stageRef);

  useEffect(() => {
    const m = window.matchMedia?.(TOUCH_QUERY);
    setRealTouch(!!m?.matches);
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    setStageW(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setStageW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleFinger = () => {
    const next = !finger;
    setFinger(next);
    setInputModeOverride(next ? { touch: true, hover: false } : null);
  };

  const opt = WIDTHS[choice];
  const why = !touch
    ? "Mouse: the message opens as a drawer, exactly as before. fold-ready leaves desktop behaviour alone."
    : stageW < MIN_DOCK
      ? `Finger, but ${stageW} px is narrower than ${MIN_DOCK}: no room for two columns, so the message opens as a drawer.`
      : `Finger and ${stageW} px of room: the message docks beside the list instead of covering it.`;

  return (
    <section className="demo-section" aria-labelledby="demo-h">
      <div className="wrap">
        <h2 id="demo-h">Try it: one inbox, four widths</h2>
        <p className="section-lede">
          Open a message, then change the width. Turn on <b>Pretend I'm a finger</b> to see what a touch screen gets.
        </p>
        <div className="controls">
          <button type="button" className="switch" role="switch" aria-checked={finger} onClick={toggleFinger}>
            <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
            Pretend I'm a finger
          </button>
          <div className="seg" role="radiogroup" aria-label="Demo width">
            {WIDTHS.map((o, i) => (
              <button
                key={o.w}
                type="button"
                role="radio"
                aria-checked={choice === i}
                className="seg-btn"
                onClick={() => setChoice(i)}
              >
                <span className="seg-label">{o.label}</span>
                <span className="seg-hint">{o.hint}</span>
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            Keep my place (KeepPlace)
          </label>
        </div>
        <p className="why" aria-live="polite">
          <span className="why-w">{stageW} px</span> {why}
          {realTouch && !finger && <span className="muted"> (Your device already reports a finger.)</span>}
        </p>
      </div>
      <div className="stage-scroll">
        <div
          ref={stageRef}
          className="stage"
          style={{ width: opt.w ? `${opt.w}px` : "calc(min(100%, 1120px) - 2px)", height: `${opt.h}px` }}
        >
          <InboxApp keepPlace={keep} />
        </div>
      </div>
    </section>
  );
}

/**
 * Pane's drawer is `position: fixed` over the window — right for a real app. Here the "window"
 * is the stage box, so pin the drawer to the stage's rectangle while the demo is on screen.
 */
function useScopedDrawer(ref: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      root.style.setProperty("--stage-x", `${r.left}px`);
      root.style.setProperty("--stage-y", `${r.top}px`);
      root.style.setProperty("--stage-w", `${r.width}px`);
      root.style.setProperty("--stage-h", `${r.height}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    root.classList.add("stage-scoped");
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      root.classList.remove("stage-scoped");
    };
  }, [ref]);
}

/* ─── "what breaks" cards ───────────────────────────────────────────────────────── */

interface Break { id: string; title: string; text: string; api: string; alt: string; before: ReactNode; after: ReactNode }

const Row = ({ icons = "none" }: { icons?: "none" | "shown" }) => (
  <div className="m-row">
    <span className="m-avatar" />
    <span className="m-lines"><span /><span /></span>
    {icons === "shown" ? <span className="m-icon" /> : <span className="m-icon m-ghost" />}
  </div>
);

const BREAKS: Break[] = [
  {
    id: "use-input-mode",
    title: "Buttons that only appear on hover",
    text: "Row actions revealed with :hover never appear for a finger — and the 951 px sideways pose looks like a desktop.",
    api: "useInputMode · Tailwind can-hover:",
    alt: "Before: the star button is invisible. After: visible for fingers, still hover-revealed for a mouse.",
    before: <><Row /><Row /><Row /></>,
    after: <><Row icons="shown" /><Row icons="shown" /><Row icons="shown" /></>,
  },
  {
    id: "split",
    title: "“Wide means mouse”",
    text: "At 951 px most sites switch to the desktop layout: tiny targets, hover menus, a modal that covers the list.",
    api: "SplitHost · Pane",
    alt: "Before: a drawer covers the list. After: the detail docks beside it.",
    before: <div className="m-split"><div className="m-list"><Row /><Row /></div><div className="m-drawer" /></div>,
    after: <div className="m-split"><div className="m-list"><Row icons="shown" /><Row icons="shown" /></div><div className="m-dock"><span /><span /><span /></div></div>,
  },
  {
    id: "visible-viewport",
    title: "100vh is taller than the page",
    text: "Folded, Safari gives the page 580 px but 100vh is 598 — a full-height sheet hides its button. With the keyboard up, every vh unit is wrong.",
    api: "useVisibleViewport · dvh",
    alt: "Before: the bottom button is cut off. After: it sits inside the visible area.",
    before: <div className="m-vh"><div className="m-sheet"><span /><span /></div><div className="m-cta m-cut" /><div className="m-toolbar" /></div>,
    after: <div className="m-vh"><div className="m-sheet"><span /><span /></div><div className="m-cta" /><div className="m-toolbar" /></div>,
  },
  {
    id: "keep-place",
    title: "Losing your place on unfold",
    text: "Unfolding reflows every row but keeps the pixel offset, so you land on a different message.",
    api: "KeepPlace",
    alt: "Before: after unfolding, the list shows message 3. After: still message 27.",
    before: <div className="m-place"><span className="m-num">3</span><Row /><Row /></div>,
    after: <div className="m-place"><span className="m-num m-num-on">27</span><Row /><Row /></div>,
  },
  {
    id: "toolbar-tint",
    title: "A grey stripe next to your page",
    text: "Folded, Safari's buttons sit in a column on the right and ignore theme-color — they sample the page's right edge, so a coloured app gets a mismatched stripe.",
    api: "ToolbarTint",
    alt: "Before: the right column stays grey beside a coloured page. After: it takes the page's colour.",
    before: <div className="m-tint"><div className="m-page"><div className="m-head" /><span /><span /></div><div className="m-side" /></div>,
    after: <div className="m-tint"><div className="m-page"><div className="m-head" /><span /><span /></div><div className="m-side m-side-on" /></div>,
  },
];
