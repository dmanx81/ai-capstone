import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "per workspace",
    summary: "Start with the relationship system of record.",
    items: ["8 accounts", "25 AI actions / month", "Core CRM and timeline", "Grounded briefs from stored records"],
    cta: "Start Free",
    href: "/signup" as const,
    featured: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    cadence: "per month",
    summary: "For a working book of accounts.",
    items: ["50 accounts", "200 AI actions / month", "Document ingestion", "Ask Relia with source references"],
    cta: "Get Started",
    href: "/signup" as const,
    featured: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$149",
    cadence: "per month",
    summary: "For teams that live in the book of business.",
    items: ["Unlimited accounts", "2,000 AI actions / month", "Document ingestion", "Agent workflows with confirmation"],
    cta: "Get Started",
    href: "/signup" as const,
    featured: false,
  },
];

export function PricingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLANS.map((plan) => (
        <Card key={plan.id} className={cn(plan.featured && "ring-2 ring-primary")}>
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{plan.summary}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-3xl font-semibold tracking-tight">{plan.price}</div>
              <div className="text-xs text-muted-foreground">{plan.cadence}</div>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {plan.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="border-t-0 bg-transparent">
            <Button className="w-full" nativeButton={false} variant={plan.featured ? "default" : "outline"} render={<Link href={plan.href} />}>
              {plan.cta}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
