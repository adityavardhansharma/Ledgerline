export const ROUTES = {
  overview: "/overview",
  pnl: "/reports/profit-and-loss",
  balance: "/reports/balance-sheet",
  cashflow: "/reports/cash-flow",
  forecast: "/plan/forecast",
  scenarios: "/plan/scenarios",
  boardpack: "/plan/board-pack",
  ledger: "/data/ledger",
  sync: "/data/sync",
  audit: "/data/audit",
  settings: "/settings",
} as const;

export type NavId = keyof typeof ROUTES;

export const NAV_ITEMS = [
  { heading: "Reports" },
  { id: "overview", label: "Overview", icon: "overview", kbd: "G O", href: ROUTES.overview },
  { id: "pnl", label: "Profit and loss", icon: "statement", kbd: "G P", href: ROUTES.pnl },
  { id: "balance", label: "Balance sheet", icon: "balance", kbd: "G B", href: ROUTES.balance },
  { id: "cashflow", label: "Cash flow", icon: "cashflow", kbd: "G C", href: ROUTES.cashflow },
  { heading: "Plan" },
  { id: "forecast", label: "Forecast", icon: "forecast", kbd: "G F", href: ROUTES.forecast },
  { id: "scenarios", label: "Scenarios", icon: "scenario", href: ROUTES.scenarios },
  { id: "boardpack", label: "Board pack", icon: "boardpack", href: ROUTES.boardpack },
  { heading: "Data" },
  { id: "ledger", label: "Ledger", icon: "ledger", href: ROUTES.ledger },
  { id: "sync", label: "Sync and import", icon: "sync", href: ROUTES.sync },
  { id: "audit", label: "Audit log", icon: "audit", href: ROUTES.audit },
] as const;
