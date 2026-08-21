"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = [
  "meeting",
  "email",
  "note",
  "transcript",
] as const;

export type RelationshipAnswerResponse = {
  answer: string;
  sources: Array<{
    interaction_id: string;
    created_at: string;
    similarity: number;
    excerpt: string;
  }>;
  model_used: string;
};

export type RelationshipAnswerResult =
  | { ok: true; data: RelationshipAnswerResponse }
  | { ok: false; message: string };

export async function askRelationship(
  accountId: string,
  question: string,
): Promise<RelationshipAnswerResult> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    return { ok: false, message: "Relationship Q&A is not configured." };
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/relationships/${accountId}/ask`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        message: "Relationship Q&A is temporarily unavailable.",
      };
    }

    return {
      ok: true,
      data: (await response.json()) as RelationshipAnswerResponse,
    };
  } catch {
    return {
      ok: false,
      message: "Relationship Q&A is temporarily unavailable.",
    };
  }
}

export async function createInteraction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const accountId = String(formData.get("account_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const rawText = String(formData.get("raw_text") ?? "").trim();
  const occurredAt = String(formData.get("occurred_at") ?? "");

  if (
    !accountId ||
    !rawText ||
    !occurredAt ||
    !ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])
  ) {
    redirect(
      `/relationships/${accountId}?error=Invalid%20interaction`
    );
  }

  if (rawText.length < 40) {
    redirect(
      `/relationships/${accountId}?error=${encodeURIComponent(
        "Interaction text is too short to analyze. Please provide at least 40 characters of meaningful context."
      )}`
    );
  }

  const { data: interaction, error: interactionError } = await supabase
    .from("interactions")
    .insert({
      account_id: accountId,
      type,
      raw_text: rawText,
      occurred_at: occurredAt,
      analysis_status: "queued",
    })
    .select("id, account_id")
    .single();

  if (interactionError || !interaction) {
    redirect(
      `/relationships/${accountId}?error=${encodeURIComponent(
        interactionError?.message ?? "Failed to create interaction"
      )}`
    );
  }

  const { error: jobError } = await supabase
    .from("analysis_jobs")
    .upsert(
      {
        account_id: accountId,
        interaction_id: interaction.id,
        status: "queued",
        attempts: 0,
        last_error: null,
      },
      { onConflict: "interaction_id" }
    );

  if (jobError) {
    await supabase
      .from("interactions")
      .delete()
      .eq("id", interaction.id);

    redirect(
      `/relationships/${accountId}?error=${encodeURIComponent(
        jobError.message ?? "Failed to queue analysis"
      )}`
    );
  }

  revalidatePath(`/relationships/${accountId}`);
  revalidatePath("/portfolio");

  redirect(`/relationships/${accountId}`);
}

export async function retryInteractionAnalysis(interactionId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  const { data: interaction, error: interactionError } = await supabase
    .from("interactions")
    .select("id, account_id, analysis_status")
    .eq("id", interactionId)
    .single();

  if (interactionError || !interaction) {
    throw new Error("Interaction not found");
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, owner_id")
    .eq("id", interaction.account_id)
    .single();

  if (accountError || !account || account.owner_id !== user.id) {
    throw new Error("You do not have access to retry this interaction");
  }

  const { error: updateError } = await supabase
    .from("interactions")
    .update({
      analysis_status: "queued",
      analysis_error: null,
      analysis_started_at: null,
      analysis_completed_at: null,
    })
    .eq("id", interactionId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { data: existingJob, error: existingJobError } = await supabase
    .from("analysis_jobs")
    .select("attempts")
    .eq("interaction_id", interactionId)
    .maybeSingle();

  if (existingJobError) {
    throw new Error(existingJobError.message);
  }

  const { error: jobError } = await supabase
    .from("analysis_jobs")
    .upsert(
      {
        account_id: interaction.account_id,
        interaction_id: interactionId,
        status: "queued",
        attempts: existingJob?.attempts ?? 0,
        last_error: null,
      },
      { onConflict: "interaction_id" }
    );

  if (jobError) {
    throw new Error(jobError.message);
  }

  revalidatePath(`/relationships/${interaction.account_id}`);
  revalidatePath("/portfolio");

  return { ok: true };
}
