"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useMemo } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

/**
 * Clerk's own session token can be issued for Convex (the "Convex integration" in Clerk's dashboard), and
 * Convex then uses it instead of the "convex" JWT template. That token carries the organisation only in
 * compact form and no name or email. Hiding its claims makes Convex always request the template, which has
 * org_id, org_role, org_name, name and email.
 */
function useAuthForConvex() {
  const auth = useAuth();
  return useMemo(() => ({ ...auth, sessionClaims: undefined }), [auth]);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    // The landing page still renders without a backend; the app pages explain what to configure.
    return <>{children}</>;
  }
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuthForConvex}>
      {children}
    </ConvexProviderWithClerk>
  );
}
