// @vitest-environment jsdom
import { Input } from "@ledgerline/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { settle } from "@ui-sdk/core/testing";
import { useState } from "react";
import { expect, test } from "vitest";

const agent = createAgent();

test("the label names the field, the hint describes it, and an error marks it invalid instead", async () => {
  const { rerender } = render(<Input id="scenario-name" label="Scenario name" hint="Say what it tests" />);
  await act(() => settle());
  const field = screen.getByRole("textbox", { name: "Scenario name" });
  expect(field.getAttribute("aria-invalid")).toBeNull();
  expect(document.getElementById(field.getAttribute("aria-describedby")!.split(" ")[0])?.textContent).toBe("Say what it tests");

  rerender(<Input id="scenario-name" label="Scenario name" hint="Say what it tests" error="That name is taken." />);
  await act(() => settle());
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(screen.queryByText("Say what it tests")).toBeNull();
  const described = field.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent);
  expect(described).toContain("That name is taken.");
});

test("native onChange still drives a controlled field, and an agent can fill it", async () => {
  function Name() {
    const [name, setName] = useState("");
    return (
      <>
        <Input id="downside-name" label="Scenario name" value={name} onChange={(e) => setName(e.target.value)} />
        <output aria-label="Typed">{name}</output>
      </>
    );
  }
  render(<Name />);
  await userEvent.setup().type(screen.getByRole("textbox", { name: "Scenario name" }), "Slow winter");
  expect(screen.getByRole("status", { name: "Typed" }).textContent).toBe("Slow winter");
  const result = await agent.act({ steps: [{ ref: "Scenario name", action: "setValue", args: ["Lose a customer"] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByRole("status", { name: "Typed" }).textContent).toBe("Lose a customer");
});
