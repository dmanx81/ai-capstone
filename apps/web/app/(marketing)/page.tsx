import type { Metadata } from "next";

import {
  AskSection,
  CapabilitiesSection,
  FaqSection,
  FinalCta,
  HeroSection,
  HowItWorksSection,
  PipelineSection,
  PreviewSection,
  PricingSection,
  ProblemBand,
  SecuritySection,
  TrustStrip,
  UseCasesSection,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: {
    absolute: "Relia — Relationship Intelligence for Customer Teams",
  },
  description:
    "Relationship intelligence for CSMs, account managers, and account executives. One workspace for timelines, health, risks, commitments, and AI that only answers from stored evidence.",
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <TrustStrip />
      <ProblemBand />
      <PipelineSection />
      <CapabilitiesSection />
      <AskSection />
      <UseCasesSection />
      <HowItWorksSection />
      <PreviewSection />
      <SecuritySection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
