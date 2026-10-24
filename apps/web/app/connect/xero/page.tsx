"use client";

import { Logo, Skeleton } from "@ledgerline/ui";
import { useAction, useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { SetupNeeded } from "@/components/app/SetupNeeded";
import { api } from "@/convex/_generated/api";
import { clerkConfigured, convexConfigured } from "@/lib/config";

/**
 * Where Xero sends the browser back (through Convex's /xero/callback). The signed-in person finishes the
 * connection here, so Convex can check they are the one who asked to connect.
 */
function FinishConnect() {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const complete = useAction(api.xero.completeConnect);
  const started = useRef(false);

  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!isAuthenticated) return router.replace("/sign-in");
    if (!code || !state) return router.replace("/onboarding?xero=cancelled");
    complete({ code, state })
      .then((result) => router.replace(result.ok ? "/data/sync?connected=1" : `/onboarding?xero=${encodeURIComponent(result.reason ?? "failed")}`))
      .catch(() => router.replace("/onboarding?xero=failed"));
  }, [isLoading, isAuthenticated, params, complete, router]);

  return (
    <div className="ll-stack" style={{ maxWidth: 480, margin: "15vh auto", padding: "0 16px" }}>
      <Logo />
      <p>Connecting Xero…</p>
      <Skeleton height={96} />
    </div>
  );
}

export default function ConnectXeroPage() {
  if (!clerkConfigured || !convexConfigured) return <SetupNeeded />;
  return (
    <Suspense>
      <FinishConnect />
    </Suspense>
  );
}
