// Marketing-only visual tokens. Scoped to the (marketing) route group --
// apps/globals.css and the authenticated app's styling are untouched.

export const palette = {
  navy: "#0B1220",
  signalBlue: "#2563EB",
  healthTeal: "#0F9F8F",
  riskRed: "#E45858",
  surface: "#F5F7FA",
  white: "#FFFFFF",
} as const;

// Mirrors apps/api/billing.py -- there is no cross-language import
// mechanism in this repo, so these are kept in sync by hand. Verified
// against DEFAULT_FREE_ALLOWANCE / DEFAULT_PRO_ALLOWANCE at the time of
// writing (5 / 1000).
export const FREE_MONTHLY_ANALYSIS_ALLOWANCE = 5;
export const PRO_PERIOD_ANALYSIS_ALLOWANCE = 1000;

// No commercial PRO price has been set yet. Render only this placeholder --
// never invent a number.
// TODO(pricing): replace with the real PRO price once decided, and confirm
// whether the configured Stripe Price is actually monthly before changing
// the "/billing period" unit below.
export const PRO_PRICE_DISPLAY = "€__ / billing period";
