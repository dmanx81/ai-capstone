export type SignalSeverity = "info" | "warning" | "critical";
export type SignalType =
  | "health_drop"
  | "health_decline"
  | "renewal_critical"
  | "renewal_soon"
  | "high_risk"
  | "multiple_open_risks"
  | "stale_relationship"
  | "overdue_action"
  | "failed_analysis"
  | "no_health_score";

export type RelationshipSignal = {
  id: string;
  account_id: string;
  type: SignalType;
  severity: SignalSeverity;
  title: string;
  detail: string;
  detected_at: string;
  source_type: string;
  source_id: string | null;
  status: string | null;
};

export const signalPriority: Record<SignalType, number> = {
  health_drop: 1,
  renewal_critical: 2,
  high_risk: 3,
  failed_analysis: 4,
  overdue_action: 5,
  renewal_soon: 6,
  health_decline: 7,
  stale_relationship: 8,
  multiple_open_risks: 9,
  no_health_score: 10,
};

export function priorityForSignal(type: SignalType): number {
  return signalPriority[type] ?? 99;
}

export function sortSignals(signals: RelationshipSignal[]) {
  return [...signals].sort(
    (left, right) => priorityForSignal(left.type) - priorityForSignal(right.type)
  );
}

function daysBetween(dateA: string | null, dateB: string) {
  if (!dateA) {
    return null;
  }

  const start = new Date(dateA).getTime();
  const end = new Date(dateB).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function renewalWindowDays(renewalDate: string | null, nowIso: string) {
  if (!renewalDate) {
    return null;
  }

  const renewAt = new Date(`${renewalDate}T00:00:00Z`).getTime();
  const now = new Date(nowIso).getTime();

  if (Number.isNaN(renewAt) || Number.isNaN(now)) {
    return null;
  }

  return Math.round((renewAt - now) / (24 * 60 * 60 * 1000));
}

function makeSignal(args: {
  account_id: string;
  type: SignalType;
  severity: SignalSeverity;
  title: string;
  detail: string;
  nowIso: string;
  source_type: string;
  source_id?: string | null;
  status?: string | null;
}): RelationshipSignal {
  return {
    id: `${args.account_id}-${args.type}-${args.source_id ?? "root"}`,
    account_id: args.account_id,
    type: args.type,
    severity: args.severity,
    title: args.title,
    detail: args.detail,
    detected_at: args.nowIso,
    source_type: args.source_type,
    source_id: args.source_id ?? null,
    status: args.status ?? null,
  };
}

export function computeRelationshipSignals({
  account_id,
  latest_health_score,
  previous_health_score,
  renewal_date,
  last_interaction_at,
  open_risks = 0,
  high_severity_open_risk_count = 0,
  overdue_action_count = 0,
  failed_analysis = false,
  nowIso = new Date().toISOString(),
}: {
  account_id: string;
  latest_health_score?: number | null;
  previous_health_score?: number | null;
  renewal_date?: string | null;
  last_interaction_at?: string | null;
  open_risks?: number;
  high_severity_open_risk_count?: number;
  overdue_action_count?: number;
  failed_analysis?: boolean;
  nowIso?: string;
}): RelationshipSignal[] {
  const signals: RelationshipSignal[] = [];

  const hasHealthScore =
    latest_health_score !== null && latest_health_score !== undefined;
  const hasPreviousHealthScore =
    previous_health_score !== null && previous_health_score !== undefined;

  if (!hasHealthScore && !hasPreviousHealthScore) {
    signals.push(
      makeSignal({
        account_id,
        type: "no_health_score",
        severity: "info",
        title: "No health history",
        detail: "This relationship has not yet produced a health score.",
        nowIso,
        source_type: "health",
      })
    );
  }

  if (
    hasHealthScore &&
    hasPreviousHealthScore &&
    previous_health_score !== null &&
    latest_health_score !== null
  ) {
    const drop = previous_health_score - latest_health_score;

    if (drop >= 15) {
      signals.push(
        makeSignal({
          account_id,
          type: "health_drop",
          severity: "critical",
          title: "Health dropped",
          detail: `Health dropped from ${previous_health_score} to ${latest_health_score}.`,
          nowIso,
          source_type: "health",
        })
      );
    } else if (drop >= 8) {
      signals.push(
        makeSignal({
          account_id,
          type: "health_decline",
          severity: "warning",
          title: "Health declined",
          detail: `Health declined from ${previous_health_score} to ${latest_health_score}.`,
          nowIso,
          source_type: "health",
        })
      );
    }
  }

  const renewalDays = renewalWindowDays(renewal_date ?? null, nowIso);
  if (renewalDays !== null && renewalDays >= 0 && renewalDays <= 30) {
    signals.push(
      makeSignal({
        account_id,
        type: "renewal_critical",
        severity: "critical",
        title: "Renewal approaching",
        detail: `Renewal is in ${renewalDays} days.`,
        nowIso,
        source_type: "renewal",
      })
    );
  } else if (renewalDays !== null && renewalDays > 30 && renewalDays <= 90) {
    signals.push(
      makeSignal({
        account_id,
        type: "renewal_soon",
        severity: "warning",
        title: "Renewal coming soon",
        detail: `Renewal is in ${renewalDays} days.`,
        nowIso,
        source_type: "renewal",
      })
    );
  }

  if (high_severity_open_risk_count > 0) {
    signals.push(
      makeSignal({
        account_id,
        type: "high_risk",
        severity: "critical",
        title: "High-severity risk open",
        detail: `There are ${high_severity_open_risk_count} open high-severity risks.`,
        nowIso,
        source_type: "risk",
      })
    );
  }

  if (open_risks >= 3 && high_severity_open_risk_count === 0) {
    signals.push(
      makeSignal({
        account_id,
        type: "multiple_open_risks",
        severity: "warning",
        title: "Multiple open risks",
        detail: `There are ${open_risks} open risks currently tracked.`,
        nowIso,
        source_type: "risk",
      })
    );
  }

  if (last_interaction_at) {
    const daysSinceInteraction = daysBetween(last_interaction_at, nowIso);
    if (daysSinceInteraction !== null && daysSinceInteraction > 30) {
      signals.push(
        makeSignal({
          account_id,
          type: "stale_relationship",
          severity: "warning",
          title: "Relationship is stale",
          detail: `Last interaction was ${daysSinceInteraction} days ago.`,
          nowIso,
          source_type: "interaction",
        })
      );
    }
  } else {
    signals.push(
      makeSignal({
        account_id,
        type: "stale_relationship",
        severity: "warning",
        title: "No interaction recorded yet",
        detail: "No interaction recorded yet.",
        nowIso,
        source_type: "interaction",
      })
    );
  }

  if (overdue_action_count > 0) {
    signals.push(
      makeSignal({
        account_id,
        type: "overdue_action",
        severity: "warning",
        title: "Overdue action",
        detail: `There are ${overdue_action_count} overdue open actions.`,
        nowIso,
        source_type: "action",
      })
    );
  }

  if (failed_analysis) {
    signals.push(
      makeSignal({
        account_id,
        type: "failed_analysis",
        severity: "warning",
        title: "Analysis failed",
        detail: "The latest analysis failed and requires a retry.",
        nowIso,
        source_type: "analysis",
      })
    );
  }

  return sortSignals(signals);
}

export function topSignalForAccount(signals: RelationshipSignal[]) {
  return sortSignals(signals)[0] ?? null;
}

export function highestSignalSeverity(signals: RelationshipSignal[]) {
  if (signals.length === 0) {
    return null;
  }

  const order = { critical: 2, warning: 1, info: 0 } as const;
  return signals.reduce((current, signal) => {
    if (order[signal.severity] > order[current]) {
      return signal.severity;
    }
    return current;
  }, "info" as SignalSeverity);
}

export function alertingSignals(signals: RelationshipSignal[]) {
  return signals.filter((signal) => signal.severity !== "info");
}
