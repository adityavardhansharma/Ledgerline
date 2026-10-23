"use client";

import { Icon } from "@ledgerline/ui";
import { Renderer } from "@openuidev/react-lang";
import { useConvex } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { CHAT_TOOLS } from "@/convex/lib/chatSpec";
import { chatLibrary, Prose } from "./library";

type Segment = { kind: "text"; text: string } | { kind: "ui"; code: string; open: boolean };

/** Split an answer into prose and ```ui blocks. A block still streaming is returned open. */
export function segments(content: string): Segment[] {
  const out: Segment[] = [];
  const fence = /```(?:ui|openui|openui-lang)?[^\n]*\n([\s\S]*?)(```|$)/g;
  let last = 0;
  for (let m = fence.exec(content); m; m = fence.exec(content)) {
    const before = content.slice(last, m.index);
    if (before.trim()) out.push({ kind: "text", text: before.trim() });
    out.push({ kind: "ui", code: m[1], open: m[2] !== "```" });
    last = m.index + m[0].length;
    if (m[2] !== "```") break;
  }
  const rest = content.slice(last);
  // A fence just starting ("``" or "```u") shouldn't flash as text.
  const tail = rest.replace(/`{1,3}[a-z-]*$/, "");
  if (tail.trim()) out.push({ kind: "text", text: tail.trim() });
  return out;
}

/**
 * Small models sometimes give a Query and the component built from it the same name ("cash = Query(...)" then
 * "cash = cashChart"), which makes the chart point at itself and never load. Rename the Query and the member
 * accesses that read it ("cash.rows"), leaving plain references to the component as they are.
 */
export function repairProgram(code: string): string {
  const lines = code.split("\n");
  const defs = new Map<string, number[]>();
  lines.forEach((line, i) => {
    const m = /^\s*([A-Za-z_][\w]*)\s*=/.exec(line);
    if (m && !line.trimStart().startsWith("$")) defs.set(m[1], [...(defs.get(m[1]) ?? []), i]);
  });
  let out = lines;
  for (const [name, at] of defs) {
    if (at.length < 2) continue;
    const queryLine = at.find((i) => /=\s*Query\(/.test(out[i]));
    if (queryLine === undefined) continue;
    const renamed = `${name}Data`;
    out = out.map((line, i) => {
      if (i === queryLine) return line.replace(new RegExp(`^(\\s*)${name}(\\s*=)`), `$1${renamed}$2`);
      return line.replace(new RegExp(`\\b${name}\\.`, "g"), `${renamed}.`);
    });
  }
  return out.join("\n");
}

/** Lets a preview or test supply tool results instead of Convex. */
export const ToolOverride = createContext<Record<string, (args: Record<string, unknown>) => Promise<unknown>> | null>(null);

/** Charts and tiles in an answer fetch their figures from the same Convex queries the model read. */
function useToolProvider() {
  const convex = useConvex();
  const override = useContext(ToolOverride);
  return useMemo(() => {
    if (override) return override;
    const tools = api.chatTools as unknown as Record<string, Parameters<typeof convex.query>[0]>;
    return Object.fromEntries(CHAT_TOOLS.map((t) => [t.name, (args: Record<string, unknown>) => convex.query(tools[t.name], (args ?? {}) as never)]));
  }, [convex, override]);
}

const UiBlock = memo(function UiBlock({ code, live }: { code: string; live: boolean }) {
  const tools = useToolProvider();
  const program = repairProgram(code);
  // The renderer parses as text arrives and expects it only to grow; if it is ever replaced, start a fresh parse.
  const last = useRef({ program: "", generation: 0 });
  if (!program.startsWith(last.current.program)) last.current.generation += 1;
  last.current.program = program;
  return (
    <motion.div className="ll-chat-ui" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <Renderer key={last.current.generation} response={program} library={chatLibrary} isStreaming={live} toolProvider={tools as never} queryLoader={<span className="ll-chat-loading" aria-label="Loading figures" />} />
    </motion.div>
  );
});

export function AnswerBody({ content, live }: { content: string; live: boolean }) {
  const parts = segments(content);
  return (
    <div className="ll-chat-answer">
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <Prose key={`t${i}`} text={p.text} live={live && i === parts.length - 1} />
        ) : (
          <UiBlock key={`u${i}`} code={p.code} live={live && p.open} />
        ),
      )}
      {live && parts.at(-1)?.kind !== "ui" ? <span className="ll-chat-caret" aria-hidden /> : null}
    </div>
  );
}

const ICON: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  company_overview: "overview",
  monthly_trend: "trend-up",
  profit_and_loss: "statement",
  account_detail: "ledger",
  cost_breakdown: "statement",
  forecast: "forecast",
  scenarios: "branch",
  owed_to_you: "invoice",
  top_customers: "team",
};

type Step = { tool: string; label: string; detail?: string };

/**
 * While the assistant reads the books: a timeline of the sources it opens, each with what it's looking at, the
 * current one turning, and a running clock. Once the answer starts, it folds into one line you can open again.
 */
export function Reading({ steps, phase, startedAt, tookMs }: { steps: Step[]; phase: string; startedAt?: number; tookMs?: number }) {
  const working = phase !== "writing" && phase !== "done" && phase !== "error";
  const [open, setOpen] = useState(working);
  const started = useRef(startedAt ?? Date.now());
  const [elapsed, setElapsed] = useState(tookMs ?? 0);
  useEffect(() => {
    if (!working) {
      setOpen(false);
      if (tookMs) setElapsed(tookMs);
      return;
    }
    const t = setInterval(() => setElapsed(Date.now() - started.current), 100);
    return () => clearInterval(t);
  }, [working, tookMs]);
  const seconds = elapsed ? `${(elapsed / 1000).toFixed(1)}s` : "";
  const current = working ? steps.at(-1) : undefined;
  const sources = new Set(steps.map((s) => s.tool)).size;
  const head = working ? (current ? (current.detail ? `${current.label} · ${current.detail}` : current.label) : "Thinking") : `Read ${sources} source${sources === 1 ? "" : "s"}`;
  return (
    <div className={`ll-think${working ? " is-working" : ""}`}>
      <button type="button" className="ll-think-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={!steps.length}>
        <span className="ll-think-mark" aria-hidden>
          {working ? <span className="ll-think-spin" /> : <Icon name="check" size={12} />}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={head} className={`ll-think-title${working ? " ll-shimmer" : ""}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {head}
          </motion.span>
        </AnimatePresence>
        {seconds ? <span className="ll-think-time">{seconds}</span> : null}
        {steps.length ? <Icon name="chevron-down" size={14} className={`ll-think-chev${open ? " is-open" : ""}`} /> : null}
      </button>
      <AnimatePresence initial={false}>
        {open && steps.length ? (
          <motion.ol key="steps" className="ll-think-steps" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            {steps.map((s, i) => {
              const live = working && i === steps.length - 1;
              return (
                <motion.li key={`${s.tool}-${i}`} className={live ? "is-live" : undefined} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                  <span className="ll-think-ico" aria-hidden>
                    <Icon name={ICON[s.tool] ?? "sparkle"} size={13} />
                  </span>
                  <span className="ll-think-text">
                    <span>{s.label}</span>
                    {s.detail ? <small>{s.detail}</small> : null}
                  </span>
                  <span className="ll-think-state" aria-hidden>
                    {live ? <span className="ll-think-spin" /> : <Icon name="check" size={12} />}
                  </span>
                </motion.li>
              );
            })}
          </motion.ol>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
