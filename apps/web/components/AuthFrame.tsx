import { Logo } from "@ledgerline/ui";
import type { ReactNode } from "react";

export function AuthFrame({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="ll-auth">
      <div className="ll-auth-art">
        <div className="ll-auth-rules" />
        <Logo size={34} />
        <div>
          <div className="ll-auth-quote">
            Your management accounts, <em>every morning</em>, straight from Xero.
          </div>
          <div className="ll-auth-card-float" style={{ marginTop: 32 }}>
            <div className="ll-k">Every figure</div>
            <div className="ll-v">to the cent</div>
            <div className="ll-k">Checked against Xero after every sync</div>
          </div>
        </div>
        <div style={{ position: "relative", fontSize: 13, opacity: 0.8 }}>Read-only access to Xero. Ledgerline never writes to your books.</div>
      </div>
      <div className="ll-auth-form">
        <div className="ll-auth-card">
          <h1>{title}</h1>
          <p>{lede}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export const clerkAppearance = {
  variables: {
    colorPrimary: "#0b7553",
    colorText: "#0e1613",
    borderRadius: "8px",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    card: { boxShadow: "none", border: "0", padding: 0, background: "transparent" },
    header: { display: "none" },
    rootBox: { width: "100%" },
    cardBox: { boxShadow: "none", width: "100%" },
  },
};
