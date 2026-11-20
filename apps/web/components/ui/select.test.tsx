// @vitest-environment jsdom
import { Select } from "@ledgerline/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { settle } from "@ui-sdk/core/testing";
import { useState } from "react";
import { expect, test, vi } from "vitest";

const agent = createAgent();
const ROLES = [
  { value: "org:member", label: "Editor" },
  { value: "org:admin", label: "Owner" },
  { value: "org:accountant", label: "Accountant" },
];

test("the field label names the trigger, and choosing from the list calls onChange like a native select", async () => {
  const onChange = vi.fn();
  function Invite() {
    const [role, setRole] = useState("org:member");
    return <Select id="invite-role" label="Role" value={role} onChange={(e) => { onChange(e.target.value); setRole(e.target.value); }} options={ROLES} />;
  }
  render(<Invite />);
  const trigger = screen.getByRole("combobox", { name: "Role" });
  expect(trigger.textContent).toBe("Editor");

  const user = userEvent.setup();
  await user.click(trigger);
  await act(() => settle());
  await user.click(screen.getByRole("option", { name: "Accountant" }));
  expect(onChange).toHaveBeenLastCalledWith("org:accountant");
  expect(trigger.textContent).toBe("Accountant");
});

test("string options work, a name submits the value, and an agent can choose by label", async () => {
  const { container } = render(
    <form>
      <Select id="fy-start" name="fy" label="Financial year starts" defaultValue="Apr" options={["Jan", "Apr", "Jul"]} />
    </form>,
  );
  expect(new FormData(container.querySelector("form")!).get("fy")).toBe("Apr");
  const result = await agent.act({ steps: [{ ref: "Financial year starts", action: "setValue", args: ["Jul"] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByRole("combobox", { name: "Financial year starts" }).textContent).toBe("Jul");
});
