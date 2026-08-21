import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const [relationshipResult, interactionsResult, briefsResult, extractedItemsResult] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("interactions")
        .select("*")
        .eq("account_id", id)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("briefs")
        .select("*")
        .eq("account_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("extracted_items")
        .select("*")
        .eq("account_id", id)
        .order("created_at", { ascending: true }),
    ]);

  const { data: relationship, error: relationshipError } = relationshipResult;
  const { data: interactions, error: interactionsError } = interactionsResult;
  const { data: briefs, error: briefsError } = briefsResult;
  const { data: extractedItems, error: extractedItemsError } = extractedItemsResult;

  if (relationshipError) {
    return NextResponse.json({ error: relationshipError.message }, { status: 400 });
  }

  if (interactionsError) {
    return NextResponse.json({ error: interactionsError.message }, { status: 400 });
  }

  if (briefsError) {
    return NextResponse.json({ error: briefsError.message }, { status: 400 });
  }

  if (extractedItemsError) {
    return NextResponse.json({ error: extractedItemsError.message }, { status: 400 });
  }

  if (!relationship) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  const payload = {
    relationship,
    interactions: interactions ?? [],
    briefs: briefs ?? [],
    extracted_items: extractedItems ?? [],
  };

  const safeName = (relationship.name ?? "relationship")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "relationship";

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.json"`,
    },
    status: 200,
  });
}
