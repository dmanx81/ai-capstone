"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, apiPost, ApiError } from "@/lib/api";
import type { BillingStatus } from "@/lib/types";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    items: ["8 accounts", "25 AI actions / month", "Core CRM and timeline"],
  },
  {
    id: "starter" as const,
    name: "Starter",
    price: "$49",
    items: ["50 accounts", "200 AI actions / month", "Document ingestion"],
  },
  {
    id: "growth" as const,
    name: "Growth",
    price: "$149",
    items: ["Unlimited accounts", "2,000 AI actions / month", "Document ingestion"],
  },
];

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  async function load() {
    setBilling(await api<BillingStatus>("/billing/status"));
  }

  useEffect(() => {
    void load();
  }, []);

  async function choose(plan: "starter" | "growth") {
    try {
      const result = await apiPost<{ demo?: boolean; checkout_url?: string; plan?: string }>("/billing/checkout", { plan });
      if (result.checkout_url) {
        window.location.assign(result.checkout_url);
        return;
      }
      if (result.demo) {
        await apiPost("/billing/demo-activate", { plan });
        toast.success(`Moved to ${plan} (demo mode — Stripe keys not configured)`);
        await load();
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Billing request failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description={
          billing?.stripe_enabled
            ? "Checkout is handled by Stripe. Webhooks update plan status."
            : "Stripe is not configured in this environment. Demo activate upgrades the workspace locally."
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={billing?.plan === plan.id ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-semibold">{plan.price}</div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {plan.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {plan.id === "free" ? (
                <p className="text-xs text-muted-foreground">Default for new workspaces.</p>
              ) : (
                <Button className="w-full" variant={billing?.plan === plan.id ? "outline" : "default"} onClick={() => void choose(plan.id)}>
                  {billing?.plan === plan.id ? "Current plan" : "Upgrade"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {billing?.stripe_enabled ? (
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const result = await apiPost<{ demo?: boolean; url?: string | null }>("/billing/portal");
              if (result.url) {
                window.location.assign(result.url);
                return;
              }
              toast.message("Stripe portal is available after the first Checkout session.");
            } catch (error) {
              toast.error(error instanceof ApiError ? error.detail : "Unable to open billing portal");
            }
          }}
        >
          Open Stripe billing portal
        </Button>
      ) : null}
    </div>
  );
}
