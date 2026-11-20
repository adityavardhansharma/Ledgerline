// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { settle } from "@ui-sdk/core/testing";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";

const update = vi.hoisted(() => vi.fn(async () => {}));
const role = vi.hoisted(() => ({ current: "owner" }));
vi.mock("@clerk/nextjs", () => ({ useOrganization: () => ({ organization: null, memberships: { data: [] }, invitations: { data: [] } }) }));
vi.mock("convex/react", () => ({ useMutation: () => update, useQuery: () => undefined, useAction: () => vi.fn() }));
vi.mock("@/components/app/AppPage", () => ({
  AppPage: ({ children }: { children: (w: unknown) => ReactNode }) =>
    children({ role: role.current, org: { name: "Kestrel Joinery Ltd", currency: "EUR", fyStartMonth: 1, basis: "accrual", alerts: { runwayUnder6: false, syncFailsTwice: true, differsFromXero: false } } }),
}));
const { default: SettingsPage } = await import("@/app/(app)/settings/page");

test("the sections are vertical tabs, and an owner's reporting and alert settings save as they change", async () => {
  const agent = createAgent();
  render(<SettingsPage />);
  expect(screen.getByRole("tablist", { name: "Settings sections" }).getAttribute("aria-orientation")).toBe("vertical");
  const user = userEvent.setup();
  screen.getAllByRole("tab")[0].focus();
  await user.keyboard("{ArrowDown}");
  await act(() => settle());
  expect(screen.getByRole("tabpanel")).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Financial year starts" }).textContent).toBe("January");

  const result = await agent.act({
    steps: [
      { ref: "Financial year starts", action: "setValue", args: ["4"] },
      { ref: "Basis", action: "setValue", args: ["cash"] },
    ],
  });
  expect(result.ok, result.error?.message).toBe(true);
  expect(update).toHaveBeenCalledWith({ fyStartMonth: 4 });
  expect(update).toHaveBeenCalledWith({ basis: "cash" });

  await user.click(screen.getByRole("tab", { name: /Alerts/ }));
  await act(() => settle());
  await user.click(screen.getByRole("switch", { name: "Runway falls under 6 months" }));
  expect(update).toHaveBeenLastCalledWith({ alerts: { runwayUnder6: true, syncFailsTwice: true, differsFromXero: false } });
});

test("someone who isn't an owner sees the settings but can't change them", async () => {
  role.current = "editor";
  update.mockClear();
  render(<SettingsPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: /Alerts/ }));
  await act(() => settle());
  const sw = screen.getByRole("switch", { name: "A sync fails twice in a row" });
  await user.click(sw);
  expect(sw.getAttribute("aria-checked")).toBe("true");
  expect(update).not.toHaveBeenCalled();
});
