import type { Metadata } from "next";
import Link from "next/link";

import { LegalNote } from "@/components/marketing/legal-note";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for the Relia relationship intelligence application.",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <LegalNote />
      <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated 10 September 2026.</p>

      <Block title="The service">
        <p>
          Relia is software for customer-facing teams. It stores accounts, timelines, and intelligence
          objects, and can generate grounded briefs and answers from that stored evidence. Output is an aid
          for your judgment, not a verified assessment of any customer.
        </p>
      </Block>

      <Block title="Accounts">
        <p>
          You are responsible for the accuracy of information you submit and for keeping credentials secure.
          You must be authorized to store any customer information you add. A demo workspace is provided for
          evaluation; it uses the same sign-in flow as any other account.
        </p>
      </Block>

      <Block title="Plans">
        <p>
          Relia offers Free, Starter, and Growth plans that gate account count and monthly AI actions, as
          shown on the{" "}
          <Link href={{ pathname: "/", hash: "pricing" }} className="underline">
            pricing
          </Link>{" "}
          section. Paid upgrades use Stripe Checkout and webhooks when Stripe is configured. Relia does not
          store card details. Plan limits are enforced on the server.
        </p>
      </Block>

      <Block title="Acceptable use">
        <p>
          Do not use Relia to store data you are not permitted to hold, to attempt unauthorized access, or
          to violate applicable law. Do not treat AI output as a source of invented customer facts — Relia
          is designed to refuse claims that lack evidence, but you remain responsible for how you use the
          product.
        </p>
      </Block>

      <Block title="Your data">
        <p>
          You retain your customer records. Workspace isolation and role checks are described on{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>{" "}
          and{" "}
          <Link href="/security" className="underline">
            Security
          </Link>
          .
        </p>
      </Block>

      <Block title="Disclaimer">
        <p>
          The service is provided as implemented, without warranties as to the accuracy or completeness of
          any AI-generated brief or answer. These terms have not been reviewed by counsel and are not a
          substitute for a negotiated enterprise agreement.
        </p>
      </Block>
    </div>
  );
}
