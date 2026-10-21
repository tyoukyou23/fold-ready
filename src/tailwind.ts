/**
 * Tailwind CSS v3 plugin: `can-hover:`, `touch:`, `short:` variants.
 *
 *   // tailwind.config.js
 *   const foldReady = require("fold-ready/tailwind").default;
 *   module.exports = { plugins: [foldReady] };
 *
 *   <button class="opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100">…</button>
 *
 * Hide hover-revealed controls with `can-hover:` — never with a width prefix like `sm:`.
 * Width says nothing about hover: an unfolded iPhone Duo is 951 px wide and has none.
 *
 * Tailwind v4 (CSS-first) — import the same variants from CSS instead:
 *   @import "fold-ready/tailwind.css";
 * (../tailwind.css; tests/tailwind.test.ts keeps it in sync with VARIANTS below.)
 */
type AddVariant = (name: string, definition: string) => void;

export const VARIANTS: Record<string, string> = {
  "can-hover": "@media (hover: hover) and (pointer: fine)",
  touch: "@media (pointer: coarse)",
  short: "@media (max-height: 600px)",
};

const foldReady = ({ addVariant }: { addVariant: AddVariant }) => {
  for (const [name, def] of Object.entries(VARIANTS)) addVariant(name, def);
};

export default foldReady;
