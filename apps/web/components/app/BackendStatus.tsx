"use client";

import { Banner, Button, Skeleton } from "@ledgerline/ui";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

/**
 * Shown while the workspace hasn't loaded. A slow first load shows skeletons; after a few seconds it says
 * why nothing has appeared, so a blocked connection or a rejected sign-in never looks like an empty page.
 */
export function BackendStatus({ waiting }: { waiting: boolean }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (!waiting) return null;
  if (!slow) {
    return (
      <div className="ll-stack">
        <Skeleton height={96} />
        <Skeleton height={180} />
      </div>
    );
  }
  const reload = (
    <Button size="sm" icon="refresh" onClick={() => window.location.reload()}>
      Reload
    </Button>
  );
  if (!isLoading && !isAuthenticated) {
    return (
      <Banner tone="warning" title="Ledgerline couldn't confirm your sign-in." action={reload}>
        You're signed in, but Ledgerline's data service didn't accept the session. Reload the page; if this keeps happening, sign out and back in.
      </Banner>
    );
  }
  return (
    <Banner tone="warning" title="Can't reach Ledgerline's data service." action={reload}>
      The page loaded but its live connection didn't open. Browser shields and privacy extensions sometimes block it: allow this site (and convex.cloud), then reload.
    </Banner>
  );
}
