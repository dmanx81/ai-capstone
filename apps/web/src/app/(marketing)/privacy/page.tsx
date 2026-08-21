{/* DRAFT — requires legal review before public launch */}
import { LegalDraftBanner } from "../legal-draft-banner";

export const metadata = {
  title: "Privacy Policy (Draft)",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <LegalDraftBanner />

      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">
        Draft. Not yet reviewed by legal counsel. This page describes what
        this application&apos;s current implementation actually does, as
        best as can be established from the codebase and configuration —
        not a finalized legal statement.
      </p>

      <Section title="1. Who this policy is about">
        <p>
          This policy covers {"{{LEGAL_ENTITY_NAME}}"} (&quot;we,&quot;
          &quot;us&quot;), operating this application, at{" "}
          {"{{STREET_ADDRESS}}"}, {"{{POSTAL_CODE}}"} {"{{CITY}}"},{" "}
          {"{{COUNTRY}}"}. Contact: {"{{CONTACT_EMAIL}}"}.{" "}
          {"{{CONTROLLER_OR_PROCESSOR_ROLE_STATEMENT}}"}
        </p>
      </Section>

      <Section title="2. What we collect">
        <p>
          Account data: your email address and authentication identifiers,
          managed by Supabase (our authentication and database provider).
        </p>
        <p>
          Content you add: relationship/account records, and the customer
          notes, emails, or call-transcript text you paste in as
          interactions, plus the analysis output generated from them
          (health scores, risks, opportunities, action items, follow-up
          drafts).
        </p>
        <p>
          Billing data, if you upgrade: your plan, subscription status, and
          Stripe customer/subscription identifiers. Card details are
          entered directly into Stripe&apos;s hosted Checkout and Customer
          Portal pages and are never received or stored by this
          application.
        </p>
      </Section>

      <Section title="3. How your data is used and who processes it">
        <p>
          The following services are actually integrated in this
          application&apos;s current implementation. We do not list a
          service here unless it is genuinely wired into the code:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Supabase</strong> — authentication, and the primary
            database storing your account, relationship, interaction, brief,
            and billing records, protected by row-level security so you can
            only access your own data.
          </li>
          <li>
            <strong>An AI analysis provider</strong> (accessed via
            OpenRouter) — receives the interaction text you submit in order
            to generate the relationship analysis (health score, risks,
            opportunities, actions, follow-up draft). The specific
            underlying model is configured by us and may change.
          </li>
          <li>
            <strong>An embeddings provider</strong> (an OpenAI-compatible
            API) — receives interaction text to generate vector embeddings
            used to retrieve relevant history for later analyses and the
            Q&amp;A feature.
          </li>
          <li>
            <strong>Stripe</strong> — if you upgrade to a paid plan, handles
            Checkout and subscription management on its own hosted pages.
            We receive your plan/subscription status from Stripe, not your
            payment details.
          </li>
          <li>
            <strong>Plausible</strong> (only when analytics is enabled in
            this deployment) — receives standard page-visit information
            (such as the page URL and referrer) for aggregate usage
            statistics. The application does not send customer notes,
            conversation text, relationship names, or custom customer
            payloads to Plausible.
          </li>
          <li>
            <strong>Sentry</strong> (only when error monitoring is enabled
            in this deployment) — receives technical error reports to help
            us fix bugs. This deployment&apos;s configuration strips user
            identity, message text, breadcrumbs, and other identifying
            details from error reports before they are sent.
          </li>
        </ul>
      </Section>

      <Section title="4. Where your data is processed">
        <p>
          We are not able to state in this draft that all processing occurs
          within the EU or the EEA. The services above are third-party
          providers with their own infrastructure, and the exact processing
          locations and any international transfer safeguards depend on
          this deployment&apos;s specific configuration and each
          provider&apos;s current data processing terms.{" "}
          {"{{INTERNATIONAL_TRANSFER_MECHANISM_AND_LOCATIONS}}"}
        </p>
      </Section>

      <Section title="5. Legal basis for processing">
        <p>{"{{LEGAL_BASIS_FOR_PROCESSING}}"}</p>
      </Section>

      <Section title="6. Data retention">
        <p>
          The application does not currently implement an automatic
          retention/deletion schedule for relationship data — records
          persist until you delete them yourself (see Section 7).{" "}
          {"{{RETENTION_PERIOD_IF_ANY_IS_ADOPTED}}"}
        </p>
      </Section>

      <Section title="7. Your rights and controls">
        <p>
          From an individual relationship&apos;s page, you can export that
          relationship&apos;s interactions, briefs, and extracted items as a
          JSON file, or delete the relationship (and its associated data)
          entirely. This application does not currently provide a single
          bulk &quot;export all my data&quot; or &quot;delete my account&quot;
          action covering every relationship at once — each relationship is
          exported or deleted individually.
        </p>
        <p>
          {"{{ADDITIONAL_DATA_SUBJECT_RIGHTS_AND_SUPERVISORY_AUTHORITY_CONTACT}}"}
        </p>
      </Section>

      <Section title="8. Children">
        <p>This Service is intended for business use and is not directed at children.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will
          be reflected by updating the date on this page.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Questions about this policy or your data: {"{{CONTACT_EMAIL}}"}.
        </p>
      </Section>
    </div>
  );
}
