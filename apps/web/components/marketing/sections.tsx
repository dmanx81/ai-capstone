import Link from "next/link";
import { Building2, Handshake, LayoutDashboard, Users } from "lucide-react";

import { DemoAccessButton } from "@/components/marketing/demo-access";
import {
  AccountOverviewPreview,
  AskReliaPreview,
  HeroPreview,
  IntelligencePreview,
  ProductPreview,
  TimelinePreview,
} from "@/components/marketing/product-preview";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRINCIPLES = [
  { title: "One customer timeline", body: "Meetings, emails, calls, and notes stay chronological on the account." },
  { title: "Evidence-backed AI", body: "Briefs and Ask Relia retrieve stored chunks and cite sources." },
  { title: "Risks and opportunities in view", body: "Structured intelligence sits next to the relationship that owns it." },
  { title: "Built for customer-facing teams", body: "CSMs, AMs, AEs, and leaders share the same workspace." },
];

const PIPELINE = [
  { title: "Interactions", body: "Calls, emails, meetings, notes" },
  { title: "Timeline", body: "Chronological system of record" },
  { title: "Intelligence", body: "Risks, opportunities, commitments" },
  { title: "AI brief", body: "Grounded in stored evidence" },
  { title: "Next actions", body: "Tasks after you confirm" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Capture the relationship",
    body: "Accounts, contacts, events, commitments, and account context live in one workspace.",
  },
  {
    step: "02",
    title: "Relia organizes the signal",
    body: "The timeline, structured intelligence, and search index keep evidence inspectable.",
  },
  {
    step: "03",
    title: "Act with context",
    body: "Briefs, the focus queue, Ask Relia, and confirm-gated tasks prepare the next conversation.",
  },
];

export const USE_CASES = [
  {
    icon: Handshake,
    title: "Customer Success",
    body: "Health, renewal risk, stakeholder change, overdue commitments, adoption issues, and meeting prep — before the call starts.",
  },
  {
    icon: Users,
    title: "Account Management",
    body: "Opportunity identification, executive context, follow-up, relationship coverage, and account planning on the same record.",
  },
  {
    icon: Building2,
    title: "Sales / Account Executives",
    body: "Customer context, expansion signals, stakeholder intelligence, and meeting preparation without a separate war room.",
  },
  {
    icon: LayoutDashboard,
    title: "Leadership",
    body: "Portfolio visibility, priority accounts, relationship risk, and whether the team actually followed through.",
  },
];

const SECURITY = [
  {
    title: "Workspace isolation",
    body: "Every business row is scoped by organization. Members cannot read another workspace’s accounts.",
  },
  {
    title: "Roles on the server",
    body: "Viewers are read-only. Only owners and admins invite teammates or change billing. Agent writes require confirm.",
  },
  {
    title: "Evidence-grounded AI",
    body: "Answers return sources. If the record does not support a claim, Relia will not guess — even with an LLM connected.",
  },
  {
    title: "Secrets stay off the client",
    body: "Service-role, Stripe, and model keys never ship to the browser. Sessions use an HttpOnly cookie.",
  },
];

const FAQ = [
  {
    q: "What is relationship intelligence?",
    a: "A durable record of the customer relationship: the account, stakeholders, chronological timeline, risks, opportunities, commitments, and next actions — queryable before a conversation.",
  },
  {
    q: "Is Relia a CRM?",
    a: "Relia includes CRM-style account and contact management, but the core is the relationship system of record: timeline plus structured intelligence plus grounded AI. It is not a full sales-automation CRM.",
  },
  {
    q: "Where does Relia get its answers?",
    a: "Ask Relia and briefs retrieve chunks from CRM snapshots, timeline events, documents, and intelligence objects in the workspace. Responses include source excerpts. Relia does not browse the public web for customer facts.",
  },
  {
    q: "Can teams use their existing customer data?",
    a: "Yes, by entering accounts, contacts, timeline events, and documents in Relia. This release does not sync automatically from an external CRM.",
  },
  {
    q: "What happens when AI cannot find evidence?",
    a: "The answer says so. Missing evidence produces an explicit “will not guess” response instead of invented people, dates, or promises.",
  },
  {
    q: "Can multiple team members collaborate?",
    a: "Yes. Owners and admins invite members by email or shareable link. Roles are owner, admin, member, and viewer. Viewers cannot write timeline events or confirm agent actions.",
  },
  {
    q: "Which AI models does Relia support?",
    a: "OpenAI or Anthropic when those API keys are configured on the server. Without keys, Relia still assembles briefs and answers from stored records. The provider is not selected in the browser.",
  },
];

export function HeroSection() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-2">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Relationship intelligence for customer teams</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Know the relationship before every customer conversation.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Relia gives CSMs, account managers, and account executives one place to see what changed,
          customer health, risks, opportunities, stakeholders, promises, and next actions — with AI
          that only speaks from evidence.
        </p>
        <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {[
            "What changed",
            "Customer health",
            "Risks and opportunities",
            "Stakeholder context",
            "Promises and commitments",
            "Next actions",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-foreground" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            Start workspace
          </Button>
          <DemoAccessButton />
        </div>
      </div>
      <HeroPreview />
    </section>
  );
}

