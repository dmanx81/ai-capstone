import type { ReactNode } from "react";
import { Building2, LayoutDashboard, ListChecks, Settings2 } from "lucide-react";

import { ReliaMark } from "@/components/marketing/logo";
import { cn } from "@/lib/utils";

const TIMELINE = [
  {
    type: "Meeting",
    title: "August QBR",
    detail: "Priya requested regional expansion scope for Dayton, Toledo, and Akron.",
  },
  {
    type: "Call",
    title: "Working session on SSO blockers",
    detail: "Marcus restated that production SSO is blocked on IdP metadata.",
  },
  {
    type: "Note",
    title: "SSO due date missed",
    detail: "We missed the committed SSO date. Customer still owes IdP metadata.",
    risk: true,
    cite: 1,
  },
];

const INTELLIGENCE = [
  { kind: "Risk", title: "Champion may leave", meta: "High · Priya Shah", risk: true },
  { kind: "Risk", title: "SSO implementation slipped six weeks", meta: "High", risk: true },
  { kind: "Commitment", title: "Deliver production SSO for clinicians", meta: "Overdue · we promised", cite: 2 },
  { kind: "Opportunity", title: "Dayton / Toledo / Akron expansion", meta: "Pursuing · requested at the August QBR" },
];

const QUEUE = [
  { title: "Review Meridian Health Systems", detail: "Health at risk (48/100)", urgency: "High", risk: true },
  { title: "Deliver production SSO for clinicians", detail: "Overdue · we promised", urgency: "High" },
  { title: "Champion may leave", detail: "High risk · Priya Shah", urgency: "Medium" },
  { title: "Expansion to Dayton / Toledo / Akron", detail: "Opportunity in pursuing", urgency: "Low" },
];

const HEALTH = [
  { label: "Healthy", count: 3, className: "bg-foreground/80" },
  { label: "Watch", count: 2, className: "bg-foreground/45" },
  { label: "At risk", count: 1, className: "bg-destructive" },
  { label: "Critical", count: 1, className: "bg-destructive" },
];

const HEALTH_TOTAL = HEALTH.reduce((sum, row) => sum + row.count, 0);

function MonoLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("font-mono text-[11px] text-muted-foreground", className)}>{children}</div>;
}

function Cite({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 inline-flex size-4 items-center justify-center rounded-[4px] border bg-background align-super font-mono text-[9px] font-medium text-foreground">
      {n}
    </sup>
  );
}

export function RiskBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/25 bg-destructive/5 px-2 py-0.5 text-xs font-medium text-destructive">
      <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
      {children}
    </span>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{children}</span>;
}

