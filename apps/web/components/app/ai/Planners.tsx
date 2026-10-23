"use client";

import { Button, Dialog, Input } from "@ledgerline/ui";
import { useAction, useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ParsedScenario } from "@/convex/aiActions";
import { money, periodLabel } from "@/lib/format";
import { AiButton, Paused, RevealText, Thinking, useAi } from "./AiAction";

const uid = () => Math.random().toString(36).slice(2, 10);
const DRIVER: Record<string, [string, (v: number) => string]> = {
  growth: ["Revenue growth a month", (v) => `${(v * 100).toFixed(1)}%`],
  grossMargin: ["Gross margin", (v) => `${(v * 100).toFixed(1)}%`],
  overheadGrowth: ["Overheads growth a year", (v) => `${(v * 100).toFixed(1)}%`],
  debtorDays: ["Debtor days", (v) => `${Math.round(v)} days`],
  creditorDays: ["Creditor days", (v) => `${Math.round(v)} days`],
  stockDays: ["Stock days", (v) => `${Math.round(v)} days`],
};
const KIND = { capex: "Equipment", income: "One-off income", expense: "One-off expense", loan: "Loan drawn", equity: "Equity raised", dividend: "Dividend paid" } as const;

type Own = { hires: { id: string; role: string; salaryCents: number; startPeriod: string; count: number }[]; oneOffs: { id: string; label: string; period: string; amountCents: number; kind: "capex" | "income" | "expense" }[]; financing: { id: string; period: string; amountCents: number; kind: "loan" | "equity" | "dividend" }[] };

/**
 * Describe a change in a sentence ("hire two fitters in March at 42k, a 50k loan in May") and get the hires,
 * one-offs, financing and assumptions filled in for review. Nothing is saved until "Add to scenario".
 */
