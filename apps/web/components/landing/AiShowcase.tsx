"use client";

import { Icon } from "@ledgerline/ui";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnswerBody, Reading, ToolOverride } from "../app/chat/Message";
import { CONVERSATIONS, TOOLS } from "./aiSamples";

/**
 * The AI, shown with the product's own components and real answers from the live model on the sample joinery.
 * Nothing here is a picture: charts are drawn by the same renderer the chat uses.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const HOLD = 8000;

function SampleTools({ children }: { children: React.ReactNode }) {
  const tools = useMemo(() => Object.fromEntries(Object.entries(TOOLS).map(([name, data]) => [name, () => new Promise((r) => setTimeout(() => r(data), 900))])), []);
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
  // The words stream, then the visual is written (quicker, as it isn't read) while a line says it's being made.
  const total = prose.length + (ui ? ui.length + 2 : 0);
  const done = chars >= total;

  useEffect(() => {
    const timers = convo.steps.map((_, i) => setTimeout(() => setSteps(i + 1), 450 + i * 700));
    let tick: ReturnType<typeof setInterval> | undefined;
    timers.push(setTimeout(() => (tick = setInterval(() => setChars((n) => Math.min(total, n + (n < prose.length ? 9 : 14))), 28)), 450 + convo.steps.length * 700 + 250));
    return () => {
      timers.forEach(clearTimeout);
      if (tick) clearInterval(tick);
    };
  }, [convo, prose, total]);

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
          {chars > 0 ? <AnswerBody content={chars <= prose.length ? prose.slice(0, chars) : `${prose}\n\n${ui.slice(0, chars - prose.length - 2)}`} live={!done} /> : null}
        </div>
      </div>
    </motion.div>
  );
}

/** Real conversations about the sample company, one after another, or the one you pick. */
export function ChatDemo({ children }: { children?: React.ReactNode }) {
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
      <div className="lp-ask-side">
      {children}
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
              <span className="lp-ask-text">{q.question}</span>
              <Icon name="arrow-right" size={14} />
              {i === index && auto ? (
                <motion.i className="lp-ask-progress" key={`${index}-${done}`} initial={{ scaleX: 0 }} animate={{ scaleX: done ? 1 : 0 }} transition={{ duration: done ? HOLD / 1000 : 0, ease: "linear" }} />
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      </div>
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

/** The Ask panel as it sits open beside the overview: one question about the chart next to it, answered. */
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
      <div className="lp-hero-chat" aria-label="Ask Ledgerline, answering a question about the chart">
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
