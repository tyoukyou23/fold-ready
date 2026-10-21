// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  auditBreakpoints, auditHoverOnly, auditRuntime, scanSourceForUaSniffing, stripHover,
} from "../src/audit";

function css(text: string) {
  const el = document.createElement("style");
  el.textContent = text;
  document.head.appendChild(el);
  return el;
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("auditHoverOnly", () => {
  it("finds a hover reveal outside a hover media query", () => {
    document.body.innerHTML = `<div class="card"><button class="act">x</button></div>`;
    css(`.act{opacity:0} .card:hover .act{opacity:1}`);
    const { findings } = auditHoverOnly(document);
    expect(findings).toHaveLength(1);
    expect(findings[0].selector).toBe(".card:hover .act");
    expect(findings[0].reveals).toEqual(["opacity: 1"]);
    expect(findings[0].elements).toBe(1);
    expect(findings[0].severity).toBe("medium");
  });

  it("ignores the same rule inside (hover: hover) and (pointer: fine)", () => {
    css(`@media (hover: hover) and (pointer: fine){ .card:hover .act{opacity:1} }`);
    css(`@supports (display:grid){ @media (pointer: fine){ .x:hover{display:block} } }`);
    expect(auditHoverOnly(document).findings).toHaveLength(0);
  });

  it("ignores hover rules that do not reveal anything", () => {
    css(`a:hover{color:red} .b:hover{transform:translateY(-2px)} .c:hover{opacity:0}`);
    expect(auditHoverOnly(document).findings).toHaveLength(0);
  });

  it("flags the Tailwind width-gated pattern as high", () => {
    document.body.innerHTML = `<div class="group"><button class="sm:opacity-0 group-hover:opacity-100">edit</button></div>`;
    css(`@media (min-width: 640px){ .sm\\:opacity-0{opacity:0} }
.group:hover .group-hover\\:opacity-100{opacity:1}`);
    const { findings } = auditHoverOnly(document);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("high");
    expect(findings[0].hiddenBy?.media).toContain("640px");
    expect(findings[0].elements).toBe(1);
  });

  it("strips :hover in compound and complex selectors", () => {
    expect(stripHover(".group:hover .btn")).toBe(".group .btn");
    expect(stripHover("a:hover>span")).toBe("a>span");
    expect(stripHover("li :hover")).toBe("li *");
    expect(stripHover(".x\\:hover")).toBe(".x\\:hover");
  });
});

describe("auditBreakpoints", () => {
  it("dedupes, sorts and reports the 669 gap", () => {
    css(`@media (min-width: 768px){.a{color:red}}
@media (min-width: 640px){.b{color:red}}
@media (min-width: 40rem){.c{color:red}}
@media (min-width: 1024px){.d{color:red}}`);
    const r = auditBreakpoints(document);
    expect(r.values).toEqual([640, 768, 1024]);
    const gap = r.gaps.find((g) => g.width === 669);
    expect(gap?.between).toEqual([640, 768]);
    expect(gap?.message).toContain("669 ");
    const portrait = r.poses.find((p) => p.pose === "unfolded-portrait");
    expect(portrait?.active).toEqual(["min-width: 640px"]);
  });

  it("counts width-only mobile queries that hide things", () => {
    css(`@media (max-width: 767px){.nav{display:none}}
@media (max-width: 767px) and (pointer: coarse){.nav2{display:none}}`);
    expect(auditBreakpoints(document).widthOnlyMobileQueries).toBe(1);
  });
});

describe("auditRuntime", () => {
  it("reports env(safe-area-inset) without viewport-fit=cover", () => {
    const meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    document.head.appendChild(meta);
    css(`.bar{padding-bottom:env(safe-area-inset-bottom)}`);
    const ids = auditRuntime(window).map((f) => f.id);
    expect(ids).toContain("viewport-fit");
    meta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
    expect(auditRuntime(window).map((f) => f.id)).not.toContain("viewport-fit");
  });
});

describe("scanSourceForUaSniffing", () => {
  it("finds device sniffing", () => {
    const src = `const a = 1;\nif (/iPhone/.test(navigator.userAgent)) mobile();\nconst m = ua.userAgent.match(/Android|Mobi/);\nconsole.log(navigator.userAgent);`;
    const hits = scanSourceForUaSniffing(src);
    expect(hits.map((h) => h.line)).toEqual([2, 3]);
    expect(hits[0].text).toBe("if (/iPhone/.test(navigator.userAgent)) mobile();");
  });
});
