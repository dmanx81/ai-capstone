"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, PageHeader } from "@/components/empty-state";
import { Field, NativeSelect } from "@/components/form";
import { HealthBadge, Pill } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Account } from "@/lib/types";

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [health, setHealth] = useState("");
  const [lifecycle, setLifecycle] = useState("");

  async function load() {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (health) params.set("health", health);
      if (lifecycle) params.set("lifecycle", lifecycle);
      const qs = params.toString();
      setAccounts(await api<Account[]>(`/accounts${qs ? `?${qs}` : ""}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    }
  }

  useEffect(() => {
    void load();
  }, [health, lifecycle]);

  const rows = useMemo(() => accounts ?? [], [accounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Every customer relationship in this workspace."
        actions={
          <Button render={<Link href="/accounts/new" />}>New account</Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Search">
          <Input
            value={q}
            placeholder="Name or domain"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
        </Field>
        <Field label="Health">
          <NativeSelect value={health} onChange={(e) => setHealth(e.target.value)}>
            <option value="">All</option>
            <option value="healthy">Healthy</option>
            <option value="watch">Watch</option>
            <option value="at_risk">At risk</option>
            <option value="critical">Critical</option>
          </NativeSelect>
        </Field>
        <Field label="Lifecycle">
          <NativeSelect value={lifecycle} onChange={(e) => setLifecycle(e.target.value)}>
            <option value="">All</option>
            <option value="prospect">Prospect</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="renewal">Renewal</option>
            <option value="churn_risk">Churn risk</option>
            <option value="churned">Churned</option>
          </NativeSelect>
        </Field>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!accounts ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Create the first customer relationship to start the timeline."
          action={{ label: "New account", onClick: () => router.push("/accounts/new") }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Industry</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">ARR</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Risks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((account) => (
                <tr key={account.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/accounts/${account.id}`} className="font-medium hover:underline">
                      {account.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{account.domain || "No domain"}</div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{account.industry || "—"}</td>
                  <td className="px-4 py-3">
                    <HealthBadge health={account.health} score={account.health_score} />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{money(account.arr)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Pill>{account.open_risk_count} open</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
