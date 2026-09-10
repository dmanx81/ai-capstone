export const MARKETING_NAV = [
  { hash: "product", label: "Product" },
  { hash: "how-it-works", label: "How it works" },
  { hash: "use-cases", label: "Use cases" },
  { hash: "pricing", label: "Pricing" },
  { hash: "security", label: "Security" },
] as const;

export type MarketingHash = (typeof MARKETING_NAV)[number]["hash"];

export function homeHash(hash: MarketingHash | "ask" | "preview" | "faq"): {
  pathname: "/";
  hash: string;
} {
  return { pathname: "/", hash };
}
