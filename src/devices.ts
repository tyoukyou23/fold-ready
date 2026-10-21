/**
 * What Safari actually gives a web page, measured — not the screen size divided by 3.
 *
 * Third-party guides list iPhone Duo as 466×678 folded and 626×890 / 890×626 unfolded.
 * The folded number is the outer *screen*; the unfolded ones are wrong even as screens — the
 * inner display is 2853×2007 px = 951×669 pt (measured in the simulator). Safari puts its controls (status bar, back, tabs) in a column on
 * the right of the folded screen and a tab bar on top of the unfolded one, so the page gets less:
 *
 *   folded            382 × 580   (the right column is not a safe area — Safari just doesn't give it to you)
 *   unfolded portrait 669 × 825   (between Tailwind `sm` 640 and `md` 768)
 *   unfolded sideways 951 × 543   (desktop width, finger input, short)
 *
 * Measured with a probe page (see the demo's "Measure your device") in the iPhone Duo simulator.
 * `source` says how each row was measured; rows are updated when checked on hardware.
 */

export type MeasureSource = "simulator" | "device";

export interface PoseMeasurement {
  /** Machine id, e.g. "folded" */
  pose: string;
  /** Human label */
  label: string;
  /** Physical screen in points (what spec sheets and most blogs quote) */
  screen: { width: number; height: number };
  /** `innerWidth × innerHeight` in Safari with default chrome — what your layout gets */
  viewport: { width: number; height: number };
  /** `env(safe-area-inset-*)` in CSS px with `viewport-fit=cover` */
  safeArea: { top: number; right: number; bottom: number; left: number };
  /** `(pointer: coarse)` */
  coarse: boolean;
  /** `(hover: hover)` */
  hover: boolean;
  devicePixelRatio: number;
  notes?: string;
}

export interface DeviceMeasurement {
  id: string;
  name: string;
  browser: string;
  os: string;
  source: MeasureSource;
  measuredOn: string; // YYYY-MM-DD
  /** Folding / unfolding fires `resize` without reloading. `screen.*` keeps the folded value. */
  facts: string[];
  poses: PoseMeasurement[];
}

export const IPHONE_DUO: DeviceMeasurement = {
  id: "iphone-duo",
  name: "iPhone Duo",
  browser: "Safari 27.0",
  os: "iOS 27.1",
  source: "simulator",
  measuredOn: "2026-10-21",
  facts: [
    "Unfolding or folding fires `resize`; the page is not reloaded and keeps its state.",
    "`screen.width × screen.height` stays 466×678 after unfolding — never size from `screen`.",
    "The user agent says plain `iPhone`; there is no way (and no need) to detect the model.",
    "Viewport Segments and Device Posture APIs are not available — Safari cannot tell where the fold is.",
    "All poses report `(pointer: coarse)` and no hover, including the 951 px wide one.",
    "Half-folding the phone moves Safari to the outer screen: the page sees exactly the folded pose (382×580). There is no tabletop / flex mode for the web and no posture event.",
    "One fold or unfold fires 2–3 `resize` events through sizes that belong to no pose (466×498, 382×498) — wait for the size to settle before switching layouts.",
  ],
  poses: [
    {
      pose: "folded",
      label: "Folded (outer screen)",
      screen: { width: 466, height: 678 },
      viewport: { width: 382, height: 580 },
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
      coarse: true,
      hover: false,
      devicePixelRatio: 3,
      notes: "Safari's status bar and buttons sit in a column on the right; the page is 84 px narrower than the screen.",
    },
    {
      pose: "unfolded-portrait",
      label: "Unfolded, portrait",
      screen: { width: 669, height: 951 },
      viewport: { width: 669, height: 825 },
      safeArea: { top: 0, right: 0, bottom: 34, left: 0 },
      coarse: true,
      hover: false,
      devicePixelRatio: 3,
      notes: "Lands between Tailwind sm (640) and md (768) — a band most sites never test.",
    },
    {
      pose: "unfolded-landscape",
      label: "Unfolded, sideways",
      screen: { width: 951, height: 669 },
      viewport: { width: 951, height: 543 },
      safeArea: { top: 0, right: 0, bottom: 34, left: 0 },
      coarse: true,
      hover: false,
      devicePixelRatio: 3,
      notes: "Desktop width with finger input and only 543 px of height. Hover menus and tall headers break here.",
    },
    {
      pose: "folded-landscape",
      label: "Folded, sideways",
      screen: { width: 678, height: 466 },
      viewport: { width: 678, height: 340 },
      safeArea: { top: 0, right: 0, bottom: 34, left: 0 },
      coarse: true,
      hover: false,
      devicePixelRatio: 3,
      notes: "Only 340 px tall — the shortest pose. Sticky headers and bottom bars can take half the page.",
    },
  ],
};

export const DEVICES: DeviceMeasurement[] = [IPHONE_DUO];

/** Find the measured pose closest to a viewport size (for "you are probably on …" hints). */
export function closestPose(width: number, height: number, devices: DeviceMeasurement[] = DEVICES) {
  let best: { device: DeviceMeasurement; pose: PoseMeasurement; distance: number } | null = null;
  for (const device of devices) {
    for (const pose of device.poses) {
      const distance = Math.hypot(pose.viewport.width - width, pose.viewport.height - height);
      if (!best || distance < best.distance) best = { device, pose, distance };
    }
  }
  return best;
}
