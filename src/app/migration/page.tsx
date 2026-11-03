import Placeholder from "@/components/Placeholder";

// Legacy migration [3.2D, 3.21]
export default function Page() {
  return (
    <Placeholder
      title="Legacy Data Migration"
      summary="Convert the ~16,000 claims in the legacy SQL Server system without data loss."
      items={["Select the legacy export file and review automatic field mapping", "Validation with rejected rows, duplicates and mapping exceptions", "Conversion report with financial control totals that tie out", "Approve conversion (Risk Manager only)"]}
    />
  );
}
