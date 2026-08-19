import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  deleteRelationship,
  updateRelationship,
} from "../actions";

type RelationshipPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RelationshipPage({
  params,
  searchParams,
}: RelationshipPageProps) {
  const { id } = await params;
  const { error: pageError } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: relationship, error } = await supabase
    .from("accounts")
    .select("id, name, industry, region, renewal_date, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load relationship: ${error.message}`);
  }

  if (!relationship) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/portfolio"
          className="text-sm font-medium text-gray-600 underline"
        >
          Back to portfolio
        </Link>

        <div className="mt-6 rounded-xl border bg-white p-8">
          <h1 className="text-3xl font-semibold">
            {relationship.name}
          </h1>

          {pageError && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {pageError}
            </div>
          )}

          <form action={updateRelationship} className="mt-8 space-y-5">
            <input
              type="hidden"
              name="id"
              value={relationship.id}
            />

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
                defaultValue={relationship.name}
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
                defaultValue={relationship.industry ?? ""}
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
                defaultValue={relationship.region ?? ""}
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
                defaultValue={relationship.renewal_date ?? ""}
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-white"
            >
              Save changes
            </button>
          </form>

          <div className="mt-10 border-t pt-6">
            <h2 className="font-medium text-red-700">
              Danger zone
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Deleting this relationship will also delete its child data.
            </p>

            <form action={deleteRelationship} className="mt-4">
              <input
                type="hidden"
                name="id"
                value={relationship.id}
              />

              <button
                type="submit"
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-700"
              >
                Delete relationship
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
