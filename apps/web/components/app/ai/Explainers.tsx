"use client";

import { Button } from "@ledgerline/ui";
import { useAction, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Anomaly } from "@/convex/aiActions";
import { periodLabel } from "@/lib/format";
import { AiButton, AiNote, AiProse, plainText, RevealText, Thinking, useAi } from "./AiAction";

/** "Why is it this figure?" inside the drawer that opens from any statement figure. */
export function ExplainFigure({ accountId, period, label }: { accountId: string; period: string; label: string }) {
  const explain = useAction(api.aiActions.explainFigure);
  const ai = useAi(explain);
  useEffect(() => ai.close(), [accountId, period]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ai.open) {
    return (
      <div className="ll-ai-slot">
        <AiButton onClick={() => void ai.run({ accountId, period })}>Why is {label} this figure?</AiButton>
      </div>
    );
  }
  return (
    <AiNote title={`${label}, ${periodLabel(period)}`} busy={ai.busy} error={ai.error} onClose={ai.close} steps={["Reading the transactions", "Comparing with last month and last year", "Writing it up"]}>
      {ai.data ? <AiProse paragraphs={ai.data.paragraphs} /> : null}
    </AiNote>
  );
}

const AREA = { financing: "Financing", hires: "Hires", oneoffs: "One-offs", assumptions: "Assumptions" } as const;

/** Why cash falls to its low point, and fixes that open the part of the plan they change. */
export function CashDipExplainer({ scenarioId, onOpenArea }: { scenarioId: Id<"scenarios">; onOpenArea: (area: "financing" | "hires" | "oneoffs" | "assumptions") => void }) {
  const explain = useAction(api.aiActions.cashDip);
  const ai = useAi(explain);
  useEffect(() => ai.close(), [scenarioId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ai.open) return <AiButton size="sm" onClick={() => void ai.run({ scenarioId })}>Why does cash dip?</AiButton>;
  return (
    <AiNote title="Why cash dips" busy={ai.busy} error={ai.error} onClose={ai.close} steps={["Reading the forecast", "Finding what drains cash", "Weighing the fixes"]}>
      {ai.data ? (
        <>
          <AiProse paragraphs={ai.data.paragraphs} />
          {ai.data.fixes.length ? (
            <ul className="ll-ai-fixes">
              {ai.data.fixes.map((fix, i) => (
                <li key={i}>
                  <span>
                    <RevealText parts={fix.text} start={20 + i * 12} />
                  </span>
                  <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => onOpenArea(fix.area as keyof typeof AREA)}>
                    {AREA[fix.area as keyof typeof AREA] ?? "Open"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </AiNote>
  );
}

const FIX = { sync: "Sync now", review_in_xero: "Check in Xero", check_account: "Check the account's type", none: "" } as const;

/** Under a "Differs from Xero" check: why each line differs and what to do. */
export function MismatchExplainer() {
  const explain = useAction(api.aiActions.explainMismatch);
  const sync = useMutation(api.sync.request);
  const ai = useAi(explain);
  if (!ai.open) return <AiButton size="sm" onClick={() => void ai.run({})}>Why is this different?</AiButton>;
  return (
    <AiNote title="Why it differs from Xero" busy={ai.busy} error={ai.error} onClose={ai.close} steps={["Comparing with Xero's reports", "Checking the sync timing", "Writing it up"]}>
      {ai.data ? (
        <>
          <ul className="ll-ai-list">
            {ai.data.items.map((item, i) => (
              <li key={i}>
                <strong>
                  {item.name}, {periodLabel(item.period)}
                </strong>
                <span>
                  <RevealText parts={item.reason} start={i * 12} />
                </span>
                {item.fix === "sync" ? (
                  <Button size="sm" icon="refresh" onClick={() => void sync()}>
                    Sync now
                  </Button>
                ) : item.fix !== "none" ? (
                  <span className="ll-ai-tag">{FIX[item.fix as keyof typeof FIX]}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {ai.data.summary.length ? (
            <p className="ll-ai-summary">
              <RevealText parts={ai.data.summary} start={40} />
            </p>
          ) : null}
        </>
      ) : null}
    </AiNote>
  );
}

const ago = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

/** A small card on the overview: what changed in the figures since the last sync. */
export function ChangeDigest() {
  const digest = useAction(api.aiActions.digest);
  const ai = useAi(digest);
  return (
    <section className="ll-ai-card">
      <div className="ll-ai-card-head">
        <div>
          <strong>Since the last sync</strong>
          <span>{ai.data?.at ? `Figures updated ${ago(ai.data.at)}` : "What moved in your figures"}</span>
        </div>
        {!ai.open || ai.error ? (
          <AiButton size="sm" onClick={() => void ai.run({})}>
            What changed?
          </AiButton>
        ) : null}
      </div>
      {ai.open ? (
        ai.error ? (
          <p className="ll-ai-error">{ai.error}</p>
        ) : ai.busy ? (
          <Thinking steps={["Comparing with the last sync", "Picking out what moved", "Writing it up"]} />
        ) : ai.data ? (
          ai.data.first ? (
            <p className="ll-ai-muted">This is the first build of your figures, so there's nothing to compare yet.</p>
          ) : ai.data.unchanged ? (
            <p className="ll-ai-muted">Nothing changed in the figures at the last sync.</p>
          ) : (
            <ul className="ll-ai-digest">
              {ai.data.items.map((item, i) => (
                <li key={i} className="ll-reveal" style={{ animationDelay: `${i * 120}ms` }}>
                  <RevealText parts={item} start={i * 8} />
                </li>
              ))}
            </ul>
          )
        ) : null
      ) : null}
    </section>
  );
}

/**
 * Unusual movements on the profit and loss: arithmetic flags each account far outside its own last twelve months,
 * the AI words why. Checked once per version of the figures.
 */
export function useAnomalies(enabled: boolean) {
  const check = useAction(api.aiActions.anomalies);
  const [flags, setFlags] = useState<Anomaly[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    check({})
      .then((result) => live && setFlags(result))
      .catch(() => live && setFlags([]));
    return () => {
      live = false;
    };
  }, [enabled, check]);
  const map: Record<string, { text: string }> = {};
  for (const f of flags ?? []) {
    const typical = `typical month ${(f.typicalCents / 100).toLocaleString("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`;
    map[`${f.accountId}|${f.period}`] = { text: f.reason ? plainText(f.reason) : `Unusual: ${typical}` };
  }
  return { flags, map };
}

export function AnomalyStrip({ flags }: { flags: Anomaly[] | null }) {
  const [open, setOpen] = useState(false);
  if (!flags?.length) return null;
  return (
    <section className="ll-ai-strip">
      <button type="button" className="ll-ai-strip-head" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        <span className="ll-ai-dot" />
        <strong>
          {flags.length} unusual movement{flags.length === 1 ? "" : "s"} in {periodLabel(flags[0].period)}
        </strong>
        <span className="ll-ai-muted">Marked with a dot in the table · {open ? "hide" : "show why"}</span>
      </button>
      {open ? (
        <ul className="ll-ai-list">
          {flags.map((f) => (
            <li key={f.accountId}>
              <strong>{f.name}</strong>
              <span>{f.reason ? <RevealText parts={f.reason} /> : `Far from its typical month.`}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
