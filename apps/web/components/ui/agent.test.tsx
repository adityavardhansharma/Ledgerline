// @vitest-environment jsdom
import { AppShell, Button, Input, RadioGroup, SegmentedControl, Select, Switch, Tabs } from "@ledgerline/ui";
import { act, render } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { settle } from "@ui-sdk/core/testing";
import { expect, test } from "vitest";

test("every control on a design-system page has a name an agent can find, and the agent can use them", async () => {
  const agent = createAgent();
  render(
    <AppShell title="Settings" active="settings" onMenu={() => {}} sidebar={{ onCollapse: () => {}, onAsk: () => {}, onSearch: () => {} }} actions={<Button icon="download">Export</Button>}>
      <Input id="org-name" label="Organisation name" defaultValue="Kestrel Joinery Ltd" />
      <Select id="fy-start" label="Financial year starts" defaultValue="1" options={[{ value: "1", label: "January" }, { value: "4", label: "April" }]} />
      <RadioGroup name="debtors" label="Debtor days" options={[{ value: "invoices", label: "From invoices" }, { value: "balances", label: "From balances" }]} />
      <Switch id="al-runway" label="Runway falls under 6 months" />
      <SegmentedControl label="Period" options={[{ value: "m", label: "Monthly" }, { value: "q", label: "Quarterly" }]} />
      <Tabs label="Statement" tabs={[{ id: "pnl", label: "Profit and loss" }, { id: "bs", label: "Balance sheet" }]} />
    </AppShell>,
  );
  await act(() => settle());

  const entries = agent.snapshot().filter((e) => !e.offPage && e.component !== "more");
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  const labels = entries.map((e) => e.label);
  for (const label of ["Organisation name", "Financial year starts", "Debtor days", "Runway falls under 6 months", "Period", "Statement", "Export", "Search", "Ask Ledgerline", "Collapse sidebar", "Open navigation"]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label);
  }

  const result = await agent.act({
    steps: [
      { ref: "Organisation name", action: "setValue", args: ["Kestrel Joinery"] },
      { ref: "Financial year starts", action: "setValue", args: ["4"] },
      { ref: "Debtor days", action: "setValue", args: ["balances"] },
      { ref: "Runway falls under 6 months", action: "toggle" },
      { ref: "Period", action: "setValue", args: ["q"] },
      { ref: "Statement", action: "select", args: ["bs"] },
    ],
  });
  expect(result.ok, result.error?.message).toBe(true);
});
