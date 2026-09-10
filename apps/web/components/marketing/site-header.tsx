"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

import { ReliaLogo } from "@/components/marketing/logo";
import { MARKETING_NAV, homeHash } from "@/components/marketing/nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <ReliaLogo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Marketing">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.hash}
              href={homeHash(item.hash)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Start free
          </Button>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
            Start free
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
                {MARKETING_NAV.map((item) => (
                  <Link
                    key={item.hash}
                    href={homeHash(item.hash)}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="grid gap-2 border-t p-4">
                <Button nativeButton={false} variant="outline" render={<Link href="/login" />} onClick={() => setOpen(false)}>
                  Sign in
                </Button>
                <Button nativeButton={false} render={<Link href="/signup" />} onClick={() => setOpen(false)}>
                  Start workspace
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
