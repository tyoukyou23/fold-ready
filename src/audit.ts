/**
 * A dev-time health check for the bugs wide touch screens expose.
 *
 * The most common one is invisible on a desktop and on a phone: a control is hidden at
 * "desktop" widths (`sm:opacity-0`) and revealed on `:hover`. On a mouse that works; on a
 * phone the width rule never applies so it stays visible. On an iPad or an unfolded iPhone Duo
 * (951 px wide, a finger, no hover) the control is hidden *and* can never be revealed. These
 * functions read the page's own CSSOM and point at those rules, at breakpoints that the
 * measured iPhone Duo viewports fall between, and at a few runtime mistakes.
 *
 * Everything here is framework-free and best-effort: cross-origin stylesheets cannot be read
 * (they are listed in `skippedSheets`), and selectors the browser cannot evaluate are skipped.
 * SSR-safe: every function returns an empty result when there is no document / window.
 */
import { IPHONE_DUO } from "./devices";

export type AuditSeverity = "high" | "medium" | "low";

export interface HoverOnlyFinding {
  /** The `:hover` selector(s) of the rule (only the parts of a selector list that hover). */
  selector: string;
  /** Declarations the rule uses to reveal something, e.g. `["opacity: 1"]`. */
  reveals: string[];
  /** Stylesheet href, or a description of the `<style>` element that owns it. */
  sheet: string;
  /** Elements currently in the document that match the selector with `:hover` removed. */
  elements: number;
  /**
   * "high": the same elements are hidden by a rule inside a `min-width` media query — hidden
   * exactly on wide touch screens (iPad, iPhone Duo unfolded) and impossible to reveal there.
   * "medium": revealed only on hover, without a hover-capable media guard.
   */
  severity: AuditSeverity;
  /** The width-gated hiding rule that made this "high", when found. */
  hiddenBy?: { selector: string; media: string };
}

export interface HoverAudit {
  findings: HoverOnlyFinding[];
  /** Stylesheets that could not be read (cross-origin without CORS). */
  skippedSheets: string[];
}

export interface Breakpoint {
  px: number;
  kind: "min" | "max";
}

export interface PoseBreakpoints {
  pose: string;
  label: string;
  width: number;
  height: number;
  /** Breakpoints whose condition is true at this width, e.g. `"min-width: 640px"`. */
  active: string[];
}

export interface BreakpointGap {
  pose: string;
  width: number;
  between: [number, number];
  message: string;
}

export interface BreakpointAudit {
  /** Unique breakpoints (by px and kind), sorted by px. */
  breakpoints: Breakpoint[];
  /** Unique px values, sorted. */
  values: number[];
  poses: PoseBreakpoints[];
  /** Measured viewport widths that land between two of your breakpoints (an untested band). */
  gaps: BreakpointGap[];
  /** `max-width` media rules with no pointer/hover feature that hide things or style `:hover`. */
  widthOnlyMobileQueries: number;
  skippedSheets: string[];
}

export interface RuntimeFinding {
  id: "viewport-fit" | "no-viewport-meta" | "100vh";
  severity: AuditSeverity;
  message: string;
  detail?: string;
}

/* ─── CSSOM walking ──────────────────────────────────────────────────────────────── */

interface RuleCtx {
  rule: CSSRule;
  /** Condition texts of every enclosing grouping rule (media, supports, …), outermost first. */
  conditions: string[];
  /** Media texts only. */
  media: string[];
  /** Selectors of enclosing style rules (CSS nesting). */
  parents: string[];
  sheet: string;
}

const INSPECTOR_STYLE_ID = "fr-insp-styles";

function sheetName(sheet: CSSStyleSheet, i: number): string {
  if (sheet.href) return sheet.href;
  const node = sheet.ownerNode as Element | null;
  if (node && node.id) return `<style id="${node.id}">`;
  return `<style> #${i + 1}`;
}

