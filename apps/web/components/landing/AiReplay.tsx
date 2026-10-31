"use client";

import { AnimatePresence, m as motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnswerBody, Reading, ToolOverride } from "../app/chat/Message";
import { CONVERSATIONS, TOOLS } from "./aiSamples";

/**
 * The chat demo's replay, drawn by the same renderer the chat uses. Loaded only once the demo scrolls into view,
 * so the renderer isn't part of the landing page's first load.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function SampleTools({ children }: { children: React.ReactNode }) {
  const tools = useMemo(() => Object.fromEntries(Object.entries(TOOLS).map(([name, data]) => [name, () => new Promise((r) => setTimeout(() => r(data), 900))])), []);
  return <ToolOverride.Provider value={tools}>{children}</ToolOverride.Provider>;
}

/** The replay area: the picked conversation, swapped when another is chosen. */
export default function ReplayStage({ index, onDone }: { index: number; onDone: (index: number) => void }) {
  return (
    <SampleTools>
      <AnimatePresence mode="wait">
        <Replay key={index} index={index} onDone={onDone} />
      </AnimatePresence>
    </SampleTools>
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

