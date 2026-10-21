"use client";

import { Banner, Button, DataTable, Dialog, IntegrationCard, Panel, StatusPill, SyncProgress } from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppPage, ConnectButton } from "@/components/app/AppPage";
import { ImportPanel } from "@/components/app/ImportPanel";
import { Reconciliation } from "@/components/app/Reconciliation";
import { useWorkspace, type Workspace } from "@/components/app/useWorkspace";
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

function ImportedCard({ workspace }: { workspace: Workspace }) {
  const { org, lastSync } = workspace;
  const sample = org.source === "sample";
  return (
    <IntegrationCard
      name={sample ? "Sample company" : "CSV import"}
      org={org.sourceLabel ?? (sample ? "Kestrel Joinery Ltd" : "Imported file")}
      status={lastSync?.status === "failed" ? "error" : "synced"}
      facts={[
        ["Imported", org.importedAt ? ago(org.importedAt) : "–"],
        ["Journals", (lastSync && lastSync.source !== "xero" ? lastSync.journalsStored : 0).toLocaleString("en-IE")],
        ["Actuals to", org.asOf ? periodLabel(org.asOf) : "Not built yet"],
        ["Updates", "When you import again"],
      ]}
      actions={
        <a href="#import">
          <Button variant="ghost" icon="upload">Import a new file</Button>
        </a>
      }
    />
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
                setError(err instanceof Error ? err.message.replace(/^.*ConvexError: /, "") : "Couldn't start a sync.");
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
            <div className="ll-grid-2">
              {imported ? (
                <ImportedCard workspace={workspace} />
              ) : connection ? (
                <IntegrationCard
                  name="Xero"
                  org={connection.tenantName}
                  status={connection.status === "connected" ? "connected" : "disconnected"}
                  facts={[
                    ["Last sync", connection.lastSyncAt ? ago(connection.lastSyncAt) : "Not yet"],
                    ...(connection.mode === "reports"
                      ? ([
                          ["Detail", "Monthly balances and documents"],
                          ["History", connection.historyFrom && connection.balancesThrough ? `${periodLabel(connection.historyFrom)} to ${periodLabel(connection.balancesThrough)}` : "Not yet"],
                        ] as [string, string][])
                      : ([
                          ["Detail", "Every journal line"],
                          ["Journals stored", connection.journalsStored.toLocaleString("en-IE")],
                          ["Last journal", `#${connection.lastJournalNumber.toLocaleString("en-IE")}`],
                        ] as [string, string][])),
                    ["Access", "Read-only"],
                    ["Connected", new Date(connection.connectedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })],
                    ["Token renews", connection.tokenExpiresAt > Date.now() ? `in ${Math.round((connection.tokenExpiresAt - Date.now()) / 60000)} min` : "on next sync"],
                  ]}
                  actions={
                    connection.status === "connected" ? (
                      <>
                        <a href="https://go.xero.com" target="_blank" rel="noreferrer"><Button variant="ghost" icon="external">Open Xero</Button></a>
                        {workspace.role === "owner" ? <ConnectButton label="Switch organisation" variant="ghost" /> : null}
                        {workspace.role === "owner" ? <Button variant="danger" onClick={() => setConfirming(true)}>Disconnect</Button> : null}
                      </>
                    ) : (
                      <ConnectButton label="Reconnect" />
                    )
                  }
                />
              ) : (
                <Panel title="Connect Xero" icon="plug">
                  <div className="ll-stack">
                    <p>Ledgerline reads your accounts, monthly balances, invoices and payments with read-only access, syncs nightly and checks every figure against Xero.</p>
                    <ConnectButton />
                  </div>
                </Panel>
              )}
              <Panel title="How your figures stay current" icon="sync">
                <ul className="ll-perm" style={{ gridTemplateColumns: "1fr" }}>
                  {connection?.mode === "reports" ? (
                    <li>
                      Xero shares journals only with apps it has approved for them, so Ledgerline reads each month-end trial balance instead: two years on the first sync, then the last three
                      months every night. Clicking a figure shows the invoices, bills, payments and bank transactions behind it.
                    </li>
                  ) : null}
                  <li>Connected to Xero, Ledgerline syncs every night at 02:00 and within a minute of a change.</li>
                  <li>Imported from CSV, figures stay as they are until you import again. Each import replaces the last.</li>
                  <li>Either way, every journal must balance, and every month is built into the same three statements.</li>
                  <li>Connecting Xero later replaces imported figures with Xero's own.</li>
                </ul>
              </Panel>
            </div>
            <div id="import">
              <ImportPanel workspace={workspace} />
            </div>
            {connection && !imported ? <Reconciliation /> : null}
            <Panel title="History" icon="clock" flush>
              <div style={{ padding: "0 20px 20px" }}>
                {history && history.length ? (
                  <DataTable
                    columns={[
                      { key: "started", label: "Started", render: (r: { startedAt: number }) => when(r.startedAt) },
                      { key: "trigger", label: "Trigger" },
                      { key: "pagesDone", label: "Batches", numeric: true },
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
                  <p className="ll-muted">Nothing synced or imported yet.</p>
                )}
              </div>
            </Panel>
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
