/**
 * <FoldReadyInspector /> — a small dev overlay that answers "what does this page think I am?"
 *
 * On a wide touch screen the questions that matter are not visible from a desktop: which input
 * mode the page sees, which measured device this viewport looks like, and which `:hover` rules
 * hide controls a finger can never reveal. Drop this in during development:
 *
 *   {process.env.NODE_ENV !== "production" && <FoldReadyInspector />}
 *
 * It renders nothing on the server and on the first client render, then portals into
 * `document.body`. Styles are injected under an `fr-insp-` prefix and its own stylesheet is
 * skipped by the audit. No network requests.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { getInputModeOverride, setInputModeOverride, useInputMode } from "./media";
import { useViewportSegments } from "./segments";
import { closestPose } from "./devices";
import {
  auditBreakpoints, auditHoverOnly, auditRuntime, elementsForFinding,
  type BreakpointAudit, type HoverAudit, type RuntimeFinding,
} from "./audit";

export type InspectorPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";

export interface FoldReadyInspectorProps {
  /** Corner to sit in. Default "bottom-left". */
  position?: InspectorPosition;
  /** Start with the panel open. Default false. */
  defaultOpen?: boolean;
}

const STYLE_ID = "fr-insp-styles";

const CSS = String.raw`
.fr-insp{--fr-insp-bg:#fff;--fr-insp-fg:#111827;--fr-insp-muted:#6b7280;--fr-insp-line:rgba(0,0,0,.1);--fr-insp-chip:#f3f4f6;--fr-insp-accent:#2563eb;
position:fixed;z-index:2147483000;font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fr-insp-fg);-webkit-text-size-adjust:100%}
@media (prefers-color-scheme:dark){.fr-insp{--fr-insp-bg:#111827;--fr-insp-fg:#f3f4f6;--fr-insp-muted:#9ca3af;--fr-insp-line:rgba(255,255,255,.14);--fr-insp-chip:#1f2937;--fr-insp-accent:#60a5fa}}
.fr-insp *{box-sizing:border-box}
.fr-insp-fab{position:relative;width:44px;height:44px;border-radius:22px;border:1px solid var(--fr-insp-line);background:var(--fr-insp-bg);color:var(--fr-insp-fg);font:600 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;padding:0}
.fr-insp-dot{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#e11d48;color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center}
.fr-insp-panel{width:min(360px,calc(100vw - 16px));max-height:70vh;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--fr-insp-bg);border:1px solid var(--fr-insp-line);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.22)}
.fr-insp-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:8px 8px 8px 12px;background:var(--fr-insp-bg);border-bottom:1px solid var(--fr-insp-line);font-weight:600}
.fr-insp-sec{padding:10px 12px;border-bottom:1px solid var(--fr-insp-line)}
.fr-insp-h{margin:0 0 6px;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--fr-insp-muted)}
.fr-insp-row{display:flex;justify-content:space-between;gap:8px}
.fr-insp-row>span:first-child{color:var(--fr-insp-muted)}
.fr-insp-btn{min-height:32px;padding:4px 10px;border:1px solid var(--fr-insp-line);border-radius:8px;background:var(--fr-insp-chip);color:var(--fr-insp-fg);font:inherit;cursor:pointer}
.fr-insp-btn[aria-pressed="true"]{background:var(--fr-insp-accent);border-color:var(--fr-insp-accent);color:#fff}
.fr-insp-btn:focus-visible,.fr-insp-fab:focus-visible{outline:2px solid var(--fr-insp-accent);outline-offset:2px}
.fr-insp-close{min-width:32px}
.fr-insp-btns{display:flex;flex-wrap:wrap;gap:6px}
.fr-insp-small{font-size:11px;color:var(--fr-insp-muted);margin:6px 0 0}
.fr-insp-list{list-style:none;margin:6px 0 0;padding:0}
.fr-insp-item{padding:6px 0;border-top:1px solid var(--fr-insp-line)}
.fr-insp-item:first-child{border-top:0}
.fr-insp-code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
.fr-insp-sev{display:inline-block;padding:0 6px;border-radius:4px;font:700 10px/16px system-ui,sans-serif;text-transform:uppercase;margin-right:6px;color:#fff}
.fr-insp-sev-high{background:#e11d48}.fr-insp-sev-medium{background:#d97706}.fr-insp-sev-low{background:#6b7280}
.fr-insp-foot{padding:8px 12px;font-size:11px;color:var(--fr-insp-muted)}
`;

