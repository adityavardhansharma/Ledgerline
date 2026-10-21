import { Banner, Logo } from "@ledgerline/ui";
import Link from "next/link";

export function SetupNeeded() {
  return (
    <main style={{ maxWidth: 680, margin: "80px auto", padding: "0 16px", display: "grid", gap: 20 }}>
      <Link href="/"><Logo size={28} /></Link>
      <Banner tone="info" title="Ledgerline isn't configured yet.">
        Add your Clerk keys and Convex URL to apps/web/.env.local, set the Convex environment variables, and start the finance engine. The README walks through each step.
      </Banner>
    </main>
  );
}
