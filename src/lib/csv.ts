// CSV export used by every report [3.5D] and the migration exceptions list.
import Papa from "papaparse";

export function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  const csv = Papa.unparse(rows);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
