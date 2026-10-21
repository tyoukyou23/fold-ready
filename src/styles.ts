/**
 * The few rules fold-ready needs. Injected once on first use (no CSS import required).
 * Everything is prefixed `fr-` and uses custom properties so you can theme it:
 *
 *   --fr-pane-bg, --fr-pane-border, --fr-backdrop, --fr-drawer-shadow, --fr-z
 */
export const CSS = String.raw`
.fr-host{display:flex;flex:1 1 auto;min-height:0;min-width:0}
.fr-host-main{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0}
.fr-host-pane{display:flex;flex-direction:column;flex:0 0 auto;min-height:0;background:var(--fr-pane-bg,#fff);border-left:1px solid var(--fr-pane-border,rgba(0,0,0,.08))}
.fr-host-pane:empty{display:none}
.fr-pane{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;outline:none}
.fr-drawer-root{position:fixed;inset:0;z-index:var(--fr-z,1000)}
.fr-backdrop{position:absolute;inset:0;background:var(--fr-backdrop,rgba(0,0,0,.3))}
.fr-drawer{position:absolute;top:0;right:0;height:100%;max-width:100%;display:flex;flex-direction:column;background:var(--fr-pane-bg,#fff);box-shadow:var(--fr-drawer-shadow,-8px 0 32px rgba(0,0,0,.18));outline:none;padding-bottom:env(safe-area-inset-bottom)}
.fr-backdrop.fr-in{animation:fr-fade-in .2s ease-out both}
.fr-backdrop.fr-out{animation:fr-fade-in .2s ease-in reverse both}
.fr-drawer.fr-in{animation:fr-slide-in .24s cubic-bezier(.2,.8,.2,1) both}
.fr-drawer.fr-out{animation:fr-slide-out .2s ease-in both}
@keyframes fr-fade-in{from{opacity:0}to{opacity:1}}
@keyframes fr-slide-in{from{transform:translateX(100%)}to{transform:none}}
@keyframes fr-slide-out{from{transform:none}to{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.fr-backdrop,.fr-drawer{animation:none!important}}
`;

let injected = false;
const STYLE_ID = "fold-ready-styles";

export function ensureStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const existing = document.getElementById(STYLE_ID);
  if (existing) { if (existing.textContent !== CSS) existing.textContent = CSS; return; }
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
