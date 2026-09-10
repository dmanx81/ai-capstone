import { cn } from "@/lib/utils";
import { healthClass, labelize, severityClass } from "@/lib/format";

export function HealthBadge({ health, score }: { health: string; score?: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", healthClass(health))}>
      {labelize(health)}
      {typeof score === "number" ? <span className="ml-1 opacity-70">{score}</span> : null}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", severityClass(severity))}>
      {severity}
    </span>
  );
}