function ensureInspectorStyles() {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) { if (existing.textContent !== CSS) existing.textContent = CSS; return; }
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function cornerStyle(position: InspectorPosition): CSSProperties {
  const gap = "max(8px, env(safe-area-inset-%s))";
  const s: CSSProperties = {};
  if (position.startsWith("top")) s.top = gap.replace("%s", "top"); else s.bottom = gap.replace("%s", "bottom");
  if (position.endsWith("left")) s.left = gap.replace("%s", "left"); else s.right = gap.replace("%s", "right");
  return s;
}

interface AuditResult {
  hover: HoverAudit;
  breakpoints: BreakpointAudit;
  runtime: RuntimeFinding[];
}

function runAll(): AuditResult {
  return { hover: auditHoverOnly(), breakpoints: auditBreakpoints(), runtime: auditRuntime() };
}

function useViewportSize() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/** Outline elements for 3 s and scroll the first into view; restores the previous outline. */
function flash(elements: Element[]) {
  const els = elements.filter((e): e is HTMLElement => typeof (e as HTMLElement).style !== "undefined").slice(0, 200);
  if (!els.length) return;
  const prev = els.map((e) => [e.style.outline, e.style.outlineOffset] as const);
  els.forEach((e) => { e.style.outline = "2px dashed #e11d48"; e.style.outlineOffset = "2px"; });
  try { els[0].scrollIntoView?.({ block: "center", behavior: "smooth" }); } catch { /* old browsers */ }
  window.setTimeout(() => {
    els.forEach((e, i) => { e.style.outline = prev[i][0]; e.style.outlineOffset = prev[i][1]; });
  }, 3000);
}

const yesNo = (b: boolean) => (b ? "yes" : "no");

