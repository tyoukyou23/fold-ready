/**
 * List–detail that docks: a <Pane> placed inside a <SplitHost> becomes a column next to your
 * content when there is room for both, and a drawer that slides over it when there isn't.
 *
 *   <SplitHost>
 *     <YourTable onRowClick={(row) => setOpen(row.id)} />
 *     {open && <Pane onClose={() => setOpen(null)} label="Details">…</Pane>}
 *   </SplitHost>
 *
 * Decisions, in order:
 *   1. Room is measured on the host itself (ResizeObserver), not the window — collapsing a
 *      sidebar or entering Split View changes it.
 *   2. By default it docks only for fingers (`dock="touch"`): wide touch screens get the
 *      side-by-side layout; mouse users keep the drawer they know. `dock="always"` for both,
 *      `dock="never"` to keep it a drawer.
 *   3. Dock ↔ drawer switches wait for the size to settle (`settleMs`, 150): folding an iPhone Duo
 *      fires 2–3 resizes through sizes that belong to no pose (466×498, 382×498 measured), and
 *      reacting to each one flashes the drawer in and out.
 *   4. On foldables that expose Viewport Segments (Chrome/Android), the docked pane snaps to the
 *      second segment so the split sits on the hinge.
 */
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useInputMode } from "./media";
import { useViewportSegments } from "./segments";
import { ensureStyles } from "./styles";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type DockPolicy = "touch" | "always" | "never";

interface SplitState {
  /** True when a Pane opened now would sit next to the content instead of over it. */
  docked: boolean;
  slot: HTMLElement | null;
}

const SplitContext = createContext<SplitState | null>(null);

/** Inside a SplitHost: `{ docked }`. Outside: `null`. Use it to decide what a row tap does. */
export function useSplit(): SplitState | null {
  return useContext(SplitContext);
}

export interface SplitHostProps {
  children?: ReactNode;
  /** Host width (px) below which panes stay drawers. Default 860. */
  minWidth?: number;
  /** Width of the docked column. Any CSS length. Default `clamp(320px, 40%, 480px)`. */
  paneWidth?: string;
  /** Who gets the docked layout. Default "touch". */
  dock?: DockPolicy;
  /** Called when `docked` changes (for the component that renders the host itself). */
  onDockChange?: (docked: boolean) => void;
  /** Align the docked pane with a hinge when the browser reports one. Default true. */
  followHinge?: boolean;
  /** Wait this long (ms) after the last resize before switching dock ↔ drawer. 0 = immediately. Default 150. */
  settleMs?: number;
  className?: string;
  style?: CSSProperties;
  paneClassName?: string;
}

export function SplitHost({
  children, minWidth = 860, paneWidth = "clamp(320px, 40%, 480px)", dock = "touch",
  onDockChange, followHinge = true, settleMs = 150, className, style, paneClassName,
}: SplitHostProps) {
  ensureStyles();
  const rootRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  const { touch } = useInputMode();
  const segments = useViewportSegments();

  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    // first measurement is immediate; later ones settle (see 3. above)
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (first || settleMs <= 0) { first = false; setWidth(w); return; }
      clearTimeout(timer);
      timer = setTimeout(() => setWidth(w), settleMs);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, [settleMs]);

  const allowed = dock === "always" || (dock === "touch" && touch);
  const docked = allowed && width >= minWidth;

  const cb = useRef(onDockChange);
  cb.current = onDockChange;
  useEffect(() => { cb.current?.(docked); }, [docked]);

  // Side-by-side segments (book-style fold): give the pane exactly the right-hand segment.
  const hinge = followHinge && segments && segments.length === 2 && segments[0].right <= segments[1].left
    ? `${Math.round(segments[1].width)}px`
    : null;

  return (
    <SplitContext.Provider value={{ docked, slot }}>
      <div ref={rootRef} className={["fr-host", className].filter(Boolean).join(" ")} style={style} data-docked={docked || undefined}>
        <div className="fr-host-main">{children}</div>
        <aside
          ref={setSlot}
          className={["fr-host-pane", paneClassName].filter(Boolean).join(" ")}
          style={{ width: hinge || paneWidth }}
        />
      </div>
    </SplitContext.Provider>
  );
}

export interface PaneProps {
  onClose: () => void;
  /** Accessible name of the pane / dialog. */
  label: string;
  /** Drawer width when not docked (CSS length). Default `min(100%, 480px)`. */
  drawerWidth?: string;
  /** Render function gets `close`, which animates the drawer out before calling onClose. */
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
}

const EXIT_MS = 200;

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Details for the selected item. Docks into the nearest SplitHost when it has room;
 * otherwise a modal drawer from the right (Esc / backdrop closes, focus is trapped-lite:
 * moved in on open and returned to the opener on close).
 */
export function Pane({ onClose, label, drawerWidth = "min(100%, 480px)", children, className }: PaneProps) {
  ensureStyles();
  const host = useSplit();
  const docked = !!(host?.docked && host.slot);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const close = useCallback(() => {
    if (closing) return;
    if (docked || reducedMotion()) { onClose(); return; }
    setClosing(true);
    timer.current = setTimeout(onClose, EXIT_MS);
  }, [closing, docked, onClose]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Focus: remember who opened us, move focus in, give it back when we go away.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    opener.current = document.activeElement;
    if (!docked) panelRef.current?.focus({ preventScroll: true });
    return () => {
      const el = opener.current as HTMLElement | null;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, [docked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // let an inner dialog handle its own Esc
      const t = e.target;
      if (t instanceof Element && t.closest("[role=dialog]") && !panelRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  if (typeof document === "undefined") return null;
  const body = typeof children === "function" ? (children as (c: () => void) => ReactNode)(close) : children;

  if (docked && host?.slot) {
    return createPortal(
      <div ref={panelRef} role="region" aria-label={label} tabIndex={-1} className={["fr-pane", className].filter(Boolean).join(" ")}>
        {body}
      </div>,
      host.slot,
    );
  }

  return createPortal(
    <div className="fr-drawer-root" onClick={close}>
      <div className={`fr-backdrop ${closing ? "fr-out" : "fr-in"}`} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={["fr-drawer", closing ? "fr-out" : "fr-in", className].filter(Boolean).join(" ")}
        style={{ width: drawerWidth }}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}
