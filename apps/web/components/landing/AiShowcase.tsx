"use client";

import { Icon } from "@ledgerline/ui";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiNote, AiProse, RevealText } from "../app/ai/AiAction";
import { BoardCommentary } from "../app/BoardCommentary";
import { AnswerBody, Reading, ToolOverride } from "../app/chat/Message";
import { CONVERSATIONS, SEARCH, TOOLS } from "./aiSamples";

/**
 * The AI, shown with the product's own components and real answers from the live model on the sample joinery.
 * Nothing here is a picture: charts are drawn by the same renderer the chat uses.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const HOLD = 8000;
const c = (text: string, source: string) => ({ text, source, fact: source });

function SampleTools({ children }: { children: React.ReactNode }) {
  const tools = useMemo(() => Object.fromEntries(Object.entries(TOOLS).map(([name, data]) => [name, async () => data])), []);
  return <ToolOverride.Provider value={tools}>{children}</ToolOverride.Provider>;
}

/** The pill that opens the chat in the app, as it sits at the bottom of every page. */
export function AskPill() {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <a href="#ask" className="lp-pill" aria-label="See Ask Ledgerline">
      <span className="ll-ask-orb" aria-hidden />
      <span>Ask Ledgerline</span>
      <kbd>{mac ? "⌘ J" : "Ctrl J"}</kbd>
    </a>
  );
}

/** One conversation, replayed as it happened: the sources it read, the words, then the picture once complete. */
function Replay({ index, onDone }: { index: number; onDone: (index: number) => void }) {
  const convo = CONVERSATIONS[index];
  const [prose, ui] = useMemo(() => {
    const at = convo.answer.indexOf("```ui");
    return at < 0 ? [convo.answer, ""] : [convo.answer.slice(0, at).trimEnd(), convo.answer.slice(at)];
  }, [convo]);
  const [steps, setSteps] = useState(0);
  const [chars, setChars] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const done = chars >= prose.length;

  useEffect(() => {
    const timers = convo.steps.map((_, i) => setTimeout(() => setSteps(i + 1), 450 + i * 700));
    let tick: ReturnType<typeof setInterval> | undefined;
    timers.push(setTimeout(() => (tick = setInterval(() => setChars((n) => Math.min(prose.length, n + 9)), 28)), 450 + convo.steps.length * 700 + 250));
    return () => {
      timers.forEach(clearTimeout);
      if (tick) clearInterval(tick);
    };
  }, [convo, prose]);

  useEffect(() => {
    if (done) onDone(index);
  }, [done, onDone, index]);

  useEffect(() => {
    const el = scroller.current;
    if (el && !done) el.scrollTop = el.scrollHeight;
  }, [chars, steps, done]);

  const phase = done ? "done" : chars > 0 ? "writing" : steps > 0 ? "reading" : "thinking";
  return (
    <motion.div className="lp-ask-scroll" ref={scroller} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }}>
      <div className="ll-ask-thread">
        <div className="ll-ask-q">{convo.question}</div>
        <div className="ll-ask-a">
          <Reading steps={convo.steps.slice(0, steps).map(([tool, label]) => ({ tool, label }))} phase={phase} />
          {chars > 0 ? <AnswerBody content={done ? `${prose}\n\n${ui}` : prose.slice(0, chars)} live={!done} /> : null}
        </div>
      </div>
    </motion.div>
  );
}