export function FoldReadyInspector({ position = "bottom-left", defaultOpen = false }: FoldReadyInspectorProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [simulated, setSimulated] = useState(false);
  const mode = useInputMode();
  const segments = useViewportSegments();
  const size = useViewportSize();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    ensureInspectorStyles();
    setMounted(true);
    setSimulated(getInputModeOverride() != null);
    // Run once in the background so the closed button can show the high-severity count.
    const t = window.setTimeout(() => { if (alive.current) setResult(runAll()); }, 0);
    return () => { alive.current = false; window.clearTimeout(t); };
  }, []);

  const run = useCallback(() => setResult(runAll()), []);
  const simulate = useCallback((on: boolean) => {
    setInputModeOverride(on ? { touch: true, hover: false } : null);
    setSimulated(on);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  const highCount = result
    ? result.hover.findings.filter((f) => f.severity === "high").length + result.runtime.filter((f) => f.severity === "high").length
    : 0;
  const pose = size ? closestPose(size.w, size.h) : null;
  const rootStyle = cornerStyle(position);

  const body = !open ? (
    <div className="fr-insp" style={rootStyle}>
      <button
        type="button"
        className="fr-insp-fab"
        aria-label={`Open fold-ready inspector (${mode.touch ? "touch" : "mouse"}${highCount ? `, ${highCount} high-severity findings` : ""})`}
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        {mode.touch ? "T" : "M"}
        {highCount > 0 && <span className="fr-insp-dot" aria-hidden="true">{highCount}</span>}
      </button>
    </div>
  ) : (
    <div className="fr-insp" style={rootStyle}>
      <section className="fr-insp-panel" role="dialog" aria-label="fold-ready inspector">
        <div className="fr-insp-head">
          <span>fold-ready</span>
          <button type="button" className="fr-insp-btn fr-insp-close" aria-label="Close inspector" onClick={() => setOpen(false)}>×</button>
        </div>

        <div className="fr-insp-sec">
          <h3 className="fr-insp-h">Now</h3>
          <div className="fr-insp-row"><span>Viewport</span><span>{size ? `${size.w}×${size.h}` : "—"}</span></div>
          <div className="fr-insp-row"><span>touch / hover / short</span><span>{yesNo(mode.touch)} / {yesNo(mode.hover)} / {yesNo(mode.short)}</span></div>
          <div className="fr-insp-row"><span>Segments</span><span>{segments ? segments.length : "none (Safari)"}</span></div>
          <div className="fr-insp-row">
            <span>Closest pose</span>
            <span>{pose ? `≈ ${pose.device.name} · ${pose.pose.label} (${Math.round(pose.distance)} px off)` : "—"}</span>
          </div>
        </div>

        <div className="fr-insp-sec">
          <h3 className="fr-insp-h">Simulate</h3>
          <div className="fr-insp-btns">
            <button type="button" className="fr-insp-btn" aria-pressed={simulated} onClick={() => simulate(true)}>Finger (no hover)</button>
            <button type="button" className="fr-insp-btn" aria-pressed={!simulated} onClick={() => simulate(false)}>Real input</button>
          </div>
          <p className="fr-insp-small">Affects fold-ready hooks only. CSS media queries can't be simulated from JS — use DevTools device mode for those.</p>
        </div>

        <div className="fr-insp-sec">
          <h3 className="fr-insp-h">Audit</h3>
          <button type="button" className="fr-insp-btn" onClick={run}>Run audit</button>
          {result && <AuditView result={result} />}
        </div>

        <div className="fr-insp-foot">fold-ready</div>
      </section>
    </div>
  );

  return createPortal(body, document.body);
}

function AuditView({ result }: { result: AuditResult }) {
  const { hover, breakpoints, runtime } = result;
  const order: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];
  const skipped = Array.from(new Set([...hover.skippedSheets, ...breakpoints.skippedSheets]));
  const total = hover.findings.length + runtime.length + breakpoints.gaps.length;
  return (
    <div>
      {total === 0 && <p className="fr-insp-small">No findings.</p>}
      {order.map((sev) => {
        const hs = hover.findings.filter((f) => f.severity === sev);
        const rs = runtime.filter((f) => f.severity === sev);
        if (!hs.length && !rs.length) return null;
        return (
          <ul key={sev} className="fr-insp-list" aria-label={`${sev} severity`}>
            {hs.map((f, i) => (
              <li key={`h${i}`} className="fr-insp-item">
                <span className={`fr-insp-sev fr-insp-sev-${sev}`}>{sev}</span>
                hover-only reveal · {f.elements} el.
                <div className="fr-insp-code">{f.selector}</div>
                <div className="fr-insp-small" style={{ marginTop: 2 }}>
                  {f.reveals.join("; ")} — {f.sheet}
                  {f.hiddenBy ? ` · hidden by ${f.hiddenBy.selector} @media ${f.hiddenBy.media}` : ""}
                </div>
                {f.elements > 0 && (
                  <button type="button" className="fr-insp-btn" style={{ marginTop: 4 }} onClick={() => flash(elementsForFinding(f))}>Show</button>
                )}
              </li>
            ))}
            {rs.map((f, i) => (
              <li key={`r${i}`} className="fr-insp-item">
                <span className={`fr-insp-sev fr-insp-sev-${sev}`}>{sev}</span>
                {f.message}
                {f.detail && <div className="fr-insp-code">{f.detail}</div>}
              </li>
            ))}
          </ul>
        );
      })}
      {breakpoints.values.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="fr-insp-small">Breakpoints: {breakpoints.values.join(", ")} px</div>
          {breakpoints.gaps.map((g) => (
            <div key={g.pose} className="fr-insp-small">{g.message}</div>
          ))}
          {breakpoints.widthOnlyMobileQueries > 0 && (
            <div className="fr-insp-small">{breakpoints.widthOnlyMobileQueries} max-width rule(s) decide "mobile" by width alone.</div>
          )}
        </div>
      )}
      {hover.ignoredRules > 0 && (
        <p className="fr-insp-small">{hover.ignoredRules} other :hover rules checked — nothing hidden on this page uses them.</p>
      )}
      {skipped.length > 0 && <p className="fr-insp-small">Skipped (cross-origin): {skipped.join(", ")}</p>}
    </div>
  );
}
