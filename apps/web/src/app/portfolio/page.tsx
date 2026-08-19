import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function PortfolioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: relationships, error } = await supabase
    .from("accounts")
    .select("id, name, industry, region, renewal_date, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load relationships: ${error.message}`);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Portfolio</h1>
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

        <div className="mt-8">
          <h2 className="text-xl font-medium">Your relationships</h2>

          {!relationships || relationships.length === 0 ? (
            <div className="mt-4 rounded-xl border bg-white p-6">
              <p className="text-gray-600">
                No relationships yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {relationships.map((relationship) => (
                <Link
                  key={relationship.id}
                  href={`/relationships/${relationship.id}`}
                  className="block rounded-xl border bg-white p-6 transition hover:shadow-sm"
                >
                  <h3 className="text-lg font-semibold">
                    {relationship.name}
                  </h3>

                  <p className="mt-2 text-sm text-gray-600">
                    {relationship.industry || "No industry"} ·{" "}
                    {relationship.region || "No region"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
