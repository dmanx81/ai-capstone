import Link from "next/link";
import {
  Bot,
  Building2,
  Check,
  FileSearch,
  Handshake,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { HeroPreview, ProductPreview } from "@/components/marketing/product-preview";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUESTIONS = [
  {
    title: "What is happening with this account?",
    body: "Health, lifecycle, ARR, and stakeholders live on the same record as the open work.",
  },
  {
    title: "What changed recently?",
    body: "Meetings, emails, calls, and notes stay chronological so you are not reconstructing history from inboxes.",
  },
  {
    title: "What risks and opportunities exist?",
    body: "Risks and expansion threads are structured objects with owners, status, and evidence — not a slide deck.",
  },
  {
    title: "What promises were made?",
    body: "Commitments keep a due date and a direction: we promised, or they promised. Overdue items surface on the dashboard.",
  },
  {
    title: "What should I do next?",
    body: "Tasks and the focus queue are operational. Agents can propose work; writes wait for confirmation.",
  },
  {
    title: "What should I know before the meeting?",
    body: "Grounded briefs and Ask Relia retrieve stored chunks and cite sources. Missing evidence is said out loud.",
  },
];

const WORKFLOW = [
  { step: "1", title: "Capture the relationship", body: "Accounts, contacts, health, ARR, lifecycle, and tags live in one workspace." },
  { step: "2", title: "Keep a timeline", body: "Meetings, emails, calls, and notes become the chronological system of record." },
  { step: "3", title: "Structure intelligence", body: "Risks, opportunities, commitments, and tasks carry evidence, not vibes." },
  { step: "4", title: "Ask Relia", body: "Briefs and answers retrieve stored chunks and cite sources. Missing evidence is said out loud." },
  { step: "5", title: "Act with confirmation", body: "Agent workflows can propose tasks. Writes happen only after you confirm." },
];

export const USE_CASES = [
  {
    icon: Handshake,
    title: "Customer Success",
    body: "See which accounts need attention today, which promises are overdue, and what changed since the last QBR — before you get on the call.",
  },
  {
    icon: Users,
    title: "Account Management",
    body: "Keep the champion, economic buyer, and blockers mapped. Expansion threads stay attached to the same relationship that holds the risks.",
  },
  {
    icon: Building2,
    title: "Sales",
    body: "Walk into a renewal or expansion already knowing commitments, sentiment, and the last customer-facing change. No separate war room required.",
  },
];

const AI = [
  { icon: Sparkles, title: "Grounded briefs", body: "Executive summaries assemble from stored risks, commitments, stakeholders, and recent timeline events." },
  { icon: FileSearch, title: "RAG with sources", body: "Questions retrieve chunks from CRM snapshots, timeline, documents, and intelligence objects." },
  { icon: Bot, title: "Confirm-gated agents", body: "Meeting prep, risk analysis, and next-best-actions preview first. Nothing writes until you say so." },
  { icon: ShieldCheck, title: "No invented facts", body: "If the record does not support a claim, Relia says it will not guess — even when an LLM is connected." },
];

const SECURITY = [
  { icon: Lock, title: "Organization isolation", body: "Every business row is scoped by workspace. Members cannot read another organization’s accounts." },
  { icon: ShieldCheck, title: "Row-level security", body: "Production Postgres policies repeat the same tenancy rule the API already enforces." },
  { icon: FileSearch, title: "Secrets stay server-side", body: "Service-role, Stripe, and model keys never ship to the browser. Sessions use an HttpOnly cookie." },
];

export function HeroSection() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-2">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Relationship intelligence for customer teams</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Walk into every customer conversation already knowing the relationship.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Relia is the system of record for accounts, timelines, risks, promises, and next actions — with AI that only
          speaks from evidence.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            Start Free
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Login
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Try the Northstar demo: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">demo@relia.app</code> /{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">demo-password</code>
        </p>
      </div>
      <HeroPreview />
    </section>
  );
}

export function ValueSection({ className }: { className?: string }) {
  return (
    <Section
      id="product"
      className={className}
      eyebrow="Product"
      title="The relationship is the system of record."
      description="CRM fields, a chronological timeline, and structured intelligence feed the same questions your team already asks before a customer meeting."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUESTIONS.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-sm">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}

export function WorkflowSection() {
  return (
    <Section
      id="workflow"
      eyebrow="Workflow"
      title="How relationship intelligence is built"
      description="Relia does not replace the work of knowing the account. It keeps that work inspectable, searchable, and usable in the next meeting."
    >
      <ol className="grid gap-4 md:grid-cols-5">
        {WORKFLOW.map((item) => (
          <li key={item.step} className="rounded-xl border bg-card p-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              {item.step}
            </div>
            <div className="mt-3 text-sm font-medium">{item.title}</div>
            <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function PreviewSection() {
  return (
    <Section
      id="preview"
      eyebrow="In the product"
      title="A dashboard that answers: what should I focus on today?"
      description="Priority is operational — accounts needing attention, overdue commitments, serious risks, upcoming tasks, and recent customer changes. The account page is the core surface."
    >
      <ProductPreview />
    </Section>
  );
}

export function AiSection() {
  return (
    <Section
      id="ai"
      eyebrow="AI"
      title="Grounded in stored records"
      description="Connect OpenAI or Anthropic when you are ready. Without keys, Relia still assembles briefs and answers from the database. Either way, claims keep their evidence."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {AI.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-4" />
                </span>
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

export function UseCasesSection() {
  return (
    <Section
      id="use-cases"
      eyebrow="Use cases"
      title="Built for the people who own the relationship"
    >
      <div className="grid gap-4 md:grid-cols-3">
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
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-8">
        <Button variant="outline" nativeButton={false} render={<Link href="/use-cases" />}>
          See Customer Success, AM, and Sales
        </Button>
      </div>
    </Section>
  );
}

export function PricingSection() {
  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      title="Start free. Upgrade when the book of business grows."
      description="Plan limits are enforced on the server. Subscription state never comes from the browser."
    >
      <PricingGrid />
    </Section>
  );
}

export function SecuritySection() {
  return (
    <Section
      id="security"
      eyebrow="Security"
      title="Tenancy and secrets are product features"
      description="Relia is built for teams that cannot leak one customer’s notes into another workspace."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {SECURITY.map((item) => {
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
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-8">
        <Button variant="outline" nativeButton={false} render={<Link href="/security" />}>
          Read how Relia isolates workspaces
        </Button>
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t bg-sidebar">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight">Know the relationship before you walk in.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a workspace in minutes, or sign in to the Northstar demo and open Meridian Health Systems.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            Start Free
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Login
          </Button>
        </div>
      </div>
    </section>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      {items.map((line) => (
        <li key={line} className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
