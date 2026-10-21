"use client";

import { OrganizationSwitcher, UserButton, useAuth } from "@clerk/nextjs";
import { AppShell, Banner, Button, EmptyState, Icon, Skeleton, StatusPill } from "@ledgerline/ui";
import { useAction } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { ago } from "@/lib/format";
import { NAV_ITEMS, ROUTES, type NavId } from "@/lib/nav";
import { clerkConfigured, convexConfigured } from "@/lib/config";
import { ThemeToggle } from "../ThemeToggle";
import { ImportProgress, useImport } from "./ImportPanel";
import { SetupNeeded } from "./SetupNeeded";
import { useWorkspace, type Workspace } from "./useWorkspace";


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

function NextLink({ href, ...rest }: { href: string } & Record<string, unknown>) {
  return <Link href={href} {...rest} />;
}

export function AppPage(props: Props) {
  if (!convexConfigured || !clerkConfigured) return <SetupNeeded />;
  return <ConnectedPage {...props} />;
}

function ConnectedPage({ active, title, subtitle, breadcrumbs, actions, overlay, needsData, children }: Props) {
  const workspace = useWorkspace();
  const { orgId, isLoaded } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (isLoaded && !orgId) router.replace("/onboarding");
  }, [isLoaded, orgId, router]);

  const syncing = workspace?.lastSync && ["queued", "running", "backingOff"].includes(workspace.lastSync.status);
  const imported = workspace?.org.source === "csv" || workspace?.org.source === "sample";
  const sidebar = {
    linkAs: NextLink,
    items: NAV_ITEMS,
    settingsHref: ROUTES.settings,
    runway: null as number | null,
    syncing: Boolean(syncing),
    syncText: syncing
      ? `${workspace?.lastSync?.source === "xero" ? "Syncing" : "Importing"} · ${workspace?.lastSync?.journalsStored ?? 0} journals`
      : imported
        ? `Imported ${ago(workspace?.org.importedAt)}`
        : workspace?.connection
          ? `Synced ${ago(workspace.connection.lastSyncAt)}`
          : "No figures yet",
    orgSwitcher: (
      <div className="ll-org" style={{ padding: 4 }}>
        <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/overview" afterCreateOrganizationUrl="/onboarding" />
      </div>
    ),
    userMenu: (
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <ThemeToggle />
        <UserButton />
      </span>
    ),
  };

  const status = imported && !syncing ? (
    <StatusPill status="synced">{workspace?.org.source === "sample" ? "Sample company" : "Imported"} {ago(workspace?.org.importedAt)}</StatusPill>
  ) : workspace?.connection ? (
    syncing ? (
      <StatusPill status="syncing">Syncing</StatusPill>
    ) : workspace.connection.status !== "connected" ? (
      <StatusPill status="disconnected" />
    ) : workspace.lastSync?.status === "needsReview" ? (
      <StatusPill status="mismatch" />
    ) : (
      <StatusPill status="synced">Synced {ago(workspace.connection.lastSyncAt)}</StatusPill>
    )
  ) : null;

  let body: ReactNode;
  if (workspace === undefined || workspace === null) {
    body = (
      <div className="ll-stack">
        <Skeleton height={96} />
        <Skeleton height={280} />
      </div>
    );
  } else if (needsData && !workspace.org.asOf) {
    body = workspace.connection || workspace.lastSync ? <FirstSyncPending workspace={workspace} /> : <NoFigures workspace={workspace} />;
  } else {
    body = (
      <>
        <ConnectionBanner workspace={workspace} />
        {children(workspace)}
      </>
    );
  }

  return (
    <AppShell
      active={active}
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      status={status}
      actions={actions}
      overlay={overlay}
      sidebar={sidebar}
    >
      {body}
    </AppShell>
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

export function ConnectButton({ label = "Connect Xero", size = "md" as "sm" | "md" | "lg" }: { label?: string; size?: "sm" | "md" | "lg" }) {
  const begin = useAction(api.xero.beginConnect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="ll-row">
      <Button
        variant="primary"
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
          <h3><Icon name="plug" size={18} />Connect Xero</h3>
          <p>Read-only access to one Xero organisation. Synced nightly and checked against Xero to the cent.</p>
          <div><ConnectButton size="sm" /></div>
        </div>
        <div className="ll-source">
          <h3><Icon name="upload" size={18} />Import from CSV</h3>
          <p>A chart of accounts and a journal listing from any accounting system or spreadsheet.</p>
          <div><Link href={`${ROUTES.sync}#import`}><Button size="sm" icon="upload">Choose files</Button></Link></div>
        </div>
        <div className="ll-source">
          <h3><Icon name="database" size={18} />Try the sample company</h3>
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
    <div className="ll-panel">
      <EmptyState icon="database" title="Add your figures to get started">
        Ledgerline builds management accounts and a three-statement forecast from your ledger. Choose where the figures come from.
      </EmptyState>
      <DataSources workspace={workspace} />
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
