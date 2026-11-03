// RFP coverage [Appendix A]: what this demo builds, what it simulates, and how production handles the rest.
// RFP section references are the ones cited in the project brief (CLAUDE.md).

type Status = "Built" | "Simulated in demo" | "Roadmap";

interface Row {
  area: string;
  ref: string;
  status: Status;
  demo: string; // what the demo does today
  production: string; // one line on how production handles it
}

const ROWS: Row[] = [
  {
    area: "Claim intake with validated data entry",
    ref: "3.3, 3.4G",
    status: "Built",
    demo: "WC/GL claim form with coded dropdowns, date checks and required fields.",
    production: "Same screens, with the City's full code tables loaded and maintained by an administrator.",
  },
  {
    area: "Start a claim from a report (AI-assisted intake)",
    ref: "3.16",
    status: "Built",
    demo: "Claude pre-fills the form from a pasted report; every suggestion is marked for review and nothing saves without a person.",
    production: "Same advisory design, run under a business associate agreement with no data retention, plus upload of PDF and scanned reports.",
  },
  {
    area: "Reserves, payments and financial flags",
    ref: "3.4H–R, 3.4P, 3.4Q, 3.11",
    status: "Built",
    demo: "Reserves by category with history, payment request/approve/reject/issue, low-reserve and under-reserved flags.",
    production: "Same rules, backed by a database with transaction-level history and nightly reconciliation to the City's ledger.",
  },
  {
    area: "Authority limits and escalation",
    ref: "3.17C, 3.17D",
    status: "Built",
    demo: "Role limits editable by the Risk Manager; above-limit requests route up with a visible flag.",
    production: "Same, with limits set per named user as well as per role, and email alerts for pending approvals.",
  },
  {
    area: "Diary and reminders",
    ref: "3.4I, 3.4K, 3.4L",
    status: "Built",
    demo: "Standard quick-pick entries, overdue items on the dashboard, owner-only editing.",
    production: "Same, plus automatic diaries triggered by claim events and an optional daily email digest.",
  },
  {
    area: "Audit trail",
    ref: "3.4H–R",
    status: "Built",
    demo: "Every change is logged with user, role, time and details.",
    production: "Tamper-evident audit log retained per the City's records schedule, searchable by claim, user and date.",
  },
  {
    area: "Legacy data conversion without loss of data",
    ref: "3.2D, 3.21",
    status: "Built",
    demo: "Field mapping, validation, correction queue, and control totals that tie out, run on a generated 16,000-row stand-in export.",
    production: "Same process run against the City's SQL Server 2019 database (15 GB), with trial conversions and a sign-off before go-live.",
  },
  {
    area: "Reporting: as-of, drill-down, export, charts, litigation",
    ref: "3.5–3.10, 3.5D, 3.5G, 3.9F, 3.10C",
    status: "Built",
    demo: "As-of report by department with drill-down, claims-by-year chart (bar/line), litigation by firm, CSV on every report.",
    production: "Same, plus saved and scheduled reports, Excel/PDF output, and a report builder for ad-hoc queries.",
  },
  {
    area: "Accessibility (WCAG 2.0 AA)",
    ref: "5.19",
    status: "Built",
    demo: "Semantic HTML, labeled inputs, keyboard navigation, sufficient contrast, chart data tables.",
    production: "Independent audit with automated and screen-reader testing, and a published VPAT before go-live.",
  },
  {
    area: "Sign-in and role-based access",
    ref: "3.17",
    status: "Simulated in demo",
    demo: "A role switcher in the header stands in for login.",
    production: "Named user accounts with role-based permissions, assigned by the Risk Manager (see SSO/MFA below).",
  },
  {
    area: "Data storage",
    ref: "3.12",
    status: "Simulated in demo",
    demo: "Seed data in code; changes saved in this browser only (Reset demo restores it).",
    production: "Encrypted managed database with point-in-time recovery; all users share one system of record.",
  },
  {
    area: "Issuing payments (checks / EFT)",
    ref: "3.11",
    status: "Simulated in demo",
    demo: "\"Issue payment\" marks a payment issued; no check or EFT is produced.",
    production: "Approved payments flow to the City's financial system for check or EFT, with numbers and cleared dates returned.",
  },
  {
    area: "Florida DWC EDI reporting (FROI/SROI)",
    ref: "3.14D",
    status: "Roadmap",
    demo: "Not in the demo.",
    production: "First and subsequent reports of injury filed electronically to the Florida Division of Workers' Compensation in its required EDI format; acknowledgments and errors tracked on each claim.",
  },
  {
    area: "Bill review and fee schedule integration",
    ref: "3.13B",
    status: "Roadmap",
    demo: "Not in the demo.",
    production: "Medical bills repriced against the Florida WC fee schedule through a bill review partner; repriced bills arrive as payment requests for approval.",
  },
  {
    area: "City financial system integration",
    ref: "3.11B",
    status: "Roadmap",
    demo: "Not in the demo (see payment issuing above).",
    production: "Scheduled export of approved payments to accounts payable with general ledger coding, and import of check/EFT numbers and cleared dates.",
  },
  {
    area: "HIPAA safeguards, SSO and MFA",
    ref: "3.18G",
    status: "Roadmap",
    demo: "Fictional data only; no real medical information.",
    production: "Single sign-on with the City's identity provider and enforced multi-factor authentication; encryption in transit and at rest, least-privilege access, access logging, and a signed BAA.",
  },
  {
    area: "24x7 hosting and backups",
    ref: "3.12",
    status: "Roadmap",
    demo: "Hosted on Vercel for evaluation only.",
    production: "Managed cloud hosting with an uptime SLA, monitoring and on-call support, daily backups with point-in-time restore, and a tested disaster recovery plan.",
  },
  {
    area: "Admin-defined custom fields",
    ref: "3.15D",
    status: "Roadmap",
    demo: "Not in the demo.",
    production: "Administrators add fields (text, date, number, code list) per claim type without code changes; custom fields appear in screens, search, reports and exports.",
  },
  {
    area: "Native-format data export at termination",
    ref: "3.21D",
    status: "Roadmap",
    demo: "CSV export on reports and conversion exceptions only.",
    production: "Complete export of all claim data, history and attached documents in native formats (CSV and a SQL Server–compatible database copy) with a data dictionary.",
  },
  {
    area: "Root claims with sub-claims / additional claimants",
    ref: "3.3D, 3.4D",
    status: "Roadmap",
    demo: "Not in the demo; each claim has one claimant.",
    production:
      "Discovery would confirm how the legacy system stores suffix claims, which may explain why the 16,000-record count exceeds the City's ~258 claims/year.",
  },
  {
    area: "Responsive phone and tablet layouts (portrait and landscape)",
    ref: "5.19",
    status: "Roadmap",
    demo: "Desktop-first; tested at laptop widths (1024px and up).",
    production:
      "Demo is desktop-first for adjusters at their desks. Production would add a collapsible nav and phone-friendly claim views for supervisors approving payments on the go and staff reviewing claims away from a desk, tested against WCAG 2.0 AA (RFP 5.19).",
  },
  {
    area: "Recurring payment schedules",
    ref: "3.11",
    status: "Roadmap",
    demo: "Not in the demo (optional in the brief).",
    production: "Scheduled indemnity payments (e.g., weekly benefits) generated automatically within authority limits and stopped when the claim's status changes.",
  },
];

