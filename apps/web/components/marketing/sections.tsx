import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Lock,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";

import { DemoAccessButton } from "@/components/marketing/demo-access";
import { ReliaMark } from "@/components/marketing/logo";
import {
  AccountVisual,
  AskAnswer,
  DashboardPreview,
  IntelligenceVisual,
  NextActionsVisual,
  RelationshipRecord,
  SourceExcerptVisual,
  TimelineVisual,
} from "@/components/marketing/product-preview";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import { Container, Eyebrow, Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HERO_POINTS = [
  "What changed",
  "Customer health",
  "Risks and opportunities",
  "Stakeholder context",
  "Promises and commitments",
  "Next actions",
];

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

const CAPABILITIES = [
  {
    id: "timeline",
    title: "Relationship timeline",
    body: "Meetings, emails, calls, notes, customer requests, and product issues stay in chronological context. User-entered events can be created, edited, and deleted from the account page.",
    visual: <TimelineVisual />,
  },
  {
    id: "intelligence",
    title: "Risks and opportunities",
    body: "Risks, expansion opportunities, commitments, and tasks are structured objects with owners, status, and evidence — not a slide deck rebuilt before every QBR.",
    visual: <IntelligenceVisual />,
  },
  {
    id: "grounded-ai",
    title: "Grounded AI",
    body: "Ask Relia and account briefs retrieve stored chunks and return source excerpts. Connect OpenAI or Anthropic when you are ready. Without keys, Relia still assembles answers from the database.",
    visual: <SourceExcerptVisual />,
  },
  {
    id: "actions",
    title: "Action management",
    body: "Commitments keep a due date and a direction: we promised, or they promised. Tasks have owners and deadlines. Agent workflows can propose follow-ups; writes wait until you confirm.",
    visual: <NextActionsVisual />,
  },
  {
    id: "account",
    title: "Account overview",
    body: "Health, ARR, lifecycle, contacts, open risks, and current priorities sit on the same account. The dashboard asks one operational question: what should I focus on today?",
    visual: <AccountVisual />,
  },
];

const QUESTIONS = [
  "What changed recently?",
  "What risks exist?",
  "What did we promise them?",
  "Who are the key stakeholders?",
  "What expansion opportunities exist?",
  "What should I do next?",
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
    icon: Lock,
    title: "Workspace isolation",
    body: "Every business row is scoped by organization. Members cannot read another workspace’s accounts.",
  },
  {
    icon: KeyRound,
    title: "Roles on the server",
    body: "Viewers are read-only. Only owners and admins invite teammates or change billing. Agent writes require confirm.",
  },
  {
    icon: ScrollText,
    title: "Evidence-grounded AI",
    body: "Answers return sources. If the record does not support a claim, Relia will not guess — even with an LLM connected.",
  },
  {
    icon: ShieldCheck,
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

const ctaClass = "h-11 px-5 text-[15px]";
const onDarkPrimary = "bg-background text-foreground hover:bg-background/90";
const onDarkOutline =
  "border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background";

function index(n: number) {
  return String(n + 1).padStart(2, "0");
}

export function HeroSection() {
  return (
    <section>
      <Container className="pt-16 sm:pt-24">
        <Eyebrow>Relationship intelligence for customer teams</Eyebrow>
        <h1 className="mt-7 max-w-5xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">
          Know the relationship before every customer conversation.
        </h1>
        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <p className="max-w-xl text-pretty text-lg leading-8 text-muted-foreground lg:col-span-7">
            Relia gives CSMs, account managers, and account executives one place to see what changed,
            customer health, risks, opportunities, stakeholders, promises, and next actions — with AI
            that only speaks from evidence.
          </p>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Button size="lg" className={ctaClass} nativeButton={false} render={<Link href="/signup" />}>
              Start workspace
              <ArrowRight data-icon="inline-end" />
            </Button>
            <DemoAccessButton className={ctaClass} />
          </div>
        </div>
        <ul className="mt-14 grid grid-cols-2 border-t sm:grid-cols-3 lg:grid-cols-6">
          {HERO_POINTS.map((item, i) => (
            <li key={item} className="border-b py-4 pr-4 lg:border-b-0">
              <div className="font-mono text-[11px] text-muted-foreground">{index(i)}</div>
              <div className="mt-1 text-sm">{item}</div>
            </li>
          ))}
        </ul>
      </Container>
      <Container className="pb-20 pt-6 sm:pb-28 lg:pt-10">
        <RelationshipRecord />
      </Container>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section aria-label="Product principles" className="border-y bg-sidebar">
      <Container>
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((item, i) => (
            <div key={item.title} className="bg-sidebar py-8 sm:px-6">
              <div className="font-mono text-[11px] text-muted-foreground">{index(i)}</div>
              <h2 className="mt-3 text-sm font-medium">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

const FLAGGED = new Set([8, 15, 26]);

export function ProblemBand() {
  return (
    <section className="bg-foreground text-background">
      <Container className="grid gap-14 py-20 sm:py-28 lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className="lg:col-span-6">
          <h2 className="max-w-xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            One account is easy to remember. Thirty aren&apos;t.
          </h2>
          <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-background/75">
            Warning signs usually already exist in calls, emails, and notes. Relia keeps that context on
            the relationship so renewal risk, overdue promises, and stakeholder change surface before
            the next conversation — not after it.
          </p>
        </div>
        <div className="grid grid-cols-6 gap-2 lg:col-span-6" aria-hidden>
          {Array.from({ length: 30 }).map((_, i) => {
            const flagged = FLAGGED.has(i);
            return (
              <div
                key={i}
                className={cn(
                  "flex aspect-[4/3] flex-col justify-between rounded-lg border p-2",
                  flagged ? "border-destructive bg-destructive/10" : "border-background/10 bg-background/[0.03]",
                )}
              >
                <div className={cn("h-1 w-3/5 rounded-full", flagged ? "bg-background/70" : "bg-background/15")} />
                <div className="flex items-center justify-between">
                  <div className={cn("h-1 w-2/5 rounded-full", flagged ? "bg-background/40" : "bg-background/10")} />
                  {flagged ? <span className="size-1.5 rounded-full bg-destructive" /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Container>
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
      <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0 lg:before:absolute lg:before:inset-x-0 lg:before:top-3 lg:before:h-px lg:before:bg-border">
        {PIPELINE.map((item, i) => {
          const last = i === PIPELINE.length - 1;
          return (
            <li key={item.title} className="relative lg:pr-8">
              <span
                className={cn(
                  "relative flex size-6 items-center justify-center rounded-full border font-mono text-[10px]",
                  last ? "border-foreground bg-foreground text-background" : "bg-background",
                )}
              >
                {index(i)}
              </span>
              <div className="mt-6 text-base font-medium tracking-tight">{item.title}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

export function CapabilitiesSection() {
  return (
    <section className="border-t">
      <Container className="py-20 sm:py-28">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <Eyebrow>Capabilities</Eyebrow>
              <h2 className="mt-5 max-w-md text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.05]">
                The relationship is the system of record
              </h2>
              <p className="mt-5 max-w-md text-pretty text-base leading-7 text-muted-foreground">
                Relia uses the same objects your team already works in: accounts, timeline events, risks,
                opportunities, commitments, tasks, and grounded answers.
              </p>
              <ol className="mt-10 hidden max-w-md border-t lg:block">
                {CAPABILITIES.map((item, i) => (
                  <li key={item.id}>
                    <a
                      href={`#cap-${item.id}`}
                      className="flex items-center gap-4 border-b py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="font-mono text-[11px]">{index(i)}</span>
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="space-y-20 lg:col-span-7">
            {CAPABILITIES.map((item, i) => (
              <article key={item.id} id={`cap-${item.id}`} className="scroll-mt-24">
                <div className="font-mono text-[11px] text-muted-foreground">{index(i)}</div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 max-w-xl text-pretty text-[15px] leading-7 text-muted-foreground">{item.body}</p>
                <div className="mt-7">{item.visual}</div>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function AskSection() {
  return (
    <Section
      id="ask"
      className="bg-sidebar"
      eyebrow="Ask Relia"
      title="Questions your team already asks — answered from the record"
      description="Suggested questions match the relationship page. The example below uses the seeded Meridian Health Systems account, not invented customers."
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <ul className="border-t lg:col-span-5">
          {QUESTIONS.map((item) => {
            const active = item === "What did we promise them?";
            return (
              <li
                key={item}
                className={cn(
                  "flex items-center justify-between gap-4 border-b py-4 text-base",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {item}
                <ArrowRight className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-30")} aria-hidden />
              </li>
            );
          })}
        </ul>
        <div className="lg:col-span-7">
          <AskAnswer />
        </div>
      </div>
    </Section>
  );
}

export function UseCasesSection() {
  return (
    <Section id="use-cases" eyebrow="Use cases" title="Built for the people who own the relationship">
      <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {USE_CASES.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex flex-col bg-background p-6">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4" aria-hidden />
              </span>
              <h3 className="mt-12 text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
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
      <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
        {HOW_IT_WORKS.map((item) => (
          <li key={item.step} className="border-t border-foreground pt-6">
            <p className="font-mono text-xs text-muted-foreground">{item.step}</p>
            <h3 className="mt-10 text-xl font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-2 text-[15px] leading-7 text-muted-foreground">{item.body}</p>
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
      <DashboardPreview />
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
      <dl className="border-t">
        {SECURITY.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="grid gap-2 border-b py-6 lg:grid-cols-12 lg:gap-8">
              <dt className="flex items-center gap-3 text-base font-medium lg:col-span-4">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {item.title}
              </dt>
              <dd className="text-[15px] leading-7 text-muted-foreground lg:col-span-8">{item.body}</dd>
            </div>
          );
        })}
      </dl>
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
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="border-t lg:col-span-8 lg:col-start-5">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-base font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  className="relative mt-1.5 size-3 shrink-0 text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-current after:transition-transform group-open:after:scale-y-0"
                  aria-hidden
                />
              </summary>
              <p className="max-w-2xl pb-6 text-[15px] leading-7 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="bg-foreground text-background">
      <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="lg:col-span-8">
          <ReliaMark inverted className="size-10" />
          <h2 className="mt-10 max-w-3xl text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
            Create a workspace, or explore the Northstar demo and open Meridian Health Systems.
          </h2>
        </div>
        <div className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
          <Button size="lg" className={cn(ctaClass, onDarkPrimary)} nativeButton={false} render={<Link href="/signup" />}>
            Start workspace
          </Button>
          <Button
            size="lg"
            variant="outline"
            className={cn(ctaClass, onDarkOutline)}
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Sign in
          </Button>
        </div>
      </Container>
    </section>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="divide-y border-t text-sm text-muted-foreground">
      {items.map((line) => (
        <li key={line} className="flex gap-3 py-3">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
