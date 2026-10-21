import { Icon, Logo } from "@ledgerline/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthArt } from "./AuthArt";
import { ThemeToggle } from "./ThemeToggle";

export function AuthFrame({ variant, title, lede, children }: { variant: "signIn" | "signUp"; title: string; lede: string; children: ReactNode }) {
  return (
    <div className="ll-auth">
      <AuthArt variant={variant} />
      <main className="ll-auth-form">
        <div className="ll-auth-bar">
          <Link href="/" className="ll-auth-home" aria-label="Ledgerline home">
            <Logo size={24} />
          </Link>
          <ThemeToggle />
        </div>
        <div className="ll-auth-card">
          <h1>{title}</h1>
          <p>{lede}</p>
          {children}
        </div>
        <p className="ll-auth-foot">
          <Icon name="lock" size={14} />
          Ledgerline only reads your books. It never writes to Xero or moves money.
        </p>
      </main>
    </div>
  );
}

// Clerk's form, drawn with Ledgerline's tokens so it follows the light and dark themes.
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--brand)",
    colorTextOnPrimaryBackground: "var(--on-brand)",
    colorText: "var(--ink)",
    colorTextSecondary: "var(--ink-muted)",
    colorBackground: "var(--surface)",
    colorInputBackground: "var(--surface)",
    colorInputText: "var(--ink)",
    colorNeutral: "var(--ink)",
    colorDanger: "var(--negative)",
    borderRadius: "8px",
    fontFamily: "var(--font-sans)",
    fontSize: "14px",
  },
  elements: {
    card: { boxShadow: "none", border: "0", padding: 0, background: "transparent" },
    header: { display: "none" },
    rootBox: { width: "100%" },
    cardBox: { boxShadow: "none", width: "100%", border: "0", background: "transparent" },
    footer: { background: "transparent" },
  },
};
