// Legacy conversion: field mapping, validation and control totals for the SQL Server export [3.2D, 3.21].
// Pure functions: the same code runs on the Migration page and when reloading an approved conversion.
import { OTHER, UNASSIGNED } from "./codes";
import { TODAY } from "./dates";
import type { Claim, ClaimType } from "./types";

export type TargetKey =
  | "legacyId"
  | "claimNumber"
  | "type"
  | "claimantLast"
  | "claimantFirst"
  | "department"
  | "dateOfLoss"
  | "dateReported"
  | "closedDate"
  | "cause"
  | "bodyPart"
  | "description"
  | "examiner"
  | "litigated"
  | "totalPaid"
  | "outstandingReserve"
  | "totalIncurred"
  | "status";

export interface TargetField {
  key: TargetKey;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const TARGET_FIELDS: TargetField[] = [
  { key: "claimNumber", label: "Claim number", required: true, synonyms: ["CLM_NBR", "CLAIM_NO", "CLAIM_NUMBER", "CLM_NO"] },
  { key: "legacyId", label: "Legacy record ID", required: false, synonyms: ["CLM_ID", "CLAIM_ID", "RECORD_ID"] },
  { key: "type", label: "Claim type (WC/GL)", required: true, synonyms: ["LOB_CD", "LOB", "LINE_OF_BUSINESS", "CLM_TYPE"] },
  { key: "claimantLast", label: "Claimant last name", required: true, synonyms: ["CLMNT_LAST_NM", "LAST_NAME", "CLAIMANT_LAST"] },
  { key: "claimantFirst", label: "Claimant first name", required: false, synonyms: ["CLMNT_FIRST_NM", "FIRST_NAME", "CLAIMANT_FIRST"] },
  { key: "department", label: "Department", required: true, synonyms: ["DEPT_CD", "DEPT", "DEPARTMENT"] },
  { key: "dateOfLoss", label: "Date of loss", required: true, synonyms: ["LOSS_DT", "DATE_OF_LOSS", "DOL"] },
  { key: "dateReported", label: "Date reported", required: false, synonyms: ["RPT_DT", "REPORTED_DT", "DATE_REPORTED"] },
  { key: "closedDate", label: "Date closed", required: false, synonyms: ["CLOSE_DT", "CLOSED_DT", "DATE_CLOSED"] },
  { key: "cause", label: "Cause", required: false, synonyms: ["CAUSE_DESC", "CAUSE", "CAUSE_CD"] },
  { key: "bodyPart", label: "Body part / damage type", required: false, synonyms: ["INJ_PART_DESC", "BODY_PART", "PART_OF_BODY"] },
  { key: "description", label: "Description", required: false, synonyms: ["LOSS_DESC", "DESCRIPTION", "ACCIDENT_DESC"] },
  { key: "examiner", label: "Adjuster / examiner", required: false, synonyms: ["EXAMINER_CD", "EXAMINER", "ADJUSTER"] },
  { key: "litigated", label: "Litigated (Y/N)", required: false, synonyms: ["LIT_FLG", "LITIGATED", "IN_SUIT"] },
  { key: "totalPaid", label: "Total paid", required: true, synonyms: ["TOT_PD_AMT", "TOTAL_PAID", "PAID_AMT"] },
  { key: "outstandingReserve", label: "Outstanding reserve", required: true, synonyms: ["OS_RSV_AMT", "OUTSTANDING_RESERVE", "OS_RESERVE"] },
  { key: "totalIncurred", label: "Total incurred", required: true, synonyms: ["TOT_INCUR_AMT", "TOTAL_INCURRED", "INCURRED"] },
  { key: "status", label: "Status", required: false, synonyms: ["CLM_STAT_CD", "STATUS", "CLAIM_STATUS"] },
];

/** Source column → target field ("" = not mapped). */
export type Mapping = Record<string, TargetKey | "">;

const norm = (h: string) => h.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function autoMap(headers: string[]): Mapping {
  const used = new Set<TargetKey>();
  const out: Mapping = {};
  for (const h of headers) {
    const f = TARGET_FIELDS.find((t) => !used.has(t.key) && (norm(t.key) === norm(h) || t.synonyms.some((s) => norm(s) === norm(h))));
    out[h] = f ? f.key : "";
    if (f) used.add(f.key);
  }
  return out;
}

export const missingRequired = (m: Mapping) =>
  TARGET_FIELDS.filter((t) => t.required && !Object.values(m).includes(t.key)).map((t) => t.label);

// Code crosswalks from legacy values to ours.
export const DEPT_XWALK: Record<string, string> = {
  PD: "POL", FD: "FIR", PW: "PW", UT: "UTL", PR: "PRK", BM: "FAC", FN: "FIN", HR: "HR",
};
const CAUSE_XWALK: Record<string, string> = {
  LIFTING: "LIFT", "SLIP/FALL": "SLIP", "AUTO ACCIDENT": "MVA", "STRUCK BY": "STRUCK", "CUT/PUNCTURE": "CUT",
  "REPETITIVE MOTION": "REPET", ASSAULT: "ASSAULT", EXPOSURE: "EXPOS", "SIDEWALK TRIP": "TRIP", "AUTO LIABILITY": "VEH",
  "PROPERTY DAMAGE": "PROP", "SEWER BACKUP": "SEWER", "TREE FALL": "TREE", "POLICE PROFESSIONAL": "POLICE", PREMISES: "PREM",
};
const PART_XWALK: Record<string, string> = {
  "LOW BACK": "BACK", SHOULDER: "SHLDR", KNEE: "KNEE", "HAND/WRIST": "HAND", NECK: "NECK", "ANKLE/FOOT": "FOOT", HEAD: "HEAD",
  LUNGS: "LUNG", MULTIPLE: "MULTI", "BODILY INJURY": "BI", "AUTO DAMAGE": "VD", PROPERTY: "PD", "WATER DAMAGE": "WD", "CIVIL RIGHTS": "CR",
};

export interface Issue {
  row: number; // line number in the source file (header = line 1)
  claimNumber: string;
  rule: string;
  detail: string;
}

export interface Totals {
  rows: number;
  paid: number;
  outstanding: number;
  incurred: number;
}

/** A source row that failed validation. It is never discarded: it waits in the correction queue [3.2D]. */
export type HeldRow = Issue & { reasons: string[] };

export interface ConversionResult {
  converted: Claim[];
  held: HeldRow[];
  duplicates: Issue[];
  mappingExceptions: Issue[];
  unmappedColumns: string[];
  ruleCounts: Record<string, number>;
  correctedRows: number[]; // source lines with Risk Manager corrections applied
  totals: {
    source: Totals; // the file exactly as received
    corrections: Totals; // net dollar effect of corrections (rows = number of corrected rows)
    duplicates: Totals;
    held: Totals;
    converted: Totals;
  };
}

/** Risk Manager corrections: source line number → { source column → corrected value }. */
export type Corrections = Record<string, Record<string, string>>;

/** Which ClaimsDesk fields a held row's reasons point at, so the fix form shows only those. */
export const FIELDS_FOR_RULE: Record<string, TargetKey[]> = {
  "Missing claim number": ["claimNumber"],
  "Unknown claim type": ["type"],
  "Missing claimant name": ["claimantLast", "claimantFirst"],
  "Bad or impossible date": ["dateOfLoss", "dateReported", "closedDate"],
  "Invalid amount": ["totalPaid", "outstandingReserve", "totalIncurred"],
  "Negative paid amount": ["totalPaid", "totalIncurred"],
  "Paid + reserve ≠ incurred": ["totalPaid", "outstandingReserve", "totalIncurred"],
};

const empty = (): Totals => ({ rows: 0, paid: 0, outstanding: 0, incurred: 0 });
const add = (t: Totals, paid: number, os: number, inc: number) => {
  t.rows++;
  t.paid += paid;
  t.outstanding += os;
  t.incurred += inc;
};
const num = (v: string) => {
  const n = Number(v.replace(/[$,]/g, ""));
  return v.trim() === "" ? NaN : n;
};
const safe = (n: number) => (Number.isFinite(n) ? n : 0);
const cents = (n: number) => Math.round(n * 100) / 100 || 0; // "|| 0" avoids -0
const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const ABBREV: [RegExp, string][] = [[/\bEE\b/g, "employee"], [/\bCLMT\b/g, "claimant"], [/\bVEH\b/g, "vehicle"]];
const sentence = (s: string) => {
  const t = ABBREV.reduce((acc, [re, word]) => acc.replace(re, word), s.toUpperCase()).toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

/** Parses "YYYY-MM-DD[ hh:mm:ss.fff]"; returns the ISO date or an error description. */
function parseDate(v: string): { date?: string; error?: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (!m) return { error: v.trim() ? `unreadable date "${v.trim()}"` : "missing" };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { error: `impossible date ${m[0]}` };
  if (y < 1950) return { error: `placeholder date ${m[0]}` };
  const iso = m[0];
  if (iso > TODAY) return { error: `future date ${iso}` };
  return { date: iso };
}

export function convert(rows: Record<string, string>[], mapping: Mapping, corrections: Corrections = {}): ConversionResult {
  const src: Partial<Record<TargetKey, string>> = {};
  for (const [h, t] of Object.entries(mapping)) if (t) src[t] = h;
  const get = (r: Record<string, string>, k: TargetKey) => (src[k] ? (r[src[k]!] ?? "").trim() : "");

  const res: ConversionResult = {
    converted: [],
    held: [],
    duplicates: [],
    mappingExceptions: [],
    unmappedColumns: Object.entries(mapping).filter(([, t]) => !t).map(([h]) => h),
    ruleCounts: {},
    correctedRows: [],
    totals: { source: empty(), corrections: empty(), duplicates: empty(), held: empty(), converted: empty() },
  };
  const bump = (rule: string) => (res.ruleCounts[rule] = (res.ruleCounts[rule] ?? 0) + 1);
  const seen = new Map<string, number>();

  rows.forEach((original, i) => {
    const line = i + 2;
    const amounts = (x: Record<string, string>) =>
      [num(get(x, "totalPaid")), num(get(x, "outstandingReserve")), num(get(x, "totalIncurred"))] as const;
    const [p0, o0, i0] = amounts(original);
    add(res.totals.source, safe(p0), safe(o0), safe(i0));

    // Apply any Risk Manager corrections; track their dollar effect so totals still tie out.
    const fix = corrections[line];
    const r = fix ? { ...original, ...fix } : original;
    const [paid, os, inc] = fix ? amounts(r) : [p0, o0, i0];
    if (fix) {
      res.correctedRows.push(line);
      add(res.totals.corrections, safe(paid) - safe(p0), safe(os) - safe(o0), safe(inc) - safe(i0));
    }
    const claimNumber = get(r, "claimNumber");

    // 1. Duplicates: keep the first occurrence of a claim number.
    if (claimNumber && seen.has(claimNumber)) {
      res.duplicates.push({ row: line, claimNumber, rule: "Duplicate claim number", detail: `Same claim as line ${seen.get(claimNumber)}` });
      add(res.totals.duplicates, safe(paid), safe(os), safe(inc));
      bump("Duplicate claim number");
      return;
    }
    if (claimNumber) seen.set(claimNumber, line);

    // 2. Validation: anything here holds the row for correction (it is kept, not discarded).
    const reasons: { rule: string; detail: string }[] = [];
    if (!claimNumber) reasons.push({ rule: "Missing claim number", detail: "Claim number is blank" });
    const typeRaw = get(r, "type").toUpperCase();
    if (typeRaw !== "WC" && typeRaw !== "GL") reasons.push({ rule: "Unknown claim type", detail: `Type "${typeRaw}" is not WC or GL` });
    if (!get(r, "claimantLast")) reasons.push({ rule: "Missing claimant name", detail: "Claimant last name is blank" });

    const loss = parseDate(get(r, "dateOfLoss"));
    if (loss.error) reasons.push({ rule: "Bad or impossible date", detail: `Date of loss: ${loss.error}` });
    const rptRaw = get(r, "dateReported");
    const rpt = rptRaw ? parseDate(rptRaw) : {};
    if (rpt.error) reasons.push({ rule: "Bad or impossible date", detail: `Date reported: ${rpt.error}` });
    const closeRaw = get(r, "closedDate");
    const close = closeRaw ? parseDate(closeRaw) : {};
    if (close.error) reasons.push({ rule: "Bad or impossible date", detail: `Date closed: ${close.error}` });
    if (loss.date && rpt.date && rpt.date < loss.date)
      reasons.push({ rule: "Bad or impossible date", detail: `Reported ${rpt.date} before loss ${loss.date}` });
    if (loss.date && close.date && close.date < loss.date)
      reasons.push({ rule: "Bad or impossible date", detail: `Closed ${close.date} before loss ${loss.date}` });

    if (![paid, os, inc].every(Number.isFinite)) reasons.push({ rule: "Invalid amount", detail: "A financial amount is blank or not a number" });
    else {
      if (paid < 0) reasons.push({ rule: "Negative paid amount", detail: `Total paid is ${paid.toFixed(2)}` });
      if (Math.abs(paid + os - inc) > 0.01)
        reasons.push({
          rule: "Paid + reserve ≠ incurred",
          detail: `${paid.toFixed(2)} + ${os.toFixed(2)} ≠ ${inc.toFixed(2)} (off by ${(inc - paid - os).toFixed(2)})`,
        });
    }

    if (reasons.length) {
      const rules = [...new Set(reasons.map((x) => x.rule))];
      rules.forEach(bump);
      res.held.push({ row: line, claimNumber, rule: rules.join("; "), detail: reasons.map((x) => x.detail).join("; "), reasons: rules });
      add(res.totals.held, safe(paid), safe(os), safe(inc));
      return;
    }

    // 3. Convert, recording code-mapping exceptions (converted, but flagged for review).
    const exception = (rule: string, detail: string) => {
      res.mappingExceptions.push({ row: line, claimNumber, rule, detail });
      bump(rule);
    };
    const deptRaw = get(r, "department").toUpperCase();
    let department = DEPT_XWALK[deptRaw];
    if (!department) {
      department = UNASSIGNED;
      exception("Unknown department code", `Legacy code "${deptRaw}" converted as Unassigned`);
    }
    const causeRaw = get(r, "cause").toUpperCase();
    let cause = CAUSE_XWALK[causeRaw];
    if (!cause) {
      cause = OTHER;
      exception("Unmapped cause", `Legacy cause "${causeRaw}" converted as Other`);
    }
    const partRaw = get(r, "bodyPart").toUpperCase();
    let part = PART_XWALK[partRaw];
    if (!part) {
      part = OTHER;
      if (partRaw) exception("Unmapped body part / damage type", `Legacy value "${partRaw}" converted as Other`);
    }

    const first = get(r, "claimantFirst");
    const claim: Claim = {
      id: claimNumber,
      number: claimNumber,
      type: typeRaw as ClaimType,
      status: "Closed",
      claimantName: title(`${first} ${get(r, "claimantLast")}`.trim()),
      department,
      dateOfLoss: loss.date!,
      dateReported: rpt.date ?? loss.date!,
      cause,
      bodyPartOrDamage: part,
      description: sentence(get(r, "description")),
      adjusterId: `Legacy examiner ${get(r, "examiner") || "unknown"}`,
      litigated: get(r, "litigated").toUpperCase() === "Y",
      closedDate: close.date ?? undefined,
      source: "legacy",
      legacy: {
        legacyId: get(r, "legacyId"),
        examiner: get(r, "examiner"),
        sourceDept: deptRaw,
        paid: cents(paid),
        outstanding: cents(os),
        incurred: cents(inc),
        corrected: !!fix,
      },
    };
    res.converted.push(claim);
  });

  // Converted totals are summed from the converted claims themselves so the tie-out is a real check.
  for (const c of res.converted) add(res.totals.converted, c.legacy!.paid, c.legacy!.outstanding, c.legacy!.incurred);
  for (const t of Object.values(res.totals)) {
    t.paid = cents(t.paid);
    t.outstanding = cents(t.outstanding);
    t.incurred = cents(t.incurred);
  }
  return res;
}

/**
 * Source (+ net corrections) − converted − held − duplicates, per column. All zero means every record
 * and every dollar is accounted for. "rows" is the number of records lost (must be 0).
 */
export function tieOut(t: ConversionResult["totals"]) {
  const k = ["rows", "paid", "outstanding", "incurred"] as const;
  return Object.fromEntries(
    k.map((f) => [f, cents(t.source[f] + (f === "rows" ? 0 : t.corrections[f]) - t.converted[f] - t.duplicates[f] - t.held[f])]),
  ) as Record<(typeof k)[number], number>;
}

/** e.g. "15,390 converted · 370 held for correction · 240 duplicates excluded · 0 records lost" */
export function summaryLine(r: ConversionResult) {
  const n = (x: number) => x.toLocaleString("en-US");
  return `${n(r.converted.length)} converted · ${n(r.held.length)} held for correction · ${n(r.duplicates.length)} duplicates excluded · ${n(
    tieOut(r.totals).rows,
  )} records lost`;
}

/** Rows for the exceptions CSV download. */
export function exceptionRows(r: ConversionResult) {
  const rows = [
    ...r.held.map((x) => ({ Line: x.row, ClaimNumber: x.claimNumber, Outcome: "Held for correction", Rule: x.rule, Detail: x.detail })),
    ...r.duplicates.map((x) => ({ Line: x.row, ClaimNumber: x.claimNumber, Outcome: "Excluded (duplicate)", Rule: x.rule, Detail: x.detail })),
    ...r.mappingExceptions.map((x) => ({ Line: x.row, ClaimNumber: x.claimNumber, Outcome: "Converted with exception", Rule: x.rule, Detail: x.detail })),
    ...r.unmappedColumns.map((h) => ({ Line: 1, ClaimNumber: "", Outcome: "Column not converted", Rule: "Unmapped column", Detail: `${h} retained in legacy archive` })),
  ];
  return rows.sort((a, b) => a.Line - b.Line);
}
