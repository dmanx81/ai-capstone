import type { Metadata } from "next";
import Link from "next/link";

import { CheckList, USE_CASES } from "@/components/marketing/sections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Use Cases",
  description: "Relationship intelligence for customer success, account management, sales, and CS / revenue leaders.",
};

const DETAIL: Record<string, string[]> = {
  "Customer Success": [
    "Start the day from the focus queue, not a spreadsheet of ARR.",
    "See overdue commitments and at-risk accounts before they become a surprise QBR.",
    "Track stakeholder change and adoption issues on the same timeline.",
    "Generate a grounded brief, then ask Relia what to discuss on the next call.",
  ],
  "Account Management": [
    "Keep champion, economic buyer, and blockers on the same account record.",
    "Track expansion opportunities next to the risks that could stall them.",
    "Keep follow-up and account planning attached to the relationship.",
    "Edit the timeline from the relationship page so the system of record stays current.",
  ],
  "Sales / Account Executives": [
    "Walk into a renewal knowing what was promised and what slipped.",
    "Use expansion signals and stakeholder intelligence instead of reconstructing email.",
    "Prepare the meeting from stored evidence, then confirm any agent-suggested follow-ups.",
  ],
  Leadership: [
    "See which accounts need attention across the portfolio.",
    "Spot relationship risk before it becomes a forecast surprise.",
    "Check whether commitments and tasks were actually followed through.",
  ],
};

export default function UseCasesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-muted-foreground">Use cases</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        One relationship workspace for CS, AM, sales, and leaders.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        The account is shared. The questions are the same. Relia keeps the evidence in one place so teams stop
        rebuilding context for every meeting.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {USE_CASES.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" aria-hidden />
                </span>
                <CardTitle className="mt-3">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <CheckList items={DETAIL[item.title] ?? []} />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/signup" />}>
          Start workspace
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={{ pathname: "/", hash: "pricing" }} />}>
          See pricing
        </Button>
      </div>
    </div>
  );
}
