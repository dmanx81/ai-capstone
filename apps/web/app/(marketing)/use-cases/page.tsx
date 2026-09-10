import type { Metadata } from "next";
import Link from "next/link";

import { USE_CASES } from "@/components/marketing/sections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Use Cases — Relia",
  description: "Relationship intelligence for customer success, account management, and sales.",
};

const DETAIL: Record<string, string[]> = {
  "Customer Success": [
    "Start the day from the focus queue, not a spreadsheet of ARR.",
    "See overdue commitments and at-risk accounts before they become a surprise QBR.",
    "Generate a grounded brief, then ask Relia what to discuss on the next call.",
  ],
  "Account Management": [
    "Keep champion, economic buyer, and blockers on the same account record.",
    "Track expansion opportunities next to the risks that could stall them.",
    "Edit the timeline from the relationship page so the system of record stays current.",
  ],
  Sales: [
    "Walk into a renewal knowing what was promised and what slipped.",
    "Use recent customer changes instead of reconstructing history from email.",
    "Confirm agent-suggested follow-ups so writes stay intentional.",
  ],
};

export default function UseCasesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-muted-foreground">Use cases</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        One relationship workspace for CS, AM, and sales.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        The account is shared. The questions are the same. Relia keeps the evidence in one place so teams stop
        rebuilding context for every meeting.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {USE_CASES.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" />
                </span>
                <CardTitle className="mt-3">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {DETAIL[item.title]?.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/signup" />}>
          Start Free
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/pricing" />}>
          See pricing
        </Button>
      </div>
    </div>
  );
}
