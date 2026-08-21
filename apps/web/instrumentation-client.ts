import * as Sentry from "@sentry/nextjs";

import { privacyOptions, tracesSampleRate } from "./sentry-privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: tracesSampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    ...privacyOptions,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
