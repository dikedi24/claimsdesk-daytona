import Placeholder from "@/components/Placeholder";

// RFP coverage [Appendix A]
export default function Page() {
  return (
    <Placeholder
      title="Roadmap"
      summary="How each RFP requirement area is covered: built, simulated in this demo, or on the production roadmap."
      items={["Coverage table for Appendix A areas, including Florida DWC EDI, bill review, financial system integration, HIPAA and SSO/MFA, hosting and backups, custom fields, and data export at termination"]}
    />
  );
}