export function ScenarioComposer({ scenarioId, startPeriod, own }: { scenarioId: Id<"scenarios">; startPeriod: string; own: Own }) {
  const parse = useAction(api.aiActions.parseScenario);
  const setPlanItems = useMutation(api.scenarios.setPlanItems);
  const setOverride = useMutation(api.scenarios.setOverride);
  const ai = useAi(parse);
  const [text, setText] = useState("");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    ai.close();
    setText("");
  }, [scenarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = ai.data as ParsedScenario | null;
  const rows = p
    ? [
        ...p.hires.map((h, i) => ({ id: `h${i}`, text: `Hire ${h.count > 1 ? `${h.count} × ` : ""}${h.role} from ${periodLabel(h.startPeriod)}`, value: `${money(h.salaryCents)} a year${h.count > 1 ? " each" : ""}` })),
        ...p.oneOffs.map((o, i) => ({ id: `o${i}`, text: `${KIND[o.kind]}: ${o.label}, ${periodLabel(o.period)}`, value: money(o.amountCents) })),
        ...p.financing.map((f, i) => ({ id: `f${i}`, text: `${KIND[f.kind]}, ${periodLabel(f.period)}`, value: money(f.amountCents) })),
        ...p.assumptions.map((a, i) => ({ id: `a${i}`, text: DRIVER[a.key]?.[0] ?? a.key, value: DRIVER[a.key]?.[1](a.value) ?? String(a.value) })),
      ]
    : [];
  const chosen = rows.filter((r) => !skip.has(r.id)).length;

  const apply = async () => {
    if (!p) return;
    setSaving(true);
    try {
      const pick = <T,>(items: T[], prefix: string) => items.filter((_, i) => !skip.has(`${prefix}${i}`));
      const hires = pick(p.hires, "h").map((h) => ({ ...h, id: uid() }));
      const oneOffs = pick(p.oneOffs, "o").map((o) => ({ ...o, id: uid() }));
      const financing = pick(p.financing, "f").map((f) => ({ ...f, id: uid() }));
      if (hires.length || oneOffs.length || financing.length) {
        await setPlanItems({
          id: scenarioId,
          ...(hires.length ? { hires: [...own.hires, ...hires] } : {}),
          ...(oneOffs.length ? { oneOffs: [...own.oneOffs, ...oneOffs] } : {}),
          ...(financing.length ? { financing: [...own.financing, ...financing] } : {}),
        });
      }
      for (const a of pick(p.assumptions, "a")) await setOverride({ id: scenarioId, key: a.key, value: a.value });
      setDone(`Added ${chosen} change${chosen === 1 ? "" : "s"}. The forecast is updating.`);
      setText("");
      ai.close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ll-composer">
      <div className="ll-composer-box">
        <textarea
          className="ll-composer-input"
          rows={2}
          maxLength={1000}
          value={text}
          placeholder="Hire two fitters in March at 42k each, buy a van in June for 38k, take a 50k loan in May"
          aria-label="Describe a change to this scenario"
          onChange={(e) => {
            setText(e.target.value);
            setDone(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) void ai.run({ text, startPeriod });
          }}
        />
        <div className="ll-composer-foot">
          <span className="ll-ai-muted">{done ?? "Describe changes in your own words; you'll check them before anything is saved."}</span>
          <AiButton size="sm" busy={ai.busy} onClick={() => text.trim() && void ai.run({ text, startPeriod })}>
            Fill in the plan
          </AiButton>
        </div>
      </div>
      {ai.open && ai.busy ? <Thinking steps={["Reading what you wrote", "Matching it to your plan", "Filling in the details"]} /> : null}
      {ai.open && !ai.busy ? (
        ai.error ? (
          <p className="ll-ai-error">{ai.error}</p>
        ) : p ? (
          <div className="ll-composer-result ll-chat-in">
            <Paused text={ai.notice} />
            {rows.length ? (
              <ul>
                {rows.map((r, i) => (
                  <li key={r.id} className="ll-reveal" style={{ animationDelay: `${i * 70}ms` }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!skip.has(r.id)}
                        onChange={() =>
                          setSkip((s) => {
                            const next = new Set(s);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                      />
                      <span>{r.text}</span>
                      <strong>{r.value}</strong>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ll-ai-muted">Nothing to add from that. Try naming a role, an amount and a month.</p>
            )}
            {p.notUnderstood ? <p className="ll-ai-warn">Not used: {p.notUnderstood}</p> : null}
            <div className="ll-composer-actions">
              <Button size="sm" variant="ghost" onClick={ai.close}>
                Discard
              </Button>
              {rows.length ? (
                <Button size="sm" variant="primary" icon="check" loading={saving} disabled={!chosen} onClick={apply}>
                  Add {chosen} to scenario
                </Button>
              ) : null}
            </div>
          </div>
        ) : null
      ) : null}
    </div>
  );
}

/** A downside branch built from the company's own worst recent months, explained, created on confirmation. */
export function DownsideButton({ onCreated }: { onCreated: (id: Id<"scenarios">) => void }) {
  const suggest = useAction(api.aiActions.downside);
  const branch = useMutation(api.scenarios.branch);
  const setOverride = useMutation(api.scenarios.setOverride);
  const ai = useAi(suggest);
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = ai.data;

  const create = async () => {
    if (!data?.baseId) return;
    setSaving(true);
    setError(null);
    try {
      const id = await branch({ fromId: data.baseId, name: (name ?? data.name).trim() || data.name });
      for (const c of data.changes) await setOverride({ id, key: c.key, value: c.to });
      ai.close();
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^[\s\S]*?ConvexError: /, "") : "Couldn't create the scenario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AiButton onClick={() => void ai.run({})} busy={ai.busy && !ai.open}>
        Downside case
      </AiButton>
      {ai.open ? (
        <Dialog
          title="A downside case from your own history"
          onClose={ai.close}
          footer={
            <>
              <Button onClick={ai.close}>Cancel</Button>
              <Button variant="forecast" icon="branch" loading={saving} disabled={!data?.changes.length || !data.baseId} onClick={create}>
                Create scenario
              </Button>
            </>
          }
        >
          {ai.error ? (
            <p className="ll-ai-error">{ai.error}</p>
          ) : ai.busy || !data ? (
            <Thinking steps={["Reading your last twelve months", "Finding the weakest months", "Writing the case"]} />
          ) : (
            <div className="ll-stack">
              <Paused text={ai.notice} />
              <p className="ll-ai-muted">Each assumption moves to the weakest level your last twelve months actually showed. You can change any of them after.</p>
              <Input id="downside-name" label="Scenario name" value={name ?? data.name} onChange={(e) => setName(e.target.value)} />
              <ul className="ll-ai-changes">
                {data.changes.map((c) => (
                  <li key={c.key}>
                    <div>
                      <strong>{DRIVER[c.key]?.[0] ?? c.key}</strong>
                      <span className="ll-mono">
                        {DRIVER[c.key]?.[1](c.from)} → {DRIVER[c.key]?.[1](c.to)}
                      </span>
                    </div>
                    {c.reason.length ? (
                      <p>
                        <RevealText parts={c.reason} />
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {error ? <p className="ll-ai-error">{error}</p> : null}
            </div>
          )}
        </Dialog>
      ) : null}
    </>
  );
}

/** Names that say what a branch tests, from its changes. Click one to rename. */
export function NameSuggest({ scenarioId, current }: { scenarioId: Id<"scenarios">; current: string }) {
  const suggest = useAction(api.aiActions.nameScenario);
  const rename = useMutation(api.scenarios.rename);
  const ai = useAi(suggest);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ai.open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) ai.close();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [ai.open, ai.close]);
  return (
    <div className="ll-ai-pop-wrap" ref={box}>
      <AiButton size="sm" busy={ai.busy} onClick={() => void ai.run({ scenarioId })} title={`Rename “${current}” to say what it tests`}>
        Suggest a name
      </AiButton>
      {ai.open && !ai.busy ? (
        <div className="ll-ai-pop" role="menu">
          {ai.error ? (
            <p className="ll-ai-error">{ai.error}</p>
          ) : (
            <>
            <Paused text={ai.notice} />
            {(ai.data?.names ?? []).map((n) => (
              <button
                key={n}
                type="button"
                role="menuitem"
                onClick={async () => {
                  await rename({ id: scenarioId, name: n });
                  ai.close();
                }}
              >
                {n}
              </button>
            ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
