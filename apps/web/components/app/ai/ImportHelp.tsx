"use client";

import { Button } from "@ledgerline/ui";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ACCOUNT_TYPES, fileShape, type ImportFix } from "@/lib/importCsv";
import { AiButton, AiNote, useAi } from "./AiAction";

const FIELD: Record<string, string> = {
  code: "Code",
  name: "Name",
  type: "Type",
  system: "System",
  journal: "Journal",
  date: "Date",
  account: "Account",
  description: "Description",
  debit: "Debit",
  credit: "Credit",
  amount: "Amount",
  reference: "Reference",
  source: "Source",
  contact: "Contact",
};

/**
 * When a file's columns or account types don't match, suggest which column is which and what each unknown type
 * means. Nothing changes until the person applies it, and the file is checked again in full afterwards.
 */
export function ImportHelp({ file, text, unknownTypes, onApply }: { file: "accounts" | "journals"; text: string; unknownTypes: string[]; onApply: (fix: ImportFix) => void }) {
  const suggest = useAction(api.aiActions.importMap);
  const ai = useAi(suggest);
  const label = file === "accounts" ? "chart of accounts" : "journal file";
  const ask = () => {
    const shape = fileShape(text);
    void ai.run({ file, headers: shape.headers, sample: shape.sample, unknownTypes, allowedTypes: ACCOUNT_TYPES });
  };
  if (!ai.open) return <AiButton size="sm" onClick={ask}>Suggest a fix for the {label}</AiButton>;
  const data = ai.data;
  const columns = Object.entries(data?.columns ?? {});
  const types = Object.entries(data?.types ?? {});
  return (
    <AiNote
      title={`Suggested fix for the ${label}`}
      busy={ai.busy}
      error={ai.error}
      onClose={ai.close}
      steps={["Reading the columns", "Matching them to what Ledgerline needs", "Checking the account types"]}
      footer={
        columns.length || types.length ? (
          <Button size="sm" variant="primary" icon="check" onClick={() => { onApply({ columns: data?.columns, types: data?.types }); ai.close(); }}>
            Apply and check again
          </Button>
        ) : null
      }
    >
      {data ? (
        <div className="ll-ai-map">
          {columns.length ? (
            <ul>
              {columns.map(([field, header]) => (
                <li key={field}>
                  <span>{FIELD[field] ?? field}</span>
                  <span className="ll-ai-arrow">←</span>
                  <code>{header}</code>
                </li>
              ))}
            </ul>
          ) : null}
          {types.length ? (
            <ul>
              {types.map(([raw, type]) => (
                <li key={raw}>
                  <code>{raw}</code>
                  <span className="ll-ai-arrow">→</span>
                  <span>{type}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {!columns.length && !types.length ? <p className="ll-ai-muted">No confident match. Rename the columns to the names listed above and try again.</p> : null}
          {data.note ? <p className="ll-ai-muted">{data.note}</p> : null}
        </div>
      ) : null}
    </AiNote>
  );
}
