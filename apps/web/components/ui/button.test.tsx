// @vitest-environment jsdom
import { Button, IconButton, Menu } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { expect, test, vi } from "vitest";

const agent = createAgent();

test("buttons and icon buttons are named, click, and an agent can press them by name", async () => {
  const save = vi.fn();
  const remove = vi.fn();
  render(
    <>
      <Button variant="primary" icon="check" onClick={save}>Save changes</Button>
      <IconButton icon="trash" label="Remove Fitter" onClick={remove} />
      <Button loading>Exporting</Button>
    </>,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenCalledOnce();
  expect((screen.getByRole("button", { name: /Exporting/ }) as HTMLButtonElement).disabled).toBe(true);

  const labels = agent.snapshot().filter((e) => !e.offPage).map((e) => e.label);
  expect(labels).toEqual(expect.arrayContaining(["Save changes", "Remove Fitter"]));
  const result = await agent.act({ steps: [{ ref: "Remove Fitter", action: "press" }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(remove).toHaveBeenCalledOnce();
});

test("a Button can still be a menu's trigger", () => {
  render(<Menu label="Export" trigger={<Button>Export</Button>} items={[{ label: "CSV" }]} />);
  const trigger = screen.getByRole("button", { name: "Export" });
  expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
  expect(trigger.getAttribute("data-slot")).toBe("menu-trigger");
});
