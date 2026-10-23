"use client";

import { useOrganization } from "@clerk/nextjs";
import { Avatar, Badge, Banner, Button, Icon, Input, ProgressBar, RadioGroup, Select, Switch } from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
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
  { id: "billing", label: "Billing", icon: "euro", hint: "Your plan and AI allowance" },
] as const;

export default function SettingsPage() {
  const [tab, setTab] = useState<(typeof SECTIONS)[number]["id"]>("team");
  return (
    <AppPage active="settings" title="Settings" subtitle="Your team, how the figures are reported, alerts and billing" breadcrumbs={["Settings"]}>
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
            {tab === "billing" ? <Billing /> : null}
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

const METER: Record<string, { title: string; hint: string }> = {
  actions: { title: "AI actions", hint: "Explaining a figure, drafting the board-pack commentary, filling in a plan from a sentence. Asking about the same figures again is free." },
  searches: { title: "AI ledger searches", hint: "Searching the ledger in your own words." },
  chats: { title: "AI chats", hint: "Each question to Ask Ledgerline." },
};

const UPCOMING = [
  { name: "Pro", price: "€20 a month", items: ["500 AI actions a month", "Unlimited AI ledger search", "500 AI chats a month"] },
  { name: "Max", price: "€100 a month", items: ["Stronger AI models for analysis", "1,000 AI actions a month", "Unlimited AI ledger search", "1,000 AI chats a month"] },
];

const resetDate = (at: number) => new Date(at).toLocaleDateString("en-IE", { day: "numeric", month: "long", timeZone: "UTC" });

function Billing() {
  const billing = useQuery(api.billing.overview);
  if (!billing) return null;
  const reset = resetDate(billing.resetsAt);
  return (
    <>
      <Group title="Plan">
        <div className="ll-plan-card">
          <div>
            <span className="ll-plan-name">
              {billing.plan} <Badge tone="brand">Current plan</Badge>
            </span>
            <p>€0, forever. Every report, forecast, scenario and board pack, for an unlimited team.</p>
          </div>
          <span className="ll-plan-price">€0</span>
        </div>
        <Row title="Companies" hint={billing.companies.mine ? "Companies you've set up, from Xero or CSV." : "Counted against the person who set this company up."}>
          <span className="ll-setting-value">
            {billing.companies.used} of {billing.companies.limit}
          </span>
        </Row>
      </Group>
      <Group title={`AI this month · resets ${reset}`}>
        <p className="ll-setting-note">Shared by everyone in this company. When one runs out, the last answers stay on screen and new ones wait for the reset; the others keep working.</p>
        {billing.meters.map((m) => {
          const out = m.used >= m.limit;
          return (
            <Row key={m.meter} title={METER[m.meter].title} hint={METER[m.meter].hint}>
              <div className="ll-meter">
                <div className="ll-meter-head">
                  <b>
                    {Math.min(m.used, m.limit)} <small>of {m.limit}</small>
                  </b>
                  <span className={out ? "is-out" : undefined}>{out ? `Paused until ${reset}` : `${m.limit - m.used} left`}</span>
                </div>
                <ProgressBar value={m.used / m.limit} label={`${METER[m.meter].title} used`} tone={out || m.used / m.limit >= 0.8 ? "warning" : undefined} />
              </div>
            </Row>
          );
        })}
      </Group>
      <Group title="Coming soon">
        <p className="ll-setting-note">Paid plans open once payments are set up. Nothing to do until then.</p>
        <div className="ll-plan-soon">
          {UPCOMING.map((plan) => (
            <div key={plan.name}>
              <span className="ll-plan-name">
                {plan.name} <Badge>Coming soon</Badge>
              </span>
              <small>{plan.price}</small>
              <ul>
                {plan.items.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={13} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Group>
    </>
  );
}
