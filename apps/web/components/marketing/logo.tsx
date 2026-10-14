import Link from "next/link";

import { cn } from "@/lib/utils";

export function ReliaMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className={inverted ? "fill-background" : "fill-primary"} />
      <path
        d="M11.2 8.8V23.2M11.2 8.8H18.4C21.6 8.8 21.6 15.2 18.4 15.2H11.2M16.8 15.2L22.4 23.2"
        fill="none"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={inverted ? "stroke-foreground" : "stroke-primary-foreground"}
      />
    </svg>
  );
}

export function ReliaLogo({
  href = "/",
  inverted = false,
  className,
}: {
  href?: "/" | "/dashboard";
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 text-[15px] font-semibold tracking-tight", className)}
      aria-label="Relia home"
    >
      <ReliaMark inverted={inverted} />
      Relia
    </Link>
  );
}
