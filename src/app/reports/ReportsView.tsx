"use client";
// Reports [3.5–3.10]: "as of" report by department with drill-down [3.5G], claims-by-year chart that switches
// between bar and line [3.9F], litigated claims by defense firm [3.10C], CSV export on every report [3.5D].
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge, TypeBadge } from "@/components/Badges";
import Chart from "@/components/Chart";
import { Card, Loading, PageTitle, btnSecondary, inputCls, labelCls, linkCls, rowCls, tableCls, td, th, theadCls } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { TODAY } from "@/lib/dates";
import { count, countCompact, fmtDate, money, moneyCents, moneyCompact } from "@/lib/format";
import { asOfByDepartment, claimsByYear, claimsInScope, litigationByFirm, type DeptRow, type YearMetric } from "@/lib/reports";
import { useAppState, type AppState } from "@/lib/store";

const SERIES = [
  { key: "WC", label: "Workers' compensation (WC)", color: "#2a78d6" },
  { key: "GL", label: "General liability (GL)", color: "#eb6834" },
];
const PAGE = 50;
const num = "text-right tabular-nums";

export default function ReportsView() {
  const s = useAppState();
  if (!s) return <Loading />;
  return (
    <div className="space-y-6">
      <PageTitle
        title="Reports"
        subtitle={
          <>
            Point-in-time claim positions, trends and litigation. Every report downloads as CSV.{" "}
            <a href="#as-of" className={linkCls}>As of report</a> · <a href="#trend" className={linkCls}>Claims by year</a> ·{" "}
            <a href="#litigation" className={linkCls}>Litigated claims by firm</a>
          </>
        }
      />
      <LegacyNote s={s} />
      <AsOfReport s={s} />
      <TrendReport s={s} />
      <LitigationReport s={s} />
    </div>
  );
}

function LegacyNote({ s }: { s: AppState }) {
  if (s.legacyStatus === "loading")
    return <p role="status" className="text-sm text-slate-700">Loading converted legacy claims…</p>;
  if (!s.legacyCount) return null;
  return (
    <p className="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950">
      Includes {count(s.legacyCount)} converted legacy claims (2006–2020). Converted claims carry their final summary totals, since their
      transaction history stays in the legacy archive.
    </p>
  );
}

// ---------- As of report [3.5G] ----------

