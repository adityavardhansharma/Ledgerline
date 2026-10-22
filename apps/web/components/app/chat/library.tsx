"use client";

import { BarChart, Icon, LineChart } from "@ledgerline/ui";
import { createLibrary, defineComponent, useIsStreaming } from "@openuidev/react-lang";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { z } from "zod/v4";

/**
 * What the chat's answers are built from. Every component is drawn from Ledgerline's design system, so the model
 * only chooses and arranges: it can't make something that looks out of place. Charts and tiles take their
 * numbers from Query() results, so figures come from the books, not from the model.
 */

export type Format = "money" | "percent" | "months" | "days" | "number";
const format = z.enum(["money", "percent", "months", "days", "number"]);

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 1 });
export function show(value: unknown, kind: Format = "money"): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (kind === "money") return n < 0 ? `−${euro.format(-n)}` : euro.format(n);
  if (kind === "percent") return `${number.format(n)}%`;
  if (kind === "months") return `${number.format(n)} months`;
  if (kind === "days") return `${Math.round(n)} days`;
  return number.format(n);
}
const compactMoney = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `€${(a / 1e6).toFixed(1)}m` : a >= 1e3 ? `€${Math.round(a / 1e3)}k` : `€${Math.round(a)}`;
  return n < 0 ? `−${s}` : s;
};

/** What a chat answer can do in the app: ask a follow-up or open a page. */
export const ChatActions = createContext<{ ask: (text: string) => void; open: (page: string) => void }>({ ask: () => {}, open: () => {} });

const nums = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => (typeof x === "number" ? x : Number(x) || 0)) : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "")) : []);

/** Prose with **bold**, and paragraph breaks. Words fade in as they stream. */
export function Prose({ text, live }: { text: string; live?: boolean }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="ll-chat-prose">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.every((l) => /^\s*[-•*]\s+/.test(l)) && lines.length > 0 && block.trim();
        if (bullets) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^\s*[-•*]\s+/, "")} live={live && i === blocks.length - 1 && j === lines.length - 1} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Inline text={block} live={live && i === blocks.length - 1} />
          </p>
        );
      })}
    </div>
  );
}

function Inline({ text, live }: { text: string; live?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  let word = 0;
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.startsWith("**") && part.endsWith("**");
        const body = bold ? part.slice(2, -2) : part;
        // While streaming, each word is its own span so new words can fade in; settled text is plain.
        const content = live
          ? body.split(/(\s+)/).map((w, j) => (/^\s+$/.test(w) ? w : <span key={`${i}-${j}-${word++}`} className="ll-chat-word">{w}</span>))
          : body;
        return bold ? <strong key={i}>{content}</strong> : <span key={i}>{content}</span>;
      })}
    </>
  );
}

const Stack = defineComponent({
  name: "Stack",
  description: "Vertical stack of blocks. The root of every ui block.",
  props: z.object({ children: z.array(z.any()) }),
  component: ({ props, renderNode }) => <div className="ll-chat-stack">{renderNode(props.children)}</div>,
});

const Row = defineComponent({
  name: "Row",
  description: "Side-by-side blocks (two or three Kpi tiles, or two small charts). Wraps on narrow screens.",
  props: z.object({ children: z.array(z.any()) }),
  component: ({ props, renderNode }) => <div className="ll-chat-row">{renderNode(props.children)}</div>,
});

const Kpi = defineComponent({
  name: "Kpi",
  description: "One headline figure with a label, from a Query field. Optional note underneath, e.g. a comparison.",
  props: z.object({
    label: z.string(),
    value: z.any().describe("A number from a Query result, e.g. overview.cash"),
    format: format.optional(),
    note: z.string().optional(),
  }),
  component: ({ props }) => (
    <div className="ll-chat-kpi ll-chat-in">
      <span className="ll-chat-kpi-label">{props.label}</span>
      <span className="ll-chat-kpi-value">{show(props.value, props.format ?? "money")}</span>
      {props.note ? <span className="ll-chat-kpi-note">{props.note}</span> : null}
    </div>
  ),
});

/** While a chart's figures load: a shimmer, then, if they never come, a plain note instead of spinning forever. */
function Waiting() {
  const live = useIsStreaming();
  const [gave, setGave] = useState(false);
  useEffect(() => {
    if (live) return;
    const t = setTimeout(() => setGave(true), 6000);
    return () => clearTimeout(t);
  }, [live]);
  return gave ? <p className="ll-chat-chart-none">No figures came back for this chart.</p> : <div className="ll-chat-chart-wait" />;
}

function ChartFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="ll-chat-figure ll-chat-in">
      {title ? <figcaption>{title}</figcaption> : null}
      {children}
    </figure>
  );
}

