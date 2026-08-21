"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type BillingStatus = {
  plan: "FREE" | "PRO";
  status: string;
  usage_count: number;
  monthly_analysis_allowance: number;
  remaining_usage: number;
  period_start: string;
  period_end: string;
};

async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function getBillingStatus(): Promise<BillingStatus | null> {
  const accessToken = await getAccessToken();
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!accessToken || !apiBaseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/billing/status`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BillingStatus;
  } catch {
    return null;
  }
}

export async function startCheckoutAction(): Promise<void> {
  const accessToken = await getAccessToken();
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!accessToken || !apiBaseUrl) {
    redirect("/settings?error=Billing%20is%20not%20configured");
  }

  let checkoutUrl: string | null = null;
  try {
    const response = await fetch(`${apiBaseUrl}/billing/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as { checkout_url: string };
      checkoutUrl = data.checkout_url;
    }
  } catch {
    checkoutUrl = null;
  }

  if (!checkoutUrl) {
    redirect(
      "/settings?error=" +
        encodeURIComponent("Unable to start checkout. Please try again.")
    );
  }

  redirect(checkoutUrl);
}

export async function openPortalAction(): Promise<void> {
  const accessToken = await getAccessToken();
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!accessToken || !apiBaseUrl) {
    redirect("/settings?error=Billing%20is%20not%20configured");
  }

  let portalUrl: string | null = null;
  try {
    const response = await fetch(`${apiBaseUrl}/billing/portal`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as { portal_url: string };
      portalUrl = data.portal_url;
    } else if (response.status === 400) {
      redirect(
        "/settings?error=" +
          encodeURIComponent("No active billing customer found for this account.")
      );
    }
  } catch {
    portalUrl = null;
  }

  if (!portalUrl) {
    redirect(
      "/settings?error=" +
        encodeURIComponent("Unable to open the billing portal. Please try again.")
    );
  }

  redirect(portalUrl);
}
