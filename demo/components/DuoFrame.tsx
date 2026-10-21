import type { PoseMeasurement } from "fold-ready/devices";

/**
 * An iPhone Duo screen at its exact measured size, with the Safari chrome that takes space from
 * the page drawn where Safari draws it. The iframe is rendered at real CSS size (so the site
 * gets exactly 382 × 580 etc.) and the whole device is scaled down with a transform.
 */

export const BEZEL = 10;
/** Safari's top chrome when unfolded: screen height − page height (951 − 825 = 669 − 543 = 126). */

export interface FrameGeometry {
  W: number; H: number; vw: number; vh: number; top: number; col: number; safe: number;
}

export function geometry(p: PoseMeasurement): FrameGeometry {
  const W = p.screen.width;
  const H = p.screen.height;
  const vw = p.viewport.width;
  const vh = p.viewport.height;
  const col = W - vw; // folded: 84 px column on the right
  const top = col > 0 ? 0 : H - vh; // unfolded: tab bar + toolbar on top
  return { W, H, vw, vh, top, col, safe: p.safeArea.bottom };
}

export const outer = (g: FrameGeometry) => ({ w: g.W + BEZEL * 2, h: g.H + BEZEL * 2 });

export type LoadState = "loading" | "loaded" | "slow";

export function DuoFrame({
  pose, scale, src, host, title, animate = false, onLoad, frameKey,
}: {
  pose: PoseMeasurement;
  scale: number;
  src: string;
  host: string;
  title: string;
  animate?: boolean;
  onLoad?: () => void;
  frameKey?: number | string;
}) {
  const g = geometry(pose);
  const o = outer(g);
  const cls = animate ? "dev dev-anim" : "dev";
  const bottom = g.H - g.top - g.vh;
  return (
    <div className={animate ? "dev-slot dev-anim" : "dev-slot"} style={{ width: o.w * scale, height: o.h * scale }}>
      <div className={cls} style={{ width: o.w, height: o.h, transform: `scale(${scale})` }}>
        <div className="dev-screen" style={{ width: g.W, height: g.H }}>
          {/* Unfolded: status + tab strip + address bar on top */}
          <div className="sf-top" style={{ height: g.top }} aria-hidden="true">
            <div className="sf-status">
              <span>9:41</span>
              <span className="sf-status-icons"><WifiGlyph /><BatteryGlyph /></span>
            </div>
            <div className="sf-tabs">
              <span className="sf-tab sf-tab-on">{host}</span>
              <span className="sf-tab">New Tab</span>
              <span className="sf-tab-plus">+</span>
            </div>
            <div className="sf-bar">
              <span className="sf-round"><ChevronGlyph /></span>
              <span className="sf-field"><span className="sf-aa">AA</span><span className="sf-host">{host}</span><ReloadGlyph /></span>
              <span className="sf-round"><TabsGlyph /></span>
            </div>
          </div>

          {/* Folded: Safari's column on the right */}
          <div className="sf-col" style={{ left: g.vw, width: g.col, height: g.H }} aria-hidden="true">
            <span className="sf-col-time">9:41</span>
            <WifiGlyph />
            <span className="sf-col-gap" />
            <span className="sf-round"><ChevronGlyph /></span>
            <span className="sf-round sf-aa">AA</span>
            <span className="sf-round">+</span>
            <span className="sf-round"><TabsGlyph /></span>
          </div>

          <div className="dev-page" style={{ top: g.top, width: g.vw, height: g.vh }}>
            <iframe key={frameKey} src={src} title={title} width={g.vw} height={g.vh} style={{ width: g.vw, height: g.vh }} onLoad={onLoad} />
            <div className="dev-safe" style={{ height: g.safe }} aria-hidden="true">
              {g.safe > 0 && <span className="dev-home" />}
            </div>
          </div>

          <div className="sf-bottom" style={{ top: g.top + g.vh, width: g.vw, height: Math.max(0, bottom) }} aria-hidden="true">
            {/* Folded: Safari's address pill floats here, below the page (as in the simulator) */}
            {g.col > 0 && bottom > 40 && <span className="sf-pill">{host}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function WifiGlyph() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true" className="glyph">
      <path d="M1 4.2a10 10 0 0 1 14 0M3.3 6.6a6.6 6.6 0 0 1 9.4 0M5.6 9a3.2 3.2 0 0 1 4.8 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}
function BatteryGlyph() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true" className="glyph">
      <rect x="0.75" y="0.75" width="20" height="10.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
      <rect x="2.5" y="2.5" width="14" height="7" rx="1.6" fill="currentColor" />
      <rect x="22" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".5" />
    </svg>
  );
}
function ChevronGlyph() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true" className="glyph">
      <path d="M8.5 2 3 8l5.5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TabsGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="glyph">
      <rect x="1.5" y="4.5" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 1.5h8a2 2 0 0 1 2 2v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function ReloadGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="glyph">
      <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