export function TrustStrip() {
  return (
    <section aria-label="Product principles" className="border-y bg-sidebar">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map((item) => (
          <div key={item.title}>
            <h2 className="text-sm font-medium">{item.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProblemBand() {
  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          One account is easy to remember. Thirty aren&apos;t.
        </h2>
        <p className="mt-4 text-sm leading-6 text-background/75 sm:text-base">
          Warning signs usually already exist in calls, emails, and notes. Relia keeps that context on
          the relationship so renewal risk, overdue promises, and stakeholder change surface before
          the next conversation — not after it.
        </p>
      </div>
    </section>
  );
}

export function PipelineSection() {
  return (
    <Section
      id="product"
      eyebrow="Product"
      title="One place to understand every relationship"
      description="Customer interactions become a timeline, then structured intelligence, then a grounded brief and next actions. Nothing in that chain invents a customer fact."
    >
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PIPELINE.map((item, index) => (
          <li key={item.title} className="relative rounded-xl border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">{String(index + 1).padStart(2, "0")}</div>
            <div className="mt-2 text-sm font-medium">{item.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function CapabilitiesSection() {
  return (
    <Section
      eyebrow="Capabilities"
      title="The relationship is the system of record"
      description="Relia uses the same objects your team already works in: accounts, timeline events, risks, opportunities, commitments, tasks, and grounded answers."
    >
      <div className="grid gap-10">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Relationship timeline</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Meetings, emails, calls, notes, customer requests, and product issues stay in chronological
              context. User-entered events can be created, edited, and deleted from the account page.
            </p>
          </div>
          <TimelinePreview />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="lg:order-2">
            <h3 className="text-lg font-semibold tracking-tight">Risks and opportunities</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Risks, expansion opportunities, commitments, and tasks are structured objects with owners,
              status, and evidence — not a slide deck rebuilt before every QBR.
            </p>
          </div>
          <div className="lg:order-1">
            <IntelligencePreview />
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Grounded AI</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ask Relia and account briefs retrieve stored chunks and return source excerpts. Connect OpenAI
              or Anthropic when you are ready. Without keys, Relia still assembles answers from the database.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Source excerpt</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="rounded-lg border p-3 text-xs">
                <div className="font-medium">Timeline · SSO due date missed</div>
                <p className="mt-1 text-muted-foreground">We committed to SSO by last Friday&apos;s steering meeting.</p>
              </div>
              <p className="mt-3 text-muted-foreground">If that evidence is missing, Relia says it will not guess.</p>
            </CardContent>
          </Card>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="lg:order-2">
            <h3 className="text-lg font-semibold tracking-tight">Action management</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Commitments keep a due date and a direction: we promised, or they promised. Tasks have owners
              and deadlines. Agent workflows can propose follow-ups; writes wait until you confirm.
            </p>
          </div>
          <Card className="lg:order-1">
            <CardHeader>
              <CardTitle>Next actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-lg border p-3">
                <div className="font-medium">Confirm Priya&apos;s role through renewal</div>
                <div className="mt-1 text-xs text-muted-foreground">Task · Meridian Health Systems</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="font-medium">Deliver production SSO for clinicians</div>
                <div className="mt-1 text-xs text-muted-foreground">Commitment · overdue · we promised</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="font-medium">Send regional expansion scoping deck</div>
                <div className="mt-1 text-xs text-muted-foreground">Follow-up proposed by agent · not written until confirm</div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Account overview</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Health, ARR, lifecycle, contacts, open risks, and current priorities sit on the same account.
              The dashboard asks one operational question: what should I focus on today?
            </p>
          </div>
          <AccountOverviewPreview />
        </div>
      </div>
    </Section>
  );
}

export function AskSection() {
  return (
    <Section
      id="ask"
      eyebrow="Ask Relia"
      title="Questions your team already asks — answered from the record"
      description="Suggested questions match the relationship page. The example below uses the seeded Meridian Health Systems account, not invented customers."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "What changed recently?",
          "What risks exist?",
          "What did we promise them?",
          "Who are the key stakeholders?",
          "What expansion opportunities exist?",
          "What should I do next?",
        ].map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="text-sm">{item}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <AskReliaPreview />
      </div>
    </Section>
  );
}

export function UseCasesSection() {
  return (
    <Section id="use-cases" eyebrow="Use cases" title="Built for the people who own the relationship">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Capture the relationship. Organize the signal. Act with context."
    >
      <ol className="grid gap-6 md:grid-cols-3">
        {HOW_IT_WORKS.map((item) => (
          <li key={item.step}>
            <p className="text-sm font-semibold text-muted-foreground">{item.step}</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
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
      description="The preview uses Relia’s own cards, health badges, and account chrome — the same surfaces as the Northstar demo, not a stock illustration."
    >
      <ProductPreview />
    </Section>
  );
}

export function SecuritySection() {
  return (
    <Section
      id="security"
      eyebrow="Security"
      title="Tenancy and evidence are product features"
      description="Relia does not publish SOC 2, ISO 27001, HIPAA, or GDPR certifications. The claims below describe the current architecture."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {SECURITY.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
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

export function PricingSection() {
  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      title="Start free. Upgrade when the book of business grows."
      description="These are the plans Relia already enforces on the server: account limits and monthly AI actions. Subscription state never comes from the browser."
    >
      <PricingGrid />
    </Section>
  );
}

export function FaqSection() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions about Relia">
      <div className="mx-auto max-w-3xl divide-y rounded-xl border">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-4 py-4">
            <summary className="cursor-pointer list-none text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-4">
                {item.q}
                <span className="text-muted-foreground group-open:hidden" aria-hidden>
                  +
                </span>
                <span className="hidden text-muted-foreground group-open:inline" aria-hidden>
                  −
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="border-t bg-sidebar">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight">Know the relationship before the next conversation.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a workspace, or explore the Northstar demo and open Meridian Health Systems.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
            Start workspace
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Sign in
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
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

