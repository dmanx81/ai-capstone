"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TimelineInteraction = {
  id: string;
  type: string;
  raw_text: string;
  occurred_at: string;
};

type TimelineBrief = {
  id: string;
  interaction_id: string | null;
  created_at: string;
  health_score: number | null;
};

type TimelineItem = {
  id: string;
  brief_id: string;
  kind: string;
  status: string;
  title: string;
  created_at: string;
  resolved_at: string | null;
};

type RelationshipTimelineProps = {
  nowIso: string;
  renewalDate: string | null;
  interactions: TimelineInteraction[];
  briefs: TimelineBrief[];
  items: TimelineItem[];
};

type Range = "3m" | "6m" | "12m" | "all";

type TimelineEvent = {
  id: string;
  date: string;
  label: string;
  detail: string;
  kind: "interaction" | "risk-raised" | "risk-resolved";
  interactionId?: string;
};

type PositionedTimelineEvent = TimelineEvent & {
  lane: number;
  position: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MIN_MARKER_GAP_PERCENT = 18;

const rangeOptions: Array<[Range, string]> = [
  ["3m", "3 months"],
  ["6m", "6 months"],
  ["12m", "12 months"],
  ["all", "All"],
];

function formatDate(value: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return formatter.format(new Date(value));
}

function rangeStart(range: Range, dates: string[], now: Date) {
  if (range === "all") {
    const earliest = dates.reduce(
      (current, value) => Math.min(current, new Date(value).getTime()),
      now.getTime()
    );
    return new Date(earliest);
  }

  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - Number(range.replace("m", "")));
  return start;
}

function roundedPercent(value: number) {
  return Number(value.toFixed(4));
}

function eventTone(kind: TimelineEvent["kind"]) {
  if (kind === "interaction") {
    return "border-blue-500 bg-blue-50";
  }

  if (kind === "risk-raised") {
    return "border-red-500 bg-red-50";
  }

  return "border-green-600 bg-green-50";
}

function areEventsOnOneDay(events: TimelineEvent[]) {
  if (events.length === 0) {
    return false;
  }

  const firstDay = new Date(events[0].date).toISOString().slice(0, 10);
  return events.every(
    (event) => new Date(event.date).toISOString().slice(0, 10) === firstDay
  );
}

function positionEvents(events: TimelineEvent[], startTime: number, span: number) {
  const laneEnds: number[] = [];

  return events.map<PositionedTimelineEvent>((event) => {
    const position = roundedPercent(
      ((new Date(event.date).getTime() - startTime) / span) * 100
    );
    const openLane = laneEnds.findIndex(
      (laneEnd) => position - laneEnd >= MIN_MARKER_GAP_PERCENT
    );
    const lane = openLane === -1 ? laneEnds.length : openLane;

    laneEnds[lane] = position;

    return { ...event, lane, position };
  });
}

