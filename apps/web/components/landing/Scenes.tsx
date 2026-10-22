"use client";

import { Icon } from "@ledgerline/ui";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiNote, AiProse } from "../app/ai/AiAction";
import { SEARCH } from "./aiSamples";

/**
 * Small scripted scenes for the homepage: a cursor moves, clicks, and the product answers. Each plays once when it
 * comes into view, again when it comes back, or from its replay button. With reduced motion it shows the result.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const CANCELLED = Symbol("cancelled");
const c = (text: string, source: string) => ({ text, source, fact: source });

type Point = { x: number; y: number };
type Cursor = Point & { shown: boolean; clicks: number };

/** Runs a scene's script while it is on screen, and gives it a cursor that moves between elements. */
function useScene(script: (s: { wait: (ms: number) => Promise<void>; moveTo: (el: HTMLElement | null, dx?: number, dy?: number) => Promise<void>; click: () => Promise<void>; hide: () => void }) => Promise<void>, reset: () => void) {
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { amount: 0.6 });
  const reduce = useReducedMotion();
  const [cursor, setCursor] = useState<Cursor>({ x: 0, y: 0, shown: false, clicks: 0 });
  const [state, setState] = useState<"idle" | "playing" | "done">("idle");
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (inView && !reduce) setRun((r) => r + 1);
  }, [inView, reduce]);

  useEffect(() => {
    if (!run) return;
    const timers = new Set<() => void>();
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          timers.delete(stop);
          resolve();
        }, ms);
        const stop = () => {
          clearTimeout(t);
          reject(CANCELLED);
        };
        timers.add(stop);
      });
    const moveTo = async (el: HTMLElement | null, dx = 0, dy = 0) => {
      const root = box.current;
      if (!el || !root) return;
      const a = el.getBoundingClientRect();
      const b = root.getBoundingClientRect();
      setCursor((cur) => ({ ...cur, shown: true, x: a.left - b.left + Math.min(a.width / 2, 48) + dx, y: a.top - b.top + a.height / 2 + dy }));
      await wait(760);
    };
    const click = async () => {
      setCursor((cur) => ({ ...cur, clicks: cur.clicks + 1 }));
      await wait(220);
    };
    const hide = () => setCursor((cur) => ({ ...cur, shown: false }));
    reset();
    const root = box.current;
    if (root) setCursor({ x: root.clientWidth * 0.82, y: root.clientHeight * 0.9, shown: false, clicks: 0 });
    setState("playing");
    script({ wait, moveTo, click, hide })
      .then(() => setState("done"))
      .catch((e) => {
        if (e !== CANCELLED) throw e;
      });
    return () => timers.forEach((stop) => stop());
    // The script and reset are stable for a scene; a new run is what restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return { box, cursor, state, reduce, replay: () => setRun((r) => r + 1) };
}

function Pointer({ cursor }: { cursor: Cursor }) {
  return (
    <motion.div className="lp-cursor" aria-hidden initial={false} animate={{ x: cursor.x, y: cursor.y, opacity: cursor.shown ? 1 : 0 }} transition={{ x: { duration: 0.7, ease: [0.45, 0, 0.2, 1] }, y: { duration: 0.7, ease: [0.45, 0, 0.2, 1] }, opacity: { duration: 0.25 } }}>
      <AnimatePresence>
        {cursor.clicks ? <motion.span key={cursor.clicks} className="lp-cursor-ring" initial={{ scale: 0.2, opacity: 0.7 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} /> : null}
      </AnimatePresence>
      <motion.svg key={cursor.clicks} width="18" height="22" viewBox="0 0 18 22" initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ duration: 0.18 }}>
        <path d="M1.5 1.5v16.2l4.3-4.1 2.9 6.6 3-1.3-2.9-6.5h6z" fill="#fff" stroke="#0e1613" strokeWidth="1.4" strokeLinejoin="round" />
      </motion.svg>
    </motion.div>
  );
}

function Replay({ onClick, shown }: { onClick: () => void; shown: boolean }) {
  return (
    <button type="button" className={`lp-replay${shown ? " is-shown" : ""}`} onClick={onClick} tabIndex={shown ? 0 : -1} aria-label="Play again">
      <Icon name="refresh" size={13} /> Replay
    </button>
  );
}

const CHIPS = ["Liffey Timber Supplies", "Apr – Jun 2026", "Over €5,000"];
const ROWS = SEARCH.rows.slice(0, 4);

