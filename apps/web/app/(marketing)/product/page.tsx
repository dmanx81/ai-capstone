import type { Metadata } from "next";
import Link from "next/link";

import {
  AskSection,
  CapabilitiesSection,
  HowItWorksSection,
  PipelineSection,
  PreviewSection,
} from "@/components/marketing/sections";
import { PageIntro } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Product",
  description: "Accounts, timeline, intelligence objects, and grounded AI — the Relia relationship system of record.",
};

export default function ProductPage() {
  return (
    <>
      <PageIntro
        eyebrow="Product"
        title="Everything on the account, ready for the next conversation."
        description="Relia is CRM-style relationship management with a chronological timeline, structured intelligence, and AI that only uses stored evidence."
      >
        <Button size="lg" className="h-11 px-5 text-[15px]" nativeButton={false} render={<Link href="/signup" />}>
          Start workspace
        </Button>
        <Button size="lg" variant="outline" className="h-11 px-5 text-[15px]" nativeButton={false} render={<Link href="/login" />}>
          Sign in
        </Button>
      </PageIntro>
      <PipelineSection />
      <HowItWorksSection />
      <CapabilitiesSection />
      <PreviewSection />
      <AskSection />
    </>
  );
}
