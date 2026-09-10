import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Lock, ScrollText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Security — Relia",
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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-muted-foreground">Security</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Isolation first. Evidence second. Secrets never in the browser.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        Relia is designed for customer teams that cannot mix workspaces or invent facts about an account. Authentication
        uses an HttpOnly session cookie. Optional Supabase JWTs are verified on the API.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" />
                </span>
                <CardTitle className="mt-3">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button nativeButton={false} render={<Link href="/signup" />}>
          Start Free
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
          Login
        </Button>
      </div>
    </div>
  );
}
