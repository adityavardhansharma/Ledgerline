import { SignUp } from "@clerk/nextjs";
import { AuthFrame, clerkAppearance } from "@/components/AuthFrame";
import { SetupNeeded } from "@/components/app/SetupNeeded";
import { clerkConfigured } from "@/lib/config";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  if (!clerkConfigured) return <SetupNeeded />;
  return (
    <AuthFrame variant="signUp" title="Create your account" lede="Free while Ledgerline is in preview. Next you'll add your figures: Xero, a CSV file or the sample company.">
      <SignUp appearance={clerkAppearance} signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </AuthFrame>
  );
}
