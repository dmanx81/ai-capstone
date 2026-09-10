import Link from "next/link";

import { ReliaLogo } from "@/components/marketing/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/product", label: "Relationship intelligence" },
      { href: "/use-cases", label: "Use cases" },
      { href: "/pricing", label: "Pricing" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/login", label: "Login" },
      { href: "/signup", label: "Start Free" },
      { href: "/login", label: "Open demo" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-sidebar">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <ReliaLogo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Relationship intelligence for account managers, CSMs, and account executives. Evidence from stored records — never invented customer facts.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <div className="text-sm font-medium">{column.title}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.label}`}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Relia. All rights reserved.</span>
          <span>Organization-scoped. Grounded in your system of record.</span>
        </div>
      </div>
    </footer>
  );
}
