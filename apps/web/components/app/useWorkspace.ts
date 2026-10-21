"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

/** The current organisation, its Xero connection and latest sync, created on first visit. */
export function useWorkspace() {
  const current = useQuery(api.orgs.current);
  const ensure = useMutation(api.orgs.ensure);
  useEffect(() => {
    if (current === null) void ensure();
  }, [current, ensure]);
  return current;
}

export type Workspace = NonNullable<ReturnType<typeof useWorkspace>>;
