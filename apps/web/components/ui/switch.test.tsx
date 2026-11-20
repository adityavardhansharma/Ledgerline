// @vitest-environment jsdom
import { Switch } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { useState } from "react";
import { expect, test, vi } from "vitest";

const agent = createAgent();

test("the label names the switch, and Space and clicks toggle it", async () => {
  const onChange = vi.fn();
  render(<Switch id="al-runway" label="Runway falls under 6 months" hint="Emails the owner" onChange={onChange} />);
  const control = screen.getByRole("switch", { name: "Runway falls under 6 months" });
  expect(control.getAttribute("aria-checked")).toBe("false");
  expect(control.id).toBe("al-runway");

  const user = userEvent.setup();
  control.focus();
  await user.keyboard(" ");
  expect(onChange).toHaveBeenLastCalledWith(true);
  await user.click(screen.getByText("Emails the owner"));
  expect(onChange).toHaveBeenLastCalledWith(false);
});

test("a controlled switch follows its checked prop, and an agent can turn it on", async () => {
  function Alerts() {
    const [on, setOn] = useState(false);
    return <Switch id="al-sync" label="A sync fails twice in a row" checked={on} onChange={setOn} />;
  }
  render(<Alerts />);
  const result = await agent.act({ steps: [{ ref: "A sync fails twice in a row", action: "toggle" }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

test("a disabled switch can't be focused or changed", async () => {
  const onChange = vi.fn();
  render(<Switch id="al-off" label="Figures differ from Xero" disabled onChange={onChange} />);
  await userEvent.setup().click(screen.getByRole("switch"));
  expect(onChange).not.toHaveBeenCalled();
});
