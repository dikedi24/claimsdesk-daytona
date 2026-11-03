"use client";
// Legacy migration: select file → map fields → validate → conversion report → approve [3.2D, 3.21].
// Conversion is "without loss of data": rows that fail validation are held for correction, never discarded.
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
import { approveConversion, correctLegacyRow, correctionOutcome, rollbackConversion, type Result } from "@/lib/actions";
import { DEPARTMENTS, deptLabel } from "@/lib/codes";
import { fmtDate, count, moneyCents } from "@/lib/format";
import {
  DEPT_XWALK,
  FIELDS_FOR_RULE,
  TARGET_FIELDS,
  autoMap,
  convert,
  exceptionRows,
  missingRequired,
  summaryLine,
  tieOut,
  type ConversionResult,
  type Corrections,
  type HeldRow,
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
  const [corrections, setCorrections] = useState<Corrections>({});
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
    setCorrections({});
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
    setResult(convert(file.rows, mapping, corrections));
    setConvertMs(performance.now() - t);
    setStep(2);
  };

  // Pre-approval fix of a held row: apply the correction and re-run validation [3.2D].
  const correct = (line: number, fix: Record<string, string>): Result => {
    if (!file) return { ok: false, error: "No file loaded." };
    if (s.role !== "risk_manager") return { ok: false, error: "Only the Risk Manager can correct held rows." };
    const next = { ...corrections, [line]: { ...corrections[line], ...fix } };
    const r = convert(file.rows, mapping, next);
    setCorrections(next);
    setResult(r);
    return correctionOutcome(r, line);
  };

  const approve = () => {
    if (!file || !result) return;
    if (!window.confirm(`Approve conversion of ${count(result.converted.length)} claims from ${file.name}?`)) return;
    const r = approveConversion(result, file.rows, mapping, corrections, file.name, file.bundled);
    setMessage(r);
    if (r.ok) {
      setFile(null);
      setResult(null);
      setStep(0);
    }
  };

  // Once approved, show the decision and the remaining correction queue (unless a new run has been started).
  if (s.migration && !file) {
    return (
      <div className="max-w-6xl space-y-5">
        <PageTitle title="Legacy Data Migration" subtitle="Conversion of historical claims from the City's legacy SQL Server system." />
        <ResultMessage result={message} />
        <ApprovedSummary s={s} onRollback={() => setMessage(rollbackConversion())} />
        {s.legacyResult && s.legacyRows && (
          <>
            <ControlTotals result={s.legacyResult} />
            <ExceptionsCard
              s={s}
              result={s.legacyResult}
              rows={s.legacyRows}
              mapping={s.migration.mapping}
              corrections={s.migration.corrections ?? {}}
              fileName={s.migration.fileName}
              onCorrect={correctLegacyRow}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      <PageTitle
        title="Legacy Data Migration"
        subtitle="Convert the ~16,000 historical claims in the City's legacy SQL Server system without loss of data. Nothing is converted until the Risk Manager approves the conversion report."
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
      {step === 3 && file && result && (
        <ReportStep
          s={s}
          file={file}
          result={result}
          mapping={mapping}
          corrections={corrections}
          onCorrect={correct}
          onBack={() => setStep(2)}
          onApprove={approve}
        />
      )}
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
  if (deptCol)
    for (const r of file.rows) {
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
          <p className="mb-3 text-sm text-slate-700">
            How legacy department codes translate to City departments. Unknown codes convert as “Unassigned” and are listed as exceptions.
          </p>
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
    result.held.find((x) => x.reasons.includes(rule));
  const rules = Object.entries(result.ruleCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <Card title="Validation results">
        <p className="mb-3 text-sm text-slate-700">
          Checked {count(file.rows.length)} rows in {(ms / 1000).toFixed(2)} seconds. <strong>{count(result.converted.length)}</strong> rows are ready to
          convert, {count(result.held.length)} will be held for correction (kept, not discarded), and {count(result.duplicates.length)} are
          duplicates.
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
              const outcome = OUTCOME[rule] ?? "Held for correction";
              return (
                <tr key={rule} className={rowCls}>
                  <td className={`${td} font-medium`}>{rule}</td>
                  <td className={`${td} text-right tabular-nums`}>{count(n)}</td>
                  <td className={td}>
                    <span className={outcome.startsWith("Held") ? "text-red-800" : outcome.startsWith("Excluded") ? "text-slate-800" : "text-amber-900"}>
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

function ReportStep({
  s,
  file,
  result,
  mapping,
  corrections,
  onCorrect,
  onBack,
  onApprove,
}: {
  s: AppState;
  file: SourceFile;
  result: ConversionResult;
  mapping: Mapping;
  corrections: Corrections;
  onCorrect: (line: number, fix: Record<string, string>) => Result;
  onBack: () => void;
  onApprove: () => void;
}) {
  const diff = tieOut(result.totals);
  const ties = Object.values(diff).every((v) => v === 0);
  const isRM = s.role === "risk_manager";

  return (
    <div className="space-y-4">
      <SummaryBanner result={result} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Source records" value={result.totals.source.rows} />
        <Stat label="Converted" value={result.converted.length} tone="green" />
        <Stat label="Held for correction" value={result.held.length} tone="amber" />
        <Stat label="Duplicates excluded" value={result.duplicates.length} />
        <Stat label="Records lost" value={diff.rows} tone={diff.rows === 0 ? "green" : "red"} />
      </div>

      <ControlTotals result={result} />

      <ExceptionsCard s={s} result={result} rows={file.rows} mapping={mapping} corrections={corrections} fileName={file.name} onCorrect={onCorrect} />

      <Card title="Approve conversion">
        <p className="mb-3 text-sm text-slate-700">
          Approving loads {count(result.converted.length)} converted historical claims into ClaimsDesk, where they appear in search and reports as
          closed, read-only claims. The {count(result.held.length)} rows held for correction are not discarded: they stay in the correction queue,
          and the Risk Manager can fix and convert them before or after approval.
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

/** "15,390 converted · 370 held for correction · 240 duplicates excluded · 0 records lost" */
function SummaryBanner({ result }: { result: ConversionResult }) {
  const lost = tieOut(result.totals).rows;
  return (
    <p
      role="status"
      className={`rounded border px-4 py-3 text-base font-semibold ${
        lost === 0 ? "border-green-300 bg-green-50 text-green-950" : "border-red-300 bg-red-50 text-red-950"
      }`}
    >
      {summaryLine(result)}
    </p>
  );
}

/** Source total = Converted + Held for correction + Duplicates excluded, per column [3.2D]. */
function ControlTotals({ result }: { result: ConversionResult }) {
  const t = result.totals;
  const diff = tieOut(t);
  const ties = Object.values(diff).every((v) => v === 0);
  const hasCorrections = result.correctedRows.length > 0;
  const accounted: Totals = {
    rows: t.converted.rows + t.held.rows + t.duplicates.rows,
    paid: t.converted.paid + t.held.paid + t.duplicates.paid,
    outstanding: t.converted.outstanding + t.held.outstanding + t.duplicates.outstanding,
    incurred: t.converted.incurred + t.held.incurred + t.duplicates.incurred,
  };
  const line = (label: string, x: Totals, opts: { strong?: boolean; rows?: string } = {}) => (
    <tr className={`${rowCls} ${opts.strong ? "font-semibold" : ""}`}>
      <th scope="row" className={`${td} text-left ${opts.strong ? "font-semibold" : "font-normal"}`}>
        {label}
      </th>
      <td className={`${td} text-right tabular-nums`}>{opts.rows ?? count(x.rows)}</td>
      <td className={`${td} text-right tabular-nums`}>{moneyCents(x.paid)}</td>
      <td className={`${td} text-right tabular-nums`}>{moneyCents(x.outstanding)}</td>
      <td className={`${td} text-right tabular-nums`}>{moneyCents(x.incurred)}</td>
    </tr>
  );
  return (
    <Card title="Financial control totals">
      <div
        role="status"
        className={`mb-3 rounded border px-3 py-2 text-sm font-semibold ${
          ties ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"
        }`}
      >
        {ties
          ? "✓ Ties out: every source record and dollar is accounted for as converted, held for correction, or an excluded duplicate."
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
            {line("Source file (as received)", t.source, { strong: true })}
            {hasCorrections && line(`Net change from Risk Manager corrections (${count(t.corrections.rows)} rows)`, t.corrections, { rows: "—" })}
            {line("Converted into ClaimsDesk", t.converted)}
            {line("Held for correction (kept in queue)", t.held)}
            {line("Duplicates excluded", t.duplicates)}
            {line("Total accounted for", accounted, { strong: true })}
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
      <p className="mt-2 text-xs text-slate-600">
        Source total{hasCorrections ? " + corrections" : ""} = Converted + Held for correction + Duplicates excluded. Converted totals are summed from
        the converted claims themselves.
      </p>
    </Card>
  );
}

/** Held-for-correction queue (with inline fix for the Risk Manager), duplicates, and mapping exceptions. */
function ExceptionsCard({
  s,
  result,
  rows,
  mapping,
  corrections,
  fileName,
  onCorrect,
}: {
  s: AppState;
  result: ConversionResult;
  rows: Record<string, string>[];
  mapping: Mapping;
  corrections: Corrections;
  fileName: string;
  onCorrect: (line: number, fix: Record<string, string>) => Result;
}) {
  const [tab, setTab] = useState<"held" | "duplicates" | "mapping">("held");
  const [page, setPage] = useState(0);
  const [fixing, setFixing] = useState<number | null>(null);
  const [message, setMessage] = useState<Result | null>(null);
  const lists = { held: result.held, duplicates: result.duplicates, mapping: result.mappingExceptions };
  const list: Issue[] = lists[tab];
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const current = Math.min(page, pages - 1); // stay in range as rows leave the queue
  const canFix = s.role === "risk_manager";

  const download = () => {
    const csv = Papa.unparse(exceptionRows(result));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversion_exceptions_${fileName.replace(/\.csv$/i, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title="Exceptions queue"
      action={
        <button type="button" className={btnSecondary} onClick={download}>
          Download exceptions (CSV)
        </button>
      }
    >
      <ResultMessage result={message} />
      <div role="tablist" aria-label="Exception lists" className="my-3 flex flex-wrap gap-1">
        {(
          [
            ["held", `Held for correction (${count(result.held.length)})`],
            ["duplicates", `Duplicates excluded (${count(result.duplicates.length)})`],
            ["mapping", `Mapping exceptions (${count(result.mappingExceptions.length)})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`rounded border px-3 py-1 text-sm ${
              tab === k ? "border-[#0b3a5b] bg-[#0b3a5b] font-semibold text-white" : "border-slate-300 hover:bg-slate-100"
            }`}
            onClick={() => {
              setTab(k);
              setPage(0);
              setFixing(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "held" && (
        <p className="mb-2 text-sm text-slate-700">
          These rows are kept, not discarded.{" "}
          {canFix
            ? "Fix a value and re-validate: if the row passes, it converts immediately."
            : "Only the Risk Manager can correct held rows."}
          {result.correctedRows.length > 0 && ` ${count(result.correctedRows.length)} row(s) corrected so far.`}
        </p>
      )}
      {tab === "mapping" && result.unmappedColumns.length > 0 && (
        <p className="mb-2 text-sm text-slate-700">
          Columns not converted (kept in the legacy archive): <span className="font-mono">{result.unmappedColumns.join(", ")}</span>
        </p>
      )}
      <div role="tabpanel" className="overflow-x-auto">
        {list.length === 0 ? (
          <p className="text-sm text-slate-600">{tab === "held" ? "No rows are held. Every valid record has converted." : "None."}</p>
        ) : (
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Line</th>
                <th className={th}>Legacy claim</th>
                <th className={th}>Issue</th>
                <th className={th}>Detail</th>
                {tab === "held" && canFix && <th className={th}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {list.slice(current * PAGE, current * PAGE + PAGE).map((x) => (
                <IssueRow
                  key={`${x.row}-${x.rule}`}
                  issue={x}
                  held={tab === "held" ? (x as HeldRow) : null}
                  canFix={canFix}
                  open={fixing === x.row}
                  onToggle={() => setFixing(fixing === x.row ? null : x.row)}
                  row={rows[x.row - 2]}
                  mapping={mapping}
                  corrections={corrections}
                  onSubmit={(fix) => {
                    const r = onCorrect(x.row, fix);
                    setMessage(r);
                    if (r.ok) setFixing(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pages > 1 && (
        <nav aria-label="Exception pages" className="mt-2 flex items-center gap-3 text-sm">
          <button type="button" className={btnSecondary} disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <span>
            Page {current + 1} of {pages}
          </span>
          <button type="button" className={btnSecondary} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </button>
        </nav>
      )}
    </Card>
  );
}

function IssueRow({
  issue,
  held,
  canFix,
  open,
  onToggle,
  row,
  mapping,
  corrections,
  onSubmit,
}: {
  issue: Issue;
  held: HeldRow | null;
  canFix: boolean;
  open: boolean;
  onToggle: () => void;
  row: Record<string, string> | undefined;
  mapping: Mapping;
  corrections: Corrections;
  onSubmit: (fix: Record<string, string>) => void;
}) {
  const showAction = !!held && canFix;
  return (
    <>
      <tr className={rowCls}>
        <td className={`${td} tabular-nums`}>{issue.row}</td>
        <td className={`${td} font-mono text-xs`}>{issue.claimNumber || "—"}</td>
        <td className={td}>{issue.rule}</td>
        <td className={`${td} text-slate-700`}>{issue.detail}</td>
        {showAction && (
          <td className={td}>
            <button type="button" className={btnSecondary} aria-expanded={open} onClick={onToggle}>
              {open ? "Cancel" : "Fix"}
            </button>
          </td>
        )}
      </tr>
      {showAction && open && row && (
        <tr className="bg-amber-50/60">
          <td colSpan={5} className="px-3 py-3">
            <FixForm held={held!} row={row} mapping={mapping} current={corrections[issue.row] ?? {}} onSubmit={onSubmit} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Inline correction of the source values behind a held row's reasons. */
function FixForm({
  held,
  row,
  mapping,
  current,
  onSubmit,
}: {
  held: HeldRow;
  row: Record<string, string>;
  mapping: Mapping;
  current: Record<string, string>;
  onSubmit: (fix: Record<string, string>) => void;
}) {
  const colFor = (k: TargetKey) => Object.entries(mapping).find(([, t]) => t === k)?.[0];
  const keys = [...new Set(held.reasons.flatMap((r) => FIELDS_FOR_RULE[r] ?? []))];
  const fields = keys
    .map((k) => ({ key: k, col: colFor(k), label: TARGET_FIELDS.find((f) => f.key === k)!.label }))
    .filter((f): f is { key: TargetKey; col: string; label: string } => !!f.col);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.col, current[f.col] ?? row[f.col] ?? ""])));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-2"
    >
      <p className="text-sm font-semibold text-slate-800">
        Correct line {held.row} ({held.claimNumber || "no claim number"}): {held.detail}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((f) => (
          <div key={f.col} className="flex flex-col">
            <label htmlFor={`fix-${held.row}-${f.col}`} className="text-xs font-semibold text-slate-700">
              {f.label} <span className="font-mono font-normal text-slate-500">({f.col})</span>
            </label>
            <input
              id={`fix-${held.row}-${f.col}`}
              className={`${inputCls} w-56`}
              value={values[f.col]}
              onChange={(e) => setValues({ ...values, [f.col]: e.target.value })}
              aria-describedby={`was-${held.row}-${f.col}`}
            />
            <span id={`was-${held.row}-${f.col}`} className="text-xs text-slate-500">
              In source file: {row[f.col] ? <span className="font-mono">{row[f.col]}</span> : "(blank)"}
            </span>
          </div>
        ))}
        <button type="submit" className={btnPrimary}>
          Save and re-validate
        </button>
      </div>
      <p className="text-xs text-slate-600">
        The source file is not changed. The correction is recorded in the audit trail and applied whenever the conversion runs.
      </p>
    </form>
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
          <dd>{count(s.legacyResult?.converted.length ?? m.converted)}</dd>
        </div>
      </dl>
      {s.legacyResult && (
        <div className="mt-3">
          <SummaryBanner result={s.legacyResult} />
        </div>
      )}
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
