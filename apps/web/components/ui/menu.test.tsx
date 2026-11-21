// @vitest-environment jsdom
import { Button, Menu } from "@ledgerline/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

const agent = createAgent();

function Export({ csv, html }: { csv: () => void; html: () => void }) {
  return (
    <Menu
      label="Export"
      trigger={<Button icon="download">Export</Button>}
      items={[{ heading: "Spreadsheet (CSV)" }, { label: "Profit and loss", icon: "download", onClick: csv }, { divider: true }, { heading: "Web page" }, { label: "HTML with charts", icon: "external", onClick: html }]}
    />
  );
}

test("the trigger opens a named menu, arrows move, Enter runs the item and focus comes back", async () => {
  const csv = vi.fn();
  const html = vi.fn();
  render(<Export csv={csv} html={html} />);
  const trigger = screen.getByRole("button", { name: "Export" });
  expect(trigger.getAttribute("aria-haspopup")).toBe("menu");

  const user = userEvent.setup();
  trigger.focus();
  await user.keyboard("{Enter}");
  await act(() => settle());
  expect(screen.getByRole("menu", { name: "Export" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Spreadsheet (CSV)" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Profit and loss" }));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "HTML with charts" }));
  await user.keyboard("{Enter}");
  await act(() => settle());
  expect(html).toHaveBeenCalledOnce();
  expect(csv).not.toHaveBeenCalled();
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("Escape closes without running anything, and an agent can run an item by name", async () => {
  const csv = vi.fn();
  render(<Export csv={csv} html={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Export" }));
  await act(() => settle());
  await user.keyboard("{Escape}");
  await act(() => settle());
  expect(screen.queryByRole("menu")).toBeNull();
  expect(csv).not.toHaveBeenCalled();

  const result = await agent.act({ steps: [{ ref: "Export", action: "press", args: ["Profit and loss"] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(csv).toHaveBeenCalledOnce();
});

test("an item marked confirm needs a person before an agent can run it", async () => {
  let approve = false;
  const gated = createAgent({ allow: (step) => !step.confirm || approve });
  const remove = vi.fn();
  render(
    <Menu
      trigger={<Button icon="more">Actions for Hire two fitters</Button>}
      items={[{ label: "Open in forecast" }, { divider: true }, { label: "Delete scenario", danger: true, confirm: "Deletes the scenario Hire two fitters", onClick: remove }]}
    />,
  );
  const step = { steps: [{ ref: "Actions for Hire two fitters", action: "press", args: ["Delete scenario"] }] };
  expect((await gated.act(step)).ok).toBe(false);
  expect(remove).not.toHaveBeenCalled();
  approve = true;
  expect((await gated.act(step)).ok).toBe(true);
  expect(remove).toHaveBeenCalledOnce();
});
