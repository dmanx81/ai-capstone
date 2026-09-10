import type { Metadata } from "next";
import Link from "next/link";

import { LegalNote } from "@/components/marketing/legal-note";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Relia stores workspace data, uses AI providers, and keeps secrets off the browser.",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <LegalNote />
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated 10 September 2026.</p>

      <Block title="What Relia stores">
        <p>
          Relia stores the account you create (name, email, password hash) and the workspace data you add:
          organizations, memberships, accounts, contacts, timeline events, risks, opportunities, commitments,
          tasks, documents, search chunks, and AI usage events.
        </p>
        <p>
          Relia does not receive or store card numbers. When Stripe is configured, Checkout and the Customer
          Portal run on Stripe-hosted pages. Relia stores plan, subscription status, and Stripe identifiers
          returned by webhooks.
        </p>
      </Block>

      <Block title="How data is used">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Your workspace</strong> — to provide the product: CRM, timeline,
            intelligence, dashboard, and collaboration.
          </li>
          <li>
            <strong className="text-foreground">Optional language models</strong> — if an OpenAI or Anthropic
            key is configured on the server, interaction text and retrieved chunks are sent to that provider to
            polish briefs or answers. Without keys, Relia assembles output only from stored records.
          </li>
          <li>
            <strong className="text-foreground">Optional embeddings</strong> — if an OpenAI key is configured,
            text is embedded for retrieval. Otherwise Relia uses a local hashing embedder.
          </li>
          <li>
            <strong className="text-foreground">Stripe</strong> — only if you start a paid checkout; Relia never
            sees the raw card.
          </li>
        </ul>
      </Block>

      <Block title="Tenancy and access">
        <p>
          Business rows are scoped by organization. The API filters by the signed-in workspace. Production
          Postgres policies (row-level security) repeat that rule. Members cannot read another organization’s
          accounts. Sessions use an HttpOnly cookie. Service-role, Stripe secret, and model keys are not
          exposed to the browser.
        </p>
      </Block>

      <Block title="What Relia does not do">
        <p>
          Relia does not currently offer a single “download all my data” or “delete my entire account”
          button covering every workspace at once. Account records and timeline events can be managed from
          the authenticated application according to your role. Relia does not claim SOC 2, ISO 27001, HIPAA,
          or GDPR certification on this site.
        </p>
      </Block>

      <Block title="Contact">
        <p>
          Questions about this page can be raised through your Relia workspace administrator. There is no
          separate public contact form in this release.
        </p>
        <p>
          Related:{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/security" className="underline">
            Security
          </Link>
          .
        </p>
      </Block>
    </div>
  );
}
