/**
 * Choose the colour of Safari's toolbar — including the iPhone Duo's right-hand column.
 *
 * Safari ignores `<meta name="theme-color">` for its toolbars and samples the page instead:
 * a few pixels in from the edge, and only from fixed/sticky elements. On a folded iPhone Duo the
 * status bar and buttons live in a column on the RIGHT of the page, so it samples the right edge;
 * on other iPhones / iPad and the unfolded Duo it samples the top.
 *
 * Measured (iPhone Duo simulator, Safari 27): an 8 px `position: fixed` strip on the right edge
 * paints the whole right column in its colour, and causes no horizontal scrolling
 * (scrollWidth stays 382). Earlier workarounds widened the page past the edge instead — that's
 * what scrolled sideways.
 *
 *   <ToolbarTint color="#1e3a8a" />                    // right edge, touch devices only
 *   <ToolbarTint color="#1e3a8a" edges={["top", "right"]} when="always" />
 *
 * The top edge is opt-in: a fixed header already tints the top bar, and a strip over your
 * content's first 8 px is rarely what you want.
 *
 * The strip is real content: give it the colour of what's next to it (your header or page
 * background) so it reads as part of the page. It ignores pointer events and is hidden from
 * assistive tech.
 */
import type { CSSProperties } from "react";
import { useInputMode } from "./media";

export type TintEdge = "top" | "right";

export interface ToolbarTintProps {
  color: string;
  /** Default ["right"] (the folded Duo's column). Add "top" if you have no fixed header. */
  edges?: TintEdge[];
  /** Render only for finger input (default) or everywhere. Desktop Safari has no right column. */
  when?: "touch" | "always";
  /** Strip thickness in px. Safari samples ~5–10 px in; 8 is the measured sweet spot. */
  size?: number;
  zIndex?: number;
}

export function ToolbarTint({ color, edges = ["right"], size = 8, zIndex = 2147483000, when = "touch" }: ToolbarTintProps) {
  const { touch } = useInputMode();
  if (when === "touch" && !touch) return null;
  const base: CSSProperties = { position: "fixed", background: color, pointerEvents: "none", zIndex };
  return (
    <>
      {edges.includes("top") && <div aria-hidden="true" data-fr-tint="top" style={{ ...base, top: 0, left: 0, right: 0, height: size }} />}
      {edges.includes("right") && <div aria-hidden="true" data-fr-tint="right" style={{ ...base, top: 0, right: 0, bottom: 0, width: size }} />}
    </>
  );
}
