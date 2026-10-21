import { useEffect, useRef, useState, type ReactNode } from "react";
import { readViewportSegments, supportsViewportSegments } from "fold-ready";
import { closestPose, IPHONE_DUO } from "fold-ready/devices";
import { copyText } from "../components/Code";

const ISSUES = "https://github.com/tyoukyou23/fold-ready/issues";

const QUERIES = [
  "(pointer: coarse)",
  "(pointer: fine)",
  "(hover: hover)",
  "(any-hover: hover)",
  "(any-pointer: coarse)",
  "(max-height: 600px)",
  "(orientation: portrait)",
  "(display-mode: standalone)",
];

interface Reading {
  inner: { width: number; height: number };
  visual: { width: number; height: number; scale: number; offsetTop: number } | null;
  screen: { width: number; height: number };
  devicePixelRatio: number;
  safeArea: { top: number; right: number; bottom: number; left: number };
  media: Record<string, boolean>;
  segments: { supported: boolean; current: ReturnType<typeof readViewportSegments> };
  resizeCount: number;
  userAgent: string;
}

function read(probe: HTMLElement | null, resizeCount: number): Reading {
  const vv = window.visualViewport;
  const cs = probe ? getComputedStyle(probe) : null;
  const px = (v?: string) => Math.round((parseFloat(v || "0") || 0) * 10) / 10;
  return {
    inner: { width: window.innerWidth, height: window.innerHeight },
    visual: vv ? { width: Math.round(vv.width), height: Math.round(vv.height), scale: Math.round(vv.scale * 100) / 100, offsetTop: Math.round(vv.offsetTop) } : null,
    screen: { width: window.screen.width, height: window.screen.height },
    devicePixelRatio: window.devicePixelRatio,
    safeArea: {
      top: px(cs?.paddingTop), right: px(cs?.paddingRight), bottom: px(cs?.paddingBottom), left: px(cs?.paddingLeft),
    },
    media: Object.fromEntries(QUERIES.map((q) => [q, !!window.matchMedia?.(q).matches])),
    segments: { supported: supportsViewportSegments(), current: readViewportSegments() },
    resizeCount,
    userAgent: navigator.userAgent,
  };
}

