"use client";

import { Banner, Button, EmptyState, Icon } from "@ledgerline/ui";
import { useAction } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/convex/_generated/api";
import { ago, periodLabel } from "@/lib/format";
import { ROUTES, type NavId } from "@/lib/nav";
import { clerkConfigured, convexConfigured } from "@/lib/config";
import { BackendStatus } from "./BackendStatus";
import { useFrame } from "./AppFrame";
import { ImportProgress, useImport } from "./ImportPanel";
import { SetupNeeded } from "./SetupNeeded";
import type { Workspace } from "./useWorkspace";

interface Props {
  active: NavId | "settings";
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
  overlay?: ReactNode;
  /** Pages that show synced figures pass true: they explain what to do when nothing has synced yet. */
  needsData?: boolean;
  children: (workspace: Workspace) => ReactNode;
}

export function AppPage(props: Props) {
  if (!convexConfigured || !clerkConfigured) return <SetupNeeded />;
  return <PageInFrame {...props} />;
}

/** One page inside the app frame: its title and actions go to the frame's top bar, its body to the page area. */
function PageInFrame({ active, title, subtitle, breadcrumbs, actions, overlay, needsData, children }: Props) {
  const { workspace, companyLimit, setHead, actionsSlot, overlaySlot } = useFrame();
  const crumbs = breadcrumbs?.join("\u0000");
  useLayoutEffect(() => {
    setHead({ active, title, subtitle, breadcrumbs: crumbs ? crumbs.split("\u0000") : undefined });
  }, [setHead, active, title, subtitle, crumbs]);

  let body: ReactNode;
  if (workspace === null && companyLimit) {
    body = <CompanyLimit limit={companyLimit.limit} names={companyLimit.names} />;
  } else if (workspace === undefined || workspace === null) {
    body = <BackendStatus waiting />;
  } else if (needsData && !workspace.org.asOf) {
    const finished = workspace.lastSync && ["done", "needsReview"].includes(workspace.lastSync.status);
    body =
      finished && workspace.connection && workspace.org.source !== "csv" && workspace.org.source !== "sample" ? (
        <EmptyXero workspace={workspace} />
      ) : workspace.connection || workspace.lastSync ? (
        <FirstSyncPending workspace={workspace} />
      ) : (
        <NoFigures workspace={workspace} />
      );
  } else {
    body = (
      <>
        <ConnectionBanner workspace={workspace} />
        {children(workspace)}
      </>
    );
  }

  return (
    <>
      {actions && actionsSlot ? createPortal(actions, actionsSlot) : null}
      {overlay && overlaySlot ? createPortal(overlay, overlaySlot) : null}
      {body}
    </>
  );
}

function ConnectionBanner({ workspace }: { workspace: Workspace }) {
  const connection = workspace.connection;
  const run = workspace.lastSync;
  if (connection && connection.status !== "connected") {
    return (
      <Banner tone="negative" title="Xero disconnected." action={<ConnectButton label="Reconnect" size="sm" />}>
        Ledgerline can no longer read your Xero organisation. Figures below are from the last sync{connection.lastSyncAt ? `, ${ago(connection.lastSyncAt)}` : ""}.
      </Banner>
    );
  }
  if (run?.status === "failed" && run.source !== "xero") {
    return (
      <Banner tone="warning" title="The last import didn't finish." action={<Link href={ROUTES.sync}><Button size="sm">See import</Button></Link>}>
        {run.error ?? "Import the files again from Sync and import."} Figures below are from before it.
      </Banner>
    );
  }
  if (run?.status === "failed") {
    return (
      <Banner tone="warning" title="The last sync failed.">
        {run.error ?? "Ledgerline will try again tonight."} Figures from the last good sync are kept.
      </Banner>
    );
  }
  if (run?.status === "backingOff" && run.error) {
    return <Banner tone="info" title="Waiting on Xero.">{run.error}</Banner>;
  }
  return null;
}

