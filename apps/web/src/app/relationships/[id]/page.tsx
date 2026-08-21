import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  deleteRelationship,
  updateRelationship,
} from "../actions";
import { createInteraction } from "../interaction-actions";
import RelationshipTimeline from "./relationship-timeline";

// Synchronous LLM analysis is temporary; replace it with queued background processing before public launch.
export const maxDuration = 60;

type RelationshipPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

type BriefContent = {
  executive_summary: string;
  health_score?: number;
  health_justification?: string;
  risks: Array<{
    title: string;
    severity: string;
    evidence: string;
    confidence: number;
  }>;
  opportunities: Array<{
    title: string;
    evidence: string;
    recommended_action: string;
  }>;
  action_items: Array<{
    action: string;
    owner: string | null;
    deadline: string | null;
    evidence: string;
  }>;
  next_steps: string[];
  follow_up_email: string;
};

const interactionDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

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

  const [relationshipResult, interactionsResult, briefsResult, itemsResult] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, industry, region, renewal_date, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("interactions")
        .select("id, type, raw_text, occurred_at, created_at")
        .eq("account_id", id)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("briefs")
        .select("id, interaction_id, content_json, health_score, model_used, created_at")
        .eq("account_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("extracted_items")
        .select("id, brief_id, kind, title, detail, status, created_at, resolved_at")
        .eq("account_id", id)
        .order("created_at", { ascending: true }),
    ]);

  const { data: relationship, error } = relationshipResult;
  const { data: interactions, error: interactionsError } = interactionsResult;
  const { data: briefs, error: briefsError } = briefsResult;
  const { data: allExtractedItems, error: itemsError } = itemsResult;

  if (error) {
    throw new Error(`Failed to load relationship: ${error.message}`);
  }

  if (!relationship) {
    notFound();
  }

  if (interactionsError) {
    throw new Error(
      `Failed to load interactions: ${interactionsError.message}`
    );
  }

  if (briefsError) {
    throw new Error(`Failed to load briefs: ${briefsError.message}`);
  }

  if (itemsError) {
    throw new Error(`Failed to load extracted items: ${itemsError.message}`);
  }

  const latestBrief = briefs?.[0] ?? null;
  const nowIso = new Date().toISOString();
  const extractedItems = latestBrief
    ? allExtractedItems?.filter((item) => item.brief_id === latestBrief.id) ?? []
    : [];

  const briefContent = latestBrief?.content_json as BriefContent | undefined;
  const healthScore = latestBrief?.health_score ?? null;
  const healthLabel =
    healthScore === null
      ? null
      : healthScore >= 80
        ? "Healthy"
        : healthScore >= 60
          ? "Stable"
          : healthScore >= 40
            ? "At risk"
            : "Critical";

  const risks =
    extractedItems?.filter((item) => item.kind === "risk") ?? [];

  const opportunities =
    extractedItems?.filter((item) => item.kind === "opportunity") ?? [];

  const actions =
    extractedItems?.filter((item) => item.kind === "action") ?? [];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
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
            <input type="hidden" name="id" value={relationship.id} />

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
        </div>

        <div className="mt-6 rounded-xl border bg-white p-8">
          <h2 className="text-2xl font-semibold">
            Latest AI brief
          </h2>

          {!latestBrief || !briefContent ? (
            <p className="mt-4 text-gray-600">
              No AI brief yet. Add an interaction to generate one.
            </p>
          ) : (
            <div className="mt-6 space-y-8">
              <section>
                <h3 className="text-lg font-semibold">
                  Executive summary
                </h3>

                <p className="mt-2 whitespace-pre-wrap text-gray-700">
                  {briefContent.executive_summary}
                </p>
              </section>

              <section className="rounded-lg border bg-gray-50 p-5">
                <h3 className="text-lg font-semibold">
                  Relationship health
                </h3>

                <p className="mt-2 text-2xl font-semibold">
                  {healthScore ?? "—"} / 100
                </p>

                {healthLabel && (
                  <p className="mt-2 text-sm font-medium text-gray-600">
                    {healthLabel}
                  </p>
                )}

                {briefContent.health_justification && (
                  <p className="mt-2 text-sm text-gray-600">
                    {briefContent.health_justification}
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-lg font-semibold">
                  Risks
                </h3>

                {risks.length === 0 ? (
                  <p className="mt-2 text-gray-600">
                    No risks identified.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {risks.map((risk) => (
                      <div
                        key={risk.id}
                        className="rounded-lg border p-4"
                      >
                        <p className="font-medium">
                          {risk.title}
                        </p>

                        {risk.detail && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                            {risk.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-lg font-semibold">
                  Opportunities
                </h3>

                {opportunities.length === 0 ? (
                  <p className="mt-2 text-gray-600">
                    No opportunities identified.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {opportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        className="rounded-lg border p-4"
                      >
                        <p className="font-medium">
                          {opportunity.title}
                        </p>

                        {opportunity.detail && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                            {opportunity.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-lg font-semibold">
                  Action items
                </h3>

                {actions.length === 0 ? (
                  <p className="mt-2 text-gray-600">
                    No action items identified.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {actions.map((action) => (
                      <div
                        key={action.id}
                        className="rounded-lg border p-4"
                      >
                        <p className="font-medium">
                          {action.title}
                        </p>

                        {action.detail && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                            {action.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-lg font-semibold">
                  Next steps
                </h3>

                <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-700">
                  {briefContent.next_steps.map((step) => (
                    <li key={step}>
                      {step}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold">
                  Draft follow-up email
                </h3>

                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                  {briefContent.follow_up_email}
                </pre>
              </section>
            </div>
          )}
        </div>

        <RelationshipTimeline
          nowIso={nowIso}
          renewalDate={relationship.renewal_date}
          interactions={interactions ?? []}
          briefs={(briefs ?? []).map((brief) => ({
            id: brief.id,
            interaction_id: brief.interaction_id,
            created_at: brief.created_at,
            health_score: brief.health_score,
          }))}
          items={(allExtractedItems ?? []).map((item) => ({
            id: item.id,
            brief_id: item.brief_id,
            kind: item.kind,
            status: item.status,
            title: item.title,
            created_at: item.created_at,
            resolved_at: item.resolved_at,
          }))}
        />

        <div className="mt-6 rounded-xl border bg-white p-8">
          <h2 className="text-2xl font-semibold">
            Add interaction
          </h2>

          <form action={createInteraction} className="mt-6 space-y-5">
            <input
              type="hidden"
              name="account_id"
              value={relationship.id}
            />

            <div>
              <label
                htmlFor="type"
                className="mb-1 block text-sm font-medium"
              >
                Type
              </label>

              <select
                id="type"
                name="type"
                required
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
                <option value="note">Note</option>
                <option value="transcript">Transcript</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="occurred_at"
                className="mb-1 block text-sm font-medium"
              >
                Date and time
              </label>

              <input
                id="occurred_at"
                name="occurred_at"
                type="datetime-local"
                required
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="raw_text"
                className="mb-1 block text-sm font-medium"
              >
                Interaction text
              </label>

              <textarea
                id="raw_text"
                name="raw_text"
                required
                rows={8}
                className="w-full rounded-md border px-3 py-2"
                placeholder="Paste meeting notes, an email, transcript, or other relationship context..."
              />
            </div>

            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-white"
            >
              Add interaction
            </button>
          </form>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-8">
          <h2 className="text-2xl font-semibold">
            Interaction history
          </h2>

          {!interactions || interactions.length === 0 ? (
            <p className="mt-4 text-gray-600">
              No interactions yet.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {interactions.map((interaction) => (
                <div
                  key={interaction.id}
                  className="rounded-lg border p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium capitalize">
                      {interaction.type}
                    </span>

                    <time className="text-sm text-gray-500">
                      {interactionDateFormatter.format(
                        new Date(interaction.occurred_at)
                      )}
                    </time>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                    {interaction.raw_text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border bg-white p-8">
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
    </main>
  );
}
