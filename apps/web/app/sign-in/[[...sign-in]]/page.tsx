import { SignIn } from "@clerk/nextjs";
import { AuthFrame, clerkAppearance } from "@/components/AuthFrame";
import { SetupNeeded } from "@/components/app/SetupNeeded";
import { clerkConfigured } from "@/lib/config";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  if (!clerkConfigured) return <SetupNeeded />;
  return (
    <AuthFrame title="Welcome back" lede="Sign in with the email you signed up with.">
      <SignIn appearance={clerkAppearance} signUpUrl="/sign-up" fallbackRedirectUrl="/overview" />
    </AuthFrame>
  );
}
