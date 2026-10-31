"use client";

import { Icon } from "@ledgerline/ui";
import { m as motion, useInView } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CONVERSATIONS, TOOLS } from "./aiSamples";

// The replay uses the chat's renderer, the heaviest code on the page; it loads when the demo is about to be seen.
const ReplayStage = dynamic(() => import("./AiReplay"), { ssr: false, loading: () => <div className="lp-ask-scroll" /> });

/**
 * The AI, shown with the product's own components and real answers from the live model on the sample joinery.
 * Nothing here is a picture: charts are drawn by the same renderer the chat uses.
 */

const HOLD = 8000;

/** Real conversations about the sample company, one after another, or the one you pick. */
export function ChatDemo({ children }: { children?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, { once: true, margin: "600px 0px" });
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
        {near && started ? <ReplayStage index={index} onDone={setFinished} /> : <div className="lp-ask-scroll" />}
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

/**
 * The Ask panel as it sits open beside the overview: one question about the chart next to it, answered. Written out
 * with the chat's own classes rather than run through the renderer, so the hero needs none of the chat's code.
 */
export function HeroChat() {
  const overview = TOOLS.company_overview;
  const forecast = TOOLS.forecast;
  return (
    <div className="lp-hero-chat" aria-label="Ask Ledgerline, answering a question about the chart">
      <div className="lp-hero-chat-head">
        <span className="ll-ask-orb" aria-hidden />
        <strong>Ask Ledgerline</strong>
      </div>
      <div className="ll-ask-q">How is cash looking?</div>
      <div className="ll-chat-answer">
        <div className="ll-chat-prose">
          <p>
            <span>Cash isn&apos;t an immediate worry. It dips to its low point in </span>
            <strong>November</strong>
            <span>, then rebuilds; collections are the lever to watch.</span>
          </p>
        </div>
        <div className="ll-chat-ui">
          <div className="ll-chat-ui-stage is-ready">
            <div className="ll-chat-ui-real is-ready">
              <div className="ll-chat-stack">
                <div className="ll-chat-row">
                  <HeroKpi label="Cash now" value={overview.cash} />
                  <HeroKpi label="Lowest forecast" value={forecast.lowestCash} note={forecast.lowestMonth} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function HeroKpi({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="ll-chat-kpi ll-chat-in">
      <span className="ll-chat-kpi-label">{label}</span>
      <span className="ll-chat-kpi-value">{euro.format(value)}</span>
      {note ? <span className="ll-chat-kpi-note">{note}</span> : null}
    </div>
  );
}
