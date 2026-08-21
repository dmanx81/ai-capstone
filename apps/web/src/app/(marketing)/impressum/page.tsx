{/* DRAFT — requires legal review before public launch */}
import { LegalDraftBanner } from "../legal-draft-banner";

export const metadata = {
  title: "Impressum (Draft)",
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

export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <LegalDraftBanner />

      <h1 className="text-3xl font-bold text-gray-900">Impressum</h1>
      <p className="mt-2 text-sm text-gray-500">
        Draft provider information under §5 of the German Digital Services
        Act (Digitale-Dienste-Gesetz, DDG). Not yet reviewed by legal
        counsel. DDG is the current German framework implementing
        transparency/provider-information obligations for telemedia
        services; it replaced the former Telemediengesetz (TMG) and should
        be used as the basis here, not TMG.
      </p>

      <Section title="Provider (§5 DDG)">
        <p>
          {"{{LEGAL_ENTITY_NAME}}"}
          <br />
          {"{{LEGAL_FORM}}"}
          <br />
          {"{{STREET_ADDRESS}}"}
          <br />
          {"{{POSTAL_CODE}}"} {"{{CITY}}"}
          <br />
          {"{{COUNTRY}}"}
        </p>
      </Section>

      <Section title="Represented by">
        <p>{"{{AUTHORIZED_REPRESENTATIVE_NAME}}"}</p>
      </Section>

      <Section title="Contact">
        <p>
          Email: {"{{CONTACT_EMAIL}}"}
          <br />
          Phone: {"{{PHONE_NUMBER}}"}
        </p>
      </Section>

      <Section title="Register entry">
        <p>{"{{COMMERCIAL_REGISTER_COURT_AND_NUMBER_IF_APPLICABLE}}"}</p>
      </Section>

      <Section title="VAT identification number">
        <p>
          VAT ID per §27a of the German VAT Act (Umsatzsteuergesetz):{" "}
          {"{{VAT_ID}}"}
        </p>
      </Section>

      <Section title="Responsible for content">
        <p>{"{{CONTENT_RESPONSIBILITY_NAME_AND_ADDRESS_IF_DIFFERENT}}"}</p>
      </Section>

      <Section title="Supervisory authority">
        <p>{"{{SUPERVISORY_AUTHORITY_IF_APPLICABLE}}"}</p>
      </Section>

      <Section title="Dispute resolution">
        <p>
          The European Commission provides a platform for online dispute
          resolution (ODR):{" "}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . {"{{PARTICIPATION_IN_CONSUMER_DISPUTE_RESOLUTION_STATEMENT}}"}
        </p>
      </Section>
    </div>
  );
}
