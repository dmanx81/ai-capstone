"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type RelationshipAction = (() => Promise<{ ok: boolean }> | { ok: boolean }) | null;

type RelationshipStatusProps = {
  status: "queued" | "analyzing" | "failed" | "complete";
  error: string | null;
  retryAction: RelationshipAction;
};

export default function RelationshipStatus({
  status,
  error,
  retryAction,
}: RelationshipStatusProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "queued" && status !== "analyzing") {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [router, status]);

  return (
    <div
      className={`mt-4 rounded-md border p-4 ${
        status === "failed"
          ? "border-red-200 bg-red-50"
          : status === "queued" || status === "analyzing"
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-gray-800">
          {status === "queued" && "Queued for analysis"}
          {status === "analyzing" && "Analyzing…"}
          {status === "failed" && "Analysis failed"}
          {status === "complete" && "Analysis complete"}
        </p>

        {status === "failed" && retryAction && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await retryAction();
                router.refresh();
              });
            }}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>

      {(status === "queued" || status === "analyzing") && (
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ll refresh automatically while the background analysis finishes.
        </p>
      )}

      {status === "failed" && error && (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
