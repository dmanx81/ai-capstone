import Link from "next/link";

import { ReliaLogo } from "@/components/marketing/logo";
import { homeHash } from "@/components/marketing/nav";
import { Container } from "@/components/marketing/section";

const linkClass = "text-sm text-muted-foreground transition-colors hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <Container className="grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <ReliaLogo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Relationship intelligence for customer success, account management, and sales. Answers
            come from stored records — Relia does not invent customer facts.
          </p>
        </div>
        <FooterColumn title="Product" className="md:col-span-3">
          <Link href="/product" className={linkClass}>
            Features
          </Link>
          <Link href="/use-cases" className={linkClass}>
            Use cases
          </Link>
          <Link href={homeHash("pricing")} className={linkClass}>
            Pricing
          </Link>
          <Link href="/security" className={linkClass}>
            Security
          </Link>
        </FooterColumn>
        <FooterColumn title="Legal" className="md:col-span-2">
          <Link href="/privacy" className={linkClass}>
            Privacy
          </Link>
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>
        </FooterColumn>
        <FooterColumn title="Account" className="md:col-span-2">
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
          <Link href="/signup" className={linkClass}>
            Create workspace
          </Link>
        </FooterColumn>
      </Container>
      <div className="border-t">
        <Container className="flex flex-col gap-2 py-5 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Relia. All rights reserved.</span>
          <span>Organization-scoped. Grounded in your system of record.</span>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="font-mono text-xs text-muted-foreground">{title}</div>
      <div className="mt-4 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