const Line = defineComponent({
  name: "LineChart",
  description: "A trend over months. labels and values usually pluck from a Query's rows, e.g. trend.rows.label and trend.rows.value. Optional second series to compare.",
  props: z.object({
    title: z.string(),
    labels: z.any(),
    values: z.any(),
    format: format.optional(),
    name: z.string().optional(),
    compare: z.any().optional(),
    compareName: z.string().optional(),
  }),
  component: ({ props }) => {
    const labels = strs(props.labels);
    const values = nums(props.values);
    if (labels.length < 2) return <ChartFrame title={props.title}><Waiting /></ChartFrame>;
    const series = [{ name: props.name ?? props.title, kind: "actual", values }];
    if (props.compare) series.push({ name: props.compareName ?? "Compared", kind: "forecast", values: nums(props.compare) });
    const kind = (props.format ?? "money") as Format;
    return (
      <ChartFrame title={props.title}>
        <LineChart labels={labels} series={series as never} height={190} zero={kind === "money"} legend={Boolean(props.compare)} format={(v: number) => (kind === "money" ? compactMoney(v) : show(v, kind))} />
      </ChartFrame>
    );
  },
});

const Bars = defineComponent({
  name: "BarChart",
  description: "Values side by side: months, accounts or customers. labels and values usually pluck from a Query's rows.",
  props: z.object({ title: z.string(), labels: z.any(), values: z.any(), format: format.optional() }),
  component: ({ props }) => {
    const labels = strs(props.labels);
    const values = nums(props.values);
    if (!labels.length) return <ChartFrame title={props.title}><Waiting /></ChartFrame>;
    const kind = (props.format ?? "money") as Format;
    return (
      <ChartFrame title={props.title}>
        <BarChart labels={labels.map((l) => (l.length > 11 ? `${l.slice(0, 10)}…` : l))} values={values} height={190} seriesName={props.title} format={(v: number) => (kind === "money" ? compactMoney(v) : show(v, kind))} />
      </ChartFrame>
    );
  },
});

const Table = defineComponent({
  name: "Table",
  description: "Rows from a Query result. columns lists which fields to show, in order, with a label and format.",
  props: z.object({
    columns: z.array(z.object({ key: z.string(), label: z.string(), format: z.enum(["money", "percent", "months", "days", "number", "text"]).optional() })),
    rows: z.any().describe("An array of objects, usually a Query's rows"),
    limit: z.number().optional(),
  }),
  component: ({ props }) => {
    const rows = Array.isArray(props.rows) ? (props.rows as Record<string, unknown>[]).slice(0, props.limit ?? 12) : [];
    return (
      <div className="ll-chat-table-wrap ll-chat-in">
        <table className="ll-chat-table">
          <thead>
            <tr>
              {props.columns.map((c) => (
                <th key={c.key} className={c.format && c.format !== "text" ? "is-num" : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r, i) => (
                <tr key={i} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                  {props.columns.map((c) => (
                    <td key={c.key} className={c.format && c.format !== "text" ? "is-num" : undefined}>
                      {c.format && c.format !== "text" ? show(r[c.key], c.format) : String(r[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={props.columns.length} className="ll-chat-table-wait" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  },
});

const Callout = defineComponent({
  name: "Callout",
  description: "A short highlighted note: a risk, a recommendation or a caveat.",
  props: z.object({ tone: z.enum(["info", "positive", "warning", "negative"]), title: z.string(), text: z.string().optional() }),
  component: ({ props }) => (
    <div className={`ll-chat-callout is-${props.tone} ll-chat-in`}>
      <Icon name={props.tone === "positive" ? "success" : props.tone === "info" ? "info" : props.tone === "warning" ? "warning" : "error"} size={16} />
      <div>
        <strong>{props.title}</strong>
        {props.text ? <span>{props.text}</span> : null}
      </div>
    </div>
  ),
});

const Text = defineComponent({
  name: "Text",
  description: "A short line of text inside a ui block, e.g. a caption. Write longer prose outside ui blocks.",
  props: z.object({ text: z.string() }),
  component: function Render({ props }) {
    const live = useIsStreaming();
    return <Prose text={String(props.text ?? "")} live={live} />;
  },
});

const PAGES = ["overview", "pnl", "balance", "cashflow", "forecast", "scenarios", "boardpack", "ledger", "sync"] as const;

const OpenPage = defineComponent({
  name: "OpenPage",
  description: "A button that opens a page of the app where the person can see or change more.",
  props: z.object({ label: z.string(), page: z.enum(PAGES) }),
  component: function Render({ props }) {
    const { open } = useContext(ChatActions);
    return (
      <button type="button" className="ll-chat-link ll-chat-in" onClick={() => open(props.page)}>
        {props.label}
        <Icon name="arrow-right" size={14} />
      </button>
    );
  },
});

const FollowUps = defineComponent({
  name: "FollowUps",
  description: "Two or three short follow-up questions the person might ask next, as tappable chips. Use at most once, at the end.",
  props: z.object({ questions: z.array(z.string()) }),
  component: function Render({ props }) {
    const { ask } = useContext(ChatActions);
    const live = useIsStreaming();
    return (
      <div className="ll-chat-followups ll-chat-in">
        {(props.questions ?? []).slice(0, 3).map((q) => (
          <button key={q} type="button" disabled={live} onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
    );
  },
});

export const chatLibrary = createLibrary({
  components: [Stack, Row, Kpi, Line, Bars, Table, Callout, Text, OpenPage, FollowUps],
  root: "Stack",
});