function readSheets(doc: Document): { sheets: { sheet: CSSStyleSheet; name: string; rules: CSSRuleList }[]; skipped: string[] } {
  const sheets: { sheet: CSSStyleSheet; name: string; rules: CSSRuleList }[] = [];
  const skipped: string[] = [];
  const list = doc.styleSheets;
  for (let i = 0; i < list.length; i++) {
    const sheet = list[i] as CSSStyleSheet;
    const owner = sheet.ownerNode as Element | null;
    if (owner && owner.id === INSPECTOR_STYLE_ID) continue;
    const name = sheetName(sheet, i);
    try {
      const rules = sheet.cssRules;
      if (rules) sheets.push({ sheet, name, rules });
    } catch {
      skipped.push(name); // SecurityError: cross-origin
    }
  }
  return { sheets, skipped };
}

function conditionOf(rule: CSSRule): { condition?: string; media?: string } {
  const r = rule as CSSRule & { media?: MediaList; conditionText?: string; name?: string };
  if (r.media && typeof r.media.mediaText === "string") return { condition: r.media.mediaText, media: r.media.mediaText };
  if (typeof r.conditionText === "string") return { condition: r.conditionText };
  return {};
}

function walkRules(rules: CSSRuleList, sheet: string, visit: (ctx: RuleCtx) => void, conditions: string[] = [], media: string[] = [], parents: string[] = []) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const selectorText = (rule as CSSStyleRule).selectorText;
    if (typeof selectorText === "string") visit({ rule, conditions, media, parents, sheet });
    let children: CSSRuleList | undefined;
    try { children = (rule as CSSGroupingRule).cssRules; } catch { children = undefined; }
    if (!children || !children.length) continue;
    const c = conditionOf(rule);
    walkRules(
      children,
      sheet,
      visit,
      c.condition !== undefined ? [...conditions, c.condition] : conditions,
      c.media !== undefined ? [...media, c.media] : media,
      typeof selectorText === "string" ? [...parents, selectorText] : parents,
    );
  }
}

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** True when an enclosing condition limits the rule to devices that can actually hover. */
function isHoverGuarded(conditions: string[]): boolean {
  return conditions.some((c) => {
    const t = squash(c);
    return t.includes("hover:hover") || t.includes("pointer:fine");
  });
}

/** Split a selector list on top-level commas (not inside parentheses / brackets). */
export function splitSelectorList(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "\\") { cur += ch + (selector[i + 1] ?? ""); i++; continue; }
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const HOVER_RE = /(^|[^\\]):hover(?![\w-])/;

/**
 * Remove `:hover` from a selector so it matches the elements it would apply to.
 * `.group:hover .btn` → `.group .btn`; a bare `:hover` (e.g. `a :hover`) becomes `*`.
 */
