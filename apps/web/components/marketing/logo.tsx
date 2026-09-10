import Link from "next/link";

export function ReliaLogo({ href = "/" }: { href?: "/" | "/dashboard" }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
        R
      </span>
      Relia
    </Link>
  );
}
