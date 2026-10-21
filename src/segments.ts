/**
 * Viewport Segments (where the hinge is), when the browser has it.
 *
 * Chrome / Edge 138+ on dual-screen and foldable Android expose `window.viewport.segments`.
 * Safari (including iPhone Duo) does not — this returns `null` there, and every fold-ready
 * component works without it. Treat a non-null value as a progressive enhancement.
 */
import { useEffect, useState } from "react";

export interface Segment { left: number; top: number; right: number; bottom: number; width: number; height: number }

type ViewportWithSegments = { segments?: ReadonlyArray<DOMRectReadOnly> | null };

export function readViewportSegments(): Segment[] | null {
  if (typeof window === "undefined") return null;
  const vp = (window as unknown as { viewport?: ViewportWithSegments }).viewport;
  const segs = vp?.segments;
  if (!segs || segs.length < 2) return null;
  return segs.map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }));
}

/** `null` = one segment or unsupported (Safari). Otherwise 2+ rectangles in CSS px. */
export function useViewportSegments(): Segment[] | null {
  const [segs, setSegs] = useState<Segment[] | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const update = () => setSegs(readViewportSegments());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return segs;
}

/** Whether this browser can report segments at all (not whether it is folded right now). */
export function supportsViewportSegments(): boolean {
  return typeof window !== "undefined" && "viewport" in window;
}
