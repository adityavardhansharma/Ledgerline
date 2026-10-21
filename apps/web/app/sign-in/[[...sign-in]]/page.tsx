import { SignIn } from "@clerk/nextjs";
import { AuthFrame, clerkAppearance } from "@/components/AuthFrame";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthFrame title="Welcome back" lede="Sign in with the email you signed up with.">
      <SignIn appearance={clerkAppearance} signUpUrl="/sign-up" fallbackRedirectUrl="/overview" />
    </AuthFrame>
  );
}
