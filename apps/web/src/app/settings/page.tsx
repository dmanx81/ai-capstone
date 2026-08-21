import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getBillingStatus,
  openPortalAction,
  startCheckoutAction,
} from "./billing-actions";

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function formatPeriodLabel(periodStart?: string, periodEnd?: string): string {
  if (!periodStart || !periodEnd) {
    return "";
  }
  try {
    const start = new Date(periodStart).toLocaleDateString();
    const end = new Date(periodEnd).toLocaleDateString();
    return `${start} - ${end}`;
  } catch {
    return "";
  }
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { error } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const billing = await getBillingStatus();

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/portfolio"
            className="text-sm font-medium text-gray-600 underline"
          >
            Back to portfolio
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-gray-600 underline"
          >
            Home
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-xl border bg-white p-8">
          <h1 className="text-3xl font-semibold">Billing</h1>

          {billing ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-gray-500">Plan</p>
                  <p className="mt-1 text-lg font-semibold">{billing.plan}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Status</p>
                  <p className="mt-1 text-lg font-semibold capitalize">
                    {billing.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Usage this period
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {billing.usage_count} / {billing.monthly_analysis_allowance}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Remaining analyses
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {billing.remaining_usage}
                  </p>
                </div>
              </div>

              {formatPeriodLabel(billing.period_start, billing.period_end) && (
                <p className="mt-3 text-sm text-gray-500">
                  Current period:{" "}
                  {formatPeriodLabel(billing.period_start, billing.period_end)}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {billing.plan === "PRO" ? (
                  <form action={openPortalAction}>
                    <button
                      type="submit"
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                    >
                      Manage subscription
                    </button>
                  </form>
                ) : (
                  <form action={startCheckoutAction}>
                    <button
                      type="submit"
                      className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Upgrade to Pro
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              Billing information is temporarily unavailable.
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-white p-8">
          <h1 className="text-3xl font-semibold">Data controls</h1>

          <p className="mt-4 text-gray-700">
            This application stores the data needed to understand and support your
            customer relationships.
          </p>

          <div className="mt-6 rounded-lg border bg-gray-50 p-5">
            <h2 className="text-lg font-semibold">What we store</h2>

            <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-700">
              <li>Relationships and account details</li>
              <li>Interaction notes and customer context</li>
              <li>Generated briefs and summaries</li>
              <li>Extracted risks, opportunities, and actions</li>
              <li>Relationship health scores</li>
              <li>relationship-memory chunks/embeddings</li>
              <li>Async analysis job metadata</li>
            </ul>
          </div>

          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5">
            <h2 className="text-lg font-semibold text-red-700">
              Delete relationship
            </h2>

            <p className="mt-2 text-sm text-red-700">
              Deleting a relationship permanently removes the relationship and its
              associated application data.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/portfolio"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                Review relationships
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
