"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, PageHeader } from "@/components/empty-state";
import { Pill } from "@/components/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Task } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setTasks(await api<Task[]>("/tasks"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!tasks) return <Skeleton className="h-40" />;

  const open = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Next actions across the portfolio, including AI-proposed work you confirmed." />
      {open.length === 0 ? (
        <EmptyState title="No open tasks" description="Create tasks from an account or confirm an agent follow-up plan." />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {open.map((task) => (
                <tr key={task.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{task.title}</div>
                    {task.rationale ? <div className="text-xs text-muted-foreground">{task.rationale}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link className="underline" href={`/accounts/${task.account_id}`}>
                      {task.account_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(task.due_date)}</td>
                  <td className="px-4 py-3">
                    <Pill>{task.source}</Pill>
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
