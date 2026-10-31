import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { clerkConfigured } from "@/lib/config";

/**
 * Sign-in, onboarding and the app: everything that needs an account. Clerk's script and the Convex connection
 * start here rather than in the root layout, so the public landing page loads neither.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  if (!clerkConfigured) return children;
  return (
    <ClerkProvider>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ClerkProvider>
  );
}
