import { useCallback, useEffect, useRef, useState } from "react";
import { KeepPlace, Pane, SplitHost, useInputMode, useSelection, useSplit } from "fold-ready";
import { MESSAGES, type Message } from "../data";

/**
 * The product, as a real little app: a list that opens a message.
 * - SplitHost measures its own width; with a finger and ≥ 860 px it docks the Pane next to the list.
 * - useSelection keeps the open message in the URL (?sel=12), so fold / unfold / reload keep it open.
 * - KeepPlace keeps the list on the same row when the width changes.
 * - Row actions are visible for fingers and revealed on hover only for a real mouse.
 */
export function InboxApp({ keepPlace = true, homeLink = false, initialRow = null, settleMs }: { keepPlace?: boolean; homeLink?: boolean; initialRow?: string | null; settleMs?: number }) {
  const [sel, setSel] = useSelection("sel");
  const [starred, setStarred] = useState<Set<string>>(() => new Set(["3", "9"]));
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [kept, setKept] = useState<string | null>(null);
  const keptTimer = useRef<ReturnType<typeof setTimeout>>();
  const { hover, touch } = useInputMode();
  const [docked, setDocked] = useState(false);

  const open = sel ? MESSAGES.find((m) => m.id === sel) ?? null : null;

  const toggleStar = useCallback((id: string) => {
    setStarred((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const openMessage = (id: string) => {
    setSel(id);
    setRead((r) => (r.has(id) ? r : new Set(r).add(id)));
  };

  const onRestore = useCallback((info: { anchor: Element }) => {
    const row = (info.anchor as HTMLElement).closest("[data-row]") as HTMLElement | null;
    const n = row?.dataset.row;
    if (!n) return;
    setKept(`Width changed — kept your place at message ${n}`);
    clearTimeout(keptTimer.current);
    keptTimer.current = setTimeout(() => setKept(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(keptTimer.current), []);

  // Start scrolled to a given row (list only — never the page)
  useEffect(() => {
    if (!initialRow) return;
    const row = document.querySelector(`[data-row="${CSS.escape(initialRow)}"]`) as HTMLElement | null;
    const list = row?.closest(".inbox-list") as HTMLElement | null;
    if (row && list) list.scrollTop = row.offsetTop - list.offsetTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = MESSAGES.filter((m) => m.unread && !read.has(m.id)).length;

  return (
    <div className="inbox" data-hover={hover || undefined}>
      <header className="inbox-bar">
        <div className="inbox-title">
          <strong>Inbox</strong>
          <span className="inbox-count">{unread} unread</span>
        </div>
        {homeLink ? <a className="inbox-org" href="#/">fold-ready demo</a> : <span className="inbox-org">Riverside Studio</span>}
      </header>
      <SplitHost className="inbox-split" onDockChange={setDocked} settleMs={settleMs}>
        <KeepPlace as="ul" className="inbox-list" enabled={keepPlace} onRestore={onRestore} aria-label="Messages">
          {MESSAGES.map((m) => (
            <Row
              key={m.id}
              m={m}
              active={m.id === sel}
              unread={m.unread && !read.has(m.id)}
              starred={starred.has(m.id)}
              onOpen={() => openMessage(m.id)}
              onStar={() => toggleStar(m.id)}
            />
          ))}
        </KeepPlace>
        {open && (
          <Pane label={open.subject} onClose={() => setSel(null)}>
            {(close) => (
              <Detail m={open} starred={starred.has(open.id)} onStar={() => toggleStar(open.id)} onClose={close} />
            )}
          </Pane>
        )}
      </SplitHost>
      <div className="inbox-status" role="status" aria-live="polite">
        <span className="inbox-dock">
          {docked ? "Pane docked" : "Pane as drawer"}
          <span aria-hidden="true"> · </span>
          {touch ? "finger" : "mouse"}
        </span>
        {kept && <span className="inbox-kept">{kept}</span>}
      </div>
    </div>
  );
}

function Row({ m, active, unread, starred, onOpen, onStar }: {
  m: Message; active: boolean; unread: boolean; starred: boolean; onOpen: () => void; onStar: () => void;
}) {
  return (
    <li className="row" data-keep-anchor data-row={m.id} data-active={active || undefined} data-unread={unread || undefined} data-starred={starred || undefined}>
      <button type="button" className="row-main" onClick={onOpen} aria-current={active ? "true" : undefined}>
        <span className="avatar" aria-hidden="true">{m.initials}</span>
        <span className="row-text">
          <span className="row-top">
            <span className="row-from">{m.from}</span>
            <span className="row-time">{m.time}</span>
          </span>
          <span className="row-subject">{unread && <span className="dot" aria-label="Unread" />}{m.subject}</span>
          <span className="row-snippet">{m.snippet}</span>
        </span>
      </button>
      <div className="row-actions">
        <button type="button" className="icon-btn" onClick={onStar} aria-pressed={starred} aria-label={starred ? `Unstar ${m.subject}` : `Star ${m.subject}`}>
          <StarIcon filled={starred} />
        </button>
      </div>
    </li>
  );
}

function Detail({ m, starred, onStar, onClose }: { m: Message; starred: boolean; onStar: () => void; onClose: () => void }) {
  // Beside the list there is nothing to go "back" to — it closes the column
  const docked = !!useSplit()?.docked;
  return (
    <article className="detail">
      <div className="detail-bar">
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          {docked ? <><span aria-hidden="true">✕</span> Close</> : <><span aria-hidden="true">←</span> Back</>}
        </button>
        <button type="button" className="icon-btn" onClick={onStar} aria-pressed={starred} aria-label={starred ? "Unstar" : "Star"}>
          <StarIcon filled={starred} />
        </button>
      </div>
      <div className="detail-body">
        <h2 className="detail-subject">{m.subject}</h2>
        <p className="detail-meta">
          <span className="avatar" aria-hidden="true">{m.initials}</span>
          <span><strong>{m.from}</strong><br /><span className="muted">{m.time} · to the studio team</span></span>
        </p>
        {m.body.map((p, i) => <p key={i} className="detail-p">{p}</p>)}
        <div className="detail-actions">
          <button type="button" className="btn">Reply</button>
          <button type="button" className="btn btn-quiet">Forward</button>
        </div>
      </div>
    </article>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
