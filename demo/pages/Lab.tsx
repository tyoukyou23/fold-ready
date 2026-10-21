import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { IPHONE_DUO } from "fold-ready/devices";
import { DuoFrame, geometry, outer, type LoadState } from "../components/DuoFrame";
import { selfUrl } from "../router";
import { FoldSim } from "../components/FoldSim";

// The three poses whose Safari chrome we've drawn (folded-sideways is in the table, not the frames)
const POSES = IPHONE_DUO.poses.filter((p) => p.pose !== "folded-landscape");
const [FOLDED, PORTRAIT, SIDEWAYS] = POSES;
const SLOW_MS = 10000;
const MOVE_MS = 700;
const HOLD_MS = 1200;

/** Add `fr-simulate=touch` so pages using fold-ready render as a finger would get them. */
export function withSimulate(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.searchParams.has("fr-simulate")) u.searchParams.set("fr-simulate", "touch");
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(u: string) {
  try { return new URL(u).host; } catch { return ""; }
}

function useWidth<T extends HTMLElement>() {
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
  return [ref, w] as const;
}

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return undefined;
    const u = () => setR(m.matches);
    u();
    m.addEventListener?.("change", u);
    return () => m.removeEventListener?.("change", u);
  }, []);
  return r;
}

export function Lab() {
  if (typeof window !== "undefined" && window.self !== window.top) {
    return (
      <div className="wrap lab">
        <p className="note">Duo Lab inside Duo Lab would load itself forever, so it stops here.</p>
      </div>
    );
  }
  return <LabPage />;
}

