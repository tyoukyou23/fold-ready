/**
 * Should the side navigation start collapsed?
 *
 * If the user has toggled it on this device, respect that. Otherwise collapse it only on wide
 * *touch* screens (iPad, unfolded iPhone Duo), where those 220 px are better spent on content.
 * Mouse users keep what they had.
 *
 *   const [hidden, setHidden] = useState(false);
 *   useEffect(() => setHidden(initialSidebarHidden("app:sidebar")), []);
 *   const toggle = () => setHidden((h) => { rememberSidebarHidden("app:sidebar", !h); return !h; });
 */
import { TOUCH_QUERY } from "./media";

export function initialSidebarHidden(storageKey: string): boolean {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved != null) return saved === "1";
    return !!window.matchMedia?.(TOUCH_QUERY).matches;
  } catch {
    return false;
  }
}

export function rememberSidebarHidden(storageKey: string, hidden: boolean): void {
  try { localStorage.setItem(storageKey, hidden ? "1" : "0"); } catch { /* private mode */ }
}