function HealthMeter({ score }: { score: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <MonoLabel>Relationship health</MonoLabel>
        <div className="font-mono text-xs">
          <span className="font-medium text-destructive">{score}</span>
          <span className="text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-destructive" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function RelationshipRecord() {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3.5">
        <ReliaMark className="size-5" />
        <span className="text-sm font-semibold tracking-tight">Meridian Health Systems</span>
        <RiskBadge>At risk 48</RiskBadge>
        <Tag>Renewal</Tag>
        <MonoLabel className="ml-auto hidden sm:block">Northstar Customer Success</MonoLabel>
      </div>
      <div className="grid lg:grid-cols-[1fr_1fr_1.15fr]">
        <div className="border-b p-5 lg:border-b-0 lg:border-r">
          <MonoLabel>01 · Timeline</MonoLabel>
          <ol className="relative mt-4 space-y-5 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-px before:bg-border">
            {TIMELINE.map((item) => (
              <li key={item.title} className="relative pl-5">
                <span
                  className={cn(
                    "absolute left-0 top-1.5 size-[7px] rounded-full ring-4 ring-card",
                    item.risk ? "bg-destructive" : "bg-foreground",
                  )}
                  aria-hidden
                />
                <MonoLabel>{item.type}</MonoLabel>
                <div className="mt-0.5 text-sm font-medium">
                  {item.title}
                  {item.cite ? <Cite n={item.cite} /> : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="border-b p-5 lg:border-b-0 lg:border-r">
          <MonoLabel>02 · Intelligence</MonoLabel>
          <ul className="mt-4 divide-y rounded-xl border">
            {INTELLIGENCE.map((item) => (
              <li key={item.title} className="px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <MonoLabel className={item.risk ? "text-destructive" : undefined}>{item.kind}</MonoLabel>
                  {item.risk ? <span className="size-1.5 rounded-full bg-destructive" aria-hidden /> : null}
                </div>
                <div className="mt-1 text-sm font-medium">
                  {item.title}
                  {item.cite ? <Cite n={item.cite} /> : null}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{item.meta}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-5 bg-muted/40 p-5">
          <MonoLabel>03 · Grounded brief</MonoLabel>
          <p className="text-[15px] leading-7">
            Meridian Health Systems is in renewal with health at risk. The committed SSO date was missed
            <Cite n={1} /> and production SSO for clinicians is overdue — we promised it
            <Cite n={2} />.
          </p>
          <HealthMeter score={48} />
          <div className="space-y-2">
            <MonoLabel>Sources</MonoLabel>
            <SourceChip n={1} title="Timeline · SSO due date missed" body="We committed to SSO by last Friday's steering meeting." />
            <SourceChip n={2} title="Commitment · Deliver production SSO" body="Overdue. Direction: we promised." />
          </div>
          <div className="rounded-xl border border-dashed bg-background p-3">
            <MonoLabel>Next action · Task</MonoLabel>
            <div className="mt-1 text-sm font-medium">Confirm Priya&apos;s role through renewal</div>
          </div>
        </div>
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t px-5 py-3 font-mono text-[11px] text-muted-foreground">
        <span>Grounded in stored records.</span>
        <span className="hidden sm:inline">Model: grounded assembler</span>
      </figcaption>
    </figure>
  );
}

function SourceChip({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-background p-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-foreground font-mono text-[10px] font-medium text-background">
        {n}
      </span>
      <div className="min-w-0 text-xs">
        <div className="font-medium">{title}</div>
        <p className="mt-0.5 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border bg-card p-5", className)}>{children}</div>;
}

export function TimelineVisual() {
  return (
    <Panel>
      <MonoLabel>Relationship timeline</MonoLabel>
      <ol className="mt-4 divide-y">
        {TIMELINE.map((item) => (
          <li key={item.title} className="grid grid-cols-[4.5rem_1fr] gap-3 py-3 first:pt-0 last:pb-0">
            <MonoLabel className={cn("pt-0.5", item.risk && "text-destructive")}>{item.type}</MonoLabel>
            <div>
              <div className="text-sm font-medium">{item.title}</div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function IntelligenceVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Panel>
        <MonoLabel>Risks</MonoLabel>
        <ul className="mt-3 space-y-3">
          {INTELLIGENCE.filter((item) => item.risk).map((item) => (
            <li key={item.title} className="flex items-start justify-between gap-3 text-sm">
              <span className="font-medium">{item.title}</span>
              <RiskBadge>High</RiskBadge>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <MonoLabel>Opportunities &amp; commitments</MonoLabel>
        <ul className="mt-3 space-y-3">
          {INTELLIGENCE.filter((item) => !item.risk).map((item) => (
            <li key={item.title} className="text-sm">
              <div className="font-medium">{item.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{item.meta}</div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function SourceExcerptVisual() {
  return (
    <Panel>
      <MonoLabel>Source excerpt</MonoLabel>
      <div className="mt-3">
        <SourceChip n={1} title="Timeline · SSO due date missed" body="We committed to SSO by last Friday's steering meeting." />
      </div>
      <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
        If that evidence is missing, Relia says it will not guess.
      </p>
    </Panel>
  );
}

export function NextActionsVisual() {
  const items = [
    { title: "Confirm Priya's role through renewal", meta: "Task", pending: false },
    { title: "Deliver production SSO for clinicians", meta: "Commitment · overdue · we promised", pending: false },
    { title: "Send regional expansion scoping deck", meta: "Follow-up proposed by agent · not written until confirm", pending: true },
  ];
  return (
    <Panel>
      <MonoLabel>Next actions</MonoLabel>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.title}
            className={cn("flex items-start gap-3 rounded-xl border p-3", item.pending && "border-dashed bg-muted/40")}
          >
            <span
              className={cn(
                "mt-0.5 size-4 shrink-0 rounded-[5px] border",
                item.pending ? "border-dashed border-foreground/40" : "border-foreground/30",
              )}
              aria-hidden
            />
            <div>
              <div className="text-sm font-medium">{item.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{item.meta}</div>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function AccountVisual() {
  return (
    <Panel className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tracking-tight">Meridian Health Systems</span>
        <RiskBadge>At risk 48</RiskBadge>
        <Tag>Renewal</Tag>
      </div>
      <HealthMeter score={48} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-3">
          <MonoLabel>Champion</MonoLabel>
          <div className="mt-1 text-sm font-medium">Priya Shah</div>
          <div className="text-xs text-muted-foreground">VP Clinical Ops · influence high</div>
        </div>
        <div className="rounded-xl border p-3">
          <MonoLabel>Open work</MonoLabel>
          <div className="mt-1 text-sm font-medium">SSO implementation slipped</div>
          <div className="text-xs text-muted-foreground">2 open commitments · 1 live opportunity</div>
        </div>
      </div>
    </Panel>
  );
}

export function AskAnswer() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b p-5">
        <MonoLabel>Question</MonoLabel>
        <p className="mt-1.5 text-lg font-medium tracking-tight">What did we promise this customer?</p>
      </div>
      <div className="space-y-5 p-5">
        <p className="text-[15px] leading-7">
          Northstar committed to deliver production SSO for Meridian clinicians by the last steering meeting
          <Cite n={1} />. That date was missed. Meridian security still owes IdP metadata, and the CISO will not
          approve production SSO without it
          <Cite n={2} />.
        </p>
        <div className="space-y-2">
          <MonoLabel>Sources</MonoLabel>
          <SourceChip n={1} title="Commitment · Deliver production SSO" body="Overdue. Direction: we promised." />
          <SourceChip n={2} title="Timeline · SSO due date missed" body="We committed to SSO by last Friday's steering meeting." />
        </div>
      </div>
      <div className="border-t bg-muted/40 px-5 py-3 font-mono text-[11px] text-muted-foreground">
        Grounded in stored records. Model: grounded assembler
      </div>
    </div>
  );
}

const APP_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Accounts", icon: Building2 },
  { label: "Tasks", icon: ListChecks },
  { label: "Settings", icon: Settings2 },
];

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-sidebar">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <div className="mx-auto rounded-md border bg-background px-3 py-0.5 font-mono text-[11px] text-muted-foreground">
          relia.space/dashboard
        </div>
      </div>
      <div className="grid md:grid-cols-[200px_1fr]">
        <aside className="hidden border-r p-3 md:block">
          <div className="flex items-center gap-2 px-1.5 py-1">
            <ReliaMark className="size-6" />
            <div>
              <div className="text-xs font-semibold">Relia</div>
              <div className="text-[11px] text-muted-foreground">Northstar Customer Success</div>
            </div>
          </div>
          <nav className="mt-5 grid gap-0.5" aria-hidden>
            {APP_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <span
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                    item.active ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </span>
              );
            })}
          </nav>
        </aside>
        <div className="space-y-5 bg-background p-5 sm:p-6">
          <div>
            <div className="text-xl font-semibold tracking-tight">What should I focus on today?</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Priority is operational: at-risk accounts, overdue promises, and recent customer changes.
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x rounded-xl border">
            {[
              { label: "Needing attention", value: "3" },
              { label: "Overdue commitments", value: "2" },
              { label: "Opportunity in pursuing", value: "1" },
            ].map((stat) => (
              <div key={stat.label} className="p-3 sm:p-4">
                <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border">
              <div className="border-b px-4 py-2.5 text-sm font-medium">Today&apos;s queue</div>
              <ul className="divide-y">
                {QUEUE.map((item) => (
                  <li key={item.title} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className={cn("mt-0.5 text-xs", item.risk ? "text-destructive" : "text-muted-foreground")}>
                        {item.detail}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">{item.urgency}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">Relationship health</div>
              <div className="mt-4 space-y-3">
                {HEALTH.map((row) => (
                  <div key={row.label} className="grid grid-cols-[4rem_1fr_1rem] items-center gap-3">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", row.className)} style={{ width: `${(row.count / HEALTH_TOTAL) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono text-xs">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
