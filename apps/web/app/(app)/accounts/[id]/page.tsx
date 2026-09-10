"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { EmptyState, ErrorState } from "@/components/empty-state";
import { Field, NativeSelect } from "@/components/form";
import { HealthBadge, Pill, SeverityBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, fromNow, labelize, money } from "@/lib/format";
import type { AccountBrief, AccountDetail, AgentRun, AskResponse, TimelineEvent } from "@/lib/types";

const EVENT_TYPES = [
  "meeting",
  "email",
  "call",
  "note",
  "customer_request",
  "product_issue",
  "renewal_event",
];

const AGENT_ACTIONS = [
  { id: "prepare_meeting_brief", label: "Prepare meeting brief" },
  { id: "analyze_account_risks", label: "Analyze account risks" },
  { id: "find_expansion_opportunities", label: "Find expansion opportunities" },
  { id: "generate_follow_up_plan", label: "Generate follow-up plan" },
  { id: "summarize_recent_changes", label: "Summarize recent changes" },
  { id: "identify_missing_commitments", label: "Identify missing commitments" },
  { id: "suggest_next_best_actions", label: "Suggest next best actions" },
];

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const { session } = useAuth();
  const canWrite = session?.role !== "viewer";
  const [data, setData] = useState<AccountDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [brief, setBrief] = useState<AccountBrief | null>(null);
  const [question, setQuestion] = useState("What should I discuss in the next meeting?");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [deleting, setDeleting] = useState<TimelineEvent | null>(null);

  async function load() {
    try {
      setError(null);
      const detail = await api<AccountDetail>(`/accounts/${params.id}`);
      setData(detail);
      setBrief(detail.latest_brief);
      const events = await api<TimelineEvent[]>(`/accounts/${params.id}/timeline`);
      setTimeline(events);
    } catch (err) {
      const message = err instanceof ApiError && err.status === 403 ? "You do not have access to this account." : err instanceof Error ? err.message : "Failed to load account";
      setError(message);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  const filtered = useMemo(() => {
    return timeline.filter((event) => {
      if (filter && event.event_type !== filter) return false;
      if (search) {
        const blob = `${event.title} ${event.body ?? ""}`.toLowerCase();
        if (!blob.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [timeline, filter, search]);

  async function run(path: string, body?: unknown) {
    setPending(true);
    try {
      const result = await apiPost(path, body);
      toast.success("Saved");
      await load();
      return result;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Request failed");
      throw error;
    } finally {
      setPending(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { account, contacts, risks, opportunities, commitments, tasks } = data;
  const importantContacts = [...contacts].sort((a, b) => {
    const rank = (role: string) =>
      ({ champion: 0, decision_maker: 1, economic_buyer: 2, blocker: 3, influencer: 4, end_user: 5 }[role] ?? 9);
    return rank(a.stakeholder_role) - rank(b.stakeholder_role);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
            <HealthBadge health={account.health} score={account.health_score} />
            <Pill>{labelize(account.lifecycle)}</Pill>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{account.description}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{account.domain || "No domain"}</span>
            <span>{account.industry || "Industry n/a"}</span>
            <span>{money(account.arr)} ARR</span>
            <span>Renewal {formatDate(account.renewal_date)}</span>
            {account.tags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <>
              <Button variant="outline" onClick={() => setOpen("contact")}>
                Add contact
              </Button>
              <Button variant="outline" onClick={() => setOpen("event")}>
                Add timeline entry
              </Button>
              <Button onClick={() => setOpen("risk")}>Log risk</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">View only — ask an admin if you need to edit this account.</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="ask">Ask Relia</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Relationship health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${account.health_score}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Score is computed from open risks, overdue commitments, lifecycle, and recency of activity — not from a black-box model.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Open work</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>{risks.filter((r) => ["open", "monitoring"].includes(r.status)).length} open risks</div>
                <div>{opportunities.filter((o) => !["won", "lost"].includes(o.status)).length} live opportunities</div>
                <div>{commitments.filter((c) => ["open", "in_progress"].includes(c.status)).length} open commitments</div>
                <div>{tasks.filter((t) => t.status !== "done").length} open tasks</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Important contacts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {importantContacts.length === 0 ? (
                <EmptyState
                  title="No contacts"
                  description="Map champions, blockers, and economic buyers."
                  action={canWrite ? { label: "Add contact", onClick: () => setOpen("contact") } : undefined}
                />
              ) : (
                importantContacts.map((person) => (
                  <div key={person.id} className="rounded-lg border p-3">
                    <div className="font-medium">{person.name}</div>
                    <div className="text-xs text-muted-foreground">{person.title || "No title"}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Pill>{labelize(person.stakeholder_role)}</Pill>
                      <Pill>influence {person.influence}</Pill>
                      <Pill>{person.sentiment}</Pill>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Risks</CardTitle>
                {canWrite ? (
                  <Button size="sm" variant="outline" onClick={() => setOpen("risk")}>
                    Add
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {risks.slice(0, 3).map((risk) => (
                  <div key={risk.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{risk.title}</span>
                      <SeverityBadge severity={risk.severity} />
                    </div>
                  </div>
                ))}
                {risks.length === 0 ? <p className="text-sm text-muted-foreground">No risks recorded.</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Commitments</CardTitle>
                {canWrite ? (
                  <Button size="sm" variant="outline" onClick={() => setOpen("commitment")}>
                    Add
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {commitments.slice(0, 3).map((item) => (
                  <div key={item.id} className="text-sm">
                    {item.description}
                    <div className="text-xs text-muted-foreground">{formatDate(item.due_date)}</div>
                  </div>
                ))}
                {commitments.length === 0 ? <p className="text-sm text-muted-foreground">No promises on file.</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Opportunities</CardTitle>
                {canWrite ? (
                  <Button size="sm" variant="outline" onClick={() => setOpen("opportunity")}>
                    Add
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                {opportunities.slice(0, 3).map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{money(item.potential_value)}</div>
                  </div>
                ))}
                {opportunities.length === 0 ? <p className="text-sm text-muted-foreground">No live expansion threads.</p> : null}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recent_activity.slice(0, 6).map((event) => (
                  <div key={event.id}>
                    <div className="text-sm font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {labelize(event.event_type)} · {fromNow(event.occurred_at)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Latest AI brief</CardTitle>
              </CardHeader>
              <CardContent>
                {brief ? (
                  <p className="text-sm text-muted-foreground">{brief.executive_summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No brief yet. Generate one from the Intelligence tab.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input placeholder="Search the relationship" value={search} onChange={(e) => setSearch(e.target.value)} />
            <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-48">
              <option value="">All types</option>
              {[...EVENT_TYPES, "task", "risk", "opportunity", "commitment", "document", "ai_insight"].map((type) => (
                <option key={type} value={type}>
                  {labelize(type)}
                </option>
              ))}
            </NativeSelect>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="No matching entries"
              description="Add a meeting, note, or email to start the system of record."
              action={canWrite ? { label: "Add timeline entry", onClick: () => setOpen("event") } : undefined}
            />
          ) : (
            <ol className="relative space-y-4 border-l pl-6">
              {filtered.map((event) => (
                <li key={event.id} className="space-y-1">
                  <div className="absolute -left-1.5 mt-1.5 size-3 rounded-full border bg-background" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(event.occurred_at)} · {labelize(event.event_type)}
                        {event.updated_at && event.updated_at !== event.created_at ? ` · edited ${fromNow(event.updated_at)}` : ""}
                      </div>
                      <div className="font-medium">{event.title}</div>
                    </div>
                    {canWrite && event.editable ? (
                      <div className="flex gap-1">
                        <Button size="xs" variant="ghost" onClick={() => setEditing(event)}>
                          Edit
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setDeleting(event)}>
                          Delete
                        </Button>
                      </div>
                    ) : !event.editable ? (
                      <span className="text-xs text-muted-foreground">Managed from source</span>
                    ) : null}
                  </div>
                  {event.body ? <p className="text-sm text-muted-foreground">{event.body}</p> : null}
                  {event.evidence_excerpt || event.evidence_source ? (
                    <p className="text-xs text-muted-foreground">
                      Evidence: {event.evidence_source ? `${event.evidence_source} — ` : ""}
                      {event.evidence_excerpt}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="intelligence" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={async () => {
                const result = (await run(`/accounts/${account.id}/brief`)) as { content: AccountBrief };
                setBrief(result.content);
              }}
            >
              Generate account brief
            </Button>
            {AGENT_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  const result = await run(`/accounts/${account.id}/agents`, {
                    action: action.id,
                    confirm: false,
                    apply_writes: false,
                  });
                  setAgentRun(result as AgentRun);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>

          {brief ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Executive summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6">{brief.executive_summary}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{brief.disclaimer}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Risks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {brief.risks.length === 0 ? <p className="text-sm text-muted-foreground">No open risks stored.</p> : null}
                  {brief.risks.map((risk) => (
                    <div key={risk.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{risk.title}</div>
                        <SeverityBadge severity={risk.severity} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{Math.round(risk.confidence * 100)}% confidence</div>
                      {risk.evidence?.[0] ? <p className="mt-2 text-xs">Evidence: {risk.evidence[0].excerpt}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Opportunities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {brief.opportunities.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {money(item.potential_value)} · {item.status}
                      </div>
                      {item.next_action ? <p className="mt-2 text-sm">{item.next_action}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Open commitments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {brief.open_commitments.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="text-sm">{item.description}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.direction === "us" ? "We promised" : "They promised"} · {formatDate(item.due_date)}
                        {item.overdue ? " · overdue" : ""}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Questions to ask next</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-4 text-sm">
                    {brief.questions_to_ask.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recommended next actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {brief.recommended_next_actions.map((item) => (
                    <div key={item.title} className="rounded-lg border p-3">
                      <div className="font-medium">{item.title}</div>
                      <p className="text-sm text-muted-foreground">{item.rationale}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState title="No brief yet" description="Generate a grounded brief from stored account records." />
          )}

          {agentRun ? (
            <Card>
              <CardHeader>
                <CardTitle>Agent preview — {labelize(agentRun.action)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(agentRun.output_payload, null, 2)}
                </pre>
                {agentRun.output_payload.proposed_writes?.length ? (
                  <Button
                    disabled={pending}
                    onClick={async () => {
                      const result = await run(`/accounts/${account.id}/agents`, {
                        action: agentRun.action,
                        confirm: true,
                        apply_writes: true,
                      });
                      setAgentRun(result as AgentRun);
                      toast.success("Tasks created from confirmed agent output");
                    }}
                  >
                    Confirm and create tasks
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Risks</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setOpen("risk")}>
                  Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {risks.map((risk) => (
                  <div key={risk.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{risk.title}</span>
                      <SeverityBadge severity={risk.severity} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{risk.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Opportunities</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setOpen("opportunity")}>
                  Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {opportunities.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{money(item.potential_value)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Commitments</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setOpen("commitment")}>
                  Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {commitments.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="text-sm">{item.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.direction === "us" ? "Us" : "Customer"} · {formatDate(item.due_date)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Tasks</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setOpen("task")}>
                  Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.status} · {formatDate(item.due_date)}
                      {item.rationale ? ` · ${item.rationale}` : ""}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ask" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ask a grounded question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  "What did we promise this customer?",
                  "What are their biggest risks?",
                  "What changed recently?",
                  "Who is the champion?",
                  "What should I discuss in the next meeting?",
                ].map((item) => (
                  <Button key={item} size="xs" variant="outline" onClick={() => setQuestion(item)}>
                    {item}
                  </Button>
                ))}
              </div>
              <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setAskError(null);
                    try {
                      const result = await apiPost<AskResponse>("/ask", { account_id: account.id, question });
                      setAnswer(result);
                    } catch (error) {
                      const message = error instanceof ApiError ? error.detail : "Ask failed";
                      setAskError(message);
                      toast.error(message);
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Retrieve and answer
                </Button>
                {canWrite ? (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      try {
                        const result = await apiPost<{ chunks: number }>(`/accounts/${account.id}/reindex`);
                        toast.success(`Search index rebuilt (${result.chunks} chunks)`);
                      } catch (error) {
                        toast.error(error instanceof ApiError ? error.detail : "Reindex failed");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Rebuild search index
                  </Button>
                ) : null}
              </div>
              {askError ? <p className="text-sm text-destructive">{askError}</p> : null}
              {answer ? (
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap text-sm leading-6">{answer.answer}</p>
                  <p className="text-xs text-muted-foreground">
                    {answer.grounded ? "Grounded in stored records." : "Ungrounded."} Model: {answer.model}
                  </p>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</div>
                    <ul className="mt-2 space-y-2">
                      {answer.evidence.map((item) => (
                        <li key={item.chunk_id} className="rounded-lg border p-3 text-xs">
                          <div className="font-medium">
                            {labelize(item.source_type)} · {Math.round(item.similarity * 100)}% match
                          </div>
                          <p className="mt-1 text-muted-foreground">{item.excerpt}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateDialogs accountId={account.id} open={open} setOpen={setOpen} onCreated={load} />
      <EditTimelineDialog event={editing} onClose={() => setEditing(null)} onSaved={load} />
      <DeleteTimelineDialog event={deleting} onClose={() => setDeleting(null)} onDeleted={load} />
    </div>
  );
}

function CreateDialogs({
  accountId,
  open,
  setOpen,
  onCreated,
}: {
  accountId: string;
  open: string | null;
  setOpen: (value: string | null) => void;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  async function submit(path: string, body: unknown) {
    try {
      await apiPost(path, body);
      toast.success("Added");
      setOpen(null);
      setForm({});
      await onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to save");
    }
  }

  return (
    <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
      <DialogContent className="sm:max-w-md">
        {open === "contact" ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(`/accounts/${accountId}/contacts`, {
                name: form.name,
                title: form.title,
                email: form.email || null,
                stakeholder_role: form.stakeholder_role || "end_user",
                influence: form.influence || "medium",
                sentiment: form.sentiment || "unknown",
                notes: form.notes,
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Add contact</DialogTitle>
            </DialogHeader>
            <Field label="Name">
              <Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Title">
              <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Stakeholder role">
              <NativeSelect value={form.stakeholder_role ?? "champion"} onChange={(e) => setForm({ ...form, stakeholder_role: e.target.value })}>
                <option value="champion">Champion</option>
                <option value="decision_maker">Decision maker</option>
                <option value="economic_buyer">Economic buyer</option>
                <option value="influencer">Influencer</option>
                <option value="blocker">Blocker</option>
                <option value="end_user">End user</option>
              </NativeSelect>
            </Field>
            <Button type="submit">Save contact</Button>
          </form>
        ) : null}

        {open === "event" ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(`/accounts/${accountId}/timeline`, {
                event_type: form.event_type || "note",
                title: form.title,
                body: form.body,
                evidence_source: form.evidence_source,
                evidence_excerpt: form.evidence_excerpt,
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Add timeline entry</DialogTitle>
            </DialogHeader>
            <Field label="Type">
              <NativeSelect value={form.event_type ?? "note"} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {labelize(type)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Title">
              <Input required value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="What happened">
              <Textarea value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </Field>
            <Field label="Evidence source">
              <Input value={form.evidence_source ?? ""} onChange={(e) => setForm({ ...form, evidence_source: e.target.value })} />
            </Field>
            <Field label="Evidence excerpt">
              <Textarea value={form.evidence_excerpt ?? ""} onChange={(e) => setForm({ ...form, evidence_excerpt: e.target.value })} />
            </Field>
            <Button type="submit">Add entry</Button>
          </form>
        ) : null}

        {open === "risk" ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(`/accounts/${accountId}/risks`, {
                title: form.title,
                description: form.description,
                severity: form.severity || "medium",
                confidence: Number(form.confidence || 0.7),
                evidence: form.evidence ? [{ source_type: "user", excerpt: form.evidence }] : [],
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Log a risk</DialogTitle>
            </DialogHeader>
            <Field label="Title">
              <Input required value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea required value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Severity">
              <NativeSelect value={form.severity ?? "medium"} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </NativeSelect>
            </Field>
            <Field label="Evidence">
              <Textarea value={form.evidence ?? ""} onChange={(e) => setForm({ ...form, evidence: e.target.value })} placeholder="Quote or source that supports this risk" />
            </Field>
            <Button type="submit">Save risk</Button>
          </form>
        ) : null}

        {open === "opportunity" ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(`/accounts/${accountId}/opportunities`, {
                title: form.title,
                description: form.description,
                potential_value: form.value ? Number(form.value) : null,
                next_action: form.next_action,
                evidence: form.evidence ? [{ source_type: "user", excerpt: form.evidence }] : [],
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Add opportunity</DialogTitle>
            </DialogHeader>
            <Field label="Title">
              <Input required value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea required value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Potential value">
              <Input type="number" value={form.value ?? ""} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </Field>
            <Field label="Next action">
              <Input value={form.next_action ?? ""} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
            </Field>
            <Button type="submit">Save opportunity</Button>
          </form>
        ) : null}

        {open === "commitment" ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(`/accounts/${accountId}/commitments`, {
                description: form.description,
                direction: form.direction || "us",
                due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
                evidence: form.evidence ? [{ source_type: "user", excerpt: form.evidence }] : [],
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Track a commitment</DialogTitle>
            </DialogHeader>
            <Field label="Promise">
              <Textarea required value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Who promised">
              <NativeSelect value={form.direction ?? "us"} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="us">We promised</option>
                <option value="customer">Customer promised</option>
              </NativeSelect>
            </Field>
            <Field label="Due">
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            <Button type="submit">Save commitment</Button>
          </form>
        ) : null}

        {open === "task" ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(`/accounts/${accountId}/tasks`, {
                title: form.title,
                description: form.description,
                due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Add task</DialogTitle>
            </DialogHeader>
            <Field label="Title">
              <Input required value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Due">
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            <Button type="submit">Save task</Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditTimelineDialog({
  event,
  onClose,
  onSaved,
}: {
  event: TimelineEvent | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [evidenceSource, setEvidenceSource] = useState("");
  const [evidenceExcerpt, setEvidenceExcerpt] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setBody(event.body ?? "");
    setEvidenceSource(event.evidence_source ?? "");
    setEvidenceExcerpt(event.evidence_excerpt ?? "");
  }, [event]);

  return (
    <Dialog open={Boolean(event)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!event) return;
            setPending(true);
            try {
              await apiPatch(`/timeline/${event.id}`, {
                title,
                body,
                evidence_source: evidenceSource || null,
                evidence_excerpt: evidenceExcerpt || null,
              });
              toast.success("Timeline entry updated");
              onClose();
              await onSaved();
            } catch (error) {
              toast.error(error instanceof ApiError ? error.detail : "Unable to save");
            } finally {
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit timeline entry</DialogTitle>
          </DialogHeader>
          <Field label="Title">
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="What happened">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Field label="Evidence source">
            <Input value={evidenceSource} onChange={(e) => setEvidenceSource(e.target.value)} />
          </Field>
          <Field label="Evidence excerpt">
            <Textarea value={evidenceExcerpt} onChange={(e) => setEvidenceExcerpt(e.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTimelineDialog({
  event,
  onClose,
  onDeleted,
}: {
  event: TimelineEvent | null;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={Boolean(event)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this timeline entry?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          “{event?.title}” will be removed from the system of record. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (!event) return;
              setPending(true);
              try {
                await apiDelete(`/timeline/${event.id}`);
                toast.success("Entry deleted");
                onClose();
                await onDeleted();
              } catch (error) {
                toast.error(error instanceof ApiError ? error.detail : "Unable to delete");
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Deleting…" : "Delete entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
