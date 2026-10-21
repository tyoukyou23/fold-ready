import { useState } from "react";

/** A code block with a copy button. No highlighter — the code is short and the page stays light. */
export function Code({ children, lang }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const text = children.replace(/^\n+|\s+$/g, "");
  const copy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="code">
      <div className="code-head">
        <span className="code-lang">{lang ?? ""}</span>
        <button type="button" className="code-copy" onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre><code>{text}</code></pre>
    </div>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the textarea fallback (iframes, http) */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
