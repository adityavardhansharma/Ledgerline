import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Clerk's proxy only attaches the session. Each protected layout checks it (see app/(account)/(app)/layout.tsx).
// Without Clerk keys the landing page still works and app pages explain what to configure.
const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default configured ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
