"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createRelationship(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const renewalDate = String(formData.get("renewal_date") ?? "").trim();

  if (!name) {
    redirect("/relationships/new?error=Name%20is%20required");
  }

  const { error } = await supabase
    .from("accounts")
    .insert({
      owner_id: user.id,
      name,
      industry: industry || null,
      region: region || null,
      renewal_date: renewalDate || null,
    });

  if (error) {
    redirect(
      `/relationships/new?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/portfolio");
  redirect("/portfolio");
}

export async function updateRelationship(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const renewalDate = String(formData.get("renewal_date") ?? "").trim();

  if (!id || !name) {
    redirect(`/relationships/${id}?error=Name%20is%20required`);
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name,
      industry: industry || null,
      region: region || null,
      renewal_date: renewalDate || null,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/relationships/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/portfolio");
  revalidatePath(`/relationships/${id}`);
  redirect(`/relationships/${id}`);
}

export async function deleteRelationship(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const id = String(formData.get("id") ?? "");
  const confirmed = String(formData.get("confirm_delete") ?? "");

  if (!id) {
    redirect("/portfolio");
  }

  if (confirmed !== "yes") {
    redirect(`/relationships/${id}?error=${encodeURIComponent("Please confirm deletion before continuing.")}`);
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id);

  if (error) {
    redirect(
      `/relationships/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/portfolio");
  redirect("/portfolio");
}

export async function updateActionItem(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const itemId = String(formData.get("id") ?? "").trim();
  if (!itemId) {
    redirect("/portfolio");
  }

  const { data: item, error: itemError } = await supabase
    .from("extracted_items")
    .select("id, account_id, owner, due_date, status, resolved_at, evidence, detail")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !item) {
    throw new Error(itemError?.message ?? "Action item not found");
  }

  const accountId = item.account_id;
  const rawOwner = String(formData.get("owner") ?? "").trim();
  const nextOwner = rawOwner.length > 0 ? rawOwner : null;
  const clearDueDate = String(formData.get("clear_due_date") ?? "") === "true";
  const dueDateValue = String(formData.get("due_date") ?? "").trim();
  const statusValue = String(formData.get("status") ?? "").trim();
  const nowIso = new Date().toISOString();

  const updatePayload: Record<string, string | null> = {};

  if (formData.has("owner")) {
    updatePayload.owner = nextOwner;
  }

  if (clearDueDate) {
    updatePayload.due_date = null;
  } else if (formData.has("due_date") && dueDateValue) {
    updatePayload.due_date = dueDateValue;
  }

  if (statusValue === "resolved") {
    updatePayload.status = "resolved";
    updatePayload.resolved_at = nowIso;
  } else if (statusValue === "open") {
    updatePayload.status = "open";
    updatePayload.resolved_at = null;
  }

  if (Object.keys(updatePayload).length === 0) {
    redirect(`/relationships/${accountId}`);
  }

  const { error: updateError } = await supabase
    .from("extracted_items")
    .update(updatePayload)
    .eq("id", itemId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/portfolio");
  revalidatePath(`/relationships/${accountId}`);
  redirect(`/relationships/${accountId}`);
}
