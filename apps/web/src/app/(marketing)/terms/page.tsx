{/* DRAFT — requires legal review before public launch */}
import { LegalDraftBanner } from "../legal-draft-banner";

export const metadata = {
  title: "Terms of Service (Draft)",
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

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <LegalDraftBanner />

      <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-500">
        Draft. Not yet reviewed by legal counsel.
      </p>

      <Section title="1. Acceptance of these terms">
        <p>
          By creating an account or using this application (the
          &quot;Service&quot;), you agree to these Terms of Service. If you
          do not agree, do not use the Service.
        </p>
      </Section>

      <Section title="2. Who operates this Service">
        <p>
          The Service is operated by {"{{LEGAL_ENTITY_NAME}}"},{" "}
          {"{{STREET_ADDRESS}}"}, {"{{POSTAL_CODE}}"} {"{{CITY}}"},{" "}
          {"{{COUNTRY}}"} (&quot;we,&quot; &quot;us&quot;). You can reach us
          at {"{{CONTACT_EMAIL}}"}.
        </p>
      </Section>

      <Section title="3. The Service">
        <p>
          The Service lets you record customer interactions (notes, emails,
          call transcripts) for accounts you manage, and generates an
          analysis of each interaction — a relationship-health score, risks,
          opportunities, action items, and a draft follow-up message — using
          a third-party AI provider. The output is a draft aid for your
          judgment, not a guaranteed or verified assessment of any customer
          relationship.
        </p>
      </Section>

      <Section title="4. Accounts">
        <p>
          You are responsible for the accuracy of information you submit and
          for keeping your login credentials secure. You must be authorized
          to use any customer information you add to the Service.
        </p>
      </Section>

      <Section title="5. Plans and billing">
        <p>
          The Service offers a Free plan and a Pro plan with different
          per-period analysis allowances, described on the pricing section
          of this site. Paid subscriptions are billed and managed through
          Stripe&apos;s hosted Checkout and Customer Portal; we do not
          receive or store your card details. Prices, allowances, and plan
          terms may change; we will make reasonable efforts to communicate
          material changes in advance.
        </p>
      </Section>

      <Section title="6. Acceptable use">
        <p>
          You agree not to use the Service to store or process data you are
          not legally permitted to hold, to attempt to disrupt or reverse
          engineer the Service, or to use the Service in a way that violates
          applicable law.
        </p>
      </Section>

      <Section title="7. Your data">
        <p>
          You retain ownership of the customer data you submit. You can
          export or delete an individual relationship&apos;s data from that
          relationship&apos;s page at any time; see our{" "}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>{" "}
          for detail on how your data is processed.
        </p>
      </Section>

      <Section title="8. Disclaimers and limitation of liability">
        <p>
          The Service is provided &quot;as is&quot; without warranties of
          any kind, express or implied, including as to the accuracy or
          completeness of any AI-generated analysis. To the maximum extent
          permitted by applicable law, {"{{LEGAL_ENTITY_NAME}}"} will not be
          liable for indirect, incidental, or consequential damages arising
          from use of the Service.
        </p>
        <p>{"{{LIABILITY_CAP_OR_JURISDICTION_SPECIFIC_LANGUAGE}}"}</p>
      </Section>

      <Section title="9. Termination">
        <p>
          You may stop using the Service at any time and delete your
          relationship data as described above. We may suspend or terminate
          access for use that violates these terms.
        </p>
      </Section>

      <Section title="10. Governing law">
        <p>{"{{GOVERNING_LAW_AND_JURISDICTION}}"}</p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>
          We may update these terms from time to time. Material changes will
          be reflected by updating the date on this page.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>Questions about these terms: {"{{CONTACT_EMAIL}}"}.</p>
      </Section>
    </div>
  );
}
