import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Tooltips } from "@/components/Tooltips";
import { clerkConfigured } from "@/lib/config";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif" });

export const metadata: Metadata = {
  title: { default: "Ledgerline", template: "%s · Ledgerline" },
  description: "Management accounts and three-statement forecasts for small businesses, straight from Xero.",
};

// The whole screen, edge to edge: safe-area insets in the styles keep content clear of notches and the home bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d0c" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('ll-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

// Clerk sends anyone it has no destination for to "/", so its steps outside the sign-in form (a Google sign-in that
// becomes a sign-up, choosing an organisation) landed on the homepage. These defaults cover every flow.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IE" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {clerkConfigured ? (
          <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/overview" signUpFallbackRedirectUrl="/onboarding">
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ClerkProvider>
        ) : (
          children
        )}
        <Tooltips />
        <Analytics />
      </body>
    </html>
  );
}
