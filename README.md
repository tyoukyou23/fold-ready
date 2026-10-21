# fold-ready

**Make your web app feel native on foldables and wide touch screens** — iPhone Duo, iPad, Android foldables.
React · TypeScript · zero dependencies · SSR-safe · React 17+

[Live demo & Duo Lab](https://tyoukyou23.github.io/fold-ready/) · [日本語](./README.ja.md)

```bash
npm i fold-ready
```

---

## Why

Most sites decide "is this a phone?" by **width**. An unfolded iPhone Duo held sideways is **951 px wide** — desktop territory — and still has **no mouse**. So it gets your desktop UI: hover-only buttons a finger can never reveal, a sidebar eating a third of the screen, list → detail that jumps between pages instead of sitting side by side.

What Safari actually gives a page on iPhone Duo (measured, not screen ÷ 3):

| Pose | Page viewport | Notes |
|---|---|---|
| Folded | **382 × 580** | Safari's status bar and buttons take a column on the **right**. The screen is 466 wide; your page is not. |
| Unfolded, portrait | **669 × 825** | Between Tailwind `sm` (640) and `md` (768) — a band almost nobody tests. |
| Unfolded, sideways | **951 × 543** | Desktop width, finger input, very short. |
| Folded, sideways | **678 × 340** | The shortest pose. Sticky headers and bottom bars can eat half the page. |

All poses: `(pointer: coarse)`, no hover. Folding fires `resize` — no reload. `screen.width` keeps the folded value. Safari has no Viewport Segments / Device Posture API.

Two things we found that nobody had written down:
- **Half-folding is invisible to the web.** Safari moves to the outer screen and the page gets exactly the folded pose (382 × 580) — no tabletop mode, no posture event.
- **One fold fires 2–3 resizes through sizes that belong to no pose** (466 × 498, 382 × 498). React to each one and your layout flashes. fold-ready's `SplitHost` waits for the size to settle; `useSettledViewport()` does the same for your code.

*Measured in the iPhone Duo simulator (Xcode 27.1), 2026-10-21. Hardware check coming — [contribute your measurements](https://tyoukyou23.github.io/fold-ready/#/measure).*

**fold-ready's rules:** decide by **input**, not width · measure **containers**, not the window · never sniff the device · leave mouse users' experience unchanged unless you opt in.

---

## What's inside

| | | |
|---|---|---|
| [`useInputMode`](#input-mode) | `{ touch, hover, short }` — the three questions a layout actually needs | core |
| [`SplitHost` + `Pane`](#list--detail-that-docks) | List → detail that docks side by side when there's room, slides over when there isn't. Snaps to the hinge where the browser reports one. | core |
| [`useSelection`](#selection-in-the-url) | Keep the open item in the URL (`?sel=42`) — any router | core |
| [`KeepPlace`](#unfold-without-losing-your-place) | **Unfold without losing your place**: same item at the top, focus and caret kept | ✨ |
| [`ToolbarTint`](#safari-toolbar-colour) | **Colour Safari's right-hand column** on the folded Duo — no horizontal scroll | ✨ measured |
| [`useVisibleViewport`](#visible-height--keyboard) | The height you can actually see, keyboard included, as JS or CSS variables | ✨ |
| [`FoldReadyInspector`](#inspector--audits) | Dev overlay: live mode, simulate touch, **find hover-only controls** and untested breakpoints | ✨ |
| [`fold-ready/tailwind`](#tailwind) | `can-hover:` `touch:` `short:` variants | |
| [`fold-ready/devices`](#measurements) | The measurements above as data | |
| [Duo Lab](https://tyoukyou23.github.io/fold-ready/#/lab) | See any URL in all three Duo poses and watch it unfold | tool |

---

## Input mode

```tsx
import { useInputMode } from "fold-ready";

const { touch, hover, short } = useInputMode();
// touch  (pointer: coarse)                         — a finger
// hover  (hover: hover) and (pointer: fine)        — the only case where hover-to-reveal is safe
// short  (max-height: 600px)                       — e.g. Duo sideways (543): compact your chrome
```

`false` on the server and first render, then live. `setInputModeOverride({ touch: true })` forces a mode (demos, tests); a page opened with `?fr-simulate=touch` starts in that mode — Duo Lab uses this.

## List → detail that docks

```tsx
import { SplitHost, Pane, useSelection } from "fold-ready";

function Inbox({ mails }) {
  const [sel, setSel] = useSelection("sel");
  const open = mails.find((m) => m.id === sel);
  return (
    <SplitHost>
      <MailList mails={mails} onOpen={(m) => setSel(m.id)} />
      {open && (
        <Pane label="Message" onClose={() => setSel(null)}>
          {(close) => <Message mail={open} onClose={close} />}
        </Pane>
      )}
    </SplitHost>
  );
}
```

- Docks when the **host** is ≥ `minWidth` (860) wide — sidebar collapsed or Split View change that, the window doesn't.
- `dock="touch"` (default): only fingers get side-by-side; mouse users keep the drawer they know. `"always"` / `"never"`.
- Dock ↔ drawer switches wait until resizing has been quiet for `settleMs` (150) — see "fires 2–3 resizes" above.
- Not docked: a modal drawer — Esc and backdrop close it, focus moves in and returns to the opener, `prefers-reduced-motion` respected.
- Already have a page per item? Read `useSplit()?.docked` in your row handler: dock when you can, navigate when you can't.
- Theme with `--fr-pane-bg`, `--fr-pane-border`, `--fr-backdrop`, `--fr-drawer-shadow`, `--fr-z`.

## Selection in the URL

`useSelection(key)` uses the History API (`replaceState`, no history spam). Routers that keep their own copy of the URL take an adapter:

```ts
// Next.js pages router
const router = useRouter();
const [sel, setSel] = useSelection("sel", {
  get: (k) => (typeof router.query[k] === "string" ? router.query[k] : null),
  set: (k, v) => {
    const { [k]: _, ...q } = router.query;
    router.replace({ pathname: router.pathname, query: v ? { ...q, [k]: v } : q }, undefined, { shallow: true, scroll: false });
  },
});
```

## Unfold without losing your place

Unfolding reflows text, so yesterday's `scrollTop` points at a different paragraph. `KeepPlace` remembers which element was at the top and puts it back after the width changes — and keeps a focused field (and its caret) on screen.

```tsx
import { KeepPlace } from "fold-ready";

<KeepPlace style={{ overflowY: "auto", height: "100%" }}>{longList}</KeepPlace>
<KeepPlace document />            {/* or keep the window's scroll position */}
```

Mark preferred anchors with `data-keep-anchor`. Hook form: `useKeepPlace(ref)`.

**Sticky header?** The reading position is taken just below it, so what comes back is what the user was actually reading — not the block hidden behind the header. By default `KeepPlace` reads the scroller's `scroll-padding-top` (for `document`, the `<html>` element's), which also keeps `#anchor` jumps clear of the header:

```css
html { scroll-padding-top: var(--header-h); }   /* once, for the whole site */
```

Or pass it: `<KeepPlace document topInset={61} />` — a function if the header collapses.

Header height changes with the breakpoint, or a section nav sticks below it only on phones? Leave `scroll-padding-top` unset (or pass `topInset="auto"`): the bars covering the top are measured at each step — stacked bars included, narrow sticky columns ignored.

## Safari toolbar colour

Safari ignores `theme-color` for its toolbars and samples the page edge instead. On the folded Duo it samples the **right** edge — your page colour never reaches that column. Measured: an 8 px fixed strip on the right edge paints the whole column and causes **no** horizontal scroll (the old workaround widened the page, which did).

```tsx
import { ToolbarTint } from "fold-ready";

<ToolbarTint color="#1e3a8a" />   {/* touch devices only; edges={["top","right"]} to add the top */}
```

Give it the colour of what's next to it so it reads as part of your page.

## Visible height & keyboard

Measured on the folded Duo: `100vh` = **598** (18 px too tall), `100dvh` = `100svh` = **580** (right). No unit follows the on-screen keyboard.

```tsx
import { ViewportVars, useVisibleViewport } from "fold-ready";

<ViewportVars />   // keeps --fr-visible-height, --fr-visible-width, --fr-keyboard-inset on <html>

const { width, height } = useSettledViewport();   // only after a fold / unfold / rotate has finished
```

```css
.actions { position: fixed; bottom: var(--fr-keyboard-inset, 0px); }
.sheet   { max-height: var(--fr-visible-height, 100dvh); }
```

## Inspector & audits

```tsx
import { FoldReadyInspector } from "fold-ready";

{process.env.NODE_ENV !== "production" && <FoldReadyInspector />}
```

A small floating panel: live viewport and input mode, the closest measured Duo pose, a "pretend I'm a finger" switch, and an audit that finds **hover-only reveals** (rules that show something on `:hover` outside `(hover: hover)`) — flagging the Tailwind pattern `sm:opacity-0 group-hover:opacity-100` that breaks on every iPad and unfolded Duo — plus which of your breakpoints each Duo pose lands on. The audits are plain functions too: `auditHoverOnly()`, `auditBreakpoints()`, `auditRuntime()`, `scanSourceForUaSniffing(source)` (for CI).

## Tailwind

```js
// tailwind.config.js (v3)
module.exports = { plugins: [require("fold-ready/tailwind").default] };
```

```html
<!-- revealed on hover for mice, always visible for fingers — whatever the width -->
<button class="opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100">Edit</button>
<header class="py-6 short:py-2">…</header>
```

Tailwind v4 (CSS-first) — one import, same variants:

```css
@import "tailwindcss";
@import "fold-ready/tailwind.css";
```

## Next.js App Router / Server Components

The main entry is a client module (`"use client"`), so components and hooks can be rendered straight from a Server Component layout — `<ToolbarTint>`, `<KeepPlace document />`, `<ViewportVars />`. `fold-ready/devices` and `fold-ready/tailwind` are plain data, not client modules: import `IPHONE_DUO` in a Server Component and you get the numbers, not a client reference.

## Measurements

```ts
import { IPHONE_DUO, closestPose } from "fold-ready/devices";
```

Each row says how it was measured (`source: "simulator" | "device"`) and when.

## Sidebar default

```ts
import { initialSidebarHidden, rememberSidebarHidden } from "fold-ready";
useEffect(() => setHidden(initialSidebarHidden("app:sidebar")), []);
```

Respects what the user chose on this device; otherwise starts collapsed only on wide touch screens.

---

Born in a real school-management app used daily by teachers on PCs, iPads and phones. MIT © tyoukyou23
