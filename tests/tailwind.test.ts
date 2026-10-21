import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VARIANTS } from "../src/tailwind";

describe("tailwind.css (v4) matches the v3 plugin", () => {
  const css = readFileSync(new URL("../tailwind.css", import.meta.url), "utf8");
  const declared = Object.fromEntries(
    [...css.matchAll(/^@custom-variant\s+([\w-]+)\s+\((.+)\);$/gm)].map((m) => [m[1], m[2]]),
  );

  it("declares every variant with the same media query", () => {
    expect(declared).toEqual(VARIANTS);
  });
});
