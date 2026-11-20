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
