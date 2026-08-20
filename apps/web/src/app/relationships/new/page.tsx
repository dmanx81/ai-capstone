import Link from "next/link";
import { createRelationship } from "../actions";

type NewRelationshipPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewRelationshipPage({
  searchParams,
}: NewRelationshipPageProps) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href="/portfolio"
            className="text-sm font-medium text-gray-600 underline"
          >
            Back to portfolio
          </Link>
        </div>

        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">
            New relationship
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Add a customer, prospect, partner, or other important relationship.
          </p>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={createRelationship} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium"
              >
                Name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="industry"
                className="mb-1 block text-sm font-medium"
              >
                Industry
              </label>

              <input
                id="industry"
                name="industry"
                type="text"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="region"
                className="mb-1 block text-sm font-medium"
              >
                Region
              </label>

              <input
                id="region"
                name="region"
                type="text"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="renewal_date"
                className="mb-1 block text-sm font-medium"
              >
                Renewal date
              </label>

              <input
                id="renewal_date"
                name="renewal_date"
                type="date"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-black px-4 py-2 text-white"
              >
                Create relationship
              </button>

              <Link
                href="/portfolio"
                className="rounded-md border bg-white px-4 py-2"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
