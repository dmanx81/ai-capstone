import type { Metadata } from "next";
import Link from "next/link";

import { PricingGrid } from "@/components/marketing/pricing-grid";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free, Starter, and Growth plans for Relia relationship intelligence.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-muted-foreground">Pricing</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Simple plans, enforced on the server.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        Account limits and monthly AI actions follow the workspace plan. Stripe Checkout and the billing portal
        update subscription state from webhooks — never from a client-supplied plan.
      </p>
      <div className="mt-10">
        <PricingGrid />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Need to look around first?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        to the Northstar demo, or{" "}
        <Link href="/signup" className="underline">
          start a workspace
        </Link>
        .
      </p>
      <div className="mt-6">
        <Button variant="outline" nativeButton={false} render={<Link href="/security" />}>
          How Relia handles tenancy and secrets
        </Button>
      </div>
    </div>
  );
}