export function stripHover(selector: string): string {
  let s = selector.replace(/(^|[\s>+~(,]):hover(?![\w-])/g, "$1*");
  s = s.replace(/([^\\\s>+~(,]):hover(?![\w-])/g, "$1");
  return s.trim() || "*";
}

/** Resolve CSS nesting `&` against the parent selector (best-effort). */
function resolveNested(selector: string, parents: string[]): string {
  let s = selector;
  for (let i = parents.length - 1; i >= 0; i--) {
    const p = parents[i];
    s = s.includes("&") ? s.split("&").join(`:is(${p})`) : `:is(${p}) ${s}`;
  }
  return s;
}

/* ─── reveal / hide classification ───────────────────────────────────────────────── */

const isZero = (v: string) => /^-?0+(\.0+)?([a-z%]+)?$/i.test(v.trim());

function revealsOf(style: CSSStyleDeclaration): string[] {
  const out: string[] = [];
  const get = (p: string) => (style.getPropertyValue(p) || "").trim().toLowerCase();
  const opacity = get("opacity");
  if (opacity && !isZero(opacity)) out.push(`opacity: ${opacity}`);
  const visibility = get("visibility");
  if (visibility === "visible") out.push("visibility: visible");
  const display = get("display");
  if (display && display !== "none") out.push(`display: ${display}`);
  for (const p of ["max-height", "height"]) {
    const v = get(p);
    if (v && !isZero(v)) out.push(`${p}: ${v}`);
  }
  const transform = get("transform");
  if (transform && (transform === "none" || /^(translate[xyz3d]*\(\s*0[^)]*\)|scale[xy3d]*\(\s*1(\.0+)?\s*(,\s*1(\.0+)?\s*)*\)|\s)+$/.test(transform))) {
    out.push(`transform: ${transform}`);
  }
  if (get("pointer-events") === "auto") out.push("pointer-events: auto");
  return out;
}

/** Properties a rule uses to hide something (same vocabulary as the reveals). */
function hidesOf(style: CSSStyleDeclaration): string[] {
  const out: string[] = [];
  const get = (p: string) => (style.getPropertyValue(p) || "").trim().toLowerCase();
  if (get("opacity") && isZero(get("opacity"))) out.push("opacity");
  if (get("visibility") === "hidden") out.push("visibility");
  if (get("display") === "none") out.push("display");
  for (const p of ["max-height", "height"]) if (get(p) && isZero(get(p))) out.push(p);
  const t = get("transform");
  if (t && /scale[xy]?\(\s*0[\s,)]|translate[xy]?\(\s*-?100%/.test(t)) out.push("transform");
  if (get("pointer-events") === "none") out.push("pointer-events");
  return out;
}

const propOf = (decl: string) => decl.split(":")[0].trim();

/** `min-width` (or `width >=`) media → hidden only on wide screens. */
function isMinWidthGated(media: string[]): boolean {
  return media.some((m) => /min-width\s*:/i.test(m) || /width\s*>=?/i.test(m) || /[\d.]+(px|em|rem)\s*<=?\s*width/i.test(m));
}

function safeQueryAll(doc: Document, selector: string): Element[] {
  try { return Array.from(doc.querySelectorAll(selector)); } catch { return []; }
}

function safeMatches(el: Element, selector: string): boolean {
  try { return el.matches(selector); } catch { return false; }
}

/* ─── 1. hover-only reveals ──────────────────────────────────────────────────────── */

/**
 * Find `:hover` rules that reveal something and are not guarded by `(hover: hover)` or
 * `(pointer: fine)`. A finger cannot hover, so whatever they reveal is unreachable on touch.
 */
export function auditHoverOnly(doc: Document | undefined = typeof document === "undefined" ? undefined : document): HoverAudit {
  if (!doc) return { findings: [], skippedSheets: [] };
  const { sheets, skipped } = readSheets(doc);

  const hoverRules: { selector: string; reveals: string[]; sheet: string }[] = [];
  const hideRules: { selector: string; props: string[]; media: string }[] = [];

  for (const { name, rules } of sheets) {
    walkRules(rules, name, ({ rule, conditions, media, parents }) => {
      const style = (rule as CSSStyleRule).style;
      if (!style) return;
      const raw = (rule as CSSStyleRule).selectorText;
      const full = parents.length ? resolveNested(raw, parents) : raw;
      const parts = splitSelectorList(full);
      const hoverParts = parts.filter((p) => HOVER_RE.test(p));
      if (hoverParts.length) {
        if (isHoverGuarded(conditions)) return;
        const reveals = revealsOf(style);
        if (reveals.length) hoverRules.push({ selector: hoverParts.join(", "), reveals, sheet: name });
        return;
      }
      if (isHoverGuarded(conditions) || !isMinWidthGated(media)) return;
      const props = hidesOf(style);
      if (props.length) hideRules.push({ selector: parts.join(", "), props, media: media.join(" and ") });
    });
  }

  const findings: HoverOnlyFinding[] = hoverRules.map((h) => {
    const stripped = splitSelectorList(h.selector).map(stripHover).join(", ");
    const els = safeQueryAll(doc, stripped);
    const revealed = new Set(h.reveals.map(propOf));
    let hiddenBy: HoverOnlyFinding["hiddenBy"];
    outer: for (const hide of hideRules) {
      if (!hide.props.some((p) => revealed.has(p))) continue;
      for (let i = 0; i < els.length && i < 500; i++) {
        if (safeMatches(els[i], hide.selector)) { hiddenBy = { selector: hide.selector, media: hide.media }; break outer; }
      }
    }
    const finding: HoverOnlyFinding = {
      selector: h.selector,
      reveals: h.reveals,
      sheet: h.sheet,
      elements: els.length,
      severity: hiddenBy ? "high" : "medium",
    };
    if (hiddenBy) finding.hiddenBy = hiddenBy;
    return finding;
  });

  findings.sort((a, b) => (a.severity === b.severity ? b.elements - a.elements : a.severity === "high" ? -1 : 1));
  return { findings, skippedSheets: skipped };
}

/** Elements a finding refers to (selector with `:hover` removed). For highlighting. */
export function elementsForFinding(finding: Pick<HoverOnlyFinding, "selector">, doc: Document | undefined = typeof document === "undefined" ? undefined : document): Element[] {
  if (!doc) return [];
  return safeQueryAll(doc, splitSelectorList(finding.selector).map(stripHover).join(", "));
}

/* ─── 2. breakpoints vs. measured viewports ──────────────────────────────────────── */

function toPx(value: string, unit: string): number {
  const n = parseFloat(value);
  return unit === "em" || unit === "rem" ? n * 16 : n;
}

/** Width breakpoints in one media query text. Handles `min-width:`/`max-width:` and range syntax. */
export function parseWidthBreakpoints(mediaText: string): Breakpoint[] {
  const out: Breakpoint[] = [];
  const t = mediaText.toLowerCase();
  const re = /(min|max)-width\s*:\s*([\d.]+)(px|em|rem)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) out.push({ kind: m[1] as "min" | "max", px: toPx(m[2], m[3]) });
  const r1 = /width\s*(>=|>|<=|<)\s*([\d.]+)(px|em|rem)/g;
  while ((m = r1.exec(t))) out.push({ kind: m[1].startsWith(">") ? "min" : "max", px: toPx(m[2], m[3]) });
  const r2 = /([\d.]+)(px|em|rem)\s*(<=|<|>=|>)\s*width/g;
  while ((m = r2.exec(t))) out.push({ kind: m[3].startsWith("<") ? "min" : "max", px: toPx(m[1], m[2]) });
  return out;
}

const bpLabel = (b: Breakpoint) => `${b.kind}-width: ${b.px}px`;

/**
 * Collect your width breakpoints and check them against the measured iPhone Duo viewports.
 * A width that falls between two breakpoints you use (669 between 640 and 768) is a band
 * your layout has, but that you have probably never looked at.
 */
export function auditBreakpoints(doc: Document | undefined = typeof document === "undefined" ? undefined : document): BreakpointAudit {
  const empty: BreakpointAudit = { breakpoints: [], values: [], poses: [], gaps: [], widthOnlyMobileQueries: 0, skippedSheets: [] };
  if (!doc) return empty;
  const { sheets, skipped } = readSheets(doc);

  const seen = new Map<string, Breakpoint>();
  let widthOnlyMobileQueries = 0;

  const visitGroup = (rules: CSSRuleList) => {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i] as CSSRule & { media?: MediaList; cssRules?: CSSRuleList };
      let children: CSSRuleList | undefined;
      try { children = rule.cssRules; } catch { children = undefined; }
      if (rule.media && typeof rule.media.mediaText === "string") {
        const text = rule.media.mediaText;
        for (const b of parseWidthBreakpoints(text)) seen.set(`${b.kind}:${b.px}`, b);
        const sq = squash(text);
        const maxWidth = parseWidthBreakpoints(text).some((b) => b.kind === "max");
        if (maxWidth && !/(pointer|hover):/.test(sq) && children && containsHoverOrHide(children)) widthOnlyMobileQueries++;
      }
      if (children && children.length) visitGroup(children);
    }
  };
  for (const { rules } of sheets) visitGroup(rules);

  const breakpoints = Array.from(seen.values()).sort((a, b) => a.px - b.px || (a.kind === "min" ? -1 : 1));
  const values = Array.from(new Set(breakpoints.map((b) => b.px))).sort((a, b) => a - b);

  const poses: PoseBreakpoints[] = IPHONE_DUO.poses.map((p) => {
    const w = p.viewport.width;
    return {
      pose: p.pose,
      label: p.label,
      width: w,
      height: p.viewport.height,
      active: breakpoints.filter((b) => (b.kind === "min" ? w >= b.px : w <= b.px)).map(bpLabel),
    };
  });

  const gaps: BreakpointGap[] = [];
  for (const p of poses) {
    let lower: number | undefined;
    let upper: number | undefined;
    for (const v of values) {
      if (v <= p.width) lower = v;
      else if (upper === undefined) upper = v;
    }
    if (lower !== undefined && upper !== undefined && lower !== p.width) {
      gaps.push({
        pose: p.pose,
        width: p.width,
        between: [lower, upper],
        message: `${p.width} (${IPHONE_DUO.name} · ${p.label}) lands between ${lower} and ${upper}`,
      });
    }
  }

  return { breakpoints, values, poses, gaps, widthOnlyMobileQueries, skippedSheets: skipped };
}

