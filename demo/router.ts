import { useEffect, useState } from "react";

/** Hash routing (GitHub Pages is static): `#/lab`, `#/docs/keep-place`. */
export interface Route { page: string; sub: string }

function parse(): Route {
  const h = typeof window === "undefined" ? "" : window.location.hash;
  const [page = "", sub = ""] = h.replace(/^#\/?/, "").split("/");
  return { page, sub };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/** URL of this demo's own page (keeps the path, drops query + hash), for Duo Lab's default. */
export function selfUrl(hash = "#/", simulate = true, extraQuery = ""): string {
  const { origin, pathname } = window.location;
  const q = [simulate ? "fr-simulate=touch" : "", extraQuery].filter(Boolean).join("&");
  return `${origin}${pathname}${q ? `?${q}` : ""}${hash}`;
}
