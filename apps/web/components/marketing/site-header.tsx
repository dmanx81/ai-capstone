"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";

import { ReliaLogo } from "@/components/marketing/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/product", label: "Product" },
  { href: "/use-cases", label: "Use Cases" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <ReliaLogo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Marketing">
          {LINKS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
            Login
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Start Free
          </Button>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
            Start Free
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-4 text-left">
                <SheetTitle>Relia</SheetTitle>
              </SheetHeader>
              <nav className="grid gap-1 p-3" aria-label="Marketing">
                {LINKS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm hover:bg-muted",
                        active && "bg-muted font-medium",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="grid gap-2 border-t p-4">
                <Button nativeButton={false} variant="outline" render={<Link href="/login" />} onClick={() => setOpen(false)}>
                  Login
                </Button>
                <Button nativeButton={false} render={<Link href="/signup" />} onClick={() => setOpen(false)}>
                  Start Free
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
