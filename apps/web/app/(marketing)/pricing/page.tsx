import type { Metadata } from "next";
import Link from "next/link";

import { PricingGrid } from "@/components/marketing/pricing-grid";
import { Container, PageIntro } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free, Starter, and Growth plans for Relia relationship intelligence.",
};

export default function PricingPage() {
  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title="Simple plans, enforced on the server."
        description="Account limits and monthly AI actions follow the workspace plan. Stripe Checkout and the billing portal update subscription state from webhooks — never from a client-supplied plan."
      />
      <Container className="pb-24">
        <PricingGrid />
        <div className="mt-10 flex flex-col gap-6 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Need to look around first?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>{" "}
            to the Northstar demo, or{" "}
            <Link href="/signup" className="text-foreground underline underline-offset-4">
              start a workspace
            </Link>
            .
          </p>
          <Button variant="outline" nativeButton={false} render={<Link href="/security" />}>
            How Relia handles tenancy and secrets
          </Button>
        </div>
      </Container>
    </>
  );
}
