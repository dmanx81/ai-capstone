import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

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
