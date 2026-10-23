"use client";

import { useOrganization } from "@clerk/nextjs";
import { Avatar, Badge, Banner, Button, Icon, Input, RadioGroup, Select, Switch } from "@ledgerline/ui";
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

const SECTIONS = [
  { id: "team", label: "Team", icon: "team", hint: "Who can see and change things" },
  { id: "organisation", label: "Organisation", icon: "organisation", hint: "Financial year and basis" },
  { id: "alerts", label: "Alerts", icon: "bell", hint: "What to be told about" },
] as const;

export default function SettingsPage() {
  const [tab, setTab] = useState<(typeof SECTIONS)[number]["id"]>("team");
  return (
    <AppPage active="settings" title="Settings" subtitle="Your team, how the figures are reported, and alerts" breadcrumbs={["Settings"]}>
      {(workspace) => (
        <div className="ll-settings">
          <nav className="ll-settings-nav" aria-label="Settings sections">
            {SECTIONS.map((section) => (
              <button key={section.id} type="button" className={tab === section.id ? "is-on" : undefined} aria-current={tab === section.id ? "page" : undefined} onClick={() => setTab(section.id)}>
                <Icon name={section.icon} size={16} />
                <span>
                  <b>{section.label}</b>
                  <small>{section.hint}</small>
                </span>
              </button>
            ))}
          </nav>
          <div className="ll-settings-body">
            {tab === "team" ? <Team canInvite={workspace.role === "owner"} /> : null}
            {tab === "organisation" ? <Organisation workspace={workspace} /> : null}
            {tab === "alerts" ? <Alerts workspace={workspace} /> : null}
          </div>
        </div>
      )}
    </AppPage>
  );
}

/** One setting: what it is on the left, the control on the right. */
function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="ll-setting">
      <div>
        <h3>{title}</h3>
        {hint ? <p>{hint}</p> : null}
      </div>
      <div className="ll-setting-control">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ll-setting-group">
      <h2>{title}</h2>
      {children}
    </section>
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
  const invite = async () => {
    try {
      await organization?.inviteMember({ emailAddress: email, role });
      setMessage({ tone: "positive", text: `Invitation sent to ${email}.` });
      setEmail("");
      await invitations?.revalidate?.();
    } catch (err) {
      setMessage({ tone: "negative", text: err instanceof Error ? err.message : "Invitation not sent." });
    }
  };
  return (
    <>
      <Group title={`Members · ${rows.length + pending.length}`}>
        <ul className="ll-members">
          {[...rows, ...pending].map((r) => (
            <li key={`${r.name}-${r.email}`}>
              <Avatar name={r.name} size={34} />
              <span className="ll-member-name">
                <b>{r.name}</b>
                <small>{r.email}</small>
              </span>
              <span className="ll-member-can">{ROLE[r.role]?.can ?? "Read"}</span>
              <Badge tone={ROLE[r.role]?.tone}>{ROLE[r.role]?.label ?? r.role}</Badge>
            </li>
          ))}
        </ul>
      </Group>
      {canInvite ? (
        <Group title="Invite someone">
          <Row title="Email and role" hint="Owners can do everything; editors change scenarios and export; accountants read and comment.">
            <div className="ll-invite">
              <Input id="invite-email" label="Email" type="email" placeholder="accounts@yourfirm.ie" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Select id="invite-role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: "org:member", label: "Editor" }, { value: "org:admin", label: "Owner" }, { value: "org:accountant", label: "Accountant" }]} />
              <Button variant="primary" icon="plus" disabled={!/.+@.+\..+/.test(email)} onClick={() => void invite()}>
                Send invitation
              </Button>
            </div>
            {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
          </Row>
        </Group>
      ) : null}
    </>
  );
}

function Organisation({ workspace }: { workspace: { role: string; org: { fyStartMonth: number; basis: "accrual" | "cash"; currency: string; name: string } } }) {
  const update = useMutation(api.orgs.updateSettings);
  const owner = workspace.role === "owner";
  return (
    <>
      <Group title="Reporting">
        <fieldset disabled={!owner} className="ll-setting-fields">
          <Row title="Financial year starts" hint={owner ? "Year-to-date figures and the board pack follow this. Applies from the next sync." : "Only an owner can change this."}>
            <Select id="fy-start" label="Financial year starts" value={String(workspace.org.fyStartMonth)} onChange={(e) => void update({ fyStartMonth: Number(e.target.value) })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          </Row>
          <Row title="Basis" hint="Accrual counts sales when invoiced, as Xero does by default. Cash counts them when paid.">
            <RadioGroup
              name="basis"
              label="Basis"
              value={workspace.org.basis}
              onChange={(v) => void update({ basis: v as "accrual" | "cash" })}
              options={[{ value: "accrual", label: "Accrual", hint: "Matches Xero's default" }, { value: "cash", label: "Cash", hint: "When money moves" }]}
            />
          </Row>
        </fieldset>
      </Group>
      <Group title="Organisation">
        <Row title="Name" hint="From Xero or your import.">
          <span className="ll-setting-value">{workspace.org.name}</span>
        </Row>
        <Row title="Currency" hint="All reports are in this currency.">
          <span className="ll-setting-value">{workspace.org.currency}</span>
        </Row>
      </Group>
    </>
  );
}

function Alerts({ workspace }: { workspace: { role: string; org: { alerts: { runwayUnder6: boolean; syncFailsTwice: boolean; differsFromXero: boolean } } } }) {
  const update = useMutation(api.orgs.updateSettings);
  const alerts = workspace.org.alerts;
  const set = (key: keyof typeof alerts) => (on: boolean) => void update({ alerts: { ...alerts, [key]: on } });
  return (
    <Group title="Alerts">
      <p className="ll-setting-note">Saved now. Emails to owners start with the board-pack release.</p>
      <fieldset disabled={workspace.role !== "owner"} className="ll-setting-fields">
        <Row title="Runway falls under 6 months" hint="On the base case, after any sync.">
          <Switch id="al-runway" label="Runway falls under 6 months" checked={alerts.runwayUnder6} onChange={set("runwayUnder6")} />
        </Row>
        <Row title="A sync fails twice in a row" hint="So figures don't quietly go stale.">
          <Switch id="al-sync" label="A sync fails twice in a row" checked={alerts.syncFailsTwice} onChange={set("syncFailsTwice")} />
        </Row>
        <Row title="Figures differ from Xero" hint="When the check after a sync finds a difference.">
          <Switch id="al-diff" label="Figures differ from Xero" checked={alerts.differsFromXero} onChange={set("differsFromXero")} />
        </Row>
      </fieldset>
    </Group>
  );
}
