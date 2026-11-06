"use client";

import { Skeleton } from "@ledgerline/ui";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { useFrame } from "./AppFrame";

/**
 * Shown the moment a link in the app is clicked, while the next page loads: the sidebar marks where you are going,
 * the title changes, and the page area shows its outline, so a click never looks ignored.
 */
export function PageLoading() {
  const { setHead } = useFrame();
  const path = usePathname() ?? "";
  useLayoutEffect(() => {
    const item = NAV_ITEMS.find((n) => "href" in n && path.startsWith(n.href));
    if (item && "id" in item) setHead({ active: item.id, title: item.label });
    else if (path.startsWith("/settings")) setHead({ active: "settings", title: "Settings" });
  }, [path, setHead]);
  return (
    <div className="ll-stack" aria-busy="true" aria-label="Loading">
      <Skeleton height={96} />
      <Skeleton height={320} />
      <Skeleton height={180} />
    </div>
  );
}
