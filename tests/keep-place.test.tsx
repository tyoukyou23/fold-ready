// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import {
  KeepPlace, computeRestoreScrollTop, computeRevealDelta, firstBelowEdge, isReflowingResize, readScrollPaddingTop,
} from "../src/keep-place";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("pure helpers", () => {
  it("computeRestoreScrollTop puts the anchor back at its old offset", () => {
    // anchor was 50px above the top edge; after reflow it is 150px above → scroll up by 100
    expect(computeRestoreScrollTop(-50, -150, 0, 250)).toBe(150);
    // scroller not at viewport top
    expect(computeRestoreScrollTop(10, 300, 100, 0)).toBe(190);
    // nothing moved
    expect(computeRestoreScrollTop(20, 120, 100, 42)).toBe(42);
  });

  it("computeRevealDelta scrolls as little as possible", () => {
    expect(computeRevealDelta(50, 90, 0, 300)).toBe(0);
    expect(computeRevealDelta(600, 640, 0, 300)).toBe(348);
    expect(computeRevealDelta(-40, 0, 0, 300)).toBe(-48);
    // taller than the view → align top
    expect(computeRevealDelta(400, 1000, 0, 300)).toBe(392);
  });

  it("isReflowingResize: width ≥1px, or a large height change only", () => {
    expect(isReflowingResize({ width: 400, height: 800 }, { width: 401, height: 800 })).toBe(true);
    expect(isReflowingResize({ width: 400, height: 800 }, { width: 400, height: 740 })).toBe(false); // URL bar
    expect(isReflowingResize({ width: 400, height: 800 }, { width: 400, height: 450 })).toBe(true);
  });

  it("firstBelowEdge binary-searches ordered rects", () => {
    const bottoms = [100, 200, 300, 400];
    expect(firstBelowEdge(4, (i) => bottoms[i], 250)).toBe(2);
    expect(firstBelowEdge(4, (i) => bottoms[i], 0)).toBe(0);
    expect(firstBelowEdge(4, (i) => bottoms[i], 500)).toBe(-1);
  });
});

/* ─── a fake layout ─────────────────────────────────────────────────────────────── */

const state = { width: 400 };
const scrollTops = new WeakMap<Element, number>();
let roCallbacks: Array<() => void> = [];
let restoreFns: Array<() => void> = [];

function rect(top: number, height: number, width: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: width, width, x: 0, y: top, toJSON() { return {}; } } as DOMRect;
}

function scrollerOf(el: Element): HTMLElement | null {
  return el.closest("[data-testid=scroller]") as HTMLElement | null;
}

beforeEach(() => {
  state.width = 400;
  roCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("ResizeObserver", class {
    cb: () => void;
    constructor(cb: () => void) { this.cb = cb; roCallbacks.push(() => this.cb()); }
    observe() {}
    disconnect() {}
  });

  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get() { return scrollTops.get(this) ?? 0; },
    set(v: number) { scrollTops.set(this, v); },
  });
  restoreFns.push(() => { delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollTop; });

  // Row height depends on width: narrow (folded) 100px, wide (unfolded) 50px.
  const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.dataset.testid === "scroller") return rect(0, 300, state.width);
    const sc = scrollerOf(this);
    const st = sc ? sc.scrollTop : 0;
    const rowH = state.width >= 800 ? 50 : 100;
    if (this.dataset.row != null) return rect(Number(this.dataset.row) * rowH - st, rowH, state.width);
    if (this.dataset.field != null) return rect(600 - st, 40, state.width);
    return rect(0, 0, 0);
  });
  restoreFns.push(() => spy.mockRestore());
});

afterEach(() => {
  restoreFns.forEach((f) => f());
  restoreFns = [];
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function mount(ui: React.ReactElement): { root: Root; host: HTMLElement } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(ui); });
  return { root, host };
}

const rows = (marked: boolean) =>
  Array.from({ length: 20 }, (_, i) => (
    <div key={i} data-row={i} {...(marked ? { "data-keep-anchor": "" } : {})}>row {i}</div>
  ));

