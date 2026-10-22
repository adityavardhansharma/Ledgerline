"use client";

import { Icon } from "@ledgerline/ui";
import { Renderer } from "@openuidev/react-lang";
import { useConvex } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, memo, useContext, useMemo } from "react";
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
  return (
    <motion.div className="ll-chat-ui" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
      <Renderer response={code} library={chatLibrary} isStreaming={live} toolProvider={tools as never} queryLoader={<span className="ll-chat-loading" aria-label="Loading figures" />} />
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

/** While the assistant reads the books: each source it opens appears in turn, the current one shimmering. */
export function Reading({ steps, phase }: { steps: { tool: string; label: string }[]; phase: string }) {
  const current = phase === "writing" || phase === "done" ? -1 : steps.length - 1;
  return (
    <div className="ll-chat-reading">
      <AnimatePresence initial={false}>
        {steps.length === 0 ? (
          <motion.div key="thinking" className="ll-chat-step is-current" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
            <span className="ll-chat-step-icon"><Icon name="sparkle" size={13} /></span>
            <span className="ll-shimmer">Thinking</span>
          </motion.div>
        ) : (
          steps.map((s, i) => (
            <motion.div
              key={`${s.tool}-${i}`}
              className={`ll-chat-step${i === current ? " is-current" : " is-done"}`}
              initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="ll-chat-step-icon">{i === current ? <Icon name={ICON[s.tool] ?? "sparkle"} size={13} /> : <Icon name="check" size={13} />}</span>
              <span className={i === current ? "ll-shimmer" : undefined}>{s.label}</span>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
