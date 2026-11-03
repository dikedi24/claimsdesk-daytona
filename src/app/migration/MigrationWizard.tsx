"use client";
// Legacy migration: select file → map fields → validate → conversion report → approve [3.2D, 3.21].
import Link from "next/link";
import Papa from "papaparse";
import { useState } from "react";
import {
  Card,
  Loading,
  PageTitle,
  ResultMessage,
  btnPrimary,
  btnSecondary,
  btnSuccess,
  inputCls,
  linkCls,
  rowCls,
  tableCls,
  td,
  th,
  theadCls,
} from "@/components/ui";
import { approveConversion, rollbackConversion, type Result } from "@/lib/actions";
import { DEPARTMENTS, deptLabel } from "@/lib/codes";
import { fmtDate, count, moneyCents } from "@/lib/format";
import {
  DEPT_XWALK,
  TARGET_FIELDS,
  autoMap,
  convert,
  exceptionRows,
  missingRequired,
  tieOut,
  type ConversionResult,
  type Issue,
  type Mapping,
  type TargetKey,
  type Totals,
} from "@/lib/legacy";
import { BUNDLED_LEGACY_FILE, fetchBundledLegacy, useAppState, type AppState } from "@/lib/store";
import { userName } from "@/lib/users";

interface SourceFile {
  name: string;
  bundled: boolean;
  headers: string[];
  rows: Record<string, string>[];
  parseMs: number;
}

const STEPS = ["Select file", "Map fields", "Validate", "Conversion report"];

