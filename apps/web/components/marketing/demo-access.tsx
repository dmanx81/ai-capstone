"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DemoAccessButton({
  size = "lg",
  variant = "outline",
  className,
}: {
  size?: "sm" | "lg" | "default";
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        Explore demo workspace
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Explore the Northstar demo</DialogTitle>
            <DialogDescription>
              Relia ships a seeded Customer Success workspace. Sign-in is the same authenticated
              flow as any other account — this does not bypass passwords or tenancy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              The sign-in form is prefilled. After you sign in, open{" "}
              <span className="text-foreground">Meridian Health Systems</span> to see timeline,
              risks, commitments, and Ask Relia against stored evidence.
            </p>
            <dl className="rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd>
                  <code>demo@relia.app</code>
                </dd>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <dt className="text-muted-foreground">Password</dt>
                <dd>
                  <code>demo-password</code>
                </dd>
              </div>
            </dl>
          </div>
          <DialogFooter className="border-t-0 bg-transparent sm:justify-end">
            <Button nativeButton={false} render={<Link href="/login" />}>
              Continue to sign in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
