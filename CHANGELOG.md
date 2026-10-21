# Changelog

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