export function Measure() {
  const probe = useRef<HTMLDivElement>(null);
  const count = useRef(0);
  const [r, setR] = useState<Reading | null>(null);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");

  useEffect(() => {
    let frame = 0;
    const update = () => { frame = 0; setR(read(probe.current, count.current)); };
    const onResize = () => { count.current += 1; if (!frame) frame = requestAnimationFrame(update); };
    const onOther = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onOther);
    window.visualViewport?.addEventListener("scroll", onOther);
    const mqls = QUERIES.map((q) => window.matchMedia?.(q)).filter(Boolean) as MediaQueryList[];
    mqls.forEach((m) => m.addEventListener?.("change", onOther));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onOther);
      window.visualViewport?.removeEventListener("scroll", onOther);
      mqls.forEach((m) => m.removeEventListener?.("change", onOther));
    };
  }, []);

  const near = r ? closestPose(r.inner.width, r.inner.height) : null;
  const exact = near && near.distance < 2;
  const json = r ? JSON.stringify({ measuredAt: new Date().toISOString(), ...r }, null, 2) : "";

  const copy = async () => {
    const ok = await copyText(json);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied(""), 2500);
  };

  return (
    <div className="wrap measure">
      <div ref={probe} className="safe-probe" aria-hidden="true" />
      <header className="page-head">
        <p className="eyebrow">Measure</p>
        <h1>What does your browser actually give a page?</h1>
        <p className="lede">
          Live numbers from this tab. Fold, unfold, rotate or resize and they update — no reload. If you have a device
          we haven't measured, copy the JSON and <a href={ISSUES}>open an issue on GitHub</a>.
        </p>
      </header>

      {r && (
        <>
          <section className="readout" aria-label="Viewport">
            <div className="big-num">
              <span className="big-label">innerWidth × innerHeight</span>
              <span className="big-value">{r.inner.width} × {r.inner.height}</span>
            </div>
            <div className="match">
              {near && (
                exact
                  ? <p><b>Matches {near.device.name} · {near.pose.label}</b> as measured ({near.pose.viewport.width} × {near.pose.viewport.height}).</p>
                  : <p>Closest measured pose: <b>{near.device.name} · {near.pose.label}</b>, {near.pose.viewport.width} × {near.pose.viewport.height} — {Math.round(near.distance)} px away. Nothing is inferred from this; it's just the nearest row in the table.</p>
              )}
            </div>
            <div className="copy-row">
              <button type="button" className="btn btn-primary" onClick={copy}>Copy as JSON</button>
              <span role="status" className="muted">
                {copied === "ok" ? "Copied. Paste it into a new issue." : copied === "fail" ? "Couldn't copy — select the JSON below instead." : ""}
              </span>
              <a href={ISSUES}>GitHub issues →</a>
            </div>
          </section>

          <section className="kv-grid" aria-label="All readings">
            <KV title="Viewport">
              <Item k="innerWidth × innerHeight" v={`${r.inner.width} × ${r.inner.height}`} />
              <Item k="visualViewport" v={r.visual ? `${r.visual.width} × ${r.visual.height} @ ${r.visual.scale}×` : "not supported"} />
              <Item k="screen.width × height" v={`${r.screen.width} × ${r.screen.height}`} note="Stays the folded value on iPhone Duo. Don't size from it." />
              <Item k="devicePixelRatio" v={String(r.devicePixelRatio)} />
              <Item k="resize events" v={String(r.resizeCount)} note="Since this page opened" />
            </KV>
            <KV title="Safe area · env(safe-area-inset-*)">
              <Item k="top" v={`${r.safeArea.top} px`} />
              <Item k="right" v={`${r.safeArea.right} px`} />
              <Item k="bottom" v={`${r.safeArea.bottom} px`} />
              <Item k="left" v={`${r.safeArea.left} px`} />
            </KV>
            <KV title="Input">
              {QUERIES.map((q) => <Item key={q} k={q} v={r.media[q] ? "yes" : "no"} on={r.media[q]} />)}
            </KV>
            <KV title="Fold">
              <Item k="Viewport Segments API" v={r.segments.supported ? "available" : "not available"} />
              <Item k="Segments now" v={r.segments.current ? r.segments.current.map((s) => `${s.width}×${s.height}`).join(" | ") : "one (or unknown)"} />
            </KV>
          </section>

          <section className="lab-section" aria-labelledby="cmp-h">
            <h2 id="cmp-h">Measured poses · {IPHONE_DUO.name}</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th scope="col">Pose</th><th scope="col">Page</th><th scope="col">Screen</th><th scope="col">Safe bottom</th><th scope="col">Yours</th></tr>
                </thead>
                <tbody>
                  {IPHONE_DUO.poses.map((p) => (
                    <tr key={p.pose} data-near={near?.pose.pose === p.pose || undefined}>
                      <th scope="row">{p.label}</th>
                      <td>{p.viewport.width} × {p.viewport.height}</td>
                      <td>{p.screen.width} × {p.screen.height}</td>
                      <td>{p.safeArea.bottom}</td>
                      <td>{near?.pose.pose === p.pose ? `${r.inner.width} × ${r.inner.height}${exact ? " ✓" : ""}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="lab-section" aria-labelledby="ua-h">
            <h2 id="ua-h">User agent</h2>
            <p className="ua">{r.userAgent}</p>
            <p className="muted">Shown for the record only. fold-ready never reads it — on iPhone Duo it just says "iPhone".</p>
            <details className="json">
              <summary>Show the JSON</summary>
              <pre><code>{json}</code></pre>
            </details>
          </section>
        </>
      )}
    </div>
  );
}

function KV({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="kv">
      <h2 className="kv-title">{title}</h2>
      <dl>{children}</dl>
    </div>
  );
}

function Item({ k, v, note, on }: { k: string; v: string; note?: string; on?: boolean }) {
  return (
    <div className="kv-item">
      <dt><code>{k}</code>{note && <span className="kv-note">{note}</span>}</dt>
      <dd data-on={on === undefined ? undefined : on}>{v}</dd>
    </div>
  );
}
