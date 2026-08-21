import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const plausibleOrigin = (process.env.NEXT_PUBLIC_PLAUSIBLE_API_HOST || "https://plausible.io").replace(/\/$/, "");
const isProduction = process.env.NODE_ENV === "production";
const scriptSrc = isProduction
  ? `'self' 'unsafe-inline' ${plausibleOrigin}`
  : `'self' 'unsafe-inline' 'unsafe-eval' ${plausibleOrigin}`;
const connectSrc = isProduction
  ? `'self' https://*.supabase.co https://*.sentry.io ${plausibleOrigin}`
  : `'self' https://*.supabase.co https://*.sentry.io ${plausibleOrigin}`;

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src ${connectSrc}; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';`,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@ai-capstone/shared"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: isProduction
          ? [
              ...securityHeaders,
              { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
            ]
          : securityHeaders,
      },
    ];
  },
};

const sentryEnabled = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      telemetry: false,
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
      webpack: {
        treeshake: {
          removeDebugLogging: true,
        },
      },
    })
  : nextConfig;
