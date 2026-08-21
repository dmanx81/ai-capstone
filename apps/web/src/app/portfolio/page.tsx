import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/auth/actions";
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
  const sortedRelationships = sortRelationships(relationships, sort);
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

        <div className="mt-8 flex items-center justify-between gap-4">
          <h2 className="text-xl font-medium">Relationships needing attention</h2>
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
