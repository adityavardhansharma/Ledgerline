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
const c = (text: string, source: string) => ({ text, source, fact: source });

function SampleTools({ children }: { children: React.ReactNode }) {
  const tools = useMemo(() => Object.fromEntries(Object.entries(TOOLS).map(([name, data]) => [name, async () => data])), []);
  return <ToolOverride.Provider value={tools}>{children}</ToolOverride.Provider>;
}

/** A finished exchange, small enough to float over the hero's app window. */
export function HeroChat() {
  const answer = "Cash isn't an immediate worry. It dips to its low point in **November**, then rebuilds; collections are the lever to watch.";
  const ui = `\`\`\`ui
root = Stack([tiles])
o = Query("company_overview", {}, {cash: 0})
f = Query("forecast", {}, {lowestCash: 0, lowestMonth: ""})
tiles = Row([Kpi("Cash now", o.cash, "money"), Kpi("Lowest forecast", f.lowestCash, "money", f.lowestMonth)])
\`\`\``;
  return (
    <SampleTools>
      <div className="lp-hero-chat" aria-label="Ask Ledgerline, answering a question">
        <div className="lp-hero-chat-head">
          <span className="ll-ask-orb" aria-hidden />
          <strong>Ask Ledgerline</strong>
        </div>
        <div className="ll-ask-q">How is cash looking?</div>
        <AnswerBody content={`${answer}\n\n${ui}`} live={false} />
      </div>
    </SampleTools>
  );
}

/** Real conversations replayed as they happened: reading the books, then words, then the picture. */
export function ChatDemo() {
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const visible = useInView(box, { amount: 0.35 });
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [steps, setSteps] = useState(0);
  const [chars, setChars] = useState(0);
  const convo = CONVERSATIONS[index];
  const done = chars >= convo.answer.length;

  useEffect(() => {
    if (!visible) return;
    setSteps(0);
    setChars(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    convo.steps.forEach((_, i) => timers.push(setTimeout(() => setSteps(i + 1), 500 + i * 750)));
    const start = 500 + convo.steps.length * 750 + 300;
    let tick: ReturnType<typeof setInterval> | undefined;
    timers.push(
      setTimeout(() => {
        tick = setInterval(() => setChars((n) => Math.min(convo.answer.length, n + 14)), 32);
      }, start),
    );
    return () => {
      timers.forEach(clearTimeout);
      if (tick) clearInterval(tick);
    };
  }, [index, visible, convo]);

  useEffect(() => {
    if (!done || !auto || !visible) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % CONVERSATIONS.length), 7000);
    return () => clearTimeout(t);
  }, [done, auto, visible]);

  useEffect(() => {
    const el = scroller.current;
    if (el && !done) el.scrollTop = el.scrollHeight;
  }, [chars, steps, done]);

  const phase = chars > 0 ? "writing" : steps > 0 ? "reading" : "thinking";
  return (
    <div className="lp-chatdemo" ref={box}>
      <div className="lp-chatdemo-tabs" role="tablist" aria-label="Example questions">
        {CONVERSATIONS.map((q, i) => (
          <button
            key={q.question}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={i === index ? "is-on" : undefined}
            onClick={() => {
              setAuto(false);
              setIndex(i);
            }}
          >
            {q.question}
            {i === index && auto ? <motion.i className="lp-chatdemo-progress" key={`${index}-${done}`} initial={{ scaleX: 0 }} animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: done ? 7 : 0, ease: "linear" }} /> : null}
          </button>
        ))}
      </div>
      <div className="lp-chatdemo-panel">
        <div className="ll-ask-head">
          <span className="ll-ask-orb" aria-hidden style={{ width: 22, height: 22, marginLeft: 6 }} />
          <div className="ll-ask-title">
            <strong>Ask Ledgerline</strong>
            <span>Kestrel Joinery Ltd · sample company</span>
          </div>
        </div>
        <SampleTools>
          <div className="lp-chatdemo-scroll" ref={scroller}>
            <AnimatePresence mode="wait">
              <motion.div key={index} className="ll-ask-thread" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
                <div className="ll-ask-q">{convo.question}</div>
                <div className="ll-ask-a">
                  <Reading steps={convo.steps.slice(0, Math.max(steps, 0)).map(([tool, label]) => ({ tool, label }))} phase={done ? "done" : phase} />
                  {chars > 0 ? <AnswerBody content={convo.answer.slice(0, chars)} live={!done} /> : null}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </SampleTools>
        <div className="ll-ask-composer lp-chatdemo-composer" aria-hidden>
          <span>Ask a follow-up…</span>
          <span className="ll-ask-send">
            <Icon name="arrow-up" size={16} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Each AI action, in the state it leaves things in the app. */
