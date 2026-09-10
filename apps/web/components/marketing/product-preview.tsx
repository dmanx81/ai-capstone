import { HealthBadge, Pill, SeverityBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUEUE = [
  { title: "Review Meridian Health Systems", detail: "Health at risk (48/100)", urgency: "high" },
  { title: "Deliver production SSO for clinicians", detail: "Overdue · we promised", urgency: "high" },
  { title: "Champion may leave", detail: "High risk · Priya Shah", urgency: "medium" },
  { title: "Expansion to Dayton / Toledo / Akron", detail: "Opportunity in pursuing", urgency: "low" },
];

export function ProductPreview() {
  return (
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
      <Card className="lg:col-span-3">
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
              <div className="flex items-center justify-between">
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
    </div>
  );
}
