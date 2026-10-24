"use client";

import { AiOrb, Icon, IconButton } from "@ledgerline/ui";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Citation, Prose } from "@/convex/commentary";
import { errorText } from "../BoardCommentary";

/**
 * The shared look and motion of AI actions, the same language as the chat: a quiet sparkle button; while it
 * works, a breathing mark and a status line that says what it's doing; then the answer card grows open and the
 * words write themselves in.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const DEFAULT_STEPS = ["Reading your figures", "Comparing the months", "Writing it up"];

export function AiButton({ children, onClick, busy, size = "md", title }: { children: ReactNode; onClick: () => void; busy?: boolean; size?: "sm" | "md"; title?: string }) {
  return (
    <motion.button
      type="button"
      layout
      className={`ll-ai-btn is-${size}${busy ? " is-busy" : ""}`}
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-busy={busy}
      whileTap={busy ? undefined : { scale: 0.97 }}
      transition={{ layout: { duration: 0.25, ease: EASE } }}
    >
      <AiOrb size={size === "sm" ? 18 : 20} busy={busy} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={busy ? "busy" : "idle"} className={busy ? "ll-shimmer" : undefined} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
          {busy ? "Working on it" : children}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** A status line that steps through what the action is doing while it waits. */
export function Thinking({ steps = DEFAULT_STEPS }: { steps?: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), 1600);
    return () => clearInterval(timer);
  }, [steps.length]);
  return (
    <div className="ll-ai-thinking" role="status">
      <span className="ll-ai-thinking-mark" aria-hidden>
        <AiOrb size={14} busy />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={index} className="ll-shimmer" initial={{ opacity: 0, y: 6, filter: "blur(2px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, filter: "blur(2px)" }} transition={{ duration: 0.28, ease: EASE }}>
          {steps[index]}
        </motion.span>
      </AnimatePresence>
      <span className="ll-ai-thinking-lines" aria-hidden>
        <i />
        <i />
      </span>
    </div>
  );
}

/** The month's allowance ran out: the answer shown is the last one, and new ones wait for the reset. */
export function Paused({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="ll-ai-paused" role="status">
      <Icon name="clock" size={13} />
      <span>{text}</span>
    </p>
  );
}

export function AiNote({ title, children, onClose, footer, busy, error, notice, steps }: { title: string; children?: ReactNode; onClose?: () => void; footer?: ReactNode; busy?: boolean; error?: string | null; notice?: string | null; steps?: string[] }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className="ll-ai-note"
      aria-live="polite"
      initial={reduce ? false : { opacity: 0, height: 0, y: -4 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      style={{ overflow: "hidden" }}
    >
      <div className="ll-ai-note-inner">
        <header>
          <span className="ll-ai-note-title">
            <AiOrb size={13} busy={busy} /> {title}
          </span>
          {onClose ? <IconButton icon="close" label="Close" size="sm" onClick={onClose} /> : null}
        </header>
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.p key="error" className="ll-ai-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {error}
            </motion.p>
          ) : busy ? (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
              <Thinking steps={steps} />
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <Paused text={notice ?? null} />
              {children}
            </motion.div>
          )}
        </AnimatePresence>
        {footer && !busy && !error ? <motion.footer initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.25 }}>{footer}</motion.footer> : null}
      </div>
    </motion.section>
  );
}

const isCitation = (p: string | Citation): p is Citation => typeof p !== "string";

/**
 * Cited prose that writes itself in: each word fades up a few milliseconds after the last, figures included.
 * `start` offsets the first word, so several paragraphs read as one continuous hand.
 */
export function RevealText({ parts, start = 0 }: { parts: Prose; start?: number }) {
  let n = start;
  const delay = () => `${Math.min(n++ * 18, 1400)}ms`;
  return (
    <>
      {parts.map((part, i) =>
        isCitation(part) ? (
          <button key={i} type="button" className="ll-cite ll-reveal" title={part.source} style={{ animationDelay: delay() }}>
            {part.text}
          </button>
        ) : (
          <span key={i}>
            {part.split(/([ \t\n]+)/).map((w, j) =>
              /^\s+$/.test(w) || !w ? (
                w
              ) : (
                <span key={j} className="ll-reveal" style={{ animationDelay: delay() }}>
                  {w}
                </span>
              ),
            )}
          </span>
        ),
      )}
    </>
  );
}

const words = (parts: Prose) => parts.reduce((n, p) => n + (typeof p === "string" ? p.split(/[ \t\n]+/).filter(Boolean).length : 1), 0);

export function AiProse({ paragraphs }: { paragraphs: Prose[] }) {
  let start = 0;
  return (
    <div className="ll-ai-prose">
      {paragraphs.map((p, i) => {
        const from = start;
        start += words(p);
        return (
          <p key={i}>
            <RevealText parts={p} start={from} />
          </p>
        );
      })}
    </div>
  );
}

export const plainText = (parts: Prose) => parts.map((p) => (typeof p === "string" ? p : p.text)).join("");

/** The server's "allowance used" answer: its message, and the last answer kept for the same question. */
const limitOf = (err: unknown) => {
  if (!(err instanceof ConvexError) || typeof err.data !== "object" || err.data?.code !== "limit") return null;
  return err.data as { message: string; last?: unknown };
};

/**
 * Run an action once on demand, keeping its answer, error and progress. When the month's AI actions have run
 * out, the last answer stays on screen (this one, or the one the server kept) with a note that new ones are paused.
 */
export function useAi<A, R>(fn: (args: A) => Promise<R>) {
  const [data, setDataState] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const live = useRef(0);
  const shown = useRef<R | null>(null);
  const asked = useRef<string | null>(null);
  const setData = useCallback((next: R | null) => {
    shown.current = next;
    setDataState(next);
  }, []);
  const run = useCallback(
    async (args: A) => {
      const ticket = ++live.current;
      setOpen(true);
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const result = await fn(args);
        if (ticket === live.current) {
          setData(result);
          asked.current = JSON.stringify(args);
        }
        return result;
      } catch (err) {
        if (ticket !== live.current) return null;
        const limit = limitOf(err);
        // The server's kept answer for this question, or the one on screen if it answered these same arguments.
        const last = (limit?.last as R | undefined) ?? (asked.current === JSON.stringify(args) ? shown.current : null);
        if (limit && last) {
          setData(last);
          setNotice(limit.message);
          return last;
        }
        setError(errorText(err, "That didn't work. Try again."));
        return null;
      } finally {
        if (ticket === live.current) setBusy(false);
      }
    },
    [fn, setData],
  );
  const close = useCallback(() => {
    live.current++;
    setOpen(false);
    setBusy(false);
    setError(null);
    setNotice(null);
  }, []);
  return { run, data, error, notice, busy, open, close, setData };
}
