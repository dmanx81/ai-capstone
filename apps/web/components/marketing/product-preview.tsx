import type { ReactNode } from "react";

import { HealthBadge, Pill, SeverityBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUEUE = [
  { title: "Review Meridian Health Systems", detail: "Health at risk (48/100)", urgency: "high" },
  { title: "Deliver production SSO for clinicians", detail: "Overdue · we promised", urgency: "high" },
  { title: "Champion may leave", detail: "High risk · Priya Shah", urgency: "medium" },
  { title: "Expansion to Dayton / Toledo / Akron", detail: "Opportunity in pursuing", urgency: "low" },
];

const STATS = [
  { label: "Needing attention", value: "3" },
  { label: "Overdue commitments", value: "2" },
  { label: "Open tasks", value: "5" },
  { label: "Portfolio ARR", value: "$1.24M" },
];

const HEALTH = [
  { key: "healthy", count: 3, className: "bg-emerald-500" },
  { key: "watch", count: 2, className: "bg-amber-500" },
  { key: "at_risk", count: 1, className: "bg-orange-500" },
  { key: "critical", count: 1, className: "bg-red-500" },
] as const;

const HEALTH_TOTAL = HEALTH.reduce((sum, row) => sum + row.count, 0);

const TIMELINE = [
  { type: "call", title: "Working session on SSO blockers", detail: "Marcus restated that production SSO is blocked on IdP metadata." },
  { type: "meeting", title: "August QBR", detail: "Priya requested regional expansion scope for Dayton, Toledo, and Akron." },
  { type: "note", title: "SSO due date missed", detail: "We missed the committed SSO date. Customer still owes IdP metadata." },
];

export function AppChrome({ children, subtitle }: { children: ReactNode; subtitle: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-sidebar shadow-sm">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          R
        </span>
        <div>
          <div className="text-sm font-semibold">Relia</div>
          <div className="text-xs text-muted-foreground">Northstar Customer Success</div>
        </div>
        <div className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <span className="rounded-md bg-sidebar-accent px-2 py-1 font-medium text-foreground">Dashboard</span>
          <span className="px-2 py-1">Accounts</span>
          <span className="px-2 py-1">Tasks</span>
        </div>
      </div>
      <div className="space-y-4 bg-background p-4 sm:p-5">
        <div>
          <div className="text-lg font-semibold tracking-tight">What should I focus on today?</div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HeroPreview() {
  return (
    <AppChrome subtitle="Meridian Health Systems is in renewal with health at risk.">
      <Card>
        <CardHeader>
          <CardTitle>Today’s queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {QUEUE.slice(0, 3).map((item) => (
            <div key={item.title} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
              </div>
              <Pill>{item.urgency}</Pill>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppChrome>
  );
}

export function TimelinePreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relationship timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {TIMELINE.map((item) => (
          <div key={item.title} className="rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Pill>{item.type}</Pill>
              <div className="text-sm font-medium">{item.title}</div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function IntelligencePreview() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Risks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start justify-between gap-2 rounded-lg border p-3">
            <span>SSO implementation slipped six weeks</span>
            <SeverityBadge severity="high" />
          </div>
          <div className="flex items-start justify-between gap-2 rounded-lg border p-3">
            <span>Champion may leave</span>
            <SeverityBadge severity="high" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Opportunities &amp; commitments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-lg border p-3">
            <div className="font-medium">Dayton / Toledo / Akron expansion</div>
            <div className="mt-1 text-xs text-muted-foreground">Pursuing · requested at the August QBR</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-medium">Deliver production SSO for clinicians</div>
            <div className="mt-1 text-xs text-muted-foreground">Overdue · we promised</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AskReliaPreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask Relia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {["What did we promise this customer?", "What are their biggest risks?", "Who is the champion?"].map((item) => (
            <span key={item} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question</div>
          <p className="mt-1 font-medium">What did we promise this customer?</p>
        </div>
        <div className="space-y-2 text-sm leading-6">
          <p>
            Northstar committed to deliver production SSO for Meridian clinicians by the last steering meeting.
            That date was missed. Meridian security still owes IdP metadata, and the CISO will not approve
            production SSO without it.
          </p>
          <p className="text-xs text-muted-foreground">Grounded in stored records. Model: grounded assembler</p>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</div>
          <ul className="mt-2 space-y-2">
            <li className="rounded-lg border p-3 text-xs">
              <div className="font-medium">Timeline · SSO due date missed</div>
              <p className="mt-1 text-muted-foreground">We committed to SSO by last Friday&apos;s steering meeting.</p>
            </li>
            <li className="rounded-lg border p-3 text-xs">
              <div className="font-medium">Commitment · Deliver production SSO</div>
              <p className="mt-1 text-muted-foreground">Overdue. Direction: we promised.</p>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountOverviewPreview() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Meridian Health Systems</CardTitle>
          <HealthBadge health="at_risk" score={48} />
          <Pill>renewal</Pill>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Champion</div>
          <div className="mt-1 text-sm font-medium">Priya Shah</div>
          <div className="text-xs text-muted-foreground">VP Clinical Ops · influence high</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Open work</div>
          <div className="mt-1 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              SSO implementation slipped <SeverityBadge severity="high" />
            </div>
            <div className="text-xs text-muted-foreground">2 open commitments · 1 live opportunity</div>
          </div>
        </div>
        <div className="rounded-lg border p-3 sm:col-span-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grounded brief</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Meridian is in renewal with relationship health at risk. Open risks include champion departure and SSO
            still blocked on IdP metadata. Every statement stays attached to the timeline, contacts, and stored
            intelligence — Relia does not invent customer facts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductPreview() {
  return (
    <AppChrome subtitle="Priority is operational: at-risk accounts, overdue promises, and recent customer changes.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today’s queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {QUEUE.map((item) => (
              <div key={item.title} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
                </div>
                <Pill>{item.urgency}</Pill>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="lg:col-span-3">
          <AccountOverviewPreview />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Relationship health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {HEALTH.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <div className="w-20 text-xs capitalize text-muted-foreground">{row.key.replace("_", " ")}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${row.className}`} style={{ width: `${(row.count / HEALTH_TOTAL) * 100}%` }} />
              </div>
              <div className="w-6 text-right text-xs">{row.count}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <TimelinePreview />
        <AskReliaPreview />
      </div>
      <IntelligencePreview />
    </AppChrome>
  );
}
