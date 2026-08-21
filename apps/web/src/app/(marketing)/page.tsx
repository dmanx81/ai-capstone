import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  FREE_MONTHLY_ANALYSIS_ALLOWANCE,
  PRO_PERIOD_ANALYSIS_ALLOWANCE,
  PRO_PRICE_DISPLAY,
  palette,
} from "./palette";
import { PortfolioScreenshot } from "./portfolio-screenshot";
import { SignalTrace } from "./signal-trace";

const primaryCtaClasses =
  "inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const secondaryCtaClasses =
  "inline-flex items-center justify-center rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/portfolio");
  }

  return (
    <>
      {/* Hero */}
      <section style={{ backgroundColor: palette.navy }} className="px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="font-[var(--font-marketing-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Turn every customer conversation into a clear next move.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
            Paste in a call transcript, an email, or your meeting notes. Get
            relationship health, emerging risks, open actions, and a
            follow-up draft you can review before sending.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className={primaryCtaClasses}
              style={{ backgroundColor: palette.signalBlue, outlineColor: palette.white }}
            >
              Start free
            </Link>
            <Link
              href="/auth/login"
              className={secondaryCtaClasses}
              style={{ outlineColor: palette.white }}
            >
              Log in
            </Link>
          </div>
          <div className="mt-12 flex w-full justify-center">
            <SignalTrace />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-[var(--font-marketing-display)] text-2xl font-bold text-gray-900 sm:text-3xl">
            The warning signs are usually already in your notes.
          </h2>
          <p className="mt-4 text-base text-gray-600 sm:text-lg">
            Customer context gets scattered across calls, emails, and notes.
            Renewal risk and other warning signs can sit there unnoticed.
            Follow-ups and open actions slip between conversations before
            anyone circles back.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section style={{ backgroundColor: palette.surface }} className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-[var(--font-marketing-display)] text-2xl font-bold text-gray-900 sm:text-3xl">
            How it works
          </h2>

          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            <li>
              <p
                className="font-[var(--font-marketing-display)] text-sm font-bold"
                style={{ color: palette.signalBlue }}
              >
                01
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                Add the conversation
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Paste customer notes, an email, or a call transcript.
              </p>
            </li>
            <li>
              <p
                className="font-[var(--font-marketing-display)] text-sm font-bold"
                style={{ color: palette.signalBlue }}
              >
                02
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                Let the analysis run
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Analysis runs in the background while you keep working.
              </p>
            </li>
            <li>
              <p
                className="font-[var(--font-marketing-display)] text-sm font-bold"
                style={{ color: palette.signalBlue }}
              >
                03
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                Know where to focus
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Your portfolio surfaces relationship health, risks, and next
                steps.
              </p>
            </li>
          </ol>

          <div className="mt-12">
            <PortfolioScreenshot />
          </div>
        </div>
      </section>

      {/* Product outputs */}
      <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-[var(--font-marketing-display)] text-2xl font-bold text-gray-900 sm:text-3xl">
            One conversation. Four things you can act on.
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-5">
              <p className="text-sm font-semibold" style={{ color: palette.healthTeal }}>
                Health
              </p>
              <p className="mt-2 text-sm text-gray-600">
                A consistent relationship-health signal.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-5">
              <p className="text-sm font-semibold" style={{ color: palette.riskRed }}>
                Risks
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Emerging relationship problems surfaced from the analysis.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-5">
              <p className="text-sm font-semibold" style={{ color: palette.signalBlue }}>
                Actions
              </p>
              <p className="mt-2 text-sm text-gray-600">
                What needs attention and what should happen next.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900">Follow-up</p>
              <p className="mt-2 text-sm text-gray-600">
                A draft you can review before sending.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio value */}
      <section style={{ backgroundColor: palette.navy }} className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-[var(--font-marketing-display)] text-2xl font-bold text-white sm:text-3xl">
            One account is easy to remember. Thirty aren&apos;t.
          </h2>
          <p className="mt-4 text-base text-white/80 sm:text-lg">
            The portfolio ranks relationships that need attention first —
            surfacing health decline, renewal pressure, overdue actions, and
            open risks — so you always know where to look next.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-[var(--font-marketing-display)] text-2xl font-bold text-gray-900 sm:text-3xl">
            Pricing
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-gray-600">
            Upgrade any time from Settings after you create your account. No
            card details are collected here.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Free</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">€0</p>
              <p className="mt-1 text-sm text-gray-600">
                {FREE_MONTHLY_ANALYSIS_ALLOWANCE} analyses per calendar
                month.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                <li>Relationship health scoring</li>
                <li>Risk and action extraction</li>
                <li>Follow-up drafts</li>
                <li>Per-relationship export</li>
              </ul>
              <Link
                href="/auth/signup"
                className="mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: palette.signalBlue, outlineColor: palette.navy }}
              >
                Start free
              </Link>
            </div>

            <div className="rounded-xl border-2 p-6" style={{ borderColor: palette.signalBlue }}>
              <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {PRO_PRICE_DISPLAY}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {PRO_PERIOD_ANALYSIS_ALLOWANCE} analyses per billing period.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                <li>Relationship health scoring</li>
                <li>Risk and action extraction</li>
                <li>Follow-up drafts</li>
                <li>Per-relationship export</li>
              </ul>
              <Link
                href="/auth/signup"
                className="mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: palette.signalBlue, outlineColor: palette.navy }}
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ backgroundColor: palette.surface }} className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-[var(--font-marketing-display)] text-2xl font-bold text-gray-900 sm:text-3xl">
            Frequently asked questions
          </h2>

          <dl className="mt-10 space-y-8">
            <div>
              <dt className="text-base font-semibold text-gray-900">
                What happens to the customer information I add?
              </dt>
              <dd className="mt-2 text-sm text-gray-600">
                Your notes, emails, and call transcripts are stored in this
                application&apos;s database and sent to the configured AI
                providers that generate your relationship briefs and search
                your relationship history. The application does not send
                customer notes, conversation text, relationship names, or
                custom customer payloads to Plausible, the analytics tool
                used on this site — Plausible only processes standard
                page-visit information when it&apos;s enabled. If error
                monitoring is enabled, error reports are stripped of message
                text and other identifying details before being sent. See
                our <Link href="/privacy" className="underline">Privacy Policy</Link>{" "}
                draft for full detail.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-gray-900">
                What counts as an analysis?
              </dt>
              <dd className="mt-2 text-sm text-gray-600">
                One completed analysis of a unique customer interaction
                counts toward your plan&apos;s allowance for the current
                period. A failed analysis, or retrying an interaction that
                already completed, doesn&apos;t use any additional
                allowance.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-gray-900">
                Do I need to change the tools I already use?
              </dt>
              <dd className="mt-2 text-sm text-gray-600">
                No. Paste in the notes, emails, or transcripts from whatever
                you already use to track customer conversations.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-gray-900">
                Can I delete or export relationship data?
              </dt>
              <dd className="mt-2 text-sm text-gray-600">
                Yes. From a relationship&apos;s page, you can export that
                relationship&apos;s interactions, briefs, and extracted
                items as a JSON file, or delete the relationship entirely.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold text-gray-900">
                What happens when I reach my limit for the period?
              </dt>
              <dd className="mt-2 text-sm text-gray-600">
                New analyses pause until your next period starts, or until
                you upgrade. Everything you&apos;ve already generated stays
                available.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ backgroundColor: palette.navy }} className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-[var(--font-marketing-display)] text-2xl font-bold text-white sm:text-3xl">
            Stop carrying your account portfolio in your head.
          </h2>
          <Link
            href="/auth/signup"
            className={`${primaryCtaClasses} mt-7`}
            style={{ backgroundColor: palette.signalBlue, outlineColor: palette.white }}
          >
            Start free
          </Link>
        </div>
      </section>
    </>
  );
}