/** Search in your own words: a sentence typed, read, turned into filters, and the matching lines. */
export function SearchScene() {
  const input = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"empty" | "typing" | "reading" | "done">("empty");
  const [chips, setChips] = useState(0);
  const [rows, setRows] = useState(0);
  const reset = useCallback(() => {
    setTyped("");
    setPhase("empty");
    setChips(0);
    setRows(0);
  }, []);
  const scene = useScene(async ({ wait, moveTo, click, hide }) => {
    await wait(300);
    await moveTo(input.current, 30);
    await click();
    setPhase("typing");
    for (let i = 1; i <= SEARCH.query.length; i++) {
      setTyped(SEARCH.query.slice(0, i));
      await wait(SEARCH.query[i - 1] === " " ? 70 : 34 + ((i * 7) % 20));
    }
    await wait(350);
    hide();
    setPhase("reading");
    await wait(1000);
    for (let i = 1; i <= CHIPS.length; i++) {
      setChips(i);
      await wait(150);
    }
    for (let i = 1; i <= ROWS.length; i++) {
      setRows(i);
      await wait(110);
    }
    setPhase("done");
  }, reset);
  const final = scene.reduce;
  const text = final ? SEARCH.query : typed;
  const shownChips = final ? CHIPS.length : chips;
  const shownRows = final ? ROWS.length : rows;
  return (
    <div className="lp-scene lp-scene-search" ref={scene.box}>
      <div className={`lp-search${phase === "typing" ? " is-focus" : ""}`} ref={input}>
        <Icon name="search" size={16} />
        <span className={text ? undefined : "is-placeholder"}>
          {text || "Search the ledger in your own words"}
          {phase === "typing" ? <i className="lp-caret" /> : null}
        </span>
        {phase === "reading" ? <span className="lp-search-reading ll-shimmer">Reading your search</span> : <kbd>↵</kbd>}
      </div>
      <div className="lp-search-chips">
        <AnimatePresence>
          {CHIPS.slice(0, shownChips).map((chip) => (
            <motion.span key={chip} initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
              {chip}
            </motion.span>
          ))}
        </AnimatePresence>
        {shownRows === ROWS.length ? (
          <motion.em initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {SEARCH.count} lines
          </motion.em>
        ) : null}
      </div>
      <table className="lp-mini-ledger">
        <tbody>
          {ROWS.map((r, i) => (
            <motion.tr key={i} initial={false} animate={{ opacity: i < shownRows ? 1 : 0, y: i < shownRows ? 0 : 6 }} transition={{ duration: 0.3, ease: EASE }}>
              <td>{new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-IE", { day: "numeric", month: "short", timeZone: "UTC" })}</td>
              <td>{r.account}</td>
              <td>{((r.debitCents || r.creditCents) / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 })}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <Pointer cursor={scene.cursor} />
      <Replay onClick={scene.replay} shown={scene.state === "done"} />
    </div>
  );
}

const PNL = [
  ["Sales: fitted kitchens", "114,216"],
  ["Sales: doors and joinery", "132,064"],
  ["Timber and materials", "(117,916)"],
] as const;

/** Explain a figure: hover a line of the statement, ask, and get the reason with its sources. */
export function ExplainScene() {
  const row = useRef<HTMLTableRowElement>(null);
  const button = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = useCallback(() => {
    setHover(false);
    setOpen(false);
    setBusy(false);
  }, []);
  const scene = useScene(async ({ wait, moveTo, click, hide }) => {
    await wait(300);
    await moveTo(row.current, 20);
    setHover(true);
    await wait(350);
    await moveTo(button.current, -8);
    await click();
    setOpen(true);
    setBusy(true);
    await wait(250);
    hide();
    await wait(1300);
    setBusy(false);
  }, reset);
  const final = scene.reduce;
  return (
    <div className="lp-scene lp-scene-explain" ref={scene.box}>
      <table className="lp-mini-pnl">
        <tbody>
          {PNL.map(([label, value], i) => (
            <tr key={label} ref={i === 1 ? row : undefined} className={i === 1 && (hover || open || final) ? "is-hot" : undefined}>
              <th>{label}</th>
              <td>
                {i === 1 ? (
                  <span ref={button} className={`lp-explain-btn${hover || open || final ? " is-shown" : ""}`}>
                    <Icon name="sparkle" size={12} /> Explain
                  </span>
                ) : null}
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AnimatePresence>
        {open || final ? (
          <AiNote key="note" title="Sales: doors and joinery, Sep 2026" busy={busy && !final} steps={["Reading 3 journal lines"]}>
            <AiProse paragraphs={[["Up ", c("171.1%", "Statement, previous month"), " on August. Two jobs for the Ó Briain residence made up ", c("€97,444", "Journal lines"), " of it."]]} />
          </AiNote>
        ) : null}
      </AnimatePresence>
      <Pointer cursor={scene.cursor} />
      <Replay onClick={scene.replay} shown={scene.state === "done"} />
    </div>
  );
}

/** Unusual movements: no clicking, the flag and its note are already there. */
export function UnusualStill() {
  return (
    <div className="lp-scene-still">
      <div className="lp-flag-line">
        <span>
          <span className="ll-fs-flag" aria-hidden /> Sales: doors and joinery
        </span>
        <span>132,064</span>
      </div>
      <p className="lp-tip">
        <span className="ll-ai-dot" />
        <span>About twice a typical month (€66,171). Two Ó&nbsp;Briain residence invoices make up most of it.</span>
      </p>
    </div>
  );
}
