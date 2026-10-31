"use client";

import { OrganizationSwitcher, UserButton, useAuth, useUser } from "@clerk/nextjs";
import { AppShell, StatusPill } from "@ledgerline/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ago } from "@/lib/format";
import { NAV_ITEMS, ROUTES, type NavId } from "@/lib/nav";
import { ThemeToggle } from "../ThemeToggle";
import { useGlide } from "./useGlide";
import { useCompanyLimit, useWorkspace } from "./useWorkspace";

/** What a page tells the frame about itself: the rest of the frame stays mounted from page to page. */
export interface PageHead {
  active: NavId | "settings";
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
}

interface Frame {
  workspace: ReturnType<typeof useWorkspace>;
  companyLimit: ReturnType<typeof useCompanyLimit>;
  setHead: (head: PageHead) => void;
  /** Where a page's actions and overlay render, inside the frame's top bar and shell. */
  actionsSlot: HTMLElement | null;
  overlaySlot: HTMLElement | null;
}

const FrameContext = createContext<Frame | null>(null);

export function useFrame() {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error("AppPage must render inside AppFrame (app/(app)/layout.tsx).");
  return frame;
}

const COLLAPSED_KEY = "ll-sidebar-collapsed";

// What glides when a page's layout jumps (see useGlide): every block the pages are built from, and any top-level
// block that holds none of them. Only the innermost match moves, so nothing glides twice.
const GLIDES = ".ll-flow > *, .ll-summary > div, .ll-takeaway, .ll-brief, .ll-glide, .ll-report-hero, .ll-rail-block, .ll-panel, .ll-banner";

/**
 * Between 901 and 1319px of window the sidebar shows as icons unless it's opened. The page's main column is the width
 * every page lays itself out by, and a full sidebar arriving at 900px would take 262px from it at once: the column
 * would grow to 899px, drop to 638px and grow again, so every fold between those widths (two figures across, a rail
 * beside a chart, a list beside a form) would happen, undo itself and happen again as the window widened. The icons
 * take 72px, from 899 to about 829, where no page folds; the full sidebar arrives at 1320px, taking the column from
 * about 1246 to 1058, where no page folds either. So the column only grows between jumps, and each fold happens once.
 */
const ICONS_BETWEEN = "(min-width: 901px) and (max-width: 1319px)";

const inIconsBand = () => window.matchMedia(ICONS_BETWEEN).matches;

function useIconsBand() {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(ICONS_BETWEEN);
      query.addEventListener("change", changed);
      return () => query.removeEventListener("change", changed);
    },
    inIconsBand,
    () => false,
  );
}

/**
 * Whether the sidebar is narrowed to icons: remembered per browser, toggled with "[" anywhere but a text field. In the
 * icons band it starts narrowed, and the toggle opens it for this visit without changing what's remembered.
 */
function useCollapsed() {
  const [remembered, setRemembered] = useState(false);
  const [opened, setOpened] = useState(false);
  const band = useIconsBand();
  useEffect(() => {
    try {
      setRemembered(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
  }, []);
  const toggle = () => {
    if (inIconsBand()) return setOpened((was) => !was);
    setRemembered((was) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, was ? "0" : "1");
      } catch {}
      return !was;
    });
  };
  const collapsed = band ? !opened : remembered;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, textarea, select, [contenteditable=true]")) return;
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return [collapsed, toggle] as const;
}

function NextLink({ href, ...rest }: { href: string } & Record<string, unknown>) {
  return <Link href={href} {...rest} />;
}

const sameHead = (a: PageHead, b: PageHead) =>
  a.active === b.active && a.title === b.title && a.subtitle === b.subtitle && (a.breadcrumbs ?? []).join("\u0000") === (b.breadcrumbs ?? []).join("\u0000");

/**
 * The app's sidebar, top bar and workspace, rendered once by the app layout. Pages swap only their own content, so
 * moving between them keeps the sidebar, the company switcher and the workspace subscription where they are.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const companyLimit = useCompanyLimit(workspace);
  const { orgId, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [collapsed, toggleCollapsed] = useCollapsed();
  // On a phone the navigation opens over the page and closes once a page is chosen: it is open only on the page
  // where it was opened.
  const path = usePathname();
  const [navOpenOn, setNavOpenOn] = useState<string | null>(null);
  const navOpen = navOpenOn !== null && navOpenOn === path;
  const setNavOpen = (open: boolean) => setNavOpenOn(open ? path : null);
  const [head, setHeadState] = useState<PageHead>({ active: "overview", title: "" });
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [overlaySlot, setOverlaySlot] = useState<HTMLElement | null>(null);
  const setHead = useCallback((next: PageHead) => setHeadState((was) => (sameHead(was, next) ? was : next)), []);

  useEffect(() => {
    if (isLoaded && !orgId) router.replace("/onboarding");
  }, [isLoaded, orgId, router]);

  const userName = user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || workspace?.user || "";
  const roleName = workspace ? { owner: "Owner", editor: "Editor", accountant: "Accountant" }[workspace.role] : "";
  const syncing = workspace?.lastSync && ["queued", "running", "backingOff"].includes(workspace.lastSync.status);
  const imported = workspace?.org.source === "csv" || workspace?.org.source === "sample";

  const sidebar = {
    linkAs: NextLink,
    items: NAV_ITEMS,
    homeHref: ROUTES.overview,
    collapsed: collapsed && !navOpen,
    onCollapse: navOpen ? () => setNavOpen(false) : toggleCollapsed,
    org: workspace?.org.name,
    settingsHref: ROUTES.settings,
    runway: null as number | null,
    user: userName || " ",
    role: roleName || " ",
    syncing: Boolean(syncing),
    syncText: syncing
      ? `${workspace?.lastSync?.source === "xero" ? "Syncing" : "Importing"} · ${workspace?.lastSync?.journalsStored ?? 0} journals`
      : imported
        ? `Imported ${ago(workspace?.org.importedAt)}`
        : workspace?.connection
          ? `Synced ${ago(workspace.connection.lastSyncAt)}`
          : "No figures yet",
    orgSwitcher: (
      <OrganizationSwitcher
        hidePersonal
        afterSelectOrganizationUrl="/overview"
        afterCreateOrganizationUrl="/onboarding"
        appearance={{
          elements: {
            rootBox: "ll-orgswitch",
            organizationSwitcherTrigger: "ll-orgswitch-trigger",
            organizationPreviewAvatarBox: "ll-orgswitch-avatar",
            organizationPreviewMainIdentifier: "ll-orgswitch-name",
            organizationSwitcherTriggerIcon: "ll-orgswitch-chev",
          },
        }}
      />
    ),
    userAvatar: <UserButton />,
    userMenu: <ThemeToggle />,
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

  const flow = useRef<HTMLDivElement>(null);
  useGlide(flow, GLIDES);

  const frame = useMemo(() => ({ workspace, companyLimit, setHead, actionsSlot, overlaySlot }), [workspace, companyLimit, setHead, actionsSlot, overlaySlot]);

  return (
    <FrameContext.Provider value={frame}>
      <AppShell
        active={head.active}
        title={head.title}
        subtitle={head.subtitle}
        breadcrumbs={head.breadcrumbs}
        status={status}
        actions={<span className="ll-slot" ref={setActionsSlot} />}
        overlay={<div className="ll-slot" ref={setOverlaySlot} />}
        sidebar={sidebar}
        navOpen={navOpen}
        onMenu={() => setNavOpen(!navOpen)}
      >
        <div className="ll-flow" ref={flow}>
          {children}
        </div>
      </AppShell>
    </FrameContext.Provider>
  );
}