function AsOfReport({ s }: { s: AppState }) {
  const [date, setDate] = useState(TODAY);
  const [fromYear, setFromYear] = useState(2021);
  const [dept, setDept] = useState<string | null>(null);
  const firstYear = s.legacyCount ? 2006 : 2021;
  const years = Array.from({ length: Number(TODAY.slice(0, 4)) - firstYear + 1 }, (_, i) => firstYear + i);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= TODAY ? date : TODAY;
  const effectiveFrom = Math.max(fromYear, firstYear);
  const report = useMemo(() => asOfByDepartment(s, validDate, effectiveFrom), [s, validDate, effectiveFrom]);
  const scope = `loss years ${effectiveFrom}–${TODAY.slice(0, 4)}`;

  const csv = () =>
    downloadCsv(
      `as_of_${validDate}_by_department`,
      [...report.rows, report.total].map((r) => ({
        Department: r.label,
        "Open WC": r.openWC,
        "Open GL": r.openGL,
        "Open total": r.open,
        "Incurred WC": r.incurredWC.toFixed(2),
        "Incurred GL": r.incurredGL.toFixed(2),
        "Incurred total": r.incurred.toFixed(2),
        "As of": validDate,
        Scope: scope,
      })),
    );

  return (
    <section id="as-of" aria-labelledby="as-of-title" className="scroll-mt-4">
      <Card
        title="“As of” report by department"
        action={
          <button type="button" className={btnSecondary} onClick={csv}>
            Download CSV
          </button>
        }
      >
        <h2 id="as-of-title" className="sr-only">
          As of report by department
        </h2>
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label htmlFor="asof-date" className={labelCls}>
              As of date
            </label>
            <input id="asof-date" type="date" max={TODAY} min="2006-01-01" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="asof-from" className={labelCls}>
              Include losses from
            </label>
            <select id="asof-from" className={inputCls} value={effectiveFrom} onChange={(e) => setFromYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-700" aria-live="polite">
            Positions as they stood on <strong>{fmtDate(validDate)}</strong>, {scope}: {count(report.total.claims)} claims, {count(report.total.open)} open.
            {report.legacyIncluded > 0 && ` Includes ${count(report.legacyIncluded)} converted legacy claims.`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <caption className="sr-only">Open claims and incurred by department as of {fmtDate(validDate)}</caption>
            <thead className={theadCls}>
              <tr>
                <th className={th} rowSpan={2}>
                  Department
                </th>
                <th className={`${th} border-l border-slate-200 text-center`} colSpan={3}>
                  Open claims
                </th>
                <th className={`${th} border-l border-slate-200 text-center`} colSpan={3}>
                  Incurred (paid + outstanding)
                </th>
              </tr>
              <tr>
                {["WC", "GL", "Total", "WC", "GL", "Total"].map((h, i) => (
                  <th key={i} className={`${th} text-right ${i === 0 || i === 3 ? "border-l border-slate-200" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <DeptLine key={r.dept} r={r} selected={dept === r.dept} onSelect={() => setDept(dept === r.dept ? null : r.dept)} />
              ))}
              <DeptLine r={report.total} total />
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-600">Select a department to see its claims as of this date.</p>
        {dept && <DrillDown s={s} dept={dept} label={report.rows.find((r) => r.dept === dept)?.label ?? dept} date={validDate} fromYear={effectiveFrom} />}
      </Card>
    </section>
  );
}

function DeptLine({ r, selected, onSelect, total }: { r: DeptRow; selected?: boolean; onSelect?: () => void; total?: boolean }) {
  return (
    <tr className={total ? "border-t-2 border-slate-300 font-semibold" : `${rowCls} ${selected ? "bg-sky-50" : ""}`}>
      <th scope="row" className={`${td} text-left ${total ? "" : "font-normal"}`}>
        {total ? (
          r.label
        ) : (
          <button type="button" aria-pressed={selected} onClick={onSelect} className={`${linkCls} text-left`}>
            {r.label}
          </button>
        )}
      </th>
      <td className={`${td} ${num} border-l border-slate-100`}>{count(r.openWC)}</td>
      <td className={`${td} ${num}`}>{count(r.openGL)}</td>
      <td className={`${td} ${num} font-medium`}>{count(r.open)}</td>
      <td className={`${td} ${num} border-l border-slate-100`}>{money(r.incurredWC)}</td>
      <td className={`${td} ${num}`}>{money(r.incurredGL)}</td>
      <td className={`${td} ${num} font-medium`}>{money(r.incurred)}</td>
    </tr>
  );
}

function DrillDown({ s, dept, label, date, fromYear }: { s: AppState; dept: string; label: string; date: string; fromYear: number }) {
  const [page, setPage] = useState(0);
  const [openOnly, setOpenOnly] = useState(false);
  const rows = useMemo(
    () =>
      claimsInScope(s, date, fromYear)
        .filter((x) => x.claim.department === dept && (!openOnly || x.asOf.open))
        .sort((a, b) => b.asOf.incurred - a.asOf.incurred),
    [s, date, fromYear, dept, openOnly],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);

  const csv = () =>
    downloadCsv(
      `as_of_${date}_${label.replace(/[^A-Za-z]+/g, "_")}_claims`,
      rows.map(({ claim: c, asOf: a }) => ({
        Claim: c.number,
        Type: c.type,
        Claimant: c.claimantName,
        Department: label,
        "Date of loss": c.dateOfLoss,
        "Status as of": a.open ? "Open" : "Closed",
        Paid: a.paid.toFixed(2),
        Outstanding: a.outstanding.toFixed(2),
        Incurred: a.incurred.toFixed(2),
        Source: c.source === "legacy" ? "Converted legacy" : "ClaimsDesk",
      })),
    );

  return (
    <div className="mt-5 rounded border border-sky-200 p-3" aria-live="polite">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-slate-900">
          {label}: {count(rows.length)} claims as of {fmtDate(date)}
        </h3>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => {
              setOpenOnly(e.target.checked);
              setPage(0);
            }}
          />{" "}
          Open on that date only
        </label>
        <button type="button" className={`${btnSecondary} ml-auto`} onClick={csv}>
          Download CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No claims in this department for the selected date and loss years.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Claim</th>
                <th className={th}>Type</th>
                <th className={th}>Claimant</th>
                <th className={th}>Date of loss</th>
                <th className={th}>Status on {fmtDate(date)}</th>
                <th className={`${th} text-right`}>Paid</th>
                <th className={`${th} text-right`}>Outstanding</th>
                <th className={`${th} text-right`}>Incurred</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(current * PAGE, current * PAGE + PAGE).map(({ claim: c, asOf: a }) => (
                <tr key={c.id} className={rowCls}>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={`/claims/${c.id}`} className={linkCls}>
                      {c.number}
                    </Link>
                  </td>
                  <td className={td}>
                    <TypeBadge type={c.type} />
                  </td>
                  <td className={td}>{c.claimantName}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(c.dateOfLoss)}</td>
                  <td className={td}>
                    <StatusBadge status={a.open ? "Open" : "Closed"} />
                  </td>
                  <td className={`${td} ${num}`}>{moneyCents(a.paid)}</td>
                  <td className={`${td} ${num}`}>{moneyCents(a.outstanding)}</td>
                  <td className={`${td} ${num} font-medium`}>{moneyCents(a.incurred)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Drill-down pages" className="mt-2 flex items-center gap-3 text-sm">
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
    </div>
  );
}

// ---------- Claims by year chart [3.9F] ----------

function TrendReport({ s }: { s: AppState }) {
  const [metric, setMetric] = useState<YearMetric>("claims");
  const [mode, setMode] = useState<"bar" | "line">("bar");
  const data = useMemo(() => claimsByYear(s, metric), [s, metric]);
  const isMoney = metric === "incurred";
  const title = `${isMoney ? "Total incurred" : "Claims reported"} by year of loss, WC vs GL`;

  const csv = () =>
    downloadCsv(
      `claims_by_year_${metric}`,
      data.map((d) => ({ "Year of loss": d.year, WC: isMoney ? d.WC.toFixed(2) : d.WC, GL: isMoney ? d.GL.toFixed(2) : d.GL })),
    );

  const toggle = (active: boolean) =>
    `px-3 py-1 text-sm border ${active ? "border-[#0b3a5b] bg-[#0b3a5b] font-semibold text-white" : "border-slate-300 bg-white hover:bg-slate-100"}`;

  return (
    <section id="trend" aria-labelledby="trend-title" className="scroll-mt-4">
      <Card
        title="Claims by year"
        action={
          <button type="button" className={btnSecondary} onClick={csv}>
            Download CSV
          </button>
        }
      >
        <h2 id="trend-title" className="sr-only">
          Claims by year
        </h2>
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <div role="group" aria-label="Measure" className="inline-flex overflow-hidden rounded">
            <button type="button" aria-pressed={metric === "claims"} className={`${toggle(metric === "claims")} rounded-l`} onClick={() => setMetric("claims")}>
              Claims reported
            </button>
            <button type="button" aria-pressed={metric === "incurred"} className={`${toggle(metric === "incurred")} -ml-px rounded-r`} onClick={() => setMetric("incurred")}>
              Total incurred
            </button>
          </div>
          <div role="group" aria-label="Chart type" className="inline-flex overflow-hidden rounded">
            <button type="button" aria-pressed={mode === "bar"} className={`${toggle(mode === "bar")} rounded-l`} onClick={() => setMode("bar")}>
              Bar
            </button>
            <button type="button" aria-pressed={mode === "line"} className={`${toggle(mode === "line")} -ml-px rounded-r`} onClick={() => setMode("line")}>
              Line
            </button>
          </div>
          <p className="text-sm text-slate-700">{title}. Incurred is as of today.</p>
        </div>
        <Chart
          data={data}
          series={SERIES}
          mode={mode}
          title={title}
          format={isMoney ? money : count}
          formatAxis={isMoney ? moneyCompact : countCompact}
        />
      </Card>
    </section>
  );
}

// ---------- Litigated claims by defense firm [3.10C] ----------

function LitigationReport({ s }: { s: AppState }) {
  const { rows, total } = useMemo(() => litigationByFirm(s), [s]);
  const csv = () =>
    downloadCsv(
      "litigated_claims_by_defense_firm",
      [...rows, total].map((r) => ({
        "Defense firm": r.label,
        "Litigated claims": r.claims,
        Active: r.active,
        "Total paid to firm": r.paidToFirm === null ? "Not recorded" : r.paidToFirm.toFixed(2),
        "Total incurred on these claims": r.incurred.toFixed(2),
      })),
    );

  return (
    <section id="litigation" aria-labelledby="lit-title" className="scroll-mt-4">
      <Card
        title="Litigated claims by defense firm"
        action={
          <button type="button" className={btnSecondary} onClick={csv}>
            Download CSV
          </button>
        }
      >
        <h2 id="lit-title" className="sr-only">
          Litigated claims by defense firm
        </h2>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <caption className="sr-only">Litigated claims by defense firm</caption>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Defense firm</th>
                <th className={`${th} text-right`}>Litigated claims</th>
                <th className={`${th} text-right`}>Active</th>
                <th className={`${th} text-right`}>Total paid to firm</th>
                <th className={`${th} text-right`}>Total incurred on these claims</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.firm} className={rowCls}>
                  <th scope="row" className={`${td} text-left font-normal`}>
                    {r.label}
                  </th>
                  <td className={`${td} ${num}`}>{count(r.claims)}</td>
                  <td className={`${td} ${num}`}>{count(r.active)}</td>
                  <td className={`${td} ${num}`}>{r.paidToFirm === null ? <span className="text-slate-500">Not recorded</span> : money(r.paidToFirm)}</td>
                  <td className={`${td} ${num}`}>{money(r.incurred)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <th scope="row" className={`${td} text-left`}>
                  {total.label}
                </th>
                <td className={`${td} ${num}`}>{count(total.claims)}</td>
                <td className={`${td} ${num}`}>{count(total.active)}</td>
                <td className={`${td} ${num}`}>{money(total.paidToFirm ?? 0)}</td>
                <td className={`${td} ${num}`}>{money(total.incurred)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Active = open as of {fmtDate(TODAY)}. Paid to firm = issued payments to that firm (defense fees and costs).
        </p>
      </Card>
    </section>
  );
}
