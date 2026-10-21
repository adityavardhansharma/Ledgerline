"use client";

import { OrganizationSwitcher, UserButton, useAuth } from "@clerk/nextjs";
import { AppShell, Banner, Button, EmptyState, Skeleton, StatusPill } from "@ledgerline/ui";
import { useAction } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { ago } from "@/lib/format";
import { NAV_ITEMS, ROUTES, type NavId } from "@/lib/nav";
import { ThemeToggle } from "../ThemeToggle";
import { useWorkspace, type Workspace } from "./useWorkspace";

const convexConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

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
  if (!convexConfigured) return <SetupNeeded />;
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
  const sidebar = {
    linkAs: NextLink,
    items: NAV_ITEMS,
    settingsHref: ROUTES.settings,
    runway: null as number | null,
    syncing: Boolean(syncing),
    syncText: syncing ? `Syncing · ${workspace?.lastSync?.journalsStored ?? 0} journals` : `Synced ${ago(workspace?.connection?.lastSyncAt)}`,
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

  const status = workspace?.connection ? (
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
  } else if (needsData && !workspace.connection) {
    body = <NotConnected />;
  } else if (needsData && !workspace.org.asOf) {
    body = <FirstSyncPending workspace={workspace} />;
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

function NotConnected() {
  return (
    <div className="ll-panel">
      <EmptyState icon="plug" title="Connect Xero to see your figures" action={<ConnectButton />}>
        Ledgerline reads your journals, accounts and invoices with read-only access, then builds your management accounts and checks them against Xero to the cent.
      </EmptyState>
    </div>
  );
}

function FirstSyncPending({ workspace }: { workspace: Workspace }) {
  const run = workspace.lastSync;
  return (
    <div className="ll-panel">
      <EmptyState icon="sync" title={run?.status === "failed" ? "The first sync failed" : "Your first sync is running"} action={<Link href={ROUTES.sync}><Button icon="sync">See sync progress</Button></Link>}>
        {run?.status === "failed"
          ? run.error ?? "Try again from Sync and Xero."
          : `${(run?.journalsStored ?? 0).toLocaleString("en-IE")} journals stored so far. Reports appear as soon as the sync finishes.`}
      </EmptyState>
    </div>
  );
}

function SetupNeeded() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 16px" }}>
      <Banner tone="info" title="Ledgerline needs a Convex backend.">
        Run <code>npx convex dev</code> in apps/web, set the environment variables listed in .env.example, and start the finance engine. The README walks through it.
      </Banner>
    </main>
  );
}
