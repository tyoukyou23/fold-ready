# Changelog

## 0.1.2 — 2026-10-21

- `KeepPlace` / `useKeepPlace`: `topInset: "auto"` measures the fixed / sticky bars covering the top **right now** — a header plus whatever is stuck below it (a section nav), followed down the stack. Only bars ≥ 90% of the view's width count (a sticky map column doesn't), capped at half the view; for a scroll container its own fixed ancestors (a drawer) are skipped. It is also the new default when no `scroll-padding-top` is set. Found adapting a school site whose header is 57 px below 600 px and 65 px above, with a section nav (50 px) only below 900 px: no single `scroll-padding-top` was right, and a global one would have doubled every existing `scroll-margin-top`. Verified in Chrome: unfolding 382 → 669 and back keeps the paragraph being read at the same offset below the nav. `measureTopChrome(view, within?)` exported.

## 0.1.1 — 2026-10-21

- `auditHoverOnly` reports only elements that are hidden right now (opacity ≈ 0, `visibility: hidden`, `display: none`, zero height). Hover dimming (`hover:opacity-80`) and rules that match nothing on the page are no longer listed — they're counted in the new `ignoredRules`. Found by running the Inspector on a real Tailwind app, where every compiled `hover:` utility was being reported.
- `KeepPlace` / `useKeepPlace` take the reading position **below sticky headers**: new `topInset` option (number or function); by default the scroller's CSS `scroll-padding-top` (for `document`, `<html>`'s). Before, on a page with a sticky header the anchor was the block hidden behind it, so an unfold could land a few lines off. Found adapting a Next.js dashboard with a 61 px sticky header. `readScrollPaddingTop()` exported.
- `fold-ready/tailwind.css`: Tailwind v4 users `@import "fold-ready/tailwind.css"` instead of pasting three `@custom-variant` lines. A test keeps it in sync with the v3 plugin.
- Only the main entry is a client module now. `"use client"` was also on `fold-ready/devices` and `fold-ready/tailwind`, so importing `IPHONE_DUO` in a React Server Component gave a client reference instead of the data.
- `package.json` `sideEffects` lists `*.css` (was `false`).

## 0.1.0 — 2026-10-21

First release, ahead of the iPhone Duo launch (2026-10-23).

- `useInputMode` / `useMediaQuery` / `setInputModeOverride` / `?fr-simulate=touch`
- `SplitHost` + `Pane` (+ `useSplit`): list → detail that docks by container width, drawer otherwise; hinge-aware on Viewport Segments browsers
- `useSelection` with History API default and router adapters
- `KeepPlace` / `useKeepPlace`: keep the reading position, focus and caret across fold / unfold / rotate
- `ToolbarTint`: colour Safari's right-hand column on the folded Duo without horizontal scroll
- `useVisibleViewport` / `installViewportVars` / `ViewportVars`
- `FoldReadyInspector` and audits: `auditHoverOnly`, `auditBreakpoints`, `auditRuntime`, `scanSourceForUaSniffing`
- `fold-ready/tailwind`: `can-hover:` `touch:` `short:`
- `fold-ready/devices`: iPhone Duo Safari measurements (simulator, Xcode 27.1)
- `initialSidebarHidden` / `rememberSidebarHidden`
- `useSettledViewport`, and `SplitHost` `settleMs` (default 150): a fold fires 2–3 resizes through transient sizes
- Measurements: folded-sideways pose (678×340); half-fold = folded for the web; transient resize sizes
