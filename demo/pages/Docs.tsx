import { useEffect, type ReactNode } from "react";
import { IPHONE_DUO } from "fold-ready/devices";
import { Code } from "../components/Code";

const TOC = [
  ["install", "Install"],
  ["use-input-mode", "useInputMode"],
  ["tailwind", "Tailwind variants"],
  ["split", "SplitHost · Pane"],
  ["selection", "useSelection"],
  ["keep-place", "KeepPlace"],
  ["visible-viewport", "useVisibleViewport"],
  ["toolbar-tint", "ToolbarTint"],
  ["sidebar", "initialSidebarHidden"],
  ["segments", "useViewportSegments"],
  ["inspector", "Inspector · audits"],
  ["devices", "Measurements"],
] as const;

export function Docs({ section }: { section: string }) {
  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ block: "start" });
      el.focus({ preventScroll: true });
    }
    // Narrow screens: the TOC is a horizontal strip — bring the current entry into it.
    const link = document.querySelector<HTMLElement>(`.toc a[href="#/docs/${section}"]`);
    const strip = link?.closest("ul");
    if (link && strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = link.offsetLeft - strip.clientWidth / 2 + link.offsetWidth / 2;
    }
  }, [section]);

  return (
    <div className="wrap docs">
      <header className="page-head">
        <p className="eyebrow">API</p>
        <h1>Everything fold-ready exports</h1>
        <p className="lede">
          Small hooks and two components. Mouse and desktop behaviour stay exactly as they were unless you opt in;
          nothing reads the user agent or the device model.
        </p>
      </header>
      <div className="docs-grid">
        <nav className="toc" aria-label="On this page">
          <ul>
            {TOC.map(([id, label]) => (
              <li key={id}><a href={`#/docs/${id}`} aria-current={section === id ? "location" : undefined}>{label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="docs-body">
          <Sec id="install" title="Install">
            <Code lang="sh">npm i fold-ready</Code>
            <p>React 17 or newer. No other dependencies. Everything is SSR-safe: hooks return <code>false</code> / <code>null</code> on the server and on the first client render, then follow the real value.</p>
          </Sec>

          <Sec id="use-input-mode" title="useInputMode()">
            <p>Decide by what the user can do. <code>touch</code> is <code>(pointer: coarse)</code>, <code>hover</code> is <code>(hover: hover) and (pointer: fine)</code>, <code>short</code> is <code>(max-height: 600px)</code>. All follow fold, unfold and rotation live.</p>
            <Code lang="tsx">{`
import { useInputMode } from "fold-ready";

function RowActions() {
  const { hover } = useInputMode();
  // Reveal on hover only where hover exists. Fingers always see the buttons.
  return <div className={hover ? "actions reveal-on-hover" : "actions"}>…</div>;
}
`}</Code>
            <p>Also: <code>useIsTouch()</code>, <code>useCanHover()</code>, <code>useIsShort()</code>, <code>useMediaQuery(q)</code>, <code>readInputMode()</code> (outside React), and <code>setInputModeOverride(&#123; touch: true, hover: false &#125;)</code> to preview the finger layout on a desktop. <code>?fr-simulate=touch</code> in the URL starts with that override — Duo Lab uses it.</p>
          </Sec>

          <Sec id="tailwind" title="Tailwind variants">
            <p><code>can-hover:</code>, <code>touch:</code> and <code>short:</code>. Hide hover-revealed controls with <code>can-hover:</code>, never with a width prefix like <code>sm:</code>.</p>
            <Code lang="js">{`
// tailwind.config.js (v3)
const foldReady = require("fold-ready/tailwind").default;
module.exports = { plugins: [foldReady] };
`}</Code>
            <Code lang="css">{`
/* Tailwind v4 — paste into your CSS instead */
@custom-variant can-hover (@media (hover: hover) and (pointer: fine));
@custom-variant touch (@media (pointer: coarse));
@custom-variant short (@media (max-height: 600px));
`}</Code>
            <Code lang="html">{`
<button class="opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100">…</button>
`}</Code>
          </Sec>

          <Sec id="split" title="SplitHost · Pane · useSplit()">
            <p>A list–detail that docks. The host measures <em>itself</em> (not the window): with a finger and at least <code>minWidth</code> (860) px it shows the Pane as a column beside your content; otherwise the Pane is a drawer over it, as before. Esc and the backdrop close the drawer; focus goes back to the row that opened it.</p>
            <Code lang="tsx">{`
import { SplitHost, Pane, useSelection } from "fold-ready";

function Inbox() {
  const [sel, setSel] = useSelection("sel");
  const open = messages.find((m) => m.id === sel);
  return (
    <SplitHost>                       {/* minWidth=860 dock="touch" */}
      <MessageList onOpen={setSel} />
      {open && (
        <Pane label={open.subject} onClose={() => setSel(null)}>
          {(close) => <Message m={open} onBack={close} />}
        </Pane>
      )}
    </SplitHost>
  );
}
`}</Code>
            <table className="table props">
              <thead><tr><th scope="col">Prop</th><th scope="col">Default</th><th scope="col">What it does</th></tr></thead>
              <tbody>
                <tr><td><code>minWidth</code></td><td>860</td><td>Host width below which panes stay drawers</td></tr>
                <tr><td><code>dock</code></td><td>"touch"</td><td><code>"always"</code> docks for mice too, <code>"never"</code> keeps a drawer</td></tr>
                <tr><td><code>paneWidth</code></td><td>clamp(320px, 40%, 480px)</td><td>Width of the docked column</td></tr>
                <tr><td><code>followHinge</code></td><td>true</td><td>Snap to the second segment when the browser reports a hinge</td></tr>
                <tr><td><code>onDockChange</code></td><td>—</td><td>Called with <code>docked</code> when it changes</td></tr>
                <tr><td><code>settleMs</code></td><td><code>150</code></td><td>Wait this long after the last resize before switching dock ↔ drawer. A fold fires 2–3 resizes through sizes like 466 × 498; without the wait the pane flashes.</td></tr>
              </tbody>
            </table>
            <p><code>useSplit()</code> returns <code>&#123; docked &#125;</code> inside a host (or <code>null</code>), e.g. to decide what a row tap does. Theme with <code>--fr-pane-bg</code>, <code>--fr-pane-border</code>, <code>--fr-backdrop</code>, <code>--fr-drawer-shadow</code>, <code>--fr-z</code>.</p>
          </Sec>

          <Sec id="selection" title="useSelection(key, adapter?)">
            <p>Keeps “which item is open” in the URL (<code>?sel=42</code>), so unfolding, reloading, going back or sharing the link reopens it. Uses <code>replaceState</code>, so it doesn't fill history.</p>
            <Code lang="tsx">{`
const [sel, setSel] = useSelection("sel");
`}</Code>
            <p>Routers that keep their own copy of the URL pass an adapter. Next.js pages router:</p>
            <Code lang="tsx">{`
import { useRouter } from "next/router";

const router = useRouter();
const [sel, setSel] = useSelection("sel", {
  get: (k) => (typeof router.query[k] === "string" ? (router.query[k] as string) : null),
  set: (k, v) => {
    const { [k]: _, ...q } = router.query;
    router.replace({ pathname: router.pathname, query: v ? { ...q, [k]: v } : q },
      undefined, { shallow: true, scroll: false });
  },
});
`}</Code>
          </Sec>

          <Sec id="keep-place" title="KeepPlace · useKeepPlace()">
            <p>Unfolding reflows every row but the browser keeps the <em>pixel</em> offset, so the reader lands somewhere else. KeepPlace remembers the row at the top edge and puts it back after any width change. A focused input wins: it is brought back into view above the keyboard with its caret intact.</p>
            <Code lang="tsx">{`
import { KeepPlace } from "fold-ready";

<KeepPlace as="ul" className="list" /* overflow-y: auto; bounded height */>
  {rows.map((r) => <li key={r.id} data-keep-anchor>…</li>)}
</KeepPlace>

// the window's own scroll instead of a container
<KeepPlace document>…</KeepPlace>

// hook form
const ref = useRef<HTMLDivElement>(null);
useKeepPlace(ref, { onRestore: ({ anchor, delta }) => {} });
`}</Code>
            <p>Mark good anchors with <code>data-keep-anchor</code> for exact results; without them the anchor is found from the element just inside the top edge.</p>
          </Sec>

          <Sec id="visible-viewport" title="useVisibleViewport() · ViewportVars">
            <p>Folded, Safari gives the page 580 px of height but <code>100vh</code> is 598. <code>100dvh</code> is right at rest; no unit knows about the keyboard. These read <code>visualViewport</code>.</p>
            <Code lang="tsx">{`
import { useVisibleViewport, ViewportVars } from "fold-ready";

const { height, keyboardInset, keyboardOpen } = useVisibleViewport();

// or once at the root, then plain CSS:
<ViewportVars />
`}</Code>
            <Code lang="css">{`
.sheet { max-height: var(--fr-visible-height, 100dvh); }
.sticky-actions { position: fixed; bottom: var(--fr-keyboard-inset, 0px); }
`}</Code>
            <p>Also <code>readVisibleViewport()</code> and <code>installViewportVars(root?)</code> outside React.</p>
            <p>
              <code>useSettledViewport(quietMs = 150)</code> returns <code>{"{ width, height }"}</code> only once a fold, unfold or
              rotation has finished. Measured on iPhone Duo: one fold fires 2–3 resizes and passes through 466 × 498 or
              382 × 498 — sizes that belong to no pose. Lay out for the size the user will actually see.
            </p>
          </Sec>

          <Sec id="toolbar-tint" title="ToolbarTint">
            <p>Safari ignores <code>theme-color</code> for its toolbars and samples fixed elements near the page edge. Folded, its buttons live in a column on the right, so it samples the right edge. An 8 px fixed strip there colours the whole column — measured with no horizontal scrolling.</p>
            <Code lang="tsx">{`
import { ToolbarTint } from "fold-ready";

<ToolbarTint color="#1e3a8a" />                              // right edge, fingers only
<ToolbarTint color="#1e3a8a" edges={["top", "right"]} when="always" />
`}</Code>
          </Sec>

          <Sec id="sidebar" title="initialSidebarHidden(key)">
            <p>Start the side navigation collapsed on wide <em>touch</em> screens, where those 220 px are better spent on content. Respects what the user chose before; mouse users keep what they had.</p>
            <Code lang="tsx">{`
import { initialSidebarHidden, rememberSidebarHidden } from "fold-ready";

const [hidden, setHidden] = useState(false);
useEffect(() => setHidden(initialSidebarHidden("app:sidebar")), []);
const toggle = () => setHidden((h) => { rememberSidebarHidden("app:sidebar", !h); return !h; });
`}</Code>
          </Sec>

          <Sec id="segments" title="useViewportSegments()">
            <p>Where the hinge is, when the browser knows: Chrome / Edge 138+ on Android foldables. Safari (iPhone Duo included) does not — it returns <code>null</code>, and nothing in fold-ready depends on it.</p>
            <Code lang="tsx">{`
const segments = useViewportSegments(); // null, or [{ left, top, width, height, … }, …]
supportsViewportSegments();             // can this browser report them at all?
`}</Code>
          </Sec>

          <Sec id="inspector" title="FoldReadyInspector · audits">
            <p>A small dev overlay (the round button in the corner of this site) that shows the input mode the page sees, the closest measured pose, and <code>:hover</code> rules that hide controls a finger can never reveal.</p>
            <Code lang="tsx">{`
import { FoldReadyInspector } from "fold-ready";

{process.env.NODE_ENV !== "production" && <FoldReadyInspector position="bottom-left" />}
`}</Code>
            <p>The same checks without UI, e.g. in a test or the console:</p>
            <Code lang="ts">{`
import { auditHoverOnly, auditBreakpoints, auditRuntime } from "fold-ready";

auditHoverOnly().findings;   // [{ selector, reveals, severity: "high" | "medium", hiddenBy? }]
auditBreakpoints().gaps;     // measured widths that fall between two of your breakpoints
auditRuntime();              // missing viewport-fit, 100vh, …
`}</Code>
          </Sec>

          <Sec id="devices" title="Measurements · fold-ready/devices">
            <p>
              What Safari actually gives a page, measured — not the screen size. <span className="badge">source: {IPHONE_DUO.source}</span>{" "}
              <span className="muted">{IPHONE_DUO.name} · {IPHONE_DUO.browser} · {IPHONE_DUO.os} · measured {IPHONE_DUO.measuredOn}</span>
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th scope="col">Pose</th><th scope="col">Page (inner)</th><th scope="col">Screen</th><th scope="col">Safe area bottom</th><th scope="col">Input</th><th scope="col">Notes</th></tr>
                </thead>
                <tbody>
                  {IPHONE_DUO.poses.map((p) => (
                    <tr key={p.pose}>
                      <th scope="row">{p.label}<br /><code className="muted">{p.pose}</code></th>
                      <td className="num">{p.viewport.width} × {p.viewport.height}</td>
                      <td className="num">{p.screen.width} × {p.screen.height}</td>
                      <td className="num">{p.safeArea.bottom}</td>
                      <td>{p.coarse ? "finger" : "mouse"}{p.hover ? ", hover" : ", no hover"}</td>
                      <td>{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="facts">
              {IPHONE_DUO.facts.map((f) => <li key={f}>{renderTicks(f)}</li>)}
            </ul>
            <Code lang="ts">{`
import { IPHONE_DUO, closestPose } from "fold-ready/devices";

closestPose(innerWidth, innerHeight); // { device, pose, distance } — for hints, never for layout
`}</Code>
          </Sec>
        </div>
      </div>
    </div>
  );
}

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="doc-sec" tabIndex={-1} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}><a href={`#/docs/${id}`} className="anchor">{title}</a></h2>
      {children}
    </section>
  );
}

/** `code` spans in the facts strings. */
function renderTicks(s: string) {
  return s.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>,
  );
}