function LabPage() {
  const home = selfUrl("#/");
  // The default shows the product: the inbox, scrolled to the middle with a message open —
  // so Unfold shows the pane docking AND the list keeping its place.
  const inbox = selfUrl("#/app", true, "sel=14&row=12");
  const [input, setInput] = useState(inbox);
  const [src, setSrc] = useState(inbox);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loads, setLoads] = useState<Record<string, LoadState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const presets = [
    { label: "Inbox (open message)", url: inbox },
    { label: "This site", url: home },
  ];

  // (Re)start the "is it loading?" watch for every frame whenever the URL or reload changes.
  const ids = ["static-0", "static-1", "static-2", "player"];
  useEffect(() => {
    const t = timers.current;
    setLoads(Object.fromEntries(ids.map((id) => [id, "loading" as LoadState])));
    ids.forEach((id) => {
      clearTimeout(t[id]);
      t[id] = setTimeout(() => setLoads((l) => (l[id] === "loading" ? { ...l, [id]: "slow" } : l)), SLOW_MS);
    });
    return () => ids.forEach((id) => clearTimeout(t[id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, reloadKey]);

  const loaded = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    setLoads((l) => ({ ...l, [id]: "loaded" }));
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const u = withSimulate(input);
    if (!u) { setError("That doesn't look like a web address. Try something like example.com"); return; }
    setError(null);
    setInput(u);
    if (u === src) setReloadKey((k) => k + 1); else setSrc(u);
  };

  const pick = (u: string) => { setInput(u); setError(null); setSrc(u); };

  const host = hostOf(src);
  const anySlow = Object.values(loads).some((s) => s === "slow");
  const external = host !== window.location.host;

  return (
    <div className="wrap lab">
      <header className="page-head">
        <p className="eyebrow">Duo Lab</p>
        <h1>See your site the way iPhone Duo's Safari shows it.</h1>
        <p className="lede">
          Three frames at the exact sizes Safari gives a page — not the screen sizes spec sheets quote — with Safari's
          own bars drawn where they take the space. Then press <b>Unfold</b> and watch one page go through all three.
        </p>
      </header>

      <form className="lab-form" onSubmit={submit}>
        <label htmlFor="lab-url" className="lab-label">Page to load</label>
        <div className="lab-row">
          <input
            id="lab-url"
            className="input"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-describedby="lab-help"
            aria-invalid={!!error || undefined}
          />
          <button type="submit" className="btn btn-primary">Load</button>
        </div>
        <p id="lab-help" className="lab-help">
          <code>fr-simulate=touch</code> is added so pages using fold-ready render for a finger — a desktop browser can't
          otherwise pretend to have no mouse inside an iframe. Try:{" "}
          {presets.map((p, i) => (
            <span key={p.label}>
              {i > 0 && " · "}
              <button type="button" className="linkish" onClick={() => pick(p.url)} aria-pressed={src === p.url}>{p.label}</button>
            </span>
          ))}
        </p>
        {error && <p className="lab-error" role="alert">{error}</p>}
      </form>

      {anySlow && (
        <div className="note note-warn" role="status">
          <strong>{host} hasn't loaded after {SLOW_MS / 1000} seconds.</strong> Many sites refuse to be shown inside
          another page (<code>X-Frame-Options</code> or CSP <code>frame-ancestors</code>), and the browser shows a blank or
          error frame instead. Run Duo Lab locally against your dev server (<code>npm run dev</code> in the fold-ready repo,
          then load <code>localhost</code>), or add <code>&lt;FoldReadyInspector /&gt;</code> to your app and use it in a
          real device or the simulator.
        </div>
      )}

      <FoldSim src={src} />

      <Player src={src} host={host} frameKey={`${src}|${reloadKey}`} onLoad={() => loaded("player")} />

      <StaticFrames src={src} host={host} reloadKey={reloadKey} onLoad={loaded} loads={loads} />

      <section className="lab-notes" aria-labelledby="lab-notes-h">
        <h2 id="lab-notes-h">What the frames can and can't tell you</h2>
        <ul>
          <li><b>Sizes are exact.</b> Each page gets precisely the CSS pixels Safari gave our probe page on the iPhone Duo simulator (Xcode 27.1, 2026-10-21).</li>
          <li><b>Input is not.</b> Your browser still has a mouse, so <code>(hover: hover)</code> stays true inside the frames. Pages built on fold-ready read <code>?fr-simulate=touch</code>; other pages show their mouse layout at Duo sizes.</li>
          <li><b>Blocked sites stay blank.</b> {external ? "If a frame stays empty, " : "If you load another site and a frame stays empty, "}
            it sends <code>X-Frame-Options</code> or <code>frame-ancestors</code>. That's the site's choice, not something Duo Lab can work around.</li>
          <li><b>Unfold is a resize.</b> The player keeps the same page alive while it changes size — exactly what Safari does — so you can see whether your list stays on the same row.</li>
        </ul>
        <p>On a real phone? <a href="#/measure">Measure your device</a> and send us the numbers.</p>
      </section>
    </div>
  );
}

/* ─── three frames side by side ─────────────────────────────────────────────────── */

function StaticFrames({ src, host, reloadKey, onLoad, loads }: {
  src: string; host: string; reloadKey: number; onLoad: (id: string) => void; loads: Record<string, LoadState>;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const gap = 24;
  const sizes = POSES.map((p) => outer(geometry(p)));
  const sumW = sizes.reduce((a, s) => a + s.w, 0);
  const maxW = Math.max(...sizes.map((s) => s.w));
  const row = w >= 760;
  // One scale for all three so their sizes stay comparable.
  const scale = w ? Math.min(0.85, row ? (w - gap * 2) / sumW : w / maxW) : 0;

  return (
    <section aria-labelledby="frames-h" className="lab-section">
      <h2 id="frames-h">Three poses, side by side</h2>
      <div ref={ref} className={row ? "frames frames-row" : "frames"}>
        {scale > 0 && POSES.map((p, i) => {
          const g = geometry(p);
          const id = `static-${i}`;
          return (
            <figure className="frame" key={p.pose}>
              <DuoFrame pose={p} scale={scale} src={src} host={host} title={`${host} — ${p.label}`} frameKey={`${src}|${reloadKey}`} onLoad={() => onLoad(id)} />
              <figcaption>
                <span className="frame-name">{p.label}</span>
                <span className="frame-size">{g.vw} × {g.vh}</span>
                <span className="frame-sub">
                  {g.col ? `Screen ${g.W} wide — Safari keeps ${g.col} px on the right` : `Safari's bars take ${g.top} px on top · ${g.safe} px safe area below`}
                </span>
                {loads[id] === "slow" && <span className="frame-warn">Not loaded — see the note above</span>}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/* ─── the Unfold player: one frame, four poses ──────────────────────────────────── */

const STORY = [
  { pose: FOLDED, title: "Folded · 382 × 580", text: "Safari takes the right-hand column for its status bar and buttons — the page is 84 px narrower than the screen." },
  { pose: PORTRAIT, title: "Unfolded · 669 × 825", text: "No reload, just a resize. 669 wide sits between Tailwind sm (640) and md (768), and Safari's bars move to the top." },
  { pose: SIDEWAYS, title: "Sideways · 951 × 543", text: "Desktop width, but still a finger — hover menus break here. And only 543 px tall." },
  { pose: FOLDED, title: "Folded again · 382 × 580", text: "Back to the narrow page. Is it still on the same message, the same row?" },
];

function Player({ src, host, frameKey, onLoad }: { src: string; host: string; frameKey: string; onLoad: () => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const run = useRef(0);

  const maxDim = Math.max(...POSES.map((p) => Math.max(outer(geometry(p)).w, outer(geometry(p)).h)));
  // 24 px of breathing room around the device on every side
  const scale = w ? Math.min((w - 48) / maxDim, 600 / maxDim) : 0;
  const box = maxDim * scale + 48;
  const cur = STORY[step];

  const stop = () => { run.current += 1; setPlaying(false); };

  const play = async () => {
    const id = ++run.current;
    setPlaying(true);
    const wait = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(run.current === id), ms));
    const move = reduced ? 0 : MOVE_MS;
    setStep(0);
    // Start from folded: if we weren't there, give it time to fold first.
    if (!(await wait(step === 0 || step === 3 ? HOLD_MS : move + HOLD_MS))) return;
    for (let i = 1; i < STORY.length; i++) {
      setStep(i);
      if (!(await wait(move + HOLD_MS + (reduced ? 400 : 0)))) return;
    }
    if (run.current === id) setPlaying(false);
  };

  useEffect(() => () => { run.current += 1; }, []);

  return (
    <section className="player lab-section" aria-labelledby="player-h">
      <div className="player-head">
        <h2 id="player-h">Tour the poses</h2>
        <button type="button" className="btn btn-primary btn-big" onClick={playing ? stop : play}>
          {playing ? "■ Stop" : step === 0 ? "▶ Play the tour" : "▶ Play again"}
        </button>
        <div className="seg seg-small" role="radiogroup" aria-label="Pose">
          {STORY.slice(0, 3).map((s, i) => (
            <button key={s.pose.pose} type="button" role="radio" aria-checked={(step === 3 ? 0 : step) === i} className="seg-btn"
              onClick={() => { stop(); setStep(i); }}>
              <span className="seg-label">{["Folded", "Unfolded", "Sideways"][i]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="player-caption" aria-live="polite">
        <span className="player-step">{step + 1}/4</span>
        <strong>{cur.title}</strong> <span>{cur.text}</span>
      </div>
      <div ref={ref} className="player-stage" style={{ height: box || undefined }}>
        {scale > 0 && (
          <DuoFrame pose={cur.pose} scale={scale} src={src} host={host} title={`${host} — unfold player`} frameKey={frameKey} onLoad={onLoad} />
        )}
      </div>
    </section>
  );
}
