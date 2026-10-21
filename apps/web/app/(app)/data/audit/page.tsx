"use client";

import { AuditTimeline, Button, Panel } from "@ledgerline/ui";
import { usePaginatedQuery } from "convex/react";
import { AppPage } from "@/components/app/AppPage";
import { api } from "@/convex/_generated/api";

function dayLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const label = d.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  return d.toDateString() === today.toDateString() ? `Today, ${label}` : label;
}

export default function AuditPage() {
  const { results, status, loadMore } = usePaginatedQuery(api.audit.list, {}, { initialNumItems: 40 });
  const groups: { day: string; items: { actor: string; action: string; target?: string; detail?: string; at: string; icon?: string; tone?: string }[] }[] = [];
  for (const e of results) {
    const day = dayLabel(e.at);
    if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push({
      actor: e.actor,
      action: e.action,
      target: e.target,
      detail: e.detail,
      icon: e.icon,
      tone: e.tone,
      at: new Date(e.at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" }),
    });
  }
  return (
    <AppPage active="audit" title="Audit log" subtitle="Nothing here can be edited or deleted" breadcrumbs={["Data", "Audit log"]}>
      {() => (
        <Panel>
          {groups.length ? <AuditTimeline groups={groups as never} /> : <p className="ll-muted">Nothing has happened yet.</p>}
          {status === "CanLoadMore" ? (
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => loadMore(40)}>Show older events</Button>
            </div>
          ) : null}
        </Panel>
      )}
    </AppPage>
  );
}
