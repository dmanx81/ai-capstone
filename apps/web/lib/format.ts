import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

import type { Health } from "@/lib/types";

export function money(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

export function formatDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? format(date, "MMM d, yyyy") : "—";
}

export function formatDateTime(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? format(date, "MMM d, yyyy p") : "—";
}

export function fromNow(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : "—";
}

export function labelize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

export function healthClass(health: Health | string) {
  switch (health) {
    case "healthy":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "watch":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "at_risk":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "critical":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function severityClass(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-800";
    case "high":
      return "bg-orange-50 text-orange-800";
    case "medium":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-muted text-muted-foreground";
  }
}