describe("<KeepPlace>", () => {
  for (const marked of [true, false]) {
    it(`keeps the row at the top when the width changes (${marked ? "data-keep-anchor" : "tree walk"})`, () => {
      const onRestore = vi.fn();
      const { root, host } = mount(<KeepPlace data-testid="scroller" onRestore={onRestore}>{rows(marked)}</KeepPlace>);
      const sc = host.querySelector<HTMLElement>("[data-testid=scroller]")!;

      // Folded: row 2 spans 200–300; scrolled to 250 → row 2 is half off the top (offset −50).
      sc.scrollTop = 250;
      act(() => { sc.dispatchEvent(new Event("scroll")); });

      // Unfold: rows shrink to 50px. Without help, 250 now shows row 5.
      state.width = 800;
      act(() => { roCallbacks.forEach((f) => f()); });

      // Row 2 now spans 100–150; keeping it at −50 means scrollTop 150.
      expect(sc.scrollTop).toBe(150);
      expect(onRestore).toHaveBeenCalledTimes(1);
      expect(onRestore.mock.calls[0][0].anchor).toBe(sc.querySelector("[data-row='2']"));
      expect(onRestore.mock.calls[0][0].delta).toBe(-100);
      act(() => root.unmount());
    });
  }

  // A sticky header covers the top 100px: the user is reading row 3 (50–150), not row 2, which is
  // hidden behind it. Row 3 sits 50px above the reading edge (100) → after unfolding (50px rows,
  // row 3 at 150 − st) the edge must again cut it 50px down: st = 100. Without the inset: 150.
  for (const how of ["topInset", "scroll-padding-top"] as const) {
    it(`reads below a sticky header (${how})`, () => {
      const onRestore = vi.fn();
      const props = how === "topInset" ? { topInset: 100 } : { style: { scrollPaddingTop: "100px" } };
      const { root, host } = mount(<KeepPlace data-testid="scroller" onRestore={onRestore} {...props}>{rows(true)}</KeepPlace>);
      const sc = host.querySelector<HTMLElement>("[data-testid=scroller]")!;
      sc.scrollTop = 250;
      act(() => { sc.dispatchEvent(new Event("scroll")); });
      state.width = 800;
      act(() => { roCallbacks.forEach((f) => f()); });
      expect(onRestore.mock.calls[0][0].anchor).toBe(sc.querySelector("[data-row='3']"));
      expect(sc.scrollTop).toBe(100);
      act(() => root.unmount());
    });
  }

  it("readScrollPaddingTop: px value, 0 for auto", () => {
    const a = document.createElement("div");
    a.style.scrollPaddingTop = "61px";
    const b = document.createElement("div");
    document.body.append(a, b);
    expect(readScrollPaddingTop(a)).toBe(61);
    expect(readScrollPaddingTop(b)).toBe(0);
  });

  it("ignores size changes that don't reflow (small height change)", () => {
    const { root, host } = mount(<KeepPlace data-testid="scroller">{rows(true)}</KeepPlace>);
    const sc = host.querySelector<HTMLElement>("[data-testid=scroller]")!;
    sc.scrollTop = 250;
    act(() => { sc.dispatchEvent(new Event("scroll")); });
    act(() => { roCallbacks.forEach((f) => f()); }); // same size
    expect(sc.scrollTop).toBe(250);
    act(() => root.unmount());
  });

  it("does nothing when disabled", () => {
    const { root, host } = mount(<KeepPlace data-testid="scroller" enabled={false}>{rows(true)}</KeepPlace>);
    const sc = host.querySelector<HTMLElement>("[data-testid=scroller]")!;
    sc.scrollTop = 250;
    act(() => { sc.dispatchEvent(new Event("scroll")); });
    state.width = 800;
    act(() => { roCallbacks.forEach((f) => f()); });
    expect(sc.scrollTop).toBe(250);
    act(() => root.unmount());
  });

  it("keeps a focused field visible and puts its caret back", () => {
    const { root, host } = mount(
      <KeepPlace data-testid="scroller">
        {rows(true)}
        <textarea data-field="" defaultValue="hello world" />
      </KeepPlace>,
    );
    const sc = host.querySelector<HTMLElement>("[data-testid=scroller]")!;
    const ta = host.querySelector("textarea")!;

    act(() => { ta.focus(); });
    ta.setSelectionRange(3, 5);
    act(() => { ta.dispatchEvent(new Event("keyup", { bubbles: true })); });

    // A re-render on the breakpoint drops the caret…
    ta.setSelectionRange(0, 0);
    state.width = 800;
    act(() => { roCallbacks.forEach((f) => f()); });

    expect(document.activeElement).toBe(ta);
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([3, 5]);
    // field at 600–640, view 0–300 → scroll down to bottom + 8px margin
    expect(sc.scrollTop).toBe(348);
    act(() => root.unmount());
  });

  it("<KeepPlace document> renders children without a wrapper", () => {
    const { root, host } = mount(<KeepPlace document><p id="x">hi</p></KeepPlace>);
    expect(host.firstElementChild?.id).toBe("x");
    act(() => root.unmount());
  });

  it("renders `as` and passes props through", () => {
    const { root, host } = mount(<KeepPlace as="section" className="list" aria-label="Rows">{rows(false)}</KeepPlace>);
    const el = host.firstElementChild!;
    expect(el.tagName).toBe("SECTION");
    expect(el.className).toBe("list");
    expect(el.getAttribute("aria-label")).toBe("Rows");
    act(() => root.unmount());
  });
});