export default function MigrationWizard() {
  const s = useAppState();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<SourceFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [autoMapping, setAutoMapping] = useState<Mapping>({});
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [convertMs, setConvertMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Result | null>(null);

  if (!s) return <Loading />;

  const loaded = (f: SourceFile) => {
    const auto = autoMap(f.headers);
    setFile(f);
    setMapping(auto);
    setAutoMapping(auto);
    setResult(null);
    setMessage(null);
    setStep(1);
  };

  const useBundled = async () => {
    setBusy(true);
    setMessage(null);
    const t = performance.now();
    try {
      const { headers, rows } = await fetchBundledLegacy();
      loaded({ name: "legacy_export.csv", bundled: true, headers, rows, parseMs: performance.now() - t });
    } catch (e) {
      setMessage({ ok: false, error: e instanceof Error ? e.message : "Could not load the bundled file." });
    } finally {
      setBusy(false);
    }
  };

  const upload = (f: File) => {
    setBusy(true);
    setMessage(null);
    const t = performance.now();
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setBusy(false);
        if (!res.meta.fields?.length || !res.data.length) {
          setMessage({ ok: false, error: "That file has no header row or no data rows. Choose a CSV export with column names in the first row." });
          return;
        }
        loaded({ name: f.name, bundled: false, headers: res.meta.fields, rows: res.data, parseMs: performance.now() - t });
      },
      error: (err) => {
        setBusy(false);
        setMessage({ ok: false, error: `Could not read the file: ${err.message}` });
      },
    });
  };

  const validate = () => {
    if (!file) return;
    const t = performance.now();
    setResult(convert(file.rows, mapping));
    setConvertMs(performance.now() - t);
    setStep(2);
  };

  const approve = () => {
    if (!file || !result) return;
    if (!window.confirm(`Approve conversion of ${count(result.converted.length)} claims from ${file.name}?`)) return;
    const r = approveConversion(result, mapping, file.name, file.bundled);
    setMessage(r);
    if (r.ok) {
      setFile(null);
      setResult(null);
      setStep(0);
    }
  };

  // Once approved, show the decision instead of the wizard (unless a new run has been started).
  if (s.migration && !file) {
    return (
      <div className="max-w-5xl space-y-5">
        <PageTitle title="Legacy Data Migration" subtitle="Conversion of historical claims from the City's legacy SQL Server system." />
        <ResultMessage result={message} />
        <ApprovedSummary s={s} onRollback={() => setMessage(rollbackConversion())} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      <PageTitle
        title="Legacy Data Migration"
        subtitle="Convert the ~16,000 historical claims in the City's legacy SQL Server system. Nothing is converted until the Risk Manager approves the conversion report."
      />

      <ol className="flex flex-wrap gap-2" aria-label="Migration steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${
              i === step
                ? "border-[#0b3a5b] bg-[#0b3a5b] font-semibold text-white"
                : i < step
                  ? "border-green-700 bg-green-50 text-green-900"
                  : "border-slate-300 text-slate-600"
            }`}
          >
            {i < step ? "✓ " : `${i + 1}. `}
            {label}
          </li>
        ))}
      </ol>

      <ResultMessage result={message} />

      {step === 0 && <SelectStep busy={busy} onBundled={useBundled} onUpload={upload} />}
      {step === 1 && file && (
        <MapStep file={file} mapping={mapping} autoMapping={autoMapping} setMapping={setMapping} onBack={() => setStep(0)} onNext={validate} />
      )}
      {step === 2 && file && result && (
        <ValidateStep file={file} result={result} ms={file.parseMs + convertMs} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && file && result && <ReportStep s={s} file={file} result={result} onBack={() => setStep(2)} onApprove={approve} />}
    </div>
  );
}

// ---------- Step 1 ----------

function SelectStep({ busy, onBundled, onUpload }: { busy: boolean; onBundled: () => void; onUpload: (f: File) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Use the bundled legacy export">
        <p className="mb-3 text-sm text-slate-700">
          <strong>legacy_export.csv</strong>: an export of the legacy claims database (16,000 rows, closed claims from 2006–2020), with the
          kinds of data problems found in real conversions.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnPrimary} onClick={onBundled} disabled={busy}>
            {busy ? "Loading…" : "Use bundled file"}
          </button>
          <a href={BUNDLED_LEGACY_FILE} download className={`${linkCls} text-sm`}>
            Download the raw file
          </a>
        </div>
      </Card>
      <Card title="Upload a CSV export">
        <p className="mb-3 text-sm text-slate-700">Any CSV with column names in the first row. Columns are matched automatically and can be adjusted.</p>
        <label htmlFor="upload" className="mb-1 block text-xs font-semibold text-slate-700">
          CSV file
        </label>
        <input
          id="upload"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className={`${inputCls} w-full`}
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
      </Card>
    </div>
  );
}

// ---------- Step 2 ----------

function MapStep({
  file,
  mapping,
  autoMapping,
  setMapping,
  onBack,
  onNext,
}: {
  file: SourceFile;
  mapping: Mapping;
  autoMapping: Mapping;
  setMapping: (m: Mapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const missing = missingRequired(mapping);
  const used = new Set(Object.values(mapping).filter(Boolean));
  const sample = (h: string) => file.rows.find((r) => (r[h] ?? "").trim())?.[h] ?? "";

  // Department code crosswalk with counts of each legacy code found in the file.
  const deptCol = Object.entries(mapping).find(([, t]) => t === "department")?.[0];
  const deptCounts = new Map<string, number>();
  if (deptCol) for (const r of file.rows) {
    const v = (r[deptCol] ?? "").trim().toUpperCase();
    deptCounts.set(v, (deptCounts.get(v) ?? 0) + 1);
  }
  const deptRows = [...deptCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <Card title={`Map fields — ${file.name} (${count(file.rows.length)} rows, ${file.headers.length} columns)`}>
        <p className="mb-3 text-sm text-slate-700">
          Each legacy column has been matched to a ClaimsDesk field where possible. Review the matches and change any that are wrong. Required
          fields are marked *.
        </p>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Legacy column</th>
                <th className={th}>Sample value</th>
                <th className={th}>ClaimsDesk field</th>
                <th className={th}>Match</th>
              </tr>
            </thead>
            <tbody>
              {file.headers.map((h) => {
                const t = mapping[h] ?? "";
                const changed = t !== (autoMapping[h] ?? "");
                return (
                  <tr key={h} className={rowCls}>
                    <td className={`${td} font-mono text-xs`}>{h}</td>
                    <td className={`${td} max-w-xs truncate font-mono text-xs text-slate-700`}>{sample(h) || "—"}</td>
                    <td className={td}>
                      <label htmlFor={`map-${h}`} className="sr-only">
                        ClaimsDesk field for {h}
                      </label>
                      <select
                        id={`map-${h}`}
                        className={inputCls}
                        value={t}
                        onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as TargetKey | "" })}
                      >
                        <option value="">— Not converted —</option>
                        {TARGET_FIELDS.map((f) => (
                          <option key={f.key} value={f.key} disabled={used.has(f.key) && t !== f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={td}>
                      {!t ? (
                        <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">Not mapped</span>
                      ) : changed ? (
                        <span className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">Changed by you</span>
                      ) : (
                        <span className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">Auto-matched</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {missing.length > 0 && (
          <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            Map these required fields before continuing: {missing.join(", ")}.
          </p>
        )}
      </Card>

      {deptCol && (
        <Card title="Department code crosswalk">
          <p className="mb-3 text-sm text-slate-700">How legacy department codes translate to City departments. Unknown codes convert as “Unassigned” and are listed as exceptions.</p>
          <table className={`${tableCls} max-w-2xl`}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Legacy code</th>
                <th className={th}>ClaimsDesk department</th>
                <th className={`${th} text-right`}>Rows</th>
              </tr>
            </thead>
            <tbody>
              {deptRows.map(([code, n]) => {
                const ours = DEPT_XWALK[code];
                return (
                  <tr key={code} className={`${rowCls} ${ours ? "" : "bg-amber-50"}`}>
                    <td className={`${td} font-mono`}>{code || "(blank)"}</td>
                    <td className={td}>{ours ? deptLabel(ours) : <strong className="text-amber-900">Unknown → Unassigned</strong>}</td>
                    <td className={`${td} text-right tabular-nums`}>{count(n)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-600">City departments: {DEPARTMENTS.map((d) => d.label).join(", ")}.</p>
        </Card>
      )}

      <div className="flex gap-2">
        <button type="button" className={btnSecondary} onClick={onBack}>
          Back
        </button>
        <button type="button" className={btnPrimary} onClick={onNext} disabled={missing.length > 0}>
          Validate {count(file.rows.length)} rows
        </button>
      </div>
    </div>
  );
}

// ---------- Step 3 ----------

const OUTCOME: Record<string, string> = {
  "Duplicate claim number": "Excluded (duplicate)",
  "Unknown department code": "Converted with exception",
  "Unmapped cause": "Converted with exception",
  "Unmapped body part / damage type": "Converted with exception",
};

function ValidateStep({ file, result, ms, onBack, onNext }: { file: SourceFile; result: ConversionResult; ms: number; onBack: () => void; onNext: () => void }) {
  const example = (rule: string): Issue | undefined =>
    result.duplicates.find((x) => x.rule === rule) ??
    result.mappingExceptions.find((x) => x.rule === rule) ??
    result.rejected.find((x) => x.reasons.includes(rule));
  const rules = Object.entries(result.ruleCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <Card title="Validation results">
        <p className="mb-3 text-sm text-slate-700">
          Checked {count(file.rows.length)} rows in {(ms / 1000).toFixed(2)} seconds. <strong>{count(result.converted.length)}</strong> rows are ready to
          convert, {count(result.rejected.length)} need correction, and {count(result.duplicates.length)} are duplicates.
        </p>
        <table className={tableCls}>
          <thead className={theadCls}>
            <tr>
              <th className={th}>Check</th>
              <th className={`${th} text-right`}>Rows</th>
              <th className={th}>What happens</th>
              <th className={th}>Example</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(([rule, n]) => {
              const ex = example(rule);
              const outcome = OUTCOME[rule] ?? "Rejected — fix in source and re-run";
              return (
                <tr key={rule} className={rowCls}>
                  <td className={`${td} font-medium`}>{rule}</td>
                  <td className={`${td} text-right tabular-nums`}>{count(n)}</td>
                  <td className={td}>
                    <span className={outcome.startsWith("Rejected") ? "text-red-800" : outcome.startsWith("Excluded") ? "text-slate-800" : "text-amber-900"}>
                      {outcome}
                    </span>
                  </td>
                  <td className={`${td} text-xs text-slate-700`}>{ex ? `Line ${ex.row}, ${ex.claimNumber || "no number"}: ${ex.detail}` : ""}</td>
                </tr>
              );
            })}
            {result.unmappedColumns.length > 0 && (
              <tr className={rowCls}>
                <td className={`${td} font-medium`}>Columns not converted</td>
                <td className={`${td} text-right tabular-nums`}>{result.unmappedColumns.length}</td>
                <td className={td}>Kept in the legacy archive</td>
                <td className={`${td} font-mono text-xs`}>{result.unmappedColumns.join(", ")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="flex gap-2">
        <button type="button" className={btnSecondary} onClick={onBack}>
          Back to mapping
        </button>
        <button type="button" className={btnPrimary} onClick={onNext}>
          View conversion report
        </button>
      </div>
    </div>
  );
}

// ---------- Step 4 ----------

const PAGE = 25;

function ReportStep({ s, file, result, onBack, onApprove }: { s: AppState; file: SourceFile; result: ConversionResult; onBack: () => void; onApprove: () => void }) {
  const [tab, setTab] = useState<"rejected" | "duplicates" | "mapping">("rejected");
  const [page, setPage] = useState(0);
  const t = result.totals;
  const diff = tieOut(t);
  const ties = Object.values(diff).every((v) => v === 0);
  const isRM = s.role === "risk_manager";
  const lists = { rejected: result.rejected, duplicates: result.duplicates, mapping: result.mappingExceptions };
  const list: Issue[] = lists[tab];
  const pages = Math.max(1, Math.ceil(list.length / PAGE));

  const download = () => {
    const csv = Papa.unparse(exceptionRows(result));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversion_exceptions_${file.name.replace(/\.csv$/i, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const expected: Totals = {
    rows: t.source.rows - t.duplicates.rows - t.rejected.rows,
    paid: t.source.paid - t.duplicates.paid - t.rejected.paid,
    outstanding: t.source.outstanding - t.duplicates.outstanding - t.rejected.outstanding,
    incurred: t.source.incurred - t.duplicates.incurred - t.rejected.incurred,
  };
  const line = (label: string, x: Totals, sign = "", strong = false) => (
    <tr className={`${rowCls} ${strong ? "font-semibold" : ""}`}>
      <th scope="row" className={`${td} text-left font-normal ${strong ? "font-semibold" : ""}`}>
        {label}
      </th>
      <td className={`${td} text-right tabular-nums`}>
        {sign}
        {count(x.rows)}
      </td>
      <td className={`${td} text-right tabular-nums`}>
        {sign}
        {moneyCents(x.paid)}
      </td>
      <td className={`${td} text-right tabular-nums`}>
        {sign}
        {moneyCents(x.outstanding)}
      </td>
      <td className={`${td} text-right tabular-nums`}>
        {sign}
        {moneyCents(x.incurred)}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Source records" value={t.source.rows} />
        <Stat label="Converted" value={t.converted.rows} tone="green" />
        <Stat label="Rejected (need correction)" value={t.rejected.rows} tone="red" />
        <Stat label="Duplicates excluded" value={t.duplicates.rows} />
        <Stat label="Converted with exceptions" value={new Set(result.mappingExceptions.map((m) => m.row)).size} tone="amber" />
      </div>

      <Card title="Financial control totals">
        <div
          role="status"
          className={`mb-3 rounded border px-3 py-2 text-sm font-semibold ${
            ties ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {ties
            ? "✓ Ties out: every source record and dollar is accounted for (converted, rejected or excluded as a duplicate)."
            : "✗ Does not tie out: investigate the differences below before approving."}
        </div>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}></th>
                <th className={`${th} text-right`}>Records</th>
                <th className={`${th} text-right`}>Total paid</th>
                <th className={`${th} text-right`}>Outstanding reserve</th>
                <th className={`${th} text-right`}>Total incurred</th>
              </tr>
            </thead>
            <tbody>
              {line("Source file", t.source, "", true)}
              {line("Less: duplicates excluded", t.duplicates, "− ")}
              {line("Less: rejected rows", t.rejected, "− ")}
              {line("Expected in ClaimsDesk", expected, "", true)}
              {line("Actually converted (summed from converted claims)", t.converted, "", true)}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <th scope="row" className={`${td} text-left`}>
                  Difference
                </th>
                {(["rows", "paid", "outstanding", "incurred"] as const).map((k) => (
                  <td key={k} className={`${td} text-right tabular-nums ${diff[k] === 0 ? "text-green-800" : "text-red-800"}`}>
                    {k === "rows" ? count(diff[k]) : moneyCents(diff[k])} {diff[k] === 0 ? "✓" : "✗"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Exceptions"
        action={
          <button type="button" className={btnSecondary} onClick={download}>
            Download exceptions (CSV)
          </button>
        }
      >
        <div role="tablist" aria-label="Exception lists" className="mb-3 flex flex-wrap gap-1">
          {(
            [
              ["rejected", `Rejected rows (${count(result.rejected.length)})`],
              ["duplicates", `Duplicates (${count(result.duplicates.length)})`],
              ["mapping", `Mapping exceptions (${count(result.mappingExceptions.length)})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={`rounded border px-3 py-1 text-sm ${tab === k ? "border-[#0b3a5b] bg-[#0b3a5b] font-semibold text-white" : "border-slate-300 hover:bg-slate-100"}`}
              onClick={() => {
                setTab(k);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {result.unmappedColumns.length > 0 && tab === "mapping" && (
          <p className="mb-2 text-sm text-slate-700">
            Columns not converted (kept in the legacy archive): <span className="font-mono">{result.unmappedColumns.join(", ")}</span>
          </p>
        )}
        <div role="tabpanel" className="overflow-x-auto">
          {list.length === 0 ? (
            <p className="text-sm text-slate-600">None.</p>
          ) : (
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Line</th>
                  <th className={th}>Legacy claim</th>
                  <th className={th}>Issue</th>
                  <th className={th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(page * PAGE, page * PAGE + PAGE).map((x) => (
                  <tr key={`${x.row}-${x.rule}`} className={rowCls}>
                    <td className={`${td} tabular-nums`}>{x.row}</td>
                    <td className={`${td} font-mono text-xs`}>{x.claimNumber || "—"}</td>
                    <td className={td}>{x.rule}</td>
                    <td className={`${td} text-slate-700`}>{x.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {pages > 1 && (
          <nav aria-label="Exception pages" className="mt-2 flex items-center gap-3 text-sm">
            <button type="button" className={btnSecondary} disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <button type="button" className={btnSecondary} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </nav>
        )}
      </Card>

      <Card title="Approve conversion">
        <p className="mb-3 text-sm text-slate-700">
          Approving loads {count(result.converted.length)} converted historical claims into ClaimsDesk, where they appear in search and reports as
          closed, read-only claims. Rejected rows stay in the exceptions list for correction and a later re-run.
          {!file.bundled && " Because this is an uploaded file, converted claims last only until the page is reloaded in this demo."}
        </p>
        {s.migration && (
          <p role="alert" className="mb-3 text-sm font-semibold text-amber-900">
            A conversion is already approved. Roll it back first to approve a different run.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnSecondary} onClick={onBack}>
            Back
          </button>
          <button type="button" className={btnSuccess} onClick={onApprove} disabled={!isRM || !ties || !!s.migration}>
            Approve conversion
          </button>
          {!isRM && <span className="text-sm text-slate-700">Only the Risk Manager can approve. Switch roles in the header to approve.</span>}
          {isRM && !ties && <span className="text-sm text-red-800">Approval is blocked until control totals tie out.</span>}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "red" | "amber" }) {
  const border = { slate: "border-slate-300", green: "border-green-600", red: "border-red-500", amber: "border-amber-500" }[tone];
  return (
    <div className={`rounded border border-l-8 bg-white px-3 py-2 ${border}`}>
      <div className="text-2xl font-bold tabular-nums">{count(value)}</div>
      <div className="text-xs text-slate-700">{label}</div>
    </div>
  );
}

// ---------- Approved ----------

function ApprovedSummary({ s, onRollback }: { s: AppState; onRollback: () => void }) {
  const m = s.migration!;
  return (
    <Card title="Conversion approved">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">File</dt>
          <dd>{m.fileName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Approved by</dt>
          <dd>{userName(m.approvedBy)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Approved on</dt>
          <dd>{fmtDate(m.approvedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Claims converted</dt>
          <dd>{count(m.converted)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-slate-700">
        {s.legacyStatus === "loading"
          ? "Loading converted claims…"
          : s.legacyStatus === "error"
            ? "The converted claims could not be reloaded. Try refreshing the page."
            : `${count(s.legacyCount)} converted historical claims are available in search and reports.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link href="/claims?source=legacy" className={btnPrimary}>
          View converted claims
        </Link>
        {s.role === "risk_manager" ? (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => window.confirm("Roll back the conversion? Converted claims will be removed.") && onRollback()}
          >
            Roll back conversion
          </button>
        ) : (
          <span className="text-sm text-slate-600">Only the Risk Manager can roll back the conversion.</span>
        )}
      </div>
    </Card>
  );
}
