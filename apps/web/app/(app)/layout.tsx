import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SetupNeeded } from "@/components/app/SetupNeeded";
import { AskLedgerline } from "@/components/app/chat/AskLedgerline";
import { clerkConfigured, convexConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Whether the session token already says onboarding is done. Clerk adds it when the session token is customised
 * with `{ "onboarded": "{{user.unsafe_metadata.onboarded}}" }`, which saves a call to Clerk on every full page load.
 * The claim can lag a few seconds behind the user record, so only a `true` is trusted; anything else asks Clerk.
 */
function onboardedClaim(claims: unknown): boolean {
  const c = (claims ?? {}) as { onboarded?: unknown; metadata?: { onboarded?: unknown } };
  return c.onboarded === true || c.onboarded === "true" || c.metadata?.onboarded === true;
}

// Every page in the app needs a signed-in user with an organisation. Data access is also scoped in Convex.
// A person's first visit goes through onboarding, however they arrived: Clerk's sign-in can create an account too.
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!clerkConfigured || !convexConfigured) return <SetupNeeded />;
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding");
  if (!onboardedClaim(sessionClaims)) {
    const user = await currentUser();
    if (user && !user.unsafeMetadata.onboarded) redirect("/onboarding");
  }
  return (
    <>
      {children}
      <AskLedgerline />
    </>
  );
}
