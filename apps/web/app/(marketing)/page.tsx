import type { Metadata } from "next";

import {
  AiSection,
  FinalCta,
  HeroSection,
  PreviewSection,
  PricingSection,
  SecuritySection,
  UseCasesSection,
  ValueSection,
  WorkflowSection,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Relia — Relationship Intelligence",
  description: "Know what is happening with every customer relationship before you walk into the room.",
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ValueSection />
      <WorkflowSection />
      <PreviewSection />
      <AiSection />
      <UseCasesSection />
      <PricingSection />
      <SecuritySection />
      <FinalCta />
    </>
  );
}
