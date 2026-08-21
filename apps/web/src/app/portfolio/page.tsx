import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/auth/actions";
import {
  computeRelationshipSignals,
  type RelationshipSignal,
} from "@/lib/relationship-signals";
import { createClient } from "@/lib/supabase/server";

type PortfolioPageProps = {
  searchParams: Promise<{
    sort?: string;
  }>;
};

type PortfolioRow = {
  account_id: string;
  relationship_name: string;
  renewal_date: string | null;
  latest_health_score: number | null;
  previous_health_score: number | null;
  last_interaction_at: string | null;
  open_risks: number;
  open_actions: number;
};

type DashboardRelationship = PortfolioRow & {
  trend: "↑" | "↓" | "→" | "—";
};

type PortfolioActionRow = {
  id: string;
  account_id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  created_at: string;
  resolved_at: string | null;
  relationship_name: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysSinceInteraction(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - new Date(timestamp).getTime()) / DAY_IN_MS)
  );
}

function formatInteractionAge(timestamp: string | null) {
  const days = daysSinceInteraction(timestamp);

  if (days === null) {
    return "No interactions";
  }

  if (days === 0) {
    return "Today";
  }

  return `${days} ${days === 1 ? "day" : "days"}`;
}

function formatRenewalCountdown(renewalDate: string | null) {
  if (!renewalDate) {
    return "—";
  }

  const renewal = new Date(`${renewalDate}T00:00:00`);
  const days = Math.round(
    (renewal.getTime() - startOfToday().getTime()) / DAY_IN_MS
  );

  if (days < 0) {
    return `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
  }

  if (days === 0) {
    return "Today";
  }

  if (days < 60) {
    return `${days} days`;
  }

  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"}`;
}

function healthCategory(score: number | null) {
  if (score === null) {
    return null;
  }

  if (score >= 80) {
    return "Healthy";
  }

  if (score >= 60) {
    return "Stable";
  }

  if (score >= 40) {
    return "At risk";
  }

  return "Critical";
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  nullValue: number
) {
  return (left ?? nullValue) - (right ?? nullValue);
}

function renewalSortValue(renewalDate: string | null) {
  return renewalDate
    ? new Date(`${renewalDate}T00:00:00`).getTime()
    : Number.POSITIVE_INFINITY;
}

function sortRelationships(
  relationships: DashboardRelationship[],
  sort: string
) {
  return [...relationships].sort((left, right) => {
    if (sort === "name") {
      return left.relationship_name.localeCompare(right.relationship_name);
    }

    if (sort === "recent") {
      return (
        new Date(right.last_interaction_at ?? 0).getTime()
        - new Date(left.last_interaction_at ?? 0).getTime()
      );
    }

    const healthOrder = compareNullableNumbers(
      left.latest_health_score,
      right.latest_health_score,
      101
    );

    if (healthOrder !== 0) {
      return healthOrder;
    }

    const renewalOrder =
      renewalSortValue(left.renewal_date)
      - renewalSortValue(right.renewal_date);

    if (renewalOrder !== 0) {
      return renewalOrder;
    }

    return (
      (daysSinceInteraction(right.last_interaction_at) ?? Number.POSITIVE_INFINITY)
      - (daysSinceInteraction(left.last_interaction_at) ?? Number.POSITIVE_INFINITY)
    );
  });
}

function isAtRisk(relationship: PortfolioRow) {
  const lowHealth =
    relationship.latest_health_score !== null
    && relationship.latest_health_score < 50;
  const renewalDays = relationship.renewal_date
    ? Math.round(
        (new Date(`${relationship.renewal_date}T00:00:00`).getTime()
          - startOfToday().getTime())
        / DAY_IN_MS
      )
    : null;
  const imminentRenewal =
    renewalDays !== null
    && renewalDays >= 0
    && renewalDays <= 60
    && relationship.open_risks > 0;

  return lowHealth || imminentRenewal;
}

function actionDueBucket(action: Pick<PortfolioActionRow, "due_date">, nowIso: string) {
  if (!action.due_date) {
    return 3;
  }

  const dueDate = new Date(`${action.due_date}T00:00:00Z`).getTime();
  const now = new Date(nowIso).getTime();
  const diffDays = Math.floor((dueDate - now) / DAY_IN_MS);

  if (diffDays < 0) {
    return 0;
  }

  if (diffDays <= 7) {
    return 1;
  }

  if (diffDays <= 30) {
    return 2;
  }

  return 4;
}

function comparePortfolioActions(
  left: PortfolioActionRow,
  right: PortfolioActionRow,
  nowIso: string,
) {
  const bucketDifference = actionDueBucket(left, nowIso) - actionDueBucket(right, nowIso);
  if (bucketDifference !== 0) {
    return bucketDifference;
  }

  const leftDue = left.due_date ? new Date(`${left.due_date}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
  const rightDue = right.due_date ? new Date(`${right.due_date}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) {
    return leftDue - rightDue;
  }

  const leftCreated = new Date(left.created_at).getTime();
  const rightCreated = new Date(right.created_at).getTime();
  if (leftCreated !== rightCreated) {
    return leftCreated - rightCreated;
  }

  return left.id.localeCompare(right.id);
}

export default async function PortfolioPage({
  searchParams,
}: PortfolioPageProps) {
  const { sort: requestedSort } = await searchParams;
  const sort = ["attention", "name", "recent"].includes(requestedSort ?? "")
    ? requestedSort!
    : "attention";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const nowIso = new Date().toISOString();

  const { data: portfolioRows, error } = await supabase
    .from("portfolio_overview")
    .select(
      "account_id, relationship_name, renewal_date, latest_health_score, previous_health_score, last_interaction_at, open_risks, open_actions"
    );

  if (error) {
    throw new Error(`Failed to load relationships: ${error.message}`);
  }

  const relationships: DashboardRelationship[] = (portfolioRows ?? []).map(
    (relationship) => ({
      ...relationship,
      trend:
        relationship.latest_health_score === null
        || relationship.previous_health_score === null
          ? "—"
          : relationship.latest_health_score > relationship.previous_health_score
            ? "↑"
            : relationship.latest_health_score < relationship.previous_health_score
              ? "↓"
              : "→",
    })
  );

  const { data: itemSummaryRows, error: itemSummaryError } = await supabase
    .from("extracted_items")
    .select("account_id, kind, status, severity, due_date")
    .eq("status", "open");

  if (itemSummaryError) {
    throw new Error(`Failed to load open item summary: ${itemSummaryError.message}`);
  }

  const { data: failedAnalysisRows, error: failedAnalysisError } = await supabase
    .from("interactions")
    .select("account_id, analysis_status, occurred_at")
    .order("occurred_at", { ascending: false });

  if (failedAnalysisError) {
    throw new Error(`Failed to load interaction status summary: ${failedAnalysisError.message}`);
  }

  const { data: openActionRows, error: openActionError } = await supabase
    .from("extracted_items")
    .select("id, account_id, title, owner, due_date, created_at, resolved_at")
    .eq("kind", "action")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (openActionError) {
    throw new Error(`Failed to load open actions: ${openActionError.message}`);
  }

  const itemSummary = new Map<string, {
    high_severity_open_risk_count: number;
    overdue_action_count: number;
    open_risks: number;
  }>();

  for (const item of itemSummaryRows ?? []) {
    const key = item.account_id;
    const current = itemSummary.get(key) ?? {
      high_severity_open_risk_count: 0,
      overdue_action_count: 0,
      open_risks: 0,
    };

    if (item.kind === "risk") {
      current.open_risks += 1;
      if (item.severity === "high") {
        current.high_severity_open_risk_count += 1;
      }
    }

    if (
      item.kind === "action"
      && item.status === "open"
      && item.due_date
      && new Date(`${item.due_date}T00:00:00Z`).getTime() < new Date(nowIso).getTime()
    ) {
      current.overdue_action_count += 1;
    }

    itemSummary.set(key, current);
  }

  const latestFailedAnalysisByAccount = new Map<string, boolean>();
  for (const interaction of failedAnalysisRows ?? []) {
    if (latestFailedAnalysisByAccount.has(interaction.account_id)) {
      continue;
    }

    latestFailedAnalysisByAccount.set(
      interaction.account_id,
      interaction.analysis_status === "failed"
    );
  }

  const signalsByAccount = new Map<string, RelationshipSignal[]>();
  for (const relationship of relationships) {
    const summary = itemSummary.get(relationship.account_id) ?? {
      high_severity_open_risk_count: 0,
      overdue_action_count: 0,
      open_risks: 0,
    };

    const signals = computeRelationshipSignals({
      account_id: relationship.account_id,
      latest_health_score: relationship.latest_health_score,
      previous_health_score: relationship.previous_health_score,
      renewal_date: relationship.renewal_date,
      last_interaction_at: relationship.last_interaction_at,
      open_risks: summary.open_risks,
      high_severity_open_risk_count: summary.high_severity_open_risk_count,
      overdue_action_count: summary.overdue_action_count,
      failed_analysis: latestFailedAnalysisByAccount.get(relationship.account_id) ?? false,
      nowIso,
    });

    signalsByAccount.set(relationship.account_id, signals);
  }

  const sortedRelationships = sortRelationships(relationships, sort);
  const relationNameByAccount = new Map(
    (portfolioRows ?? []).map((relationship) => [relationship.account_id, relationship.relationship_name])
  );
  const sortedOpenActions = [...(openActionRows ?? [])]
    .map((action) => ({
      ...action,
      relationship_name: relationNameByAccount.get(action.account_id) ?? "Relationship",
    }))
    .sort((left, right) => comparePortfolioActions(left, right, nowIso));
  const attentionRelationships = relationships.filter((relationship) => {
    const signals = signalsByAccount.get(relationship.account_id) ?? [];
    return signals.some((signal) => signal.severity !== "info");
  });
  const atRiskCount = relationships.filter(isAtRisk).length;
  const openActionCount = relationships.reduce(
    (total, relationship) => total + relationship.open_actions,
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Relationship portfolio</h1>
            <p className="mt-2 text-gray-600">
              Signed in as {user.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/relationships/new"
              className="rounded-md bg-black px-4 py-2 text-sm text-white"
            >
              New relationship
            </Link>

            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border bg-white px-4 py-2 text-sm"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Total relationships", relationships.length],
            ["At risk", atRiskCount],
            ["Open actions", openActionCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-white p-5">
              <p className="text-sm text-gray-600">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border bg-white p-6">
          <h2 className="text-xl font-medium">Attention Center</h2>

          {attentionRelationships.length === 0 ? (
            <p className="mt-4 text-gray-600">No relationships currently need attention.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {attentionRelationships.slice(0, 6).map((relationship) => {
                const relationshipSignals = signalsByAccount.get(relationship.account_id) ?? [];
                const topSignal = relationshipSignals[0] ?? null;
                const extraCount = Math.max(0, relationshipSignals.length - 1);

                return (
                  <Link
                    key={relationship.account_id}
                    href={`/relationships/${relationship.account_id}`}
                    className="block rounded-lg border p-4 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{relationship.relationship_name}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          {relationship.latest_health_score ?? "—"} / 100
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium uppercase tracking-wide text-gray-700">
                        {topSignal?.severity ?? "info"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-medium text-gray-800">
                      {topSignal?.title ?? "Needs attention"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {topSignal?.detail ?? "Review this relationship."}
                    </p>

                    {extraCount > 0 && (
                      <p className="mt-2 text-xs font-medium text-gray-500">
                        +{extraCount} more
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-medium">Action Center</h2>
            <span className="text-sm text-gray-600">{sortedOpenActions.length} open</span>
          </div>

          {sortedOpenActions.length === 0 ? (
            <p className="mt-4 text-gray-600">No open actions.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {sortedOpenActions.map((action) => {
                const dueDate = action.due_date ? new Date(`${action.due_date}T00:00:00Z`) : null;
                const nowDate = new Date(nowIso);
                const diffDays = dueDate ? Math.floor((dueDate.getTime() - nowDate.getTime()) / DAY_IN_MS) : null;
                const actionState = !dueDate
                  ? "No due date"
                  : diffDays !== null && diffDays < 0
                    ? "OVERDUE"
                    : diffDays !== null && diffDays <= 7
                      ? "DUE SOON"
                      : "UPCOMING";

                return (
                  <Link
                    key={action.id}
                    href={`/relationships/${action.account_id}`}
                    className="block rounded-lg border p-4 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{action.title}</p>
                        <p className="mt-1 text-sm text-gray-600">{action.relationship_name}</p>
                      </div>
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                        {actionState}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span>Owner: <span className="font-medium text-gray-900">{action.owner ?? "Unassigned"}</span></span>
                      <span>Due: <span className="font-medium text-gray-900">{action.due_date ?? "No due date"}</span></span>
                      <span>Created: <span className="font-medium text-gray-900">{new Date(action.created_at).toISOString().slice(0, 10)}</span></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="text-xl font-medium">All relationships</h2>
          <nav aria-label="Portfolio sort" className="flex gap-2 text-sm">
            {[
              ["attention", "Needs attention"],
              ["name", "Name"],
              ["recent", "Recent"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={`/portfolio?sort=${value}`}
                className={`rounded-md border px-3 py-2 ${
                  sort === value ? "bg-black text-white" : "bg-white"
                }`}
                aria-current={sort === value ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-4">
          {sortedRelationships.length === 0 ? (
            <div className="mt-4 rounded-xl border bg-white p-6">
              <p className="text-gray-600">No relationships yet.</p>
              <Link
                href="/relationships/new"
                className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm text-white"
              >
                Create a relationship
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {sortedRelationships.map((relationship) => (
                <Link
                  key={relationship.account_id}
                  href={`/relationships/${relationship.account_id}`}
                  className="block rounded-xl border bg-white p-6 transition hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {relationship.relationship_name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {healthCategory(relationship.latest_health_score) ?? "No scored brief"}
                      </p>
                    </div>
                    <p className="text-2xl font-semibold">
                      {relationship.latest_health_score ?? "—"} / 100
                      <span className="ml-2 text-lg text-gray-500" aria-label="Health trend">
                        {relationship.trend}
                      </span>
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm text-gray-600 sm:grid-cols-4">
                    <p>Last interaction: <span className="font-medium text-gray-900">{formatInteractionAge(relationship.last_interaction_at)}</span></p>
                    <p>Open risks: <span className="font-medium text-gray-900">{relationship.open_risks}</span></p>
                    <p>Open actions: <span className="font-medium text-gray-900">{relationship.open_actions}</span></p>
                    <p>Renewal: <span className="font-medium text-gray-900">{formatRenewalCountdown(relationship.renewal_date)}</span></p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
