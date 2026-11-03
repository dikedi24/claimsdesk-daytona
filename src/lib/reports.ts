// Report calculations [3.5–3.10]. Pure functions over app state.
// "As of" figures are rebuilt from dated reserve and payment transactions [3.5G].
import { DEFENSE_FIRMS, DEPARTMENTS, UNASSIGNED, deptLabel } from "./codes";
import { reserveBalances } from "./finance";
import type { AppState } from "./store";
import { CATEGORIES, type Claim, type ClaimType } from "./types";

export interface AsOf {
  open: boolean;
  paid: number;
  outstanding: number;
  incurred: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A claim's position on a given date, or null if it hadn't been reported yet. */
export function claimAsOf(s: AppState, c: Claim, date: string): AsOf | null {
  if (c.dateReported > date) return null;
  const open = !c.closedDate || c.closedDate > date;
  if (c.legacy) {
    // Converted claims carry final summary totals only (no transaction history) [3.21].
    return { open, paid: c.legacy.paid, outstanding: c.legacy.outstanding, incurred: c.legacy.incurred };
  }
  const paidByCat = { Medical: 0, Indemnity: 0, Expense: 0 };
  for (const p of s.paymentsByClaim.get(c.id) ?? []) if (p.status === "Issued" && p.issuedDate && p.issuedDate <= date) paidByCat[p.category] += p.amount;
  const reserves = reserveBalances(s.reservesByClaim.get(c.id) ?? [], date);
  let paid = 0;
  let outstanding = 0;
  for (const cat of CATEGORIES) {
    paid += paidByCat[cat];
    if (open) outstanding += Math.max(0, reserves[cat] - paidByCat[cat]);
  }
  return { open, paid: r2(paid), outstanding: r2(outstanding), incurred: r2(paid + outstanding) };
}

export interface DeptRow {
  dept: string;
  label: string;
  openWC: number;
  openGL: number;
  open: number;
  incurredWC: number;
  incurredGL: number;
  incurred: number;
  claims: number; // all claims in scope (open + closed)
}

const emptyRow = (dept: string, label: string): DeptRow => ({
  dept,
  label,
  openWC: 0,
  openGL: 0,
  open: 0,
  incurredWC: 0,
  incurredGL: 0,
  incurred: 0,
  claims: 0,
});

/** Claims in scope: loss year from `fromYear`, reported by `date`. */
export function claimsInScope(s: AppState, date: string, fromYear: number) {
  const from = `${fromYear}-01-01`;
  const out: { claim: Claim; asOf: AsOf }[] = [];
  for (const c of s.claims) {
    if (c.dateOfLoss < from) continue;
    const a = claimAsOf(s, c, date);
    if (a) out.push({ claim: c, asOf: a });
  }
  return out;
}

/** Open claim counts and incurred by department, WC vs GL, as of a date [3.5G]. */
export function asOfByDepartment(s: AppState, date: string, fromYear: number) {
  const rows = new Map<string, DeptRow>(DEPARTMENTS.map((d) => [d.code, emptyRow(d.code, d.label)]));
  const total = emptyRow("ALL", "All departments");
  let legacyIncluded = 0;
  for (const { claim: c, asOf: a } of claimsInScope(s, date, fromYear)) {
    if (!rows.has(c.department)) rows.set(c.department, emptyRow(c.department, c.department === UNASSIGNED ? "Unassigned (legacy code)" : deptLabel(c.department)));
    if (c.legacy) legacyIncluded++;
    for (const row of [rows.get(c.department)!, total]) {
      row.claims++;
      if (a.open) {
        row.open++;
        if (c.type === "WC") row.openWC++;
        else row.openGL++;
      }
      row.incurred += a.incurred;
      if (c.type === "WC") row.incurredWC += a.incurred;
      else row.incurredGL += a.incurred;
    }
  }
  // Always list the City's departments; add others (e.g. Unassigned legacy codes) only when present.
  const list = [...rows.values()].filter((r) => r.claims > 0 || DEPARTMENTS.some((d) => d.code === r.dept));
  return { rows: list, total, legacyIncluded };
}

export interface FirmRow {
  firm: string;
  label: string;
  claims: number;
  active: number;
  paidToFirm: number | null; // null = not recorded (legacy)
  incurred: number;
}

/** Litigated claims by defense firm: count, active, total paid to the firm [3.10C]. */
export function litigationByFirm(s: AppState) {
  const rows = new Map<string, FirmRow>(DEFENSE_FIRMS.map((f) => [f.code, { firm: f.code, label: f.label, claims: 0, active: 0, paidToFirm: 0, incurred: 0 }]));
  const legacy: FirmRow = { firm: "LEGACY", label: "Firm not recorded (converted legacy claims)", claims: 0, active: 0, paidToFirm: null, incurred: 0 };
  for (const c of s.claims) {
    if (!c.litigated) continue;
    const row = c.defenseFirmId ? rows.get(c.defenseFirmId) : c.legacy ? legacy : undefined;
    if (!row) continue;
    row.claims++;
    if (c.status !== "Closed") row.active++;
    row.incurred += s.summaries.get(c.id)?.incurred ?? 0;
    if (row.paidToFirm !== null)
      for (const p of s.paymentsByClaim.get(c.id) ?? [])
        if (p.status === "Issued" && p.payeeType === "defense_firm" && p.defenseFirmId === row.firm) row.paidToFirm += p.amount;
  }
  const list = [...rows.values()];
  if (legacy.claims) list.push(legacy);
  const total: FirmRow = {
    firm: "ALL",
    label: "All firms",
    claims: list.reduce((t, r) => t + r.claims, 0),
    active: list.reduce((t, r) => t + r.active, 0),
    paidToFirm: list.reduce((t, r) => t + (r.paidToFirm ?? 0), 0),
    incurred: list.reduce((t, r) => t + r.incurred, 0),
  };
  return { rows: list, total };
}

export type YearMetric = "claims" | "incurred";

/** WC and GL values per loss year, for the trend chart [3.9F]. */
export function claimsByYear(s: AppState, metric: YearMetric) {
  const years = new Map<number, Record<ClaimType, number>>();
  for (const c of s.claims) {
    const y = Number(c.dateOfLoss.slice(0, 4));
    if (!years.has(y)) years.set(y, { WC: 0, GL: 0 });
    years.get(y)![c.type] += metric === "claims" ? 1 : (s.summaries.get(c.id)?.incurred ?? 0);
  }
  return [...years.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, WC: v.WC, GL: v.GL }));
}

