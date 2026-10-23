"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/** The current organisation, its Xero connection and latest sync, created on first visit within the plan. */
export function useWorkspace() {
  const current = useQuery(api.orgs.current);
  const ensure = useMutation(api.orgs.ensure);
  useEffect(() => {
    // A refusal (the plan's companies are used) shows as CompanyLimit, from api.billing.newCompany.
    if (current === null) void ensure().catch(() => undefined);
  }, [current, ensure]);
  return current;
}

/** Set when the active organisation has no company yet and the Free plan's companies are already used. */
export function useCompanyLimit(workspace: ReturnType<typeof useWorkspace>) {
  const check = useQuery(api.billing.newCompany, workspace === null ? {} : "skip");
  return check?.blocked ? check : null;
}

export type Workspace = NonNullable<ReturnType<typeof useWorkspace>>;
