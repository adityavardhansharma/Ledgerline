"use client";

import { Button, Icon } from "@ledgerline/ui";
import { useConvex, usePaginatedQuery } from "convex/react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { toCsv } from "@/lib/csv";
import { api } from "@/convex/_generated/api";

function dayLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const label = d.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  return d.toDateString() === today.toDateString() ? `Today, ${label}` : label;
}

export default function AuditPage() {
  const { results, status, loadMore } = usePaginatedQuery(api.audit.list, {}, { initialNumItems: 40 });
  const convex = useConvex();
  const auditCsv = async () => {
    const rows: (string | number)[][] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: Awaited<ReturnType<typeof convex.query<typeof api.audit.list>>> = await convex.query(api.audit.list, { paginationOpts: { numItems: 500, cursor } });
      for (const e of page.page) rows.push([new Date(e.at).toISOString(), e.actor, e.action, e.target ?? "", e.detail ?? ""]);
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    return rows.length ? toCsv([["When (UTC)", "Who", "Did", "What", "Detail"], ...rows]) : null;
  };
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
    <AppPage
      active="audit"
      title="Audit log"
      subtitle="Nothing here can be edited or deleted"
      breadcrumbs={["Data", "Audit log"]}
      actions={<ExportMenu title="Audit log" html={false} csv={[{ label: "Audit log", build: auditCsv }]} />}
    >
      {() => (
        <div className="ll-timeline">
          {groups.length ? (
            groups.map((g) => (
              <section key={g.day} className="ll-tl-day">
                <h2>{g.day}</h2>
                <ol>
                  {g.items.map((it, i) => (
                    <li key={i} className={it.tone ? `is-${it.tone}` : undefined}>
                      <time>{it.at}</time>
                      <span className="ll-tl-dot" aria-hidden>
                        <Icon name={(it.icon ?? "audit") as never} size={13} />
                      </span>
                      <div>
                        <p>
                          <b>{it.actor}</b> {it.action}
                          {it.target ? <> <em>{it.target}</em></> : null}
                        </p>
                        {it.detail ? <small>{it.detail}</small> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))
          ) : (
            <p className="ll-muted">Nothing has happened yet.</p>
          )}
          {status === "CanLoadMore" ? (
            <div className="ll-journals-foot">
              <Button onClick={() => loadMore(40)}>Show older events</Button>
            </div>
          ) : null}
        </div>
      )}
    </AppPage>
  );
}
