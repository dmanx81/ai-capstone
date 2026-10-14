import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Lock, ScrollText, ShieldCheck } from "lucide-react";

import { Container, PageIntro } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Security",
  description: "Organization isolation, RLS, server-side roles, and secrets that never reach the browser.",
};

const ITEMS = [
  {
    icon: Lock,
    title: "Workspace tenancy",
    body: "Every account, timeline event, risk, and chunk is tagged with an organization. API queries filter by the signed-in workspace. Members cannot open another org’s relationships.",
  },
  {
    icon: ShieldCheck,
    title: "Row-level security",
    body: "Supabase migrations enable RLS and membership checks in Postgres, repeating the same isolation the FastAPI layer already applies.",
  },
  {
    icon: KeyRound,
    title: "Roles on the server",
    body: "Viewers are read-only. Only owners and admins invite teammates or change billing. Agent writes require an explicit confirm step.",
  },
  {
    icon: ScrollText,
    title: "Privacy of customer evidence",
    body: "Briefs and Ask Relia answers must cite stored records. Relia will not fabricate people, dates, or promises. Service-role, Stripe, and LLM keys stay off the client.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageIntro
        eyebrow="Security"
        title="Isolation first. Evidence second. Secrets never in the browser."
        description="Relia is designed for customer teams that cannot mix workspaces or invent facts about an account. Authentication uses an HttpOnly session cookie. Optional Supabase JWTs are verified on the API. This page does not claim SOC 2, ISO 27001, HIPAA, or GDPR certification."
      />
      <section className="border-t">
        <Container>
          <dl>
            {ITEMS.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="grid gap-3 border-b py-10 lg:grid-cols-12 lg:gap-8">
                  <dt className="lg:col-span-5">
                    <div className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</div>
                    <div className="mt-3 flex items-center gap-3 text-xl font-semibold tracking-tight">
                      <Icon className="size-4 text-muted-foreground" aria-hidden />
                      {item.title}
                    </div>
                  </dt>
                  <dd className="max-w-2xl text-[15px] leading-7 text-muted-foreground lg:col-span-7 lg:pt-7">{item.body}</dd>
                </div>
              );
            })}
          </dl>
          <div className="flex flex-wrap gap-3 py-16">
            <Button size="lg" className="h-11 px-5 text-[15px]" nativeButton={false} render={<Link href="/signup" />}>
              Start workspace
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-5 text-[15px]" nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
