import Link from "next/link";

import { ReliaLogo } from "@/components/marketing/logo";
import { homeHash } from "@/components/marketing/nav";

export function SiteFooter() {
  return (
    <footer className="border-t bg-sidebar">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <ReliaLogo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Relationship intelligence for customer success, account management, and sales. Answers
            come from stored records — Relia does not invent customer facts.
          </p>
        </div>
        <div>
          <div className="text-sm font-medium">Product</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href={homeHash("product")} className="hover:text-foreground">
                Features
              </Link>
            </li>
            <li>
              <Link href={homeHash("use-cases")} className="hover:text-foreground">
                Use cases
              </Link>
            </li>
            <li>
              <Link href={homeHash("pricing")} className="hover:text-foreground">
                Pricing
              </Link>
            </li>
            <li>
              <Link href={homeHash("security")} className="hover:text-foreground">
                Security
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-medium">Legal</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-medium">Account</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/login" className="hover:text-foreground">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-foreground">
                Create workspace
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© 2026 Relia. All rights reserved.</span>
          <span>Organization-scoped. Grounded in your system of record.</span>
        </div>
      </div>
    </footer>
  );
}
