"use client";

import { useOrganization } from "@clerk/nextjs";
import { Avatar, Badge, Banner, Button, DataTable, Input, Panel, RadioGroup, Select, Switch, Tabs } from "@ledgerline/ui";
import { useMutation } from "convex/react";
import { useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { api } from "@/convex/_generated/api";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ROLE: Record<string, { label: string; tone?: "brand" | "forecast"; can: string }> = {
  "org:admin": { label: "Owner", tone: "brand", can: "Everything" },
  "org:member": { label: "Editor", can: "Edit scenarios, export" },
  "org:accountant": { label: "Accountant", tone: "forecast", can: "Read and comment" },
};

export default function SettingsPage() {
  const [tab, setTab] = useState("team");
  return (
    <AppPage active="settings" title="Settings" breadcrumbs={["Settings"]}>
      {(workspace) => (
        <>
          <Tabs label="Settings" value={tab} onChange={setTab} tabs={[{ id: "team", label: "Team" }, { id: "organisation", label: "Organisation" }, { id: "alerts", label: "Alerts" }]} />
          {tab === "team" ? <Team canInvite={workspace.role === "owner"} /> : null}
          {tab === "organisation" ? <Organisation workspace={workspace} /> : null}
          {tab === "alerts" ? <Alerts workspace={workspace} /> : null}
        </>
      )}
    </AppPage>
  );
}

function Team({ canInvite }: { canInvite: boolean }) {
  const { organization, memberships, invitations } = useOrganization({ memberships: { infinite: true }, invitations: { infinite: true } });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org:member");
  const [message, setMessage] = useState<{ tone: "positive" | "negative"; text: string } | null>(null);
  const rows = (memberships?.data ?? []).map((m) => {
    const name = [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || m.publicUserData?.identifier || "Member";
    return { name, email: m.publicUserData?.identifier ?? "", role: m.role, since: m.createdAt };
  });
  const pending = (invitations?.data ?? []).map((i) => ({ name: i.emailAddress, email: "Invitation sent", role: i.role, since: i.createdAt }));
  return (
    <div className="ll-stack">
      <DataTable
        columns={[
          { key: "name", label: "Name", render: (r: { name: string; email: string }) => <span className="ll-row" style={{ flexWrap: "nowrap" }}><Avatar name={r.name} size={32} /><span><strong>{r.name}</strong><br /><span className="ll-muted">{r.email}</span></span></span> },
          { key: "role", label: "Role", render: (r: { role: string }) => <Badge tone={ROLE[r.role]?.tone}>{ROLE[r.role]?.label ?? r.role}</Badge> },
          { key: "can", label: "Can", render: (r: { role: string }) => ROLE[r.role]?.can ?? "Read" },
          { key: "since", label: "Since", render: (r: { since: Date }) => new Date(r.since).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }) },
        ]}
        rows={[...rows, ...pending]}
      />
      {canInvite ? (
        <Panel title="Invite someone" icon="team">
          <div className="ll-grid-halves" style={{ alignItems: "end" }}>
            <Input id="invite-email" label="Email" type="email" placeholder="accounts@yourfirm.ie" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select id="invite-role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: "org:member", label: "Editor" }, { value: "org:admin", label: "Owner" }, { value: "org:accountant", label: "Accountant (read and comment)" }]} />
          </div>
          <div className="ll-row" style={{ marginTop: 12 }}>
            <Button
              variant="primary"
              icon="plus"
              disabled={!/.+@.+\..+/.test(email)}
              onClick={async () => {
                try {
                  await organization?.inviteMember({ emailAddress: email, role });
                  setMessage({ tone: "positive", text: `Invitation sent to ${email}.` });
                  setEmail("");
                  await invitations?.revalidate?.();
                } catch (err) {
                  setMessage({ tone: "negative", text: err instanceof Error ? err.message : "Invitation not sent." });
                }
              }}
            >
              Send invitation
            </Button>
          </div>
          {message ? <div style={{ marginTop: 12 }}><Banner tone={message.tone}>{message.text}</Banner></div> : null}
        </Panel>
      ) : null}
    </div>
  );
}

function Organisation({ workspace }: { workspace: { role: string; org: { fyStartMonth: number; basis: "accrual" | "cash"; currency: string; name: string } } }) {
  const update = useMutation(api.orgs.updateSettings);
  const owner = workspace.role === "owner";
  return (
    <div className="ll-grid-halves">
      <Panel title="Reporting" icon="statement" subtitle={owner ? "Changes apply from the next sync" : "Only an owner can change these"}>
        <fieldset disabled={!owner} style={{ border: 0, padding: 0, margin: 0 }} className="ll-stack">
          <Select id="fy-start" label="Financial year starts" value={String(workspace.org.fyStartMonth)} onChange={(e) => void update({ fyStartMonth: Number(e.target.value) })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          <RadioGroup
            name="basis"
            label="Basis"
            value={workspace.org.basis}
            onChange={(v) => void update({ basis: v as "accrual" | "cash" })}
            options={[{ value: "accrual", label: "Accrual", hint: "Matches Xero's default" }, { value: "cash", label: "Cash", hint: "When money moves" }]}
          />
        </fieldset>
      </Panel>
      <Panel title="Organisation" icon="organisation">
        <dl className="ll-integ-facts">
          <div><dt>Name</dt><dd>{workspace.org.name}</dd></div>
          <div><dt>Currency</dt><dd>{workspace.org.currency}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}

function Alerts({ workspace }: { workspace: { role: string; org: { alerts: { runwayUnder6: boolean; syncFailsTwice: boolean; differsFromXero: boolean } } } }) {
  const update = useMutation(api.orgs.updateSettings);
  const alerts = workspace.org.alerts;
  const set = (key: keyof typeof alerts) => (on: boolean) => void update({ alerts: { ...alerts, [key]: on } });
  return (
    <Panel title="Alerts" icon="bell" subtitle="Saved now; email delivery to owners arrives with the board-pack release">
      <fieldset disabled={workspace.role !== "owner"} style={{ border: 0, padding: 0, margin: 0 }} className="ll-stack">
        <Switch id="al-runway" label="Runway falls under 6 months" checked={alerts.runwayUnder6} onChange={set("runwayUnder6")} />
        <Switch id="al-sync" label="A sync fails twice in a row" checked={alerts.syncFailsTwice} onChange={set("syncFailsTwice")} />
        <Switch id="al-diff" label="Figures differ from Xero" checked={alerts.differsFromXero} onChange={set("differsFromXero")} />
      </fieldset>
    </Panel>
  );
}
