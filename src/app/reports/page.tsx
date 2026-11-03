import Placeholder from "@/components/Placeholder";

// Reports [3.5–3.10]
export default function Page() {
  return (
    <Placeholder
      title="Reports"
      summary="Point-in-time and litigation reporting with CSV export."
      items={["As-of date report by department, WC vs. GL, with drill-down", "Litigated claims by defense firm", "CSV export on every report", "Chart that switches between bar and line"]}
    />
  );
}
