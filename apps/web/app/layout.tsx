import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Tooltips } from "@/components/Tooltips";
import { clerkConfigured } from "@/lib/config";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif" });

export const metadata: Metadata = {
  title: { default: "Ledgerline", template: "%s · Ledgerline" },
  description: "Management accounts and three-statement forecasts for small businesses, straight from Xero.",
};

const themeScript = `try{var t=localStorage.getItem('ll-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IE" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {clerkConfigured ? (
          <ClerkProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ClerkProvider>
        ) : (
          children
        )}
        <Tooltips />
      </body>
    </html>
  );
}
