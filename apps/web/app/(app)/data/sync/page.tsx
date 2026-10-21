"use client";

import { Banner, Button, DataTable, Dialog, IntegrationCard, Panel, StatusPill, SyncProgress } from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppPage, ConnectButton } from "@/components/app/AppPage";
import { Reconciliation } from "@/components/app/Reconciliation";
import { api } from "@/convex/_generated/api";
import { ago } from "@/lib/format";

const PHASES = ["accounts", "journals", "invoices", "reports", "reconcile"];
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

function SyncScreen() {
  const params = useSearchParams();
  const history = useQuery(api.sync.history, { limit: 25 });
  const request = useMutation(api.sync.request);
  const disconnect = useMutation(api.xero.disconnect);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AppPage
      active="sync"
      title="Sync and Xero"
      subtitle="Read-only connection, synced nightly and whenever Xero tells us something changed"
      breadcrumbs={["Data", "Sync and Xero"]}
      actions={
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
            <p>Ledgerline stops syncing. Reports keep the figures from the last sync, and you can reconnect at any time.</p>
          </Dialog>
        ) : null
      }
    >
      {(workspace) => {
        const connection = workspace.connection;
        const run = workspace.lastSync;
        const live = run && ["queued", "running", "backingOff"].includes(run.status);
        return (
          <>
            {params.get("connected") ? <Banner tone="positive" title="Xero connected.">Your first sync has started. Reports appear as soon as it finishes.</Banner> : null}
            {error ? <Banner tone="negative" title="Sync not started.">{error}</Banner> : null}
            {live && run ? (
              <SyncProgress
                org={connection?.tenantName}
                pagesDone={run.pagesDone}
                pagesTotal={run.pagesEstimate}
                journals={run.journalsStored}
                phase={Math.max(0, PHASES.indexOf(run.phase))}
                phases={["Accounts", "Journals", "Invoices", "Reports", "Check against Xero"]}
              />
            ) : null}
            {connection ? (
              <div className="ll-grid-2">
                <IntegrationCard
                  name="Xero"
                  org={connection.tenantName}
                  status={connection.status === "connected" ? "connected" : "disconnected"}
                  facts={[
                    ["Last sync", connection.lastSyncAt ? ago(connection.lastSyncAt) : "Not yet"],
                    ["Journals stored", connection.journalsStored.toLocaleString("en-IE")],
                    ["Last journal", `#${connection.lastJournalNumber.toLocaleString("en-IE")}`],
                    ["Access", "Read-only"],
                    ["Connected", new Date(connection.connectedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })],
                    ["Token renews", connection.tokenExpiresAt > Date.now() ? `in ${Math.round((connection.tokenExpiresAt - Date.now()) / 60000)} min` : "on next sync"],
                  ]}
                  actions={
                    connection.status === "connected" ? (
                      <>
                        <a href="https://go.xero.com" target="_blank" rel="noreferrer"><Button variant="ghost" icon="external">Open Xero</Button></a>
                        {workspace.role === "owner" ? <Button variant="danger" onClick={() => setConfirming(true)}>Disconnect</Button> : null}
                      </>
                    ) : (
                      <ConnectButton label="Reconnect" />
                    )
                  }
                />
                <Panel title="How syncing works" icon="sync">
                  <ul className="ll-perm" style={{ gridTemplateColumns: "1fr" }}>
                    <li>Every night at 02:00 Ledgerline reads new journals since the last one it stored.</li>
                    <li>When an invoice or contact changes in Xero, a webhook triggers a sync within a minute.</li>
                    <li>If Xero's Demo Company resets, Ledgerline notices and resyncs from the start.</li>
                    <li>After every sync, each account is compared with Xero's own reports.</li>
                  </ul>
                </Panel>
              </div>
            ) : (
              <Panel title="Connect Xero" icon="plug">
                <div className="ll-stack">
                  <p>Ledgerline needs read-only access to one Xero organisation.</p>
                  <ConnectButton />
                </div>
              </Panel>
            )}
            <Reconciliation />
            <Panel title="Sync history" icon="clock" flush>
              <div style={{ padding: "0 20px 20px" }}>
                {history && history.length ? (
                  <DataTable
                    columns={[
                      { key: "started", label: "Started", render: (r: { startedAt: number }) => when(r.startedAt) },
                      { key: "trigger", label: "Trigger" },
                      { key: "pagesDone", label: "Pages", numeric: true },
                      { key: "journalsStored", label: "New journals", numeric: true, render: (r: { journalsStored: number }) => r.journalsStored.toLocaleString("en-IE") },
                      { key: "took", label: "Took", numeric: true, render: (r: { startedAt: number; finishedAt: number | null }) => took(r.startedAt, r.finishedAt) },
                      {
                        key: "status",
                        label: "Result",
                        render: (r: { status: string; error: string | null }) => {
                          const pill = STATUS_PILL[r.status] ?? STATUS_PILL.queued;
                          return <span title={r.error ?? undefined}><StatusPill status={pill.status}>{pill.word}</StatusPill></span>;
                        },
                      },
                    ]}
                    rows={history}
                  />
                ) : (
                  <p className="ll-muted">No syncs yet.</p>
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