/** Real conversations about the sample company, one after another, or the one you pick. */
export function ChatDemo() {
  const box = useRef<HTMLDivElement>(null);
  const started = useInView(box, { once: true, amount: 0.3 });
  const visible = useInView(box, { amount: 0.2 });
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [finished, setFinished] = useState(-1);
  const done = finished === index;

  useEffect(() => {
    if (!done || !auto || !visible) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % CONVERSATIONS.length), HOLD);
    return () => clearTimeout(t);
  }, [done, auto, visible]);

  return (
    <div className="lp-ask" ref={box}>
      <ol className="lp-ask-list" role="tablist" aria-label="Example questions">
        {CONVERSATIONS.map((q, i) => (
          <li key={q.question}>
            <button
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? "is-on" : undefined}
              onClick={() => {
                setAuto(false);
                setIndex(i);
              }}
            >
              <span className="lp-ask-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="lp-ask-text">{q.question}</span>
              {i === index && auto ? (
                <motion.i className="lp-ask-progress" key={`${index}-${done}`} initial={{ scaleX: 0 }} animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: done ? HOLD / 1000 : 0, ease: "linear" }} />
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      <div className="lp-ask-window">
        <div className="lp-ask-head">
          <span className="ll-ask-orb" aria-hidden />
          <div>
            <strong>Ask Ledgerline</strong>
            <span>Kestrel Joinery Ltd</span>
          </div>
        </div>
        <SampleTools>
          <AnimatePresence mode="wait">{started ? <Replay key={index} index={index} onDone={setFinished} /> : <div className="lp-ask-scroll" key="idle" />}</AnimatePresence>
        </SampleTools>
        <div className="lp-ask-composer" aria-hidden>
          <span>Ask a follow-up…</span>
          <span className="lp-ask-send">
            <Icon name="arrow-up" size={15} />
          </span>
        </div>
      </div>
    </div>
  );
}

function Where({ children }: { children: React.ReactNode }) {
  return <span className="lp-where">{children}</span>;
}

/** The AI actions, each in the state it leaves things in the app, all on the sample company's September. */
export function ActionCards() {
  return (
    <div className="lp-actions">
      <article className="lp-action">
        <header>
          <Where>Statements · click any figure</Where>
          <h3>Why is this figure what it is?</h3>
        </header>
        <div className="lp-action-body">
          <div className="lp-figure-row">
            <span>Sales: doors and joinery · Sep 2026</span>
            <strong>€132,064</strong>
          </div>
          <AiNote title="Sales: doors and joinery, Sep 2026">
            <AiProse paragraphs={[["Sales were ", c("€132,064", "Statement"), ", up ", c("171.1%", "Statement, previous month"), " on August. Two jobs for the Ó Briain residence made up ", c("€97,444", "Journal lines"), " of it, with Glenmore Developments next."]]} />
          </AiNote>
        </div>
      </article>

      <article className="lp-action">
        <header>
          <Where>Forecast · at the low point</Where>
          <h3>Why does cash dip, and what would help?</h3>
        </header>
        <div className="lp-action-body">
          <AiNote title="Why cash dips">
            <AiProse paragraphs={[["Cash reaches its low point of ", c("€187,469", "Forecast"), " in ", c("November 2026", "Forecast"), " while the business stays profitable: it is waiting on ", c("€354,822", "Trade debtors"), " from customers."]]} />
            <ul className="ll-ai-fixes">
              <li>
                <span>
                  <RevealText parts={["Chase the ", c("€140,482", "Aged debtors"), " that is already overdue, largest first."]} start={30} />
                </span>
                <span className="lp-chip">
                  Who owes you <Icon name="arrow-right" size={13} />
                </span>
              </li>
              <li>
                <span>
                  <RevealText parts={["Test a shorter debtor-days assumption than ", c("48 days", "Drivers"), "."]} start={42} />
                </span>
                <span className="lp-chip">
                  Assumptions <Icon name="arrow-right" size={13} />
                </span>
              </li>
            </ul>
          </AiNote>
        </div>
      </article>

      <article className="lp-action">
        <header>
          <Where>Profit and loss · flagged for you</Where>
          <h3>What&apos;s unusual this month?</h3>
        </header>
        <div className="lp-action-body">
          <table className="lp-mini-pnl">
            <tbody>
              {[
                ["Sales: fitted kitchens", "114,216", false],
                ["Sales: doors and joinery", "132,064", true],
                ["Timber and materials", "117,916", false],
                ["Wages and salaries", "49,262", false],
              ].map(([label, value, flag]) => (
                <tr key={label as string} className={flag ? "is-flagged" : undefined}>
                  <th>
                    {flag ? <span className="ll-fs-flag" aria-hidden /> : null}
                    {label}
                  </th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lp-tip">
            <span className="ll-ai-dot" />
            <span>About twice a typical month (€66,171). Two Ó Briain residence invoices make up most of it.</span>
          </p>
        </div>
      </article>

      <article className="lp-action">
        <header>
          <Where>Ledger · search in your own words</Where>
          <h3>Find anything without building a filter</h3>
        </header>
        <div className="lp-action-body">
          <div className="lp-search">
            <Icon name="search" size={16} />
            <span>{SEARCH.query}</span>
          </div>
          <div className="lp-search-chips">
            {["Liffey Timber Supplies", "Apr – Jun 2026", "Over €5,000"].map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
            <em>{SEARCH.count} lines</em>
          </div>
          <table className="lp-mini-ledger">
            <tbody>
              {SEARCH.rows.slice(0, 4).map((r, i) => (
                <tr key={i}>
                  <td>{new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-IE", { day: "numeric", month: "short", timeZone: "UTC" })}</td>
                  <td>{r.account}</td>
                  <td>{((r.debitCents || r.creditCents) / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

/** The board pack's commentary, as the live model wrote it for the sample company. */
export function BoardSample() {
  const commentary = {
    id: "sample",
    period: "2026-09",
    status: "accepted" as const,
    acceptedBy: "the finance lead",
    tone: "board",
    length: "standard",
    createdAt: 0,
    createdBy: null,
    editedBy: null,
    paragraphs: null,
    facts: [],
    sections: {
      headline: [
        ["September revenue was ", c("€246,281", "Sales accounts"), ", up ", c("16.9%", "Revenue, month on month"), " on the previous month."],
        ["Cash closed at ", c("€228,780", "Bank accounts"), " after a fall of ", c("€50,497", "Closing less opening cash"), " during the month."],
        ["The priority is to reduce dependence on Glenmore Developments, which represented ", c("43%", "Sales by customer"), " of recent sales."],
      ],
      performance: [["Revenue was ", c("€246,281", "Sales accounts"), ", up ", c("16.9%", "Month on month"), " on the previous month and ", c("16.9%", "Same month last year"), " on the same month last year. Doors and joinery sales recovered strongly, while fitted kitchens fell back."]],
      cash: [["Cash fell ", c("€50,497", "Cash flow"), " in a profitable month because ", c("€71,188", "Change in trade debtors"), " was tied up in what customers owe."]],
      outlook: [["The base case keeps cash positive for the whole ", c("24 months", "Base-case forecast"), ", with its lowest point at ", c("€187,469 in November 2026", "Base-case forecast"), "."]],
      risks: [
        { level: "red", title: "Customer concentration", detail: ["Glenmore Developments accounted for ", c("43%", "Sales by customer"), " of sales over the last three months."] },
        { level: "amber", title: "Collection risk", detail: ["Debtor days have risen to ", c("48 days", "Debtors ÷ revenue"), " from ", c("42 days", "Three months earlier"), "."] },
        { level: "green", title: "Liquidity headroom", detail: ["The current ratio is ", c("3.64", "Current assets ÷ current liabilities"), "."] },
      ],
      decisions: [["Approve a focused collections plan, given debtor days of ", c("48 days", "Debtors ÷ revenue"), "."]],
      questions: [{ question: ["Why did cash fall when the business made a profit?"], answer: ["Because ", c("€71,188", "Change in trade debtors"), " went into trade debtors."] }],
    },
  };
  return (
    <div className="lp-paper">
      <div className="lp-paper-head">
        <span>Board pack · September 2026</span>
        <span className="lp-paper-status">
          <Icon name="check" size={13} /> Accepted
        </span>
      </div>
      <div className="lp-paper-body">
        <BoardCommentary commentary={commentary as never} busy={null} onRedraft={() => {}} />
      </div>
    </div>
  );
}
