// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FoldReadyInspector } from "../src/inspector";
import { renderToString } from "react-dom/server";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("FoldReadyInspector", () => {
  it("renders nothing on the server", () => {
    expect(renderToString(<FoldReadyInspector defaultOpen />)).toBe("");
  });

  it("opens and shows the Now section", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<FoldReadyInspector />); });
    const fab = document.querySelector<HTMLButtonElement>(".fr-insp-fab");
    expect(fab).not.toBeNull();
    await act(async () => { fab!.click(); });
    const panel = document.querySelector('[aria-label="fold-ready inspector"]');
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain("Now");
    expect(panel!.textContent).toContain("none (Safari)");
    const run = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Run audit")!;
    await act(async () => { run.click(); });
    expect(document.getElementById("fr-insp-styles")).not.toBeNull();
  });
});
