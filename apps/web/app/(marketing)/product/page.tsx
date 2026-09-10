import type { Metadata } from "next";
import Link from "next/link";

import {
  AskSection,
  CapabilitiesSection,
  HowItWorksSection,
  PipelineSection,
  PreviewSection,
} from "@/components/marketing/sections";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Product",
  description: "Accounts, timeline, intelligence objects, and grounded AI — the Relia relationship system of record.",
};

export default function ProductPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-12 sm:px-6 sm:pt-16">
        <p className="text-sm font-medium text-muted-foreground">Product</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything on the account, ready for the next conversation.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Relia is CRM-style relationship management with a chronological timeline, structured intelligence,
          and AI that only uses stored evidence.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Start workspace
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
        </div>
      </section>
      <PipelineSection />
      <HowItWorksSection />
      <CapabilitiesSection />
      <PreviewSection />
      <AskSection />
    </>
  );
}
