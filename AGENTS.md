# Ledgerline agent notes

Workflow, deploys and vouchers are in [CLAUDE.md](CLAUDE.md).

## ui-sdk

Interactive UI (switches, tabs, selects, menus, dialogs, tooltips, sliders…) is built on ui-sdk: `@ui-sdk/core` for
behaviors and `@ui-sdk/react` for parts. The design system in `packages/ui` wraps those parts in its own `ll-*` classes,
so app code keeps using `@ledgerline/ui`.

Before changing any of it:

- Follow the `ui-sdk` skill (`.agents/skills/ui-sdk/SKILL.md`, linked from `.claude/skills`).
- Read `node_modules/@ui-sdk/react/docs/llms.txt`, then only the component pages you need in
  `node_modules/@ui-sdk/react/docs/components/`.
- To build a component ui-sdk doesn't ship, search `node_modules/@ui-sdk/react/docs/core.md` by heading and read
  `rendering.md` next to it.
- Style state from ui-sdk's `data-*` attributes and `data-slot`, never generated ids. `@layer ui-sdk;` stays the first
  line of `apps/web/app/globals.css`.

### Patterns this app follows

- Menus open from a trigger: pass `trigger` to the design system's `Menu`. A menu, like a popover, is named by its
  trigger or title, never by an `aria-label` on its content. Give each row its own menu with a trigger named for the
  row ("Actions for Base case"), and put `confirm` on items an agent mustn't run alone, like deletes.
- `Dialog` and `Drawer` from `@ledgerline/ui` are open while mounted; Escape and their close button call `onClose`,
  and focus returns to the opener when the caller unmounts them. Put a panel animated with motion inside
  `AnimatePresence` as a ui-sdk `Dialog` that stays `open` until its exit finishes (see `AskLedgerline`).
- A control and the slider beside it need different names ("Debtor days" and "Adjust Debtor days"): the agent bridge
  refuses a label that matches two components.
- Keyboard shortcuts go through `useShortcut` from `@ui-sdk/react/shortcuts`, which skips text fields and pauses under
  a modal. Window keydown listeners should ignore an event a popup already handled (`event.defaultPrevented`).
- A popup that animates in and out does it in CSS on `data-starting-style` and `data-ending-style`.
- Component tests run in jsdom (`// @vitest-environment jsdom`, stubs in `apps/web/test/setup.ts`) with
  `__UI_SDK_STRICT__` on, and check wiring with Testing Library and `createAgent`, not ui-sdk's own behavior.
