"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AccountBrief } from "@ai-capstone/shared";

const ALLOWED_TYPES = [
  "meeting",
  "email",
  "note",
  "transcript",
] as const;

type AnalysisResponse = AccountBrief & {
  model_used: string;
};

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
    })
    .select("id")
    .single();

  if (interactionError || !interaction) {
    redirect(
      `/relationships/${accountId}?error=${encodeURIComponent(
        interactionError?.message ?? "Failed to create interaction"
      )}`
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/auth/login");
  }

  const apiBaseUrl = process.env.API_BASE_URL;

  if (!apiBaseUrl) {
    await supabase
      .from("interactions")
      .delete()
      .eq("id", interaction.id);

    redirect(
      `/relationships/${accountId}?error=API_BASE_URL%20is%20not%20configured`
    );
  }

  let brief: AnalysisResponse;

  try {
    const response = await fetch(`${apiBaseUrl}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        customer_text: rawText,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
  const errorBody = await response.text();

  throw new Error(
    `Analysis API returned ${response.status}: ${errorBody}`
  );
}

    brief = (await response.json()) as AnalysisResponse;
  } catch (error) {
    await supabase
      .from("interactions")
      .delete()
      .eq("id", interaction.id);

    const message =
      error instanceof Error
        ? error.message
        : "Analysis failed";

    redirect(
      `/relationships/${accountId}?error=${encodeURIComponent(message)}`
    );
  }

  const { data: storedBrief, error: briefError } = await supabase
    .from("briefs")
    .insert({
      account_id: accountId,
      interaction_id: interaction.id,
      content_json: brief,
      health_score: brief.health_score,
      model_used: brief.model_used,
    })
    .select("id")
    .single();

  if (briefError || !storedBrief) {
    await supabase
      .from("interactions")
      .delete()
      .eq("id", interaction.id);

    redirect(
      `/relationships/${accountId}?error=${encodeURIComponent(
        briefError?.message ?? "Failed to save brief"
      )}`
    );
  }

  const extractedItems = [
    ...brief.risks.map((risk) => ({
      account_id: accountId,
      brief_id: storedBrief.id,
      kind: "risk",
      title: risk.title,
      severity: risk.severity,
      confidence: risk.confidence,
      owner: null,
      evidence: risk.evidence,
      direction: null,
      detail: [
        `Severity: ${risk.severity}`,
        `Confidence: ${Math.round(risk.confidence * 100)}%`,
        `Evidence: ${risk.evidence}`,
      ].join("\n"),
      status: "open",
      due_date: null,
    })),

    ...brief.opportunities.map((opportunity) => ({
      account_id: accountId,
      brief_id: storedBrief.id,
      kind: "opportunity",
      title: opportunity.title,
      severity: null,
      confidence: null,
      owner: null,
      evidence: opportunity.evidence,
      direction: null,
      detail: [
        `Evidence: ${opportunity.evidence}`,
        `Recommended action: ${opportunity.recommended_action}`,
      ].join("\n"),
      status: "open",
      due_date: null,
    })),

    ...brief.action_items.map((action) => ({
      account_id: accountId,
      brief_id: storedBrief.id,
      kind: "action",
      title: action.action,
      severity: null,
      confidence: null,
      owner: action.owner,
      evidence: action.evidence,
      direction: null,
      detail: [
        action.owner ? `Owner: ${action.owner}` : null,
        action.deadline ? `Deadline: ${action.deadline}` : null,
        `Evidence: ${action.evidence}`,
      ]
        .filter(Boolean)
        .join("\n"),
      status: "open",
      due_date: null,
    })),
  ];

  if (extractedItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("extracted_items")
      .insert(extractedItems);

    if (itemsError) {
      await supabase
        .from("briefs")
        .delete()
        .eq("id", storedBrief.id);

      await supabase
        .from("interactions")
        .delete()
        .eq("id", interaction.id);

      redirect(
        `/relationships/${accountId}?error=${encodeURIComponent(
          itemsError.message
        )}`
      );
    }
  }

  revalidatePath(`/relationships/${accountId}`);
  revalidatePath("/portfolio");

  redirect(`/relationships/${accountId}`);
}
