import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SetupNeeded } from "@/components/app/SetupNeeded";
import { AskLedgerline } from "@/components/app/chat/AskLedgerline";
import { clerkConfigured, convexConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

// Every page in the app needs a signed-in user with an organisation. Data access is also scoped in Convex.
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!clerkConfigured || !convexConfigured) return <SetupNeeded />;
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding");
  return (
    <>
      {children}
      <AskLedgerline />
    </>
  );
}
