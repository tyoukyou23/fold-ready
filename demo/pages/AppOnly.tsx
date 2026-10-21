import { InboxApp } from "../components/InboxApp";

/** `#/app` — the demo inbox filling the whole viewport, for Duo Lab frames and real devices. */
export function AppOnly() {
  // `?row=12` starts the list scrolled to message 12 (Duo Lab uses it so Unfold has a place to keep)
  const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const row = q?.get("row") ?? null;
  // `?settle=0` turns off SplitHost's settle wait — Duo Lab's fold simulation uses it to show the flash
  const settle = q?.get("settle");
  return (
    <div className="app-only">
      <InboxApp homeLink initialRow={row} settleMs={settle != null ? Number(settle) : undefined} />
    </div>
  );
}
