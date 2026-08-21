import type { Event } from "@sentry/nextjs";

const REDACTED_ERROR = "Error details redacted";

function stripQueryAndFragment(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value, "http://sentry.local");
    return url.origin === "http://sentry.local" ? url.pathname : `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export function tracesSampleRate(value: string | undefined) {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}

export function scrubSentryEvent<T extends Event>(event: T): T {
  delete event.breadcrumbs;
  delete event.contexts;
  delete event.extra;
  delete event.fingerprint;
  delete event.logentry;
  delete event.tags;
  delete event.threads;
  delete event.user;

  if (event.request) {
    event.request = {
      method: event.request.method,
      url: stripQueryAndFragment(event.request.url),
    };
  }

  if (event.message) {
    event.message = REDACTED_ERROR;
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      type: exception.type,
      value: REDACTED_ERROR,
      stacktrace: exception.stacktrace
        ? {
            ...exception.stacktrace,
            frames: exception.stacktrace.frames?.map((frame) => ({
              ...frame,
              vars: undefined,
            })),
          }
        : undefined,
    }));
  }

  if (event.spans) {
    event.spans = event.spans.map((span) => ({
      ...span,
      data: {},
      description: undefined,
    }));
  }

  return event;
}

export const privacyOptions = {
  sendDefaultPii: false,
  beforeBreadcrumb: () => null,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
};
