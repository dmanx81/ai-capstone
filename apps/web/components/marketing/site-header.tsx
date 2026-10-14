"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

import { ReliaLogo } from "@/components/marketing/logo";
import { MARKETING_NAV, homeHash } from "@/components/marketing/nav";
import { Container } from "@/components/marketing/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between gap-6">
        <ReliaLogo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Marketing">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.hash}
              href={homeHash(item.hash)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-1 lg:flex">
          <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Start workspace
          </Button>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
            Start workspace
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="border-b px-5 py-4 text-left">
                <SheetTitle>Relia</SheetTitle>
              </SheetHeader>
              <nav className="grid px-2 py-3" aria-label="Marketing">
                {MARKETING_NAV.map((item) => (
                  <Link
                    key={item.hash}
                    href={homeHash(item.hash)}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
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
      </Container>
    </header>
  );
}
