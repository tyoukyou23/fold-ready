import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { FoldReadyInspector, ToolbarTint, useMediaQuery } from "fold-ready";
import "./styles.css";
import { useRoute } from "./router";
import { Home } from "./pages/Home";
import { Lab } from "./pages/Lab";
import { Measure } from "./pages/Measure";
import { Docs } from "./pages/Docs";
import { AppOnly } from "./pages/AppOnly";

const GITHUB = "https://github.com/tyoukyou23/fold-ready";

const NAV = [
  { page: "", label: "Home" },
  { page: "lab", label: "Duo Lab" },
  { page: "measure", label: "Measure" },
  { page: "docs", label: "API" },
];

const TITLES: Record<string, string> = {
  "": "fold-ready — web apps that work on foldables",
  lab: "Duo Lab · fold-ready",
  measure: "Measure your device · fold-ready",
  docs: "API · fold-ready",
  app: "Inbox · fold-ready demo",
};

function App() {
  const { page, sub } = useRoute();
  const known = page in TITLES ? page : "";

  useEffect(() => { document.title = TITLES[known]; }, [known]);
  // New page → top. (Docs scrolls to its own section.)
  useEffect(() => { if (known !== "docs" || !sub) window.scrollTo(0, 0); }, [known, sub]);

  // --head-h = height of the pinned header (0 when it isn't pinned: short screens), so sticky
  // things below it (the API table of contents) and anchor jumps clear it.
  useEffect(() => {
    const head = document.querySelector(".site-head") as HTMLElement | null;
    if (!head) return undefined;
    const write = () => {
      const pinned = getComputedStyle(head).position === "sticky";
      document.documentElement.style.setProperty("--head-h", `${pinned ? Math.round(head.getBoundingClientRect().height) : 0}px`);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(head);
    window.addEventListener("resize", write);
    return () => { ro.disconnect(); window.removeEventListener("resize", write); };
  }, [known]);

  const dark = useMediaQuery("(prefers-color-scheme: dark)");
  // Inside Duo Lab's frames the round Inspector button would cover the page being previewed.
  const framed = typeof window !== "undefined" && window.self !== window.top;
  // Folded iPhone Duo: Safari's right-hand column samples the page's right edge. Match the page.
  const tint = <ToolbarTint color={dark ? "#141416" : "#f7f6f3"} />;

  if (known === "app") return <>{tint}<AppOnly />{!framed && <FoldReadyInspector position="bottom-right" />}</>;

  return (
    <div className="site">
      {tint}
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <header className="site-head">
        <a className="brand" href="#/" aria-label="fold-ready home">
          <Logo />
          <span>fold-ready</span>
        </a>
        <nav aria-label="Main">
          <ul className="nav">
            {NAV.map((n) => (
              <li key={n.page}>
                <a href={`#/${n.page}`} aria-current={known === n.page ? "page" : undefined}>{n.label}</a>
              </li>
            ))}
            <li><a href={GITHUB} className="nav-gh">GitHub</a></li>
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {known === "" && <Home />}
        {known === "lab" && <Lab />}
        {known === "measure" && <Measure />}
        {known === "docs" && <Docs section={sub} />}
      </main>
      <footer className="site-foot">
        <span>MIT</span>
        <span aria-hidden="true">·</span>
        <a href={GITHUB}>GitHub</a>
        <span aria-hidden="true">·</span>
        <span>Measurements from the iPhone Duo simulator (Xcode 27.1), 2026-10-21 — hardware check coming</span>
      </footer>
      {!framed && <FoldReadyInspector />}
    </div>
  );
}

export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" className="logo">
      <rect x="3" y="5" width="12" height="22" rx="2" fill="currentColor" />
      <rect x="17" y="5" width="12" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