export function ActionGallery() {
  return (
    <div className="lp-bento lp-ai-bento">
      <div className="lp-cell lp-c-3">
        <span className="lp-ai-where">Statements · click any figure</span>
        <h3>Why is this figure what it is?</h3>
        <div className="lp-mini-drawer">
          <div className="lp-mini-drawer-head">
            <span>Sales: doors and joinery · September 2026</span>
            <strong>€141,547</strong>
          </div>
          <AiNote title="Sales: doors and joinery, Sep 2026">
            <AiProse paragraphs={[["Sales for doors and joinery were ", c("€141,547", "Statement"), ", up ", c("541.8%", "Statement, previous month"), " on the previous month. The largest transactions came from Riverside Dental, M. Kavanagh and Hollybank Nursing Home."]]} />
          </AiNote>
        </div>
      </div>
      <div className="lp-cell lp-c-3 no-r">
        <span className="lp-ai-where">Forecast · under the cash warning</span>
        <h3>Why does cash dip, and how do I fix it?</h3>
        <AiNote title="Why cash dips">
          <AiProse paragraphs={[["Cash falls to its low point in ", c("June 2027", "Forecast"), " at ", c("−€13,695", "Forecast"), " after trading uses ", c("€447,794", "Forecast cash flow"), " and repayments to lenders take ", c("€12,000", "Forecast cash flow"), "."]]} />
          <ul className="ll-ai-fixes">
            <li>
              <span>
                <RevealText parts={["Test a lower debtor-days assumption than ", c("46 days", "Drivers"), ", using what customers actually pay."]} start={30} />
              </span>
              <span className="lp-fake-btn">Assumptions <Icon name="arrow-right" size={13} /></span>
            </li>
            <li>
              <span>
                <RevealText parts={["Add a loan or equity before the low point, sized to cover the gap."]} start={42} />
              </span>
              <span className="lp-fake-btn">Financing <Icon name="arrow-right" size={13} /></span>
            </li>
          </ul>
        </AiNote>
      </div>
      <div className="lp-cell lp-c-2">
        <span className="lp-ai-where">Forecast · drivers</span>
        <h3>Plan in a sentence</h3>
        <div className="ll-composer">
          <div className="ll-composer-box">
            <p className="lp-composer-text">Hire two fitters in March at 42k each, buy a van in June for 38k and take a 50k loan in May.</p>
          </div>
          <div className="ll-composer-result">
            <ul>
              {[
                ["Hire 2 × fitters from Mar 2027", "€42,000 a year each"],
                ["Equipment: van, Jun 2027", "€38,000"],
                ["Loan drawn, May 2027", "€50,000"],
              ].map(([text, value], i) => (
                <li key={text} className="ll-reveal" style={{ animationDelay: `${i * 90}ms` }}>
                  <label>
                    <input type="checkbox" checked readOnly tabIndex={-1} />
                    <span>{text}</span>
                    <strong>{value}</strong>
                  </label>
                </li>
              ))}
            </ul>
            <div className="ll-composer-actions">
              <span className="lp-fake-btn is-primary">
                <Icon name="check" size={13} /> Add 3 to scenario
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="lp-cell lp-c-2">
        <span className="lp-ai-where">Profit and loss · flagged cells</span>
        <h3>Unusual movements, spotted for you</h3>
        <table className="lp-mini-pnl">
          <tbody>
            {[
              ["Sales: fitted kitchens", "€94,300", false],
              ["Sales: doors and joinery", "€141,547", true],
              ["Timber and materials", "€108,243", false],
              ["Wages and salaries", "€49,200", false],
            ].map(([label, value, flag]) => (
              <tr key={label as string}>
                <th>{label}</th>
                <td>
                  {flag ? <span className="ll-fs-flag" aria-hidden /> : null} {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="lp-ai-tip">
          <span className="ll-ai-dot" /> Sales were up from €31,131 in a typical month to €141,547, with Riverside Dental the largest posting at €43,078.
        </p>
      </div>
      <div className="lp-cell lp-c-2 no-r">
        <span className="lp-ai-where">Forecast · one click</span>
        <h3>A downside case from your own history</h3>
        <ul className="ll-ai-changes">
          <li>
            <div>
              <strong>Gross margin</strong>
              <span className="ll-mono">42.1% → 39.6%</span>
            </div>
            <p>Matches the lowest monthly margin in the last year.</p>
          </li>
          <li>
            <div>
              <strong>Overheads growth a year</strong>
              <span className="ll-mono">4.0% → 7.0%</span>
            </div>
            <p>Assumes costs rise faster than planned.</p>
          </li>
        </ul>
      </div>
      <div className="lp-cell lp-c-6 no-r no-b">
        <span className="lp-ai-where">Ledger · search in your own words</span>
        <h3>Find anything without building a filter</h3>
        <div className="ll-lsearch">
          <div className="ll-lsearch-bar">
            <Icon name="search" size={18} />
            <span className="lp-search-text">{SEARCH.query}</span>
          </div>
          <div className="ll-lsearch-chips">
            {["Liffey Timber", "1 Apr 2026 – 30 Jun 2026", "Over €5,000"].map((chip) => (
              <span key={chip} className="ll-lsearch-chip">
                {chip}
                <Icon name="close" size={12} />
              </span>
            ))}
          </div>
          <div className="ll-table-wrap">
            <table className="ll-table ll-ledger">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th className="is-num">Debit</th>
                  <th className="is-num">Credit</th>
                </tr>
              </thead>
              <tbody>
                {SEARCH.rows.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    <td className="ll-nowrap">{new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</td>
                    <td className="ll-nowrap">
                      <span className="ll-fs-code">{r.code}</span> {r.account}
                    </td>
                    <td className="ll-desc">{r.description}</td>
                    <td className="is-num">{r.debitCents ? (r.debitCents / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 }) : ""}</td>
                    <td className="is-num">{r.creditCents ? (r.creditCents / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 }) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
    <div className="lp-board-sample">
      <BoardCommentary commentary={commentary as never} busy={null} onRedraft={() => {}} />
    </div>
  );
}
