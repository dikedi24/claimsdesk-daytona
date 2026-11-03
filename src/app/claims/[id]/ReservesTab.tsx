"use client";
// Reserves by category with change history; above-authority changes route for approval [3.4P, 3.17D].
import { useState } from "react";
import { LevelBadge, TxStatusBadge } from "@/components/Badges";
import {
  Card,
  ResultMessage,
  btnDanger,
  btnPrimary,
  btnSuccess,
  inputCls,
  labelCls,
  rowCls,
  tableCls,
  td,
  th,
  theadCls,
} from "@/components/ui";
import { changeReserve, decideReserve, type Result } from "@/lib/actions";
import { LIMIT_ROLE_LABELS, canApprove, claimReserveAfter, requiredLevel } from "@/lib/finance";
import { fmtDate, money } from "@/lib/format";
import { canEditClaim } from "@/lib/permissions";
import type { AppState } from "@/lib/store";
import { CATEGORIES, type Category, type Claim } from "@/lib/types";
import { limitRole, userName } from "@/lib/users";

export default function ReservesTab({ s, claim }: { s: AppState; claim: Claim }) {
  const sum = s.summaries.get(claim.id)!;
  const txs = s.reservesByClaim.get(claim.id) ?? [];
  const history = [...txs].reverse().sort((a, b) => b.date.localeCompare(a.date)); // stable: newest entry first on ties
  const pending = txs.filter((r) => r.status === "PendingApproval");
  const editable = canEditClaim(s, claim);
  const balances = Object.fromEntries(CATEGORIES.map((c) => [c, sum.byCat[c].reserve])) as Record<Category, number>;

  const [category, setCategory] = useState<Category>("Medical");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const newBalance = Number(amount);
  const hasAmount = amount.trim() !== "" && Number.isFinite(newBalance);
  const total = hasAmount ? claimReserveAfter(balances, { category, newBalance }) : 0;
  const level = hasAmount ? requiredLevel("reserve", total, s.role, s.limits) : null;
  const own = level === limitRole(s.role);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = changeReserve(claim.id, category, newBalance, reason);
    setResult(r);
    if (r.ok) {
      setAmount("");
      setReason("");
    }
  };
  const decide = (id: string, d: "approve" | "reject") => {
    const r = decideReserve(id, d, rejectReason);
    setResult(r);
    if (r.ok) {
      setRejecting(null);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-4">
      <ResultMessage result={result} />

      <Card title="Reserves by category">
        <table className={tableCls}>
          <thead className={theadCls}>
            <tr>
              <th className={th}>Category</th>
              <th className={`${th} text-right`}>Reserve</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>% paid</th>
              <th className={`${th} text-right`}>Outstanding</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => {
              const t = sum.byCat[c];
              const pct = t.reserve > 0 ? t.paid / t.reserve : 0;
              const open = claim.status !== "Closed";
              return (
                <tr key={c} className={rowCls}>
                  <td className={td}>{c}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(t.reserve)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(t.paid)}</td>
                  <td className={`${td} text-right tabular-nums`}>{t.reserve > 0 ? `${Math.round(pct * 100)}%` : "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(t.outstanding)}</td>
                  <td className={td}>
                    {open && t.pending > t.outstanding + 0.005 ? (
                      <span className="font-semibold text-red-800">Under-reserved</span>
                    ) : open && t.reserve > 0 && pct >= 0.8 ? (
                      <span className="font-semibold text-amber-800">Low reserve (≥ 80% paid)</span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {pending.length > 0 && (
        <Card title="Reserve changes awaiting approval">
          <ul className="space-y-3">
            {pending.map((r) => {
              const t = claimReserveAfter(balances, r);
              const lvl = requiredLevel("reserve", t, r.byRole, s.limits);
              const mayAct = canApprove(s.role, "reserve", t, r.byRole, s.limits);
              return (
                <li key={r.id} className="rounded border border-blue-200 bg-blue-50/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{r.category}</strong> {money(balances[r.category])} → {money(r.newBalance)}
                    <span className="text-slate-600">(claim total {money(t)})</span>
                    <LevelBadge level={lvl} label={LIMIT_ROLE_LABELS[lvl]} />
                  </div>
                  <p className="mt-1 text-slate-700">
                    {r.reason} — requested by {userName(r.byUserId)} on {fmtDate(r.date)}
                  </p>
                  {mayAct ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <button type="button" className={btnSuccess} onClick={() => decide(r.id, "approve")}>
                        Approve
                      </button>
                      {rejecting === r.id ? (
                        <>
                          <div className="flex flex-col">
                            <label htmlFor={`rr-${r.id}`} className={labelCls}>
                              Reason for rejection (required)
                            </label>
                            <input id={`rr-${r.id}`} className={inputCls} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                          </div>
                          <button type="button" className={btnDanger} onClick={() => decide(r.id, "reject")}>
                            Confirm reject
                          </button>
                        </>
                      ) : (
                        <button type="button" className={btnDanger} onClick={() => setRejecting(r.id)}>
                          Reject
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-600">Only {LIMIT_ROLE_LABELS[lvl]} or above can approve this change.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editable && (
        <Card title="Change a reserve">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label htmlFor="res-cat" className={labelCls}>
                Category
              </label>
              <select id="res-cat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="res-amt" className={labelCls}>
                New {category} reserve ($)
              </label>
              <input
                id="res-amt"
                type="number"
                min={0}
                step="0.01"
                className={`${inputCls} w-40`}
                value={amount}
                placeholder={String(sum.byCat[category].reserve)}
                onChange={(e) => setAmount(e.target.value)}
                aria-describedby="res-help"
              />
            </div>
            <div className="flex min-w-72 flex-1 flex-col">
              <label htmlFor="res-reason" className={labelCls}>
                Reason (required)
              </label>
              <input id="res-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <button type="submit" className={btnPrimary} disabled={!hasAmount || !reason.trim()}>
              {hasAmount && !own ? "Submit for approval" : "Save reserve"}
            </button>
            <p id="res-help" className="w-full text-sm text-slate-700">
              Current {category} reserve {money(sum.byCat[category].reserve)}; paid {money(sum.byCat[category].paid)} (the reserve can&apos;t go
              below this).
              {hasAmount && level && (
                <>
                  {" "}
                  Claim total after change: <strong>{money(total)}</strong> —{" "}
                  {own ? (
                    <span className="text-green-800">within your authority, applies immediately.</span>
                  ) : (
                    <strong className="text-purple-800">exceeds your authority; will be sent to {LIMIT_ROLE_LABELS[level]}.</strong>
                  )}
                </>
              )}
            </p>
          </form>
        </Card>
      )}

      <Card title="Reserve history">
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">No reserve transactions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Change</th>
                  <th className={`${th} text-right`}>New reserve</th>
                  <th className={th}>Reason</th>
                  <th className={th}>By</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className={rowCls}>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(r.date)}</td>
                    <td className={td}>{r.category}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {r.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(r.amount))}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{money(r.newBalance)}</td>
                    <td className={td}>
                      {r.reason}
                      {r.rejectReason && <span className="block text-xs text-red-800">Rejected: {r.rejectReason}</span>}
                    </td>
                    <td className={td}>
                      {userName(r.byUserId)}
                      {r.decidedBy && <span className="block text-xs text-slate-600">Decided by {userName(r.decidedBy)}</span>}
                    </td>
                    <td className={td}>
                      <TxStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
