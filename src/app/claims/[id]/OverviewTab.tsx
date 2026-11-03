"use client";
// Overview: description, financial summary by category, and plain-language flag explanations.
import { FlagBadge } from "@/components/Badges";
import { Card, rowCls, tableCls, td, th, theadCls } from "@/components/ui";
import { diaryLabel } from "@/lib/codes";
import { TODAY } from "@/lib/dates";
import type { FlagKind } from "@/lib/finance";
import { fmtDate, money } from "@/lib/format";
import type { AppState } from "@/lib/store";
import { CATEGORIES, type Claim } from "@/lib/types";
import { userName } from "@/lib/users";

const EXPLAIN: Record<FlagKind, string> = {
  under_reserved:
    "A payment waiting to be approved or issued is larger than the reserve left in its category. The payment is blocked until the reserve is increased. [3.4Q]",
  low_reserve: "At least 80% of a category's reserve has already been paid. Review whether the reserve is still adequate. [3.4P]",
  pending_approval: "A payment or reserve change is above the requester's authority and is waiting for approval. [3.17D]",
  escalated: "A request is above the Supervisor's authority and has been routed to the Risk Manager. [3.17D]",
  overdue_diary: "A diary reminder on this claim is past its due date. [3.4K]",
};

export default function OverviewTab({ s, claim }: { s: AppState; claim: Claim }) {
  const sum = s.summaries.get(claim.id)!;
  const diary = (s.diaryByClaim.get(claim.id) ?? []).filter((d) => !d.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (claim.legacy) return <LegacyOverview claim={claim} />;

  return (
    <div className="space-y-4">
      <Card title="What happened">
        <p className="text-sm text-slate-800">{claim.description}</p>
      </Card>

      {sum.flags.length > 0 && (
        <Card title="Why this claim is flagged">
          <ul className="space-y-2 text-sm">
            {sum.flags.map((f) => (
              <li key={f} className="flex flex-wrap items-start gap-2">
                <FlagBadge flag={f} />
                <span className="text-slate-800">{EXPLAIN[f]}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Financial summary">
        <table className={tableCls}>
          <thead className={theadCls}>
            <tr>
              <th className={th}>Category</th>
              <th className={`${th} text-right`}>Reserve</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>Outstanding</th>
              <th className={`${th} text-right`}>Payments in progress</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => (
              <tr key={c} className={rowCls}>
                <td className={td}>{c}</td>
                <td className={`${td} text-right tabular-nums`}>{money(sum.byCat[c].reserve)}</td>
                <td className={`${td} text-right tabular-nums`}>{money(sum.byCat[c].paid)}</td>
                <td className={`${td} text-right tabular-nums`}>{money(sum.byCat[c].outstanding)}</td>
                <td className={`${td} text-right tabular-nums`}>{sum.byCat[c].pending ? money(sum.byCat[c].pending) : "—"}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className={td}>Total</td>
              <td className={`${td} text-right tabular-nums`}>{money(sum.reserve)}</td>
              <td className={`${td} text-right tabular-nums`}>{money(sum.paid)}</td>
              <td className={`${td} text-right tabular-nums`}>{money(sum.outstanding)}</td>
              <td className={td}></td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-600">Total incurred = paid + outstanding reserve = {money(sum.incurred)}.</p>
      </Card>

      <Card title="Upcoming diary">
        {diary.length === 0 ? (
          <p className="text-sm text-slate-600">No open diary entries.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {diary.slice(0, 5).map((d) => (
              <li key={d.id}>
                <span className={d.dueDate < TODAY ? "font-semibold text-red-800" : ""}>{fmtDate(d.dueDate)}</span> —{" "}
                {d.code === "CUSTOM" ? d.note : diaryLabel(d.code)} ({userName(d.ownerId)})
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Converted legacy claims carry summary totals only [3.21]. */
function LegacyOverview({ claim }: { claim: Claim }) {
  const l = claim.legacy!;
  return (
    <div className="space-y-4">
      <p className="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950">
        <strong>Converted from the legacy system.</strong> Summary totals only; the detailed transaction history remains in the legacy archive.
      </p>
      <Card title="What happened">
        <p className="text-sm text-slate-800">{claim.description || "No description in the legacy record."}</p>
      </Card>
      <Card title="Legacy financial totals">
        <table className={tableCls}>
          <tbody>
            <tr className={rowCls}>
              <th scope="row" className={`${td} text-left font-normal`}>Total paid</th>
              <td className={`${td} text-right tabular-nums`}>{money(l.paid)}</td>
            </tr>
            <tr className={rowCls}>
              <th scope="row" className={`${td} text-left font-normal`}>Outstanding reserve at conversion</th>
              <td className={`${td} text-right tabular-nums`}>{money(l.outstanding)}</td>
            </tr>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <th scope="row" className={`${td} text-left`}>Total incurred</th>
              <td className={`${td} text-right tabular-nums`}>{money(l.incurred)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-600">
          Legacy record ID {l.legacyId || "—"} · examiner {l.examiner || "—"} · legacy department code {l.sourceDept || "—"}
        </p>
      </Card>
    </div>
  );
}