const BADGE: Record<Status, string> = {
  Built: "border-green-300 bg-green-50 text-green-900",
  "Simulated in demo": "border-amber-300 bg-amber-50 text-amber-950",
  Roadmap: "border-slate-300 bg-slate-100 text-slate-800",
};

const LEGEND: Record<Status, string> = {
  Built: "Working in this demo, with the same rules production would use.",
  "Simulated in demo": "Shown in the demo with a stand-in (for example, the role switcher instead of login).",
  Roadmap: "Not in the demo; the production approach is described.",
};

export default function Page() {
  const counts = (s: Status) => ROWS.filter((r) => r.status === s).length;
  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roadmap: RFP coverage</h1>
        <p className="mt-1 text-sm text-slate-600">
          How each requirement area in RFP 2704RFP (Appendix A) is covered by this demo, and how the production system handles it. Live before
          September 30, 2027.
        </p>
      </div>

      <ul className="grid gap-3 md:grid-cols-3">
        {(Object.keys(LEGEND) as Status[]).map((s) => (
          <li key={s} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${BADGE[s]}`}>{s}</span>
              <span className="text-2xl font-bold tabular-nums">{counts(s)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{LEGEND[s]}</p>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">RFP requirement areas with demo status and production approach</caption>
          <thead className="border-b border-slate-300 bg-slate-50">
            <tr>
              {["Requirement area", "RFP ref.", "Status", "In this demo", "Production approach"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.area} className="border-b border-slate-100 align-top">
                <th scope="row" className="px-3 py-2 text-left font-medium text-slate-900">
                  {r.area}
                </th>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.ref}</td>
                <td className="px-3 py-2">
                  <span className={`whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2 text-slate-700">{r.demo}</td>
                <td className="px-3 py-2 text-slate-800">{r.production}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
