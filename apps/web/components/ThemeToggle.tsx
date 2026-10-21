"use client";

import { IconButton } from "@ledgerline/ui";
import { useEffect, useState } from "react";

/** Light, dark or follow the system. The choice is a per-browser convenience. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const current = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    setTheme(current ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <IconButton
      icon={theme === "dark" ? "sun" : "moon"}
      label={`Switch to ${next} theme`}
      size="sm"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("ll-theme", next);
        } catch {}
        setTheme(next);
      }}
    />
  );
}
