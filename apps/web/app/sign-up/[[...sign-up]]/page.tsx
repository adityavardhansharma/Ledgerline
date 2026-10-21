import { SignUp } from "@clerk/nextjs";
import { AuthFrame, clerkAppearance } from "@/components/AuthFrame";
import { SetupNeeded } from "@/components/app/SetupNeeded";
import { clerkConfigured } from "@/lib/config";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  if (!clerkConfigured) return <SetupNeeded />;
  return (
    <AuthFrame title="Create your account" lede="Free while Ledgerline is in preview. You'll connect Xero next.">
      <SignUp appearance={clerkAppearance} signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </AuthFrame>
  );
}
