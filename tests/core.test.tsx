// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  SplitHost, Pane, useSplit, setInputModeOverride, useInputMode, initialSidebarHidden,
  useSelection, ToolbarTint, readVisibleViewport,
} from "../src";
import foldReady, { VARIANTS } from "../src/tailwind";
import { IPHONE_DUO, closestPose } from "../src/devices";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<() => void> = [];
function mount(node: React.ReactNode) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(node));
  let done = false;
  const unmount = () => { if (!done) { done = true; act(() => root.unmount()); el.remove(); } };
  roots.push(unmount);
  return { el, root, unmount };
}
afterEach(() => { while (roots.length) roots.pop()!(); });

// jsdom has no layout: give the host a width through getBoundingClientRect + a fake ResizeObserver
let hostWidth = 1000;
class FakeRO {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; }
  observe(el: Element) { this.cb([{ contentRect: { width: hostWidth } } as any], this as any); }
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  setInputModeOverride(null);
  vi.stubGlobal("ResizeObserver", FakeRO);
  Element.prototype.getBoundingClientRect = function () { return { width: hostWidth, height: 600, top: 0, left: 0, right: hostWidth, bottom: 600, x: 0, y: 0, toJSON() {} } as DOMRect; };
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any;
  localStorage.clear();
});

describe("SplitHost + Pane", () => {
  it("docks for touch when wide enough", () => {
    setInputModeOverride({ touch: true, hover: false });
    hostWidth = 1000;
    const { el } = mount(<SplitHost><p>list</p><Pane label="Details" onClose={() => {}}>detail</Pane></SplitHost>);
    const aside = el.querySelector("aside")!;
    expect(aside.textContent).toBe("detail");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("stays a drawer for mouse users (default dock=touch)", () => {
    setInputModeOverride({ touch: false, hover: true });
    hostWidth = 1400;
    const { el } = mount(<SplitHost><p>list</p><Pane label="Details" onClose={() => {}}>detail</Pane></SplitHost>);
    expect(el.querySelector("aside")!.textContent).toBe("");
    expect(document.querySelector("[role=dialog]")!.textContent).toBe("detail");
  });

  it("stays a drawer when the host is too narrow", () => {
    setInputModeOverride({ touch: true });
    hostWidth = 600;
    mount(<SplitHost><Pane label="Details" onClose={() => {}}>detail</Pane></SplitHost>);
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
  });

  it("dock=always docks for mouse too; onDockChange reports it", () => {
    setInputModeOverride({ touch: false });
    hostWidth = 1200;
    const seen: boolean[] = [];
    mount(<SplitHost dock="always" onDockChange={(d) => seen.push(d)}><Pane label="D" onClose={() => {}}>x</Pane></SplitHost>);
    expect(seen.at(-1)).toBe(true);
  });

  it("waits for the size to settle before undocking (fold passes through 466 px)", () => {
    vi.useFakeTimers();
    setInputModeOverride({ touch: true });
    hostWidth = 1000;
    let ro: FakeRO | null = null;
    vi.stubGlobal("ResizeObserver", class extends FakeRO { constructor(cb: ResizeObserverCallback) { super(cb); ro = this; } });
    const { el } = mount(<SplitHost><Pane label="D" onClose={() => {}}>x</Pane></SplitHost>);
    expect(el.querySelector("aside")!.textContent).toBe("x");
    // transient 466 px, then back to 951 within the settle window → never undocks
    act(() => { ro!.cb([{ contentRect: { width: 466 } } as any], ro as any); vi.advanceTimersByTime(60); });
    act(() => { ro!.cb([{ contentRect: { width: 951 } } as any], ro as any); vi.advanceTimersByTime(200); });
    expect(el.querySelector("aside")!.textContent).toBe("x");
    expect(document.querySelector("[role=dialog]")).toBeNull();
    // a real fold: stays at 382 → undocks after settling
    act(() => { ro!.cb([{ contentRect: { width: 382 } } as any], ro as any); vi.advanceTimersByTime(200); });
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    vi.useRealTimers();
  });

  it("useSplit is null outside a host", () => {
    let v: unknown = "unset";
    function Probe() { v = useSplit(); return null; }
    mount(<Probe />);
    expect(v).toBeNull();
  });

  it("Esc closes the drawer", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    mount(<Pane label="D" onClose={onClose}>x</Pane>);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("input mode", () => {
  it("override wins over media queries and re-renders", () => {
    let mode: any;
    function Probe() { mode = useInputMode(); return null; }
    mount(<Probe />);
    expect(mode.touch).toBe(false);
    act(() => setInputModeOverride({ touch: true }));
    expect(mode.touch).toBe(true);
  });
});

describe("sidebar default", () => {
  it("respects a saved choice, else collapses only for touch", () => {
    expect(initialSidebarHidden("k")).toBe(false);
    window.matchMedia = ((q: string) => ({ matches: q.includes("coarse"), addEventListener() {}, removeEventListener() {} })) as any;
    expect(initialSidebarHidden("k")).toBe(true);
    localStorage.setItem("k", "0");
    expect(initialSidebarHidden("k")).toBe(false);
  });
});

describe("useSelection (history adapter)", () => {
  it("reads and writes ?sel= without adding history entries", () => {
    history.replaceState(null, "", "/?a=1");
    let api: any;
    function Probe() { api = useSelection("sel"); return null; }
    mount(<Probe />);
    expect(api[0]).toBeNull();
    const len = history.length;
    act(() => api[1]("42"));
    expect(location.search).toBe("?a=1&sel=42");
    expect(api[0]).toBe("42");
    expect(history.length).toBe(len);
    act(() => api[1](null));
    expect(location.search).toBe("?a=1");
  });
});

describe("ToolbarTint", () => {
  it("renders the right strip for touch only by default", () => {
    const { el, unmount } = mount(<ToolbarTint color="red" />);
    expect(el.querySelector("[data-fr-tint]")).toBeNull();
    unmount();
    setInputModeOverride({ touch: true });
    const m = mount(<ToolbarTint color="red" />);
    const strip = m.el.querySelector("[data-fr-tint=right]") as HTMLElement;
    expect(strip.style.position).toBe("fixed");
    expect(strip.style.width).toBe("8px");
    expect(m.el.querySelector("[data-fr-tint=top]")).toBeNull();
  });
});

describe("data", () => {
  it("measured Duo viewports and closestPose", () => {
    expect(IPHONE_DUO.poses.map((p) => `${p.viewport.width}x${p.viewport.height}`)).toEqual(["382x580", "669x825", "951x543", "678x340"]);
    expect(closestPose(950, 540)!.pose.pose).toBe("unfolded-landscape");
  });
  it("tailwind plugin registers three variants", () => {
    const added: string[] = [];
    foldReady({ addVariant: (n) => added.push(n) });
    expect(added).toEqual(Object.keys(VARIANTS));
  });
  it("readVisibleViewport falls back to innerHeight", () => {
    const v = readVisibleViewport();
    expect(v.keyboardOpen).toBe(false);
    expect(v.height).toBe(window.innerHeight);
  });
});
