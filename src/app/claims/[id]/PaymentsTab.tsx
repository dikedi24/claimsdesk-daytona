"use client";
// Payments: request → approve/reject → issue, with authority routing and under-reserve blocking [3.4Q, 3.11, 3.17D].
import { useState } from "react";
import { LevelBadge, TxStatusBadge } from "@/components/Badges";
import {
  Card,
  ResultMessage,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSuccess,
  inputCls,
  labelCls,
  rowCls,
  tableCls,
  td,
  th,
  theadCls,
} from "@/components/ui";
import { availableToPay, decidePayment, issuePayment, requestPayment, type Result } from "@/lib/actions";
import { firmLabel } from "@/lib/codes";
import { LIMIT_ROLE_LABELS, canApprove, requiredLevel } from "@/lib/finance";
import { fmtDate, moneyCents } from "@/lib/format";
import { canEditClaim } from "@/lib/permissions";
import type { AppState } from "@/lib/store";
import { CATEGORIES, type Category, type Claim, type PayeeType } from "@/lib/types";
import { limitRole, userName } from "@/lib/users";

const PAYEE_TYPES: [PayeeType, string][] = [
  ["provider", "Medical provider"],
  ["claimant", "Claimant"],
  ["defense_firm", "Defense firm"],
  ["vendor", "Other vendor"],
];

