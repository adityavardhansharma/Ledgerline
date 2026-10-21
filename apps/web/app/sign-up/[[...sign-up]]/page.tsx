import { SignUp } from "@clerk/nextjs";
import { AuthFrame, clerkAppearance } from "@/components/AuthFrame";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthFrame title="Create your account" lede="Free while Ledgerline is in preview. You'll connect Xero next.">
      <SignUp appearance={clerkAppearance} signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </AuthFrame>
  );
}
