import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "per workspace",
    summary: "Start with the relationship system of record.",
    items: ["8 accounts", "25 AI actions/month", "Core CRM and timeline", "Grounded briefs from stored records"],
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
    items: ["50 accounts", "200 AI actions/month", "Document ingestion", "Ask Relia with source references"],
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
    items: ["Unlimited accounts", "2,000 AI actions/month", "Document ingestion", "Agent workflows with confirmation"],
    cta: "Get Started",
    href: "/signup" as const,
    featured: false,
  },
];

export function PricingGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={cn(
            "flex flex-col p-6 sm:p-8",
            plan.featured ? "bg-foreground text-background" : "bg-background",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">{plan.name}</h3>
            {plan.featured ? (
              <span className="rounded-full border border-background/25 px-2 py-0.5 font-mono text-[11px] text-background/80">
                Most used
              </span>
            ) : null}
          </div>
          <p className={cn("mt-2 text-sm", plan.featured ? "text-background/70" : "text-muted-foreground")}>
            {plan.summary}
          </p>
          <div className="mt-10 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-[-0.04em]">{plan.price}</span>
            <span className={cn("text-sm", plan.featured ? "text-background/70" : "text-muted-foreground")}>
              {plan.cadence}
            </span>
          </div>
          <ul
            className={cn(
              "mt-8 flex-1 space-y-3 border-t pt-6 text-sm",
              plan.featured ? "border-background/15 text-background/85" : "text-muted-foreground",
            )}
          >
            {plan.items.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check
                  className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-background" : "text-foreground")}
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            className={cn(
              "mt-10 h-11 w-full text-[15px]",
              plan.featured && "bg-background text-foreground hover:bg-background/90",
            )}
            nativeButton={false}
            variant={plan.featured ? "default" : "outline"}
            render={<Link href={plan.href} />}
          >
            {plan.cta}
          </Button>
        </div>
      ))}
    </div>
  );
}
