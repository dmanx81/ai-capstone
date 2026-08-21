import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";

import { MarketingFooter } from "./marketing-footer";
import { MarketingHeader } from "./marketing-header";

// Scoped to the public marketing route group only -- the authenticated
// app's own pages are unaffected and keep the root layout's metadata.
export const metadata: Metadata = {
  title: {
    default: "Tend — Relationship intelligence for Account Managers and Customer Success",
    template: "%s | Tend",
  },
  description:
    "Turn customer conversations into relationship health, risks, actions and clear next steps.",
};

// next/font/google self-hosts the font files at build time and serves them
// from this origin -- no runtime request to a font CDN, and no CSP change
// is required (next.config.ts already allows font-src 'self'). Scoped to
// this route group only; the authenticated app keeps its existing Geist
// fonts from the root layout untouched.
const manrope = Manrope({
  variable: "--font-marketing-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-marketing-body",
  subsets: ["latin"],
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${manrope.variable} ${inter.variable} flex min-h-full flex-col font-[var(--font-marketing-body)]`}
    >
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