export default function RelationshipTimeline({
  nowIso,
  renewalDate,
  interactions,
  briefs,
  items,
}: RelationshipTimelineProps) {
  const [range, setRange] = useState<Range>("6m");
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(
    interactions[0]?.id ?? null
  );
  const now = new Date(nowIso);

  const allDates = useMemo(
    () => [
      ...interactions.map((interaction) => interaction.occurred_at),
      ...briefs.map((brief) => brief.created_at),
      ...items.map((item) => item.created_at),
      ...items
        .map((item) => item.resolved_at)
        .filter((date): date is string => Boolean(date)),
    ],
    [briefs, interactions, items]
  );

  const start = rangeStart(range, allDates, now);
  const end = now;
  const startTime = start.getTime();
  const endTime = end.getTime();

  const inRange = (date: string) => {
    const time = new Date(date).getTime();
    return time >= startTime && time <= endTime;
  };

  const visibleInteractions = interactions.filter((interaction) =>
    inRange(interaction.occurred_at)
  );
  const visibleBriefs = briefs.filter(
    (brief) => brief.health_score !== null && inRange(brief.created_at)
  );
  const visibleItems = items.filter((item) => inRange(item.created_at));

  const events: TimelineEvent[] = [
    ...visibleInteractions.map((interaction) => ({
      id: `interaction-${interaction.id}`,
      date: interaction.occurred_at,
      label: interaction.type,
      detail: interaction.raw_text.slice(0, 140),
      kind: "interaction" as const,
      interactionId: interaction.id,
    })),
    ...visibleItems.flatMap((item) => {
      if (item.kind !== "risk") {
        return [];
      }

      const riskEvents: TimelineEvent[] = [
        {
          id: `risk-raised-${item.id}`,
          date: item.created_at,
          label: "Risk raised",
          detail: item.title,
          kind: "risk-raised",
        },
      ];

      if (item.status === "resolved" && item.resolved_at && inRange(item.resolved_at)) {
        riskEvents.push({
          id: `risk-resolved-${item.id}`,
          date: item.resolved_at,
          label: "Risk resolved",
          detail: item.title,
          kind: "risk-resolved",
        });
      }

      return riskEvents;
    }),
  ].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  const eventTimes = events.map((event) => new Date(event.date).getTime());
  const singleDayPadding = areEventsOnOneDay(events) ? DAY_IN_MS : 0;
  const timelineStartTime =
    eventTimes.length === 0
      ? startTime
      : Math.min(startTime, Math.min(...eventTimes) - singleDayPadding);
  const timelineEndTime =
    eventTimes.length === 0
      ? endTime
      : Math.max(endTime, Math.max(...eventTimes) + singleDayPadding);
  const timelineSpan = Math.max(timelineEndTime - timelineStartTime, 1);
  const positionedEvents = positionEvents(events, timelineStartTime, timelineSpan);
  const laneCount = Math.max(
    1,
    ...positionedEvents.map((event) => event.lane + 1)
  );
  const timelineHeight = Math.max(112, laneCount * 38 + 24);

  const selectedInteraction = interactions.find(
    (interaction) => interaction.id === selectedInteractionId
  );
  const selectedBrief = briefs.find(
    (brief) => brief.interaction_id === selectedInteractionId
  );
  const healthData = visibleBriefs.map((brief) => ({
    date: formatDate(brief.created_at),
    score: brief.health_score,
  }));
  const todayPosition = roundedPercent(
    ((now.getTime() - timelineStartTime) / timelineSpan) * 100
  );
  const renewalPosition = renewalDate
    ? roundedPercent(
        Math.min(
          Math.max(
            ((new Date(`${renewalDate}T00:00:00Z`).getTime() - timelineStartTime) /
              timelineSpan) *
              100,
            0
          ),
          100
        )
      )
    : null;

  return (
    <section className="mt-6 rounded-xl border bg-white p-8" aria-labelledby="timeline-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="timeline-heading" className="text-2xl font-semibold">
            Relationship timeline
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Interactions, risks, and persisted health scores across the relationship story.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Timeline range">
          {rangeOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`rounded-md border px-3 py-2 text-sm ${
                range === value ? "bg-black text-white" : "bg-white"
              }`}
              aria-pressed={range === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed p-5 text-sm text-gray-600">
          No timeline events in this range.
        </p>
      ) : (
        <>
          <div className="mt-8 overflow-x-auto pb-3">
            <div className="min-w-[760px] px-24 pt-10">
              <div className="relative">
                <div
                  className="absolute left-0 right-0 top-1/2 border-t border-gray-300"
                />
                <div
                  className="absolute bottom-0 top-0 border-l-2 border-dashed border-gray-500"
                  style={{ left: `${Math.min(Math.max(todayPosition, 0), 100)}%` }}
                  aria-label="Today"
                >
                  <span className="absolute -top-7 -translate-x-1/2 text-xs font-medium text-gray-600">
                    Today
                  </span>
                </div>
                {renewalPosition !== null && (
                  <div
                    className="absolute bottom-0 top-0 border-l-2 border-dashed border-amber-600"
                    style={{ left: `${renewalPosition}%` }}
                    aria-label="Renewal date"
                  >
                    <span className="absolute -top-7 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-amber-700">
                      Renewal
                    </span>
                  </div>
                )}
                <div className="relative" style={{ height: `${timelineHeight}px` }}>
                  {positionedEvents.map((event) => {
                    const interactionButton = event.interactionId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedInteractionId(event.interactionId ?? null)}
                        className={`absolute max-w-40 -translate-x-1/2 truncate whitespace-nowrap rounded-full border-2 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black ${eventTone(event.kind)}`}
                        style={{
                          left: `${event.position}%`,
                          top: `${event.lane * 38 + 12}px`,
                        }}
                          aria-label={`${event.label} on ${formatDate(event.date)}`}
                      >
                        {event.label}
                      </button>
                    ) : (
                      <span
                        className={`absolute max-w-40 -translate-x-1/2 truncate whitespace-nowrap rounded-md border-2 px-2 py-1 text-xs font-medium ${eventTone(event.kind)}`}
                        style={{
                          left: `${event.position}%`,
                          top: `${event.lane * 38 + 12}px`,
                        }}
                        aria-label={`${event.label} on ${formatDate(event.date)}`}
                      >
                        {event.label}
                      </span>
                    );

                    return <div key={event.id}>{interactionButton}</div>;
                  })}
                </div>
                <div className="flex justify-between border-t pt-2 text-xs text-gray-500">
                  <span>{formatDate(new Date(timelineStartTime).toISOString())}</span>
                  <span>{formatDate(new Date(timelineEndTime).toISOString())}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600" aria-label="Timeline legend">
            <span><strong className="text-blue-700">Interaction</strong> marker</span>
            <span><strong className="text-red-700">Risk raised</strong> marker</span>
            <span><strong className="text-green-700">Risk resolved</strong> marker</span>
            <span><strong className="text-gray-700">Today</strong> dashed line</span>
            {renewalDate && <span><strong className="text-amber-700">Renewal</strong> dashed line</span>}
          </div>
        </>
      )}

      <div className="mt-6 rounded-lg border p-5">
        <h3 className="text-lg font-semibold">Interaction details</h3>
        {!selectedInteraction ? (
          <p className="mt-2 text-sm text-gray-600">Select an interaction marker to inspect its notes.</p>
        ) : (
          <div className="mt-3" aria-live="polite">
            <p className="font-medium capitalize">
              {selectedInteraction.type} · {formatDate(selectedInteraction.occurred_at)}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {selectedInteraction.raw_text}
            </p>
            {selectedBrief && (
              <p className="mt-3 text-sm text-gray-600">
                Related brief created {formatDate(selectedBrief.created_at)}
                {selectedBrief.health_score === null
                  ? "."
                  : ` with health score ${selectedBrief.health_score} / 100.`}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold">Health score history</h3>
        {healthData.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed p-5 text-sm text-gray-600">
            No scored briefs in this range.
          </p>
        ) : healthData.length === 1 ? (
          <p className="mt-3 rounded-lg border border-dashed p-5 text-sm text-gray-600">
            One scored brief: {healthData[0].score} / 100 on {healthData[0].date}. Not enough history yet for a line.
          </p>
        ) : (
          <div className="mt-4 h-64 w-full" aria-label="Health score history chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={healthData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#111827" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
