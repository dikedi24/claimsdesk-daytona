"use client";
// Read-only claim summary. The full workspace (reserve changes, payment approvals, diary,
// audit tab) is built in the claim workspace phase [3.4H–R, 3.17].
import Link from "next/link";
import { use } from "react";
import { Flags, LitigatedBadge, StatusBadge, TypeBadge } from "@/components/Badges";
import { Card, Loading, linkCls, rowCls, tableCls, td, th, theadCls } from "@/components/ui";
import { bodyLabel, causeLabel, deptLabel, diaryLabel, firmLabel } from "@/lib/codes";
import { fmtDate, money, moneyCents } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";
import { userName } from "@/lib/users";

export default function ClaimView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const s = useAppState();
  if (!s) return <Loading />;
  const claim = s.claimsById.get(decodeURIComponent(id));
  if (!claim) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Claim not found</h1>
        <p className="mt-2">
          <Link href="/claims" className={linkCls}>
            Back to claims
          </Link>
        </p>
      </div>
    );
  }
  const sum = s.summaries.get(claim.id)!;
  const payments = [...(s.paymentsByClaim.get(claim.id) ?? [])].sort((a, b) =>
    (b.issuedDate ?? b.requestedDate).localeCompare(a.issuedDate ?? a.requestedDate),
  );
  const reserves = [...(s.reservesByClaim.get(claim.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const diary = [...(s.diaryByClaim.get(claim.id) ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link href="/claims" className={linkCls}>
          ← Claims
        </Link>
      </p>
      <header className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{claim.number}</h1>
          <TypeBadge type={claim.type} />
          <StatusBadge status={claim.status} />
          {claim.litigated && <LitigatedBadge />}
          <Flags flags={sum.flags} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Field label="Claimant" value={claim.claimantName} />
          <Field label="Department" value={deptLabel(claim.department)} />
          <Field label="Adjuster" value={userName(claim.adjusterId)} />
          <Field label="Date of loss" value={fmtDate(claim.dateOfLoss)} />
          <Field label="Date reported" value={fmtDate(claim.dateReported)} />
          <Field label="Cause" value={causeLabel(claim.cause)} />
          <Field label={claim.type === "WC" ? "Body part" : "Damage type"} value={bodyLabel(claim.bodyPartOrDamage)} />
          {claim.closedDate && <Field label="Closed" value={fmtDate(claim.closedDate)} />}
          {claim.litigated && <Field label="Defense firm" value={firmLabel(claim.defenseFirmId)} />}
        </dl>
        <p className="mt-3 text-sm text-slate-700">{claim.description}</p>
      </header>

      <Card title="Financial summary">
        <table className={tableCls}>
          <thead className={theadCls}>
            <tr>
              <th className={th}>Category</th>
              <th className={`${th} text-right`}>Reserve</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>Outstanding</th>
              <th className={`${th} text-right`}>Pending payments</th>
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
              <td className={td}>Total (incurred = paid + outstanding)</td>
              <td className={`${td} text-right tabular-nums`}>{money(sum.reserve)}</td>
              <td className={`${td} text-right tabular-nums`}>{money(sum.paid)}</td>
              <td className={`${td} text-right tabular-nums`}>{money(sum.outstanding)}</td>
              <td className={`${td} text-right tabular-nums`}>Incurred {money(sum.incurred)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`Payments (${payments.length})`}>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-600">No payments.</p>
          ) : (
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Payee</th>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={rowCls}>
                    <td className={td}>{fmtDate(p.issuedDate ?? p.requestedDate)}</td>
                    <td className={td}>{p.payee}</td>
                    <td className={td}>{p.category}</td>
                    <td className={`${td} text-right tabular-nums`}>{moneyCents(p.amount)}</td>
                    <td className={td}>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <div className="space-y-5">
          <Card title="Reserve history">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Change</th>
                  <th className={`${th} text-right`}>New reserve</th>
                  <th className={th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {reserves.map((r) => (
                  <tr key={r.id} className={rowCls}>
                    <td className={td}>{fmtDate(r.date)}</td>
                    <td className={td}>{r.category}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {r.amount >= 0 ? "+" : ""}
                      {money(r.amount)}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{money(r.newBalance)}</td>
                    <td className={td}>
                      {r.reason}
                      {r.status === "PendingApproval" && <span className="ml-1 text-xs font-semibold text-blue-800">(pending approval)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Diary">
            {diary.length === 0 ? (
              <p className="text-sm text-slate-600">No diary entries.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {diary.map((d) => (
                  <li key={d.id}>
                    {fmtDate(d.dueDate)} — {diaryLabel(d.code)} ({userName(d.ownerId)}){d.completed ? " ✓" : ""}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}
