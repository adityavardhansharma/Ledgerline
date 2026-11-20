// @vitest-environment jsdom
import { Button, Drawer } from "@ledgerline/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { useState } from "react";
import { expect, test, vi } from "vitest";

function Page({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Show ledger lines</Button>
      {open ? (
        <Drawer title="Revenue · Sep 2026" eyebrow="Ledger lines" onClose={() => { onClose(); setOpen(false); }} footer={<Button>Open in ledger</Button>}>
          <p>12 lines</p>
        </Drawer>
      ) : null}
    </>
  );
}

test("the drawer is a modal named by its title; Escape closes it and focus goes back", async () => {
  const onClose = vi.fn();
  render(<Page onClose={onClose} />);
  const user = userEvent.setup();
  const opener = screen.getByRole("button", { name: "Show ledger lines" });
  await user.click(opener);
  await act(() => settle());
  const drawer = screen.getByRole("dialog", { name: "Revenue · Sep 2026" });
  expect(drawer.tagName).toBe("ASIDE");
  expect(drawer.getAttribute("aria-modal")).toBe("true");
  expect(drawer.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  await act(() => settle());
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

test("pressing the scrim or the close button closes the drawer", async () => {
  const onClose = vi.fn();
  render(<Page onClose={onClose} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Show ledger lines" }));
  await act(() => settle());
  await user.click(document.querySelector<HTMLElement>(".ll-scrim-plain")!);
  await act(() => settle());
  expect(onClose).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Show ledger lines" }));
  await act(() => settle());
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledTimes(2);
});