function containsHoverOrHide(rules: CSSRuleList): boolean {
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i] as CSSStyleRule & { cssRules?: CSSRuleList };
    if (typeof r.selectorText === "string") {
      if (HOVER_RE.test(r.selectorText)) return true;
      if (r.style && hidesOf(r.style).some((p) => p === "display" || p === "visibility")) return true;
    }
    let children: CSSRuleList | undefined;
    try { children = r.cssRules; } catch { children = undefined; }
    if (children && children.length && containsHoverOrHide(children)) return true;
  }
  return false;
}

/* ─── 3. runtime checks ──────────────────────────────────────────────────────────── */

function allCssText(doc: Document): string {
  const chunks: string[] = [];
  const { sheets } = readSheets(doc);
  for (const { rules } of sheets) {
    for (let i = 0; i < rules.length; i++) chunks.push(rules[i].cssText);
  }
  doc.querySelectorAll("style").forEach((el) => { if (el.id !== INSPECTOR_STYLE_ID) chunks.push(el.textContent || ""); });
  doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => chunks.push(el.getAttribute("style") || ""));
  return chunks.join("\n");
}

/**
 * Best-effort checks that need a live page:
 *  - `env(safe-area-inset-*)` is used but the viewport meta lacks `viewport-fit=cover`
 *    (then every inset is 0 and the padding you wrote does nothing);
 *  - no viewport meta at all;
 *  - `100vh` heights, which on iOS Safari include the area behind the toolbar — use `dvh`/`svh`.
 */
