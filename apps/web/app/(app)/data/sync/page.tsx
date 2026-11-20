"use client";

import { Banner, Button, DataTable, Dialog, StatusPill, SyncProgress } from "@ledgerline/ui";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppPage, ConnectButton } from "@/components/app/AppPage";
import { ImportPanel } from "@/components/app/ImportPanel";
import { Reconciliation } from "@/components/app/Reconciliation";
import { useWorkspace } from "@/components/app/useWorkspace";
import { errorText } from "@/components/app/BoardCommentary";
import { RailBlock, ReportGrid, SummaryLine } from "@/components/app/report/Report";
import { api } from "@/convex/_generated/api";
import { ago, periodLabel } from "@/lib/format";

const PHASES = ["accounts", "journals", "invoices", "reports", "reconcile"];
const REPORT_PHASES = ["accounts", "balances", "cash", "invoices", "reports", "reconcile"];
const IMPORT_PHASES = ["accounts", "journals", "reports"];
const STATUS_PILL: Record<string, { status: "synced" | "syncing" | "error" | "stale" | "mismatch" | "disconnected"; word: string }> = {
  done: { status: "synced", word: "Matches Xero" },
  needsReview: { status: "mismatch", word: "Differs from Xero" },
  failed: { status: "error", word: "Failed" },
  reauth: { status: "disconnected", word: "Reconnect needed" },
  running: { status: "syncing", word: "Running" },
  queued: { status: "syncing", word: "Queued" },
  backingOff: { status: "stale", word: "Waiting on Xero" },
};

