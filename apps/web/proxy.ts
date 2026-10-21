import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// The landing page and auth pages are public; everything inside the app needs a session.
const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/legal(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
