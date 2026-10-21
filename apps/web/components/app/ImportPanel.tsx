"use client";

import { Banner, Button, Icon, Panel, ProgressBar } from "@ledgerline/ui";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { type DragEvent, useId, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { type ImportAccount, type ImportJournal, batches, readAccounts, readJournals } from "@/lib/importCsv";
import { ROUTES } from "@/lib/nav";
import type { Workspace } from "./useWorkspace";

export const SAMPLE = {
  name: "Kestrel Joinery Ltd",
  accounts: "/samples/kestrel-accounts.csv",
  journals: "/samples/kestrel-journals.csv",
};

type Progress = { step: "starting" | "storing" | "building" | "done"; done: number; total: number } | null;

function plain(err: unknown) {
  if (err instanceof ConvexError) return String(err.data);
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/^[\s\S]*?(ConvexError|Uncaught Error|Error): /, "").replace(/\s+at [\s\S]*$/, "");
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDate = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "–");
const euros = (cents: number) => `€${Math.round(cents / 100).toLocaleString("en-IE")}`;

/** Run an import end to end: clear and store the chart, upload journals in batches, build the reports. */
export function useImport() {
  const start = useAction(api.imports.start);
  const page = useMutation(api.imports.page);
  const complete = useAction(api.imports.complete);
  const cancel = useMutation(api.imports.cancel);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (source: "csv" | "sample", label: string, accounts: ImportAccount[], journals: ImportJournal[]) => {
    setError(null);
    setProgress({ step: "starting", done: 0, total: 1 });
    let runId: Id<"syncRuns"> | null = null;
    try {
      runId = await start({ source, label, accounts });
      const parts = batches(journals);
      for (const [i, part] of parts.entries()) {
        setProgress({ step: "storing", done: i, total: parts.length });
        await page({ runId, journals: part });
      }
      setProgress({ step: "building", done: parts.length, total: parts.length });
      await complete({ runId });
      setProgress({ step: "done", done: parts.length, total: parts.length });
      return true;
    } catch (err) {
      const message = plain(err);
      // A failed report step is kept so it can be retried; anything earlier is abandoned.
      if (runId && !/finance engine/.test(message)) await cancel({ runId }).catch(() => undefined);
      setError(message);
      setProgress(null);
      return false;
    }
  };

  const sample = async () => {
    setError(null);
    setProgress({ step: "starting", done: 0, total: 1 });
    try {
      const [a, j] = await Promise.all([fetch(SAMPLE.accounts).then((r) => r.text()), fetch(SAMPLE.journals).then((r) => r.text())]);
      const chart = readAccounts(a);
      const ledger = readJournals(j, chart.accounts);
      if (chart.errors.length || ledger.errors.length) throw new Error("The sample files couldn't be read.");
      return await run("sample", SAMPLE.name, chart.accounts, ledger.journals);
    } catch (err) {
      setError(plain(err));
      setProgress(null);
      return false;
    }
  };

  const retry = async (runId: Id<"syncRuns">) => {
    setError(null);
    setProgress({ step: "building", done: 1, total: 1 });
    try {
      await complete({ runId });
      setProgress({ step: "done", done: 1, total: 1 });
    } catch (err) {
      setError(plain(err));
      setProgress(null);
    }
  };

  return { run, sample, retry, progress, error, busy: Boolean(progress && progress.step !== "done") };
}

function progressText(p: NonNullable<Progress>) {
  if (p.step === "starting") return "Clearing previous figures and storing the chart of accounts";
  if (p.step === "storing") return `Storing journals: batch ${p.done + 1} of ${p.total}`;
  if (p.step === "building") return "Building statements, cash flow and forecast drivers";
  return "Imported";
}

export function ImportProgress({ progress }: { progress: Progress }) {
  if (!progress || progress.step === "done") return null;
  const value = progress.step === "starting" ? 0.04 : progress.step === "building" ? 0.96 : 0.05 + (progress.done / progress.total) * 0.9;
  return (
    <div className="ll-import-progress" aria-live="polite">
      <div className="ll-row-between">
        <span>{progressText(progress)}</span>
        <span className="ll-mono">{Math.round(value * 100)}%</span>
      </div>
      <ProgressBar value={value} label="Import progress" />
    </div>
  );
}