const when = (ms: number) => new Date(ms).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const took = (a: number, b: number | null) => {
  if (!b) return "–";
  const s = Math.round((b - a) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="ll-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SyncScreen() {
  const params = useSearchParams();
  const current = useWorkspace();
  const history = useQuery(api.sync.history, { limit: 25 });
  const request = useMutation(api.sync.request);
  const disconnect = useMutation(api.xero.disconnect);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AppPage
      active="sync"
      title="Sync and import"
      subtitle="Figures come from a read-only Xero connection, or from CSV files you import"
      breadcrumbs={["Data", "Sync and import"]}
      actions={
        current?.connection?.status === "connected" ? (
          <Button
            variant="primary"
            icon="refresh"
            onClick={async () => {
              setError(null);
              try {
                await request();
              } catch (err) {
                setError(errorText(err, "Couldn't start a sync."));
              }
            }}
          >
            Sync now
          </Button>
        ) : null
      }
      overlay={
        confirming ? (
          <Dialog
            title="Disconnect Xero?"
            size="sm"
            onClose={() => setConfirming(false)}
            footer={
              <>
                <Button onClick={() => setConfirming(false)}>Keep connected</Button>
                <Button variant="danger" icon="error" onClick={() => { void disconnect(); setConfirming(false); }}>Disconnect Xero</Button>
              </>
            }
          >
            <p>Ledgerline stops syncing. Reports keep the figures from the last sync, and you can reconnect or import a file at any time.</p>
          </Dialog>
        ) : null
      }
    >
      {(workspace) => {
        const connection = workspace.connection;
        const run = workspace.lastSync;
        const live = run && ["queued", "running", "backingOff"].includes(run.status);
        const imported = workspace.org.source === "csv" || workspace.org.source === "sample";
        const importing = Boolean(live && run.source !== "xero");
        return (
          <>
            {params.get("connected") ? <Banner tone="positive" title="Xero connected.">Your first sync has started. Reports appear as soon as it finishes.</Banner> : null}
            {error ? <Banner tone="negative" title="Sync not started.">{error}</Banner> : null}
            {live && run ? (
              run.mode === "reports" && !importing ? (
                <SyncProgress
                  org={connection?.tenantName}
                  pagesDone={run.pagesDone}
                  pagesTotal={run.pagesTotal}
                  meta={`${(run.monthsStored ?? 0).toLocaleString("en-IE")} month${run.monthsStored === 1 ? "" : "s"} read from Xero's trial balance`}
                  phase={Math.max(0, REPORT_PHASES.indexOf(run.phase))}
                  phases={["Accounts", "Monthly balances", "Daily cash", "Invoices", "Reports", "Check against Xero"]}
                />
              ) : (
                <SyncProgress
                  org={connection?.tenantName}
                  title={importing ? `Importing ${workspace.org.sourceLabel ?? "your file"}` : undefined}
                  pagesDone={run.pagesDone}
                  pagesTotal={run.pagesEstimate}
                  journals={run.journalsStored}
                  phase={Math.max(0, (importing ? IMPORT_PHASES : PHASES).indexOf(run.phase))}
                  phases={importing ? ["Chart of accounts", "Journals", "Reports"] : undefined}
                />
              )
            ) : null}
            <SummaryLine
              figures={[
                { label: "Figures from", value: imported ? (workspace.org.source === "sample" ? "Sample company" : "CSV import") : connection ? "Xero" : "Nowhere yet", note: imported ? workspace.org.sourceLabel ?? undefined : connection?.tenantName },
                { label: "Actuals to", value: workspace.org.asOf ? periodLabel(workspace.org.asOf) : "–", note: "the latest month with figures" },
                { label: imported ? "Imported" : "Last sync", value: imported ? (workspace.org.importedAt ? ago(workspace.org.importedAt) : "–") : connection?.lastSyncAt ? ago(connection.lastSyncAt) : "Not yet", note: imported ? "stays as is until you import again" : connection ? "nightly at 02:00, and on every change" : undefined },
                { label: "Journals stored", value: (imported ? (run && run.source !== "xero" ? run.journalsStored : 0) : connection?.mode === "reports" ? 0 : (connection?.journalsStored ?? 0)).toLocaleString("en-IE"), note: connection?.mode === "reports" ? "monthly balances instead" : "every line, balanced" },
              ]}
            />
            <ReportGrid
              main={
                <div className="ll-stack-lg">
                  <section className="ll-report-hero is-flush">
                    <header className="ll-section-head">
                      <h2>History</h2>
                      <span>Every sync and import, newest first</span>
                    </header>
                    {history && history.length ? (
                      <DataTable
                        columns={[
                          { key: "started", label: "Started", render: (r: { startedAt: number }) => when(r.startedAt) },
                          { key: "trigger", label: "Trigger" },
                          { key: "journalsStored", label: "New journals", numeric: true, render: (r: { journalsStored: number }) => r.journalsStored.toLocaleString("en-IE") },
                          { key: "took", label: "Took", numeric: true, render: (r: { startedAt: number; finishedAt: number | null }) => took(r.startedAt, r.finishedAt) },
                          {
                            key: "status",
                            label: "Result",
                            render: (r: { status: string; source: string; error: string | null }) => {
                              const pill = STATUS_PILL[r.status] ?? STATUS_PILL.queued;
                              const word = r.source !== "xero" && r.status === "done" ? "Imported" : pill.word;
                              return <span title={r.error ?? undefined}><StatusPill status={pill.status}>{word}</StatusPill></span>;
                            },
                          },
                        ]}
                        rows={history}
                      />
                    ) : (
                      <p className="ll-muted ll-pad">Nothing synced or imported yet.</p>
                    )}
                  </section>
                  <div id="import">
                    <ImportPanel workspace={workspace} />
                  </div>
                </div>
              }
              rail={
                <>
                  <RailBlock title={imported ? (workspace.org.source === "sample" ? "Sample company" : "Imported file") : "Xero connection"} aside={<StatusPill status={imported ? (run?.status === "failed" ? "error" : "synced") : connection?.status === "connected" ? "connected" : "disconnected"} />}>
                    {imported ? (
                      <>
                        <Facts rows={[["Company", workspace.org.sourceLabel ?? (workspace.org.source === "sample" ? "Kestrel Joinery Ltd" : "Imported file")], ["Imported", workspace.org.importedAt ? ago(workspace.org.importedAt) : "–"], ["Updates", "When you import again"]]} />
                        <a href="#import"><Button size="sm" icon="upload">Import a new file</Button></a>
                      </>
                    ) : connection ? (
                      <>
                        <Facts
                          rows={[
                            ["Organisation", connection.tenantName],
                            ["Access", "Read-only"],
                            ["Detail", connection.mode === "reports" ? "Monthly balances and documents" : "Every journal line"],
                            ...(connection.mode === "reports"
                              ? ([["History", connection.historyFrom && connection.balancesThrough ? `${periodLabel(connection.historyFrom)} to ${periodLabel(connection.balancesThrough)}` : "Not yet"]] as [string, string][])
                              : ([["Last journal", `#${connection.lastJournalNumber.toLocaleString("en-IE")}`]] as [string, string][])),
                            ["Connected", new Date(connection.connectedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })],
                          ]}
                        />
                        <div className="ll-row">
                          {connection.status === "connected" ? (
                            <>
                              <a href="https://go.xero.com" target="_blank" rel="noreferrer"><Button size="sm" icon="external">Open Xero</Button></a>
                              {workspace.role === "owner" ? <ConnectButton label="Switch" variant="ghost" /> : null}
                              {workspace.role === "owner" ? <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>Disconnect</Button> : null}
                            </>
                          ) : (
                            <ConnectButton label="Reconnect" />
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="ll-rail-note">Read-only access to your accounts, monthly balances, invoices and payments. Synced nightly and checked against Xero.</p>
                        <ConnectButton />
                      </>
                    )}
                  </RailBlock>
                  {connection && !imported ? (
                    <RailBlock title="Checked against Xero">
                      <Reconciliation />
                    </RailBlock>
                  ) : null}
                  <RailBlock title="How figures stay current">
                    <ul className="ll-rail-list">
                      {connection?.mode === "reports" ? <li>Xero shares journals only with approved apps, so Ledgerline reads each month-end trial balance: two years at first, then the last three months nightly.</li> : null}
                      <li>From Xero: every night at 02:00, and within a minute of a change.</li>
                      <li>From a file: as imported, until you import again.</li>
                      <li>Every journal must balance, and every month becomes the same three statements.</li>
                    </ul>
                  </RailBlock>
                </>
              }
            />
          </>
        );
      }}
    </AppPage>
  );
}

export default function SyncPage() {
  return (
    <Suspense>
      <SyncScreen />
    </Suspense>
  );
}
