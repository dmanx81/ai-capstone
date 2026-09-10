"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, PageHeader } from "@/components/empty-state";
import { HealthBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate, fromNow, money } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setData(await api<Dashboard>("/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const dist = data.health_distribution;
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-8">
      <PageHeader title="Where should I focus today?" description={data.focus} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Portfolio ARR" value={money(data.summary.arr)} />
        <Stat label="Accounts" value={String(data.summary.accounts)} />
        <Stat label="Needing attention" value={String(data.summary.at_risk)} />
        <Stat label="Overdue commitments" value={String(data.summary.overdue_commitments)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Relationship health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(["healthy", "watch", "at_risk", "critical"] as const).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <div className="w-20 text-xs capitalize text-muted-foreground">{key.replace("_", " ")}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    key === "healthy"
                      ? "h-full bg-emerald-500"
                      : key === "watch"
                        ? "h-full bg-amber-500"
                        : key === "at_risk"
                          ? "h-full bg-orange-500"
                          : "h-full bg-red-500"
                  }
                  style={{ width: `${((dist[key] || 0) / total) * 100}%` }}
                />
              </div>
              <div className="w-6 text-right text-xs">{dist[key] || 0}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accounts requiring attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.attention.length === 0 ? (
              <EmptyState title="Nothing urgent" description="No accounts are currently flagged for attention." />
            ) : (
              data.attention.map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-xs text-muted-foreground">{account.lifecycle.replaceAll("_", " ")}</div>
                  </div>
                  <HealthBadge health={account.health} score={account.health_score} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overdue commitments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.overdue_commitments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue promises on file.</p>
            ) : (
              data.overdue_commitments.map((item) => (
                <Link key={item.id} href={`/accounts/${item.account_id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                  <div className="text-sm font-medium">{item.description}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.account_name} · due {formatDate(item.due_date)} · {item.direction === "us" ? "we promised" : "they promised"}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No live expansion threads.</p>
            ) : (
              data.opportunities.map((item) => (
                <Link key={item.id} href={`/accounts/${item.account_id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm">{money(item.potential_value)}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.account_name} · {item.status} · {Math.round(item.confidence * 100)}% confidence
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming renewals and tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcoming.renewals.map((account) => (
              <Link key={account.id} href={`/accounts/${account.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="font-medium">{account.name} renewal</div>
                <div className="text-xs text-muted-foreground">{formatDate(account.renewal_date)}</div>
              </Link>
            ))}
            {data.upcoming.tasks.map((task) => (
              <Link key={task.id} href={`/accounts/${task.account_id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="font-medium">{task.title}</div>
                <div className="text-xs text-muted-foreground">
                  {task.account_name} · {formatDate(task.due_date)}
                </div>
              </Link>
            ))}
            {data.upcoming.renewals.length === 0 && data.upcoming.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due in the next two weeks.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent intelligence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent_intelligence.length === 0 ? (
              <p className="text-sm text-muted-foreground">Generate an account brief to see it here.</p>
            ) : (
              data.recent_intelligence.map((item) => (
                <Link key={item.id} href={`/accounts/${item.account_id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                  <div className="text-sm font-medium">{item.account_name}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent account activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent_activity.map((item) => (
              <Link key={item.id} href={`/accounts/${item.account_id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.account_name} · {item.event_type.replaceAll("_", " ")} · {fromNow(item.occurred_at)}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