export function auditRuntime(win: Window | undefined = typeof window === "undefined" ? undefined : window): RuntimeFinding[] {
  if (!win || !win.document) return [];
  const doc = win.document;
  const out: RuntimeFinding[] = [];
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const content = (meta?.getAttribute("content") || "").toLowerCase();
  let css = "";
  try { css = allCssText(doc); } catch { css = ""; }

  if (!meta) {
    out.push({
      id: "no-viewport-meta",
      severity: "high",
      message: "No <meta name=\"viewport\"> — mobile browsers lay the page out at ~980 px and zoom out.",
    });
  }
  if (/env\(\s*safe-area-inset/i.test(css) && !/viewport-fit\s*=\s*cover/.test(content)) {
    out.push({
      id: "viewport-fit",
      severity: "medium",
      message: "CSS uses env(safe-area-inset-*) but the viewport meta lacks viewport-fit=cover, so every inset is 0.",
      detail: meta ? `content="${meta.getAttribute("content")}"` : undefined,
    });
  }
  const vh = css.match(/(?:^|[;{\s])(min-height|height|max-height)\s*:\s*100vh/gi);
  if (vh && vh.length) {
    out.push({
      id: "100vh",
      severity: "low",
      message: `${vh.length} declaration(s) use 100vh, which on iOS Safari is taller than the visible area. Prefer 100dvh (with a 100vh fallback).`,
    });
  }
  return out;
}

/* ─── source scan (CLI / CI) ─────────────────────────────────────────────────────── */

const UA_RE = /\b(?:navigator\s*\.\s*)?userAgent\b/;
const DEVICE_RE = /iPhone|iPad|iPod|Android|Mobi|webOS|BlackBerry/;

/**
 * Find user-agent sniffing for device class in source text — e.g.
 * `/iPhone/.test(navigator.userAgent)` or `userAgent.match(/Android|Mobi/)`.
 * The iPhone Duo's UA says plain "iPhone" at 951 px wide; decide by input instead.
 * Returns 1-based line numbers.
 */
export function scanSourceForUaSniffing(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (UA_RE.test(l) && DEVICE_RE.test(l)) out.push({ line: i + 1, text: l.trim() });
  }
  return out;
}