export default function PaymentsTab({ s, claim }: { s: AppState; claim: Claim }) {
  const editable = canEditClaim(s, claim);
  const payments = [...(s.paymentsByClaim.get(claim.id) ?? [])].reverse().sort((a, b) => {
    const rank = (st: string) => (st === "Requested" ? 0 : st === "Approved" ? 1 : 2);
    return rank(a.status) - rank(b.status) || (b.issuedDate ?? b.requestedDate).localeCompare(a.issuedDate ?? a.requestedDate);
  });

  const [category, setCategory] = useState<Category>(claim.type === "WC" ? "Medical" : "Indemnity");
  const [payeeType, setPayeeType] = useState<PayeeType>(claim.type === "WC" ? "provider" : "claimant");
  const [payee, setPayee] = useState(claim.type === "WC" ? "" : claim.claimantName);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const amt = Number(amount);
  const hasAmount = amount.trim() !== "" && Number.isFinite(amt) && amt > 0;
  const available = availableToPay(claim.id, category);
  const over = hasAmount && amt > available + 0.005;
  const level = hasAmount ? requiredLevel("payment", amt, s.role, s.limits) : null;
  const own = level === limitRole(s.role);

  const onPayeeType = (t: PayeeType) => {
    setPayeeType(t);
    if (t === "claimant") setPayee(claim.claimantName);
    else if (t === "defense_firm" && claim.defenseFirmId) setPayee(firmLabel(claim.defenseFirmId));
    else setPayee("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = requestPayment(claim.id, { category, payee, payeeType, amount: amt, memo });
    setResult(r);
    if (r.ok) {
      setAmount("");
      setMemo("");
    }
  };
  const decide = (id: string, d: "approve" | "reject") => {
    const r = decidePayment(id, d, rejectReason);
    setResult(r);
    if (r.ok) {
      setRejecting(null);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-4">
      <ResultMessage result={result} />

      {editable && (
        <Card title="Request a payment">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="flex flex-col">
              <label htmlFor="pay-cat" className={labelCls}>
                Category
              </label>
              <select id="pay-cat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="pay-type" className={labelCls}>
                Payee type
              </label>
              <select id="pay-type" className={inputCls} value={payeeType} onChange={(e) => onPayeeType(e.target.value as PayeeType)}>
                {PAYEE_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col md:col-span-2">
              <label htmlFor="pay-payee" className={labelCls}>
                Payee (required)
              </label>
              <input id="pay-payee" className={inputCls} value={payee} onChange={(e) => setPayee(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label htmlFor="pay-amt" className={labelCls}>
                Amount ($)
              </label>
              <input
                id="pay-amt"
                type="number"
                min={0.01}
                step="0.01"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-describedby="pay-help"
                aria-invalid={over || undefined}
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="pay-memo" className={labelCls}>
                Memo
              </label>
              <input id="pay-memo" className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            <div id="pay-help" className="text-sm md:col-span-3 xl:col-span-5">
              <p className="text-slate-700">
                Available to pay from {category}: <strong>{moneyCents(Math.max(0, available))}</strong> (outstanding reserve less payments
                already in progress).
              </p>
              {over && (
                <p role="alert" className="mt-1 font-semibold text-red-800">
                  Under-reserved: this payment is more than the {category} reserve available. Increase the reserve on the Reserves tab first.
                </p>
              )}
              {hasAmount && !over && level && (
                <p className={own ? "mt-1 text-green-800" : "mt-1 font-semibold text-purple-800"}>
                  {own
                    ? "Within your payment authority: it will be approved and ready to issue."
                    : `Above your payment authority: it will be sent to ${LIMIT_ROLE_LABELS[level]} for approval.`}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <button type="submit" className={btnPrimary} disabled={!hasAmount || over || !payee.trim()}>
                {hasAmount && !own && !over ? "Submit for approval" : "Request payment"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Payments (${payments.length})`}>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-600">No payments on this claim.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Payee</th>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>Requested by</th>
                  <th className={th}>Status</th>
                  <th className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const lvl = requiredLevel("payment", p.amount, p.requestedByRole, s.limits);
                  const mayApprove = p.status === "Requested" && canApprove(s.role, "payment", p.amount, p.requestedByRole, s.limits);
                  const mayIssue = p.status === "Approved" && editable;
                  return (
                    <tr key={p.id} className={rowCls}>
                      <td className={`${td} whitespace-nowrap`}>{fmtDate(p.issuedDate ?? p.requestedDate)}</td>
                      <td className={td}>
                        {p.payee}
                        {p.memo && <span className="block text-xs text-slate-600">{p.memo}</span>}
                      </td>
                      <td className={td}>{p.category}</td>
                      <td className={`${td} text-right tabular-nums`}>{moneyCents(p.amount)}</td>
                      <td className={td}>{userName(p.requestedBy)}</td>
                      <td className={td}>
                        <div className="flex flex-col items-start gap-1">
                          <TxStatusBadge status={p.status} />
                          {p.status === "Requested" && <LevelBadge level={lvl} label={LIMIT_ROLE_LABELS[lvl]} />}
                          {p.approvedBy && p.status !== "Rejected" && p.approvedBy !== p.requestedBy && (
                            <span className="text-xs text-slate-600">Approved by {userName(p.approvedBy)}</span>
                          )}
                          {p.status === "Rejected" && (
                            <span className="text-xs text-red-800">
                              {userName(p.rejectedBy)}: {p.rejectReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={td}>
                        {mayApprove &&
                          (rejecting === p.id ? (
                            <div className="flex flex-col gap-1">
                              <label htmlFor={`pr-${p.id}`} className={labelCls}>
                                Reason for rejection (required)
                              </label>
                              <input id={`pr-${p.id}`} className={inputCls} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                              <div className="flex gap-1">
                                <button type="button" className={btnDanger} onClick={() => decide(p.id, "reject")}>
                                  Confirm reject
                                </button>
                                <button type="button" className={btnSecondary} onClick={() => setRejecting(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <button type="button" className={btnSuccess} onClick={() => decide(p.id, "approve")}>
                                Approve
                              </button>
                              <button type="button" className={btnDanger} onClick={() => setRejecting(p.id)}>
                                Reject
                              </button>
                            </div>
                          ))}
                        {p.status === "Requested" && !mayApprove && (
                          <span className="text-xs text-slate-600">Needs {LIMIT_ROLE_LABELS[lvl]}</span>
                        )}
                        {mayIssue && (
                          <button type="button" className={btnPrimary} onClick={() => setResult(issuePayment(p.id))}>
                            Issue payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