export function ConnectButton({
  label = "Connect Xero",
  size = "md" as "sm" | "md" | "lg",
  variant = "primary" as "primary" | "secondary" | "ghost",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const begin = useAction(api.xero.beginConnect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="ll-row">
      <Button
        variant={variant}
        icon="link"
        size={size}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            window.location.href = await begin();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not reach Xero.");
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {error ? <span style={{ color: "var(--negative)", fontSize: 13 }}>{error}</span> : null}
    </span>
  );
}

/** Nothing synced or imported yet: offer every way in. */
export function DataSources({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const { sample, progress, error, busy } = useImport();
  const canWrite = workspace.role !== "accountant";
  return (
    <div className="ll-stack">
      <div className="ll-sources">
        <div className="ll-source">
          <h3><span className="ll-source-icon"><Icon name="plug" size={16} /></span>Connect Xero</h3>
          <p>Read-only access to one Xero organisation. Synced nightly and checked against Xero to the cent.</p>
          <div><ConnectButton size="sm" /></div>
        </div>
        <div className="ll-source">
          <h3><span className="ll-source-icon"><Icon name="upload" size={16} /></span>Import from CSV</h3>
          <p>A chart of accounts and a journal listing from any accounting system or spreadsheet.</p>
          <div><Link href={`${ROUTES.sync}#import`}><Button size="sm" icon="upload">Choose files</Button></Link></div>
        </div>
        <div className="ll-source">
          <h3><span className="ll-source-icon"><Icon name="database" size={16} /></span>Try the sample company</h3>
          <p>Two years of Kestrel Joinery Ltd, an Irish joinery: 940 journals, every statement tying out.</p>
          <div>
            <Button size="sm" disabled={!canWrite || busy} loading={busy} onClick={async () => { if (await sample()) router.push(ROUTES.overview); }}>
              Load sample
            </Button>
          </div>
        </div>
      </div>
      <ImportProgress progress={progress} />
      {error ? <Banner tone="negative" title="Sample not loaded.">{error}</Banner> : null}
    </div>
  );
}

function NoFigures({ workspace }: { workspace: Workspace }) {
  return (
    <div className="ll-panel ll-nofigures">
      <EmptyState icon="database" title="Add your figures to get started">
        Ledgerline builds management accounts and a three-statement forecast from your ledger. Choose where the figures come from.
      </EmptyState>
      <DataSources workspace={workspace} />
    </div>
  );
}

/** The sync worked but the Xero organisation has nothing in it yet (a new trial organisation, for example). */
function EmptyXero({ workspace }: { workspace: Workspace }) {
  const connection = workspace.connection!;
  return (
    <div className="ll-panel">
      <EmptyState
        icon="database"
        title={`${connection.tenantName} has no transactions yet`}
        action={
          workspace.role === "owner" ? (
            <span className="ll-row">
              <ConnectButton label="Switch Xero organisation" />
              <Link href={ROUTES.sync}>
                <Button>See the sync</Button>
              </Link>
            </span>
          ) : null
        }
      >
        Ledgerline read {connection.tenantName}
        {connection.historyFrom ? ` back to ${periodLabel(connection.historyFrom)}` : ""} and found nothing to report. A new Xero organisation starts empty. To see
        Ledgerline with real figures, switch to Xero&apos;s Demo Company, which is under the same Xero login, or add transactions in Xero and sync again.
      </EmptyState>
    </div>
  );
}

function FirstSyncPending({ workspace }: { workspace: Workspace }) {
  const run = workspace.lastSync;
  return (
    <div className="ll-panel">
      <EmptyState
        icon={run?.source === "xero" ? "sync" : "upload"}
        title={run?.status === "failed" ? `The ${run.source === "xero" ? "first sync" : "import"} didn't finish` : run?.source === "xero" ? "Your first sync is running" : "Your import is running"}
        action={<Link href={ROUTES.sync}><Button icon="sync">{run?.status === "failed" ? "Try again" : "See progress"}</Button></Link>}
      >
        {run?.status === "failed"
          ? run.error ?? "Try again from Sync and import."
          : run?.mode === "reports"
            ? `${(run.monthsStored ?? 0).toLocaleString("en-IE")} months read from Xero so far. Reports appear as soon as it finishes.`
            : `${(run?.journalsStored ?? 0).toLocaleString("en-IE")} journals stored so far. Reports appear as soon as it finishes.`}
      </EmptyState>
    </div>
  );
}

/** The Free plan's companies are used: say so, and point back to the ones that exist. */
export function CompanyLimit({ limit, names }: { limit: number; names: string[] }) {
  return (
    <Banner tone="warning" title={`The Free plan has ${limit} companies, and you've set up both.`}>
      This organisation wasn&apos;t set up in Ledgerline. Switch to {names.length ? names.join(" or ") : "one of your companies"} from the company menu, or remove one there first.
      Paid plans with more companies are coming soon.
    </Banner>
  );
}
