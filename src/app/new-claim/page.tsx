import Placeholder from "@/components/Placeholder";

// Claim intake [3.3, 3.4G, 3.16]
export default function Page() {
  return (
    <Placeholder
      title="New Claim"
      summary="Enter a new workers' compensation or general liability claim."
      items={["Validated claim form with coded dropdowns and required fields", "Start from a report: paste a first report of injury and get AI-suggested fields to review", "Nothing saves until you click Save; accepted AI suggestions are recorded in the audit trail"]}
    />
  );
}