function DropZone({ label, hint, file, summary, invalid, onFile }: { label: string; hint: string; file: { name: string } | null; summary?: string; invalid?: boolean; onFile: (name: string, text: string) => void }) {
  const id = useId();
  const [over, setOver] = useState(false);
  const read = async (f: File | undefined) => {
    if (f) onFile(f.name, await f.text());
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void read(e.dataTransfer.files[0]);
  };
  return (
    <label
      htmlFor={id}
      className={`ll-drop${over ? " is-over" : ""}${file ? " is-filled" : ""}${file && invalid ? " is-invalid" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <input id={id} type="file" accept=".csv,text/csv" onChange={(e) => void read(e.target.files?.[0])} />
      <Icon name={file ? (invalid ? "warning" : "success") : "upload"} size={20} />
      <span className="ll-drop-text">
        <strong>{file ? file.name : label}</strong>
        <span>{file ? summary : hint}</span>
      </span>
      <span className="ll-drop-action">{file ? "Replace" : "Choose file"}</span>
    </label>
  );
}

/** Import a chart of accounts and journals from CSV, or load the sample company. */
export function ImportPanel({ workspace, onDone }: { workspace: Workspace; onDone?: () => void }) {
  const [accountsFile, setAccountsFile] = useState<{ name: string; text: string } | null>(null);
  const [journalsFile, setJournalsFile] = useState<{ name: string; text: string } | null>(null);
  const { run, sample, retry, progress, error, busy } = useImport();

  const chart = useMemo(() => (accountsFile ? readAccounts(accountsFile.text) : null), [accountsFile]);
  const ledger = useMemo(() => (chart && journalsFile ? readJournals(journalsFile.text, chart.accounts) : null), [chart, journalsFile]);
  const issues = [...(chart?.errors ?? []), ...(ledger?.errors ?? [])];
  const ready = Boolean(chart && ledger && !issues.length && ledger.journals.length);

  const connected = workspace.connection?.status === "connected";
  const canWrite = workspace.role !== "accountant";
  const blocked = connected || !canWrite;
  const failedReports = workspace.lastSync && workspace.lastSync.source !== "xero" && workspace.lastSync.status === "failed" && workspace.lastSync.phase === "reports";
  const done = progress?.step === "done";

  return (
    <Panel title="Import from CSV" icon="upload" subtitle="A chart of accounts and a journal listing from any accounting system or spreadsheet">
      <div className="ll-stack">
        {connected ? (
          <Banner tone="info" title="Xero is connected.">
            Disconnect Xero below before importing, so the nightly sync doesn't replace your file.
          </Banner>
        ) : null}
        {!canWrite ? <Banner tone="info" title="Read-only role.">Accountants can read and comment. Ask an owner or editor to import figures.</Banner> : null}
        {workspace.org.asOf && !blocked && !done ? (
          <Banner tone="warning" title="Importing replaces your current figures.">
            Statements, forecasts and drafted commentary are rebuilt from the new file. Scenarios and their assumptions are kept.
          </Banner>
        ) : null}

        <div className="ll-drop-grid">
          <DropZone
            label="Chart of accounts"
            hint="Code, Name, Type, and optionally System"
            file={accountsFile}
            summary={chart ? (chart.errors.length ? `${chart.errors.length} problem${chart.errors.length === 1 ? "" : "s"}` : `${chart.accounts.length} accounts`) : undefined}
            invalid={Boolean(chart?.errors.length)}
            onFile={(name, text) => setAccountsFile({ name, text })}
          />
          <DropZone
            label="Journals"
            hint="Journal, Date, Account, Description, Debit, Credit"
            file={journalsFile}
            summary={
              ledger
                ? ledger.errors.length
                  ? `${ledger.errors.length} problem${ledger.errors.length === 1 ? "" : "s"}`
                  : `${ledger.journals.length.toLocaleString("en-IE")} journals · ${ledger.lineCount.toLocaleString("en-IE")} lines`
                : chart
                  ? undefined
                  : "Add the chart of accounts too"
            }
            invalid={Boolean(ledger?.errors.length)}
            onFile={(name, text) => setJournalsFile({ name, text })}
          />
        </div>

        {chart?.warnings.length ? (
          <ul className="ll-import-notes">
            {chart.warnings.map((w) => (
              <li key={w}>
                <Icon name="info" size={16} />
                {w}
              </li>
            ))}
          </ul>
        ) : null}

        {issues.length ? (
          <Banner tone="negative" title={`${issues.length} problem${issues.length === 1 ? "" : "s"} to fix before importing.`}>
            <ul className="ll-import-issues">
              {issues.slice(0, 8).map((issue, i) => (
                <li key={i}>
                  {issue.row ? <span className="ll-mono">Row {issue.row}</span> : null}
                  {issue.message}
                </li>
              ))}
              {issues.length > 8 ? <li>and {issues.length - 8} more.</li> : null}
            </ul>
          </Banner>
        ) : null}

        {ready && ledger ? (
          <dl className="ll-import-summary">
            <div>
              <dt>Journals</dt>
              <dd>{ledger.journals.length.toLocaleString("en-IE")}</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>{longDate(ledger.from)}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{longDate(ledger.to)}</dd>
            </div>
            <div>
              <dt>Debits = credits</dt>
              <dd>{euros(ledger.debitCents)}</dd>
            </div>
          </dl>
        ) : null}

        <ImportProgress progress={progress} />
        {error ? (
          <Banner tone="negative" title="Import stopped." action={failedReports ? <Button size="sm" icon="refresh" onClick={() => void retry(workspace.lastSync!.id)}>Build reports again</Button> : null}>
            {error}
          </Banner>
        ) : failedReports && !busy ? (
          <Banner tone="warning" title="Reports weren't built." action={<Button size="sm" icon="refresh" onClick={() => void retry(workspace.lastSync!.id)}>Build reports again</Button>}>
            {workspace.lastSync?.error ?? "The last import stored its journals but stopped before building reports."}
          </Banner>
        ) : null}
        {done ? (
          <Banner tone="positive" title="Imported." action={<Link href={ROUTES.overview}><Button size="sm" variant="primary" iconRight="arrow-right">Open overview</Button></Link>}>
            Your statements, cash flow and forecast drivers are ready.
          </Banner>
        ) : null}

        <div className="ll-row-between">
          <div className="ll-row">
            <Button
              variant="primary"
              icon="upload"
              disabled={!ready || blocked || busy}
              loading={busy && Boolean(accountsFile)}
              onClick={async () => {
                if (!chart || !ledger || !journalsFile) return;
                if (await run("csv", journalsFile.name, chart.accounts, ledger.journals)) onDone?.();
              }}
            >
              Import {ledger?.journals.length ? `${ledger.journals.length.toLocaleString("en-IE")} journals` : "files"}
            </Button>
            <Button icon="database" disabled={blocked || busy} onClick={async () => (await sample()) && onDone?.()}>
              Use the sample company
            </Button>
          </div>
          <span className="ll-row ll-import-templates">
            Example files:
            <a href={SAMPLE.accounts} download>accounts</a>
            <a href={SAMPLE.journals} download>journals</a>
          </span>
        </div>
      </div>
    </Panel>
  );
}
