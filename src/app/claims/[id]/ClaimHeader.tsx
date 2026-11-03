"use client";
// Claim header with totals, a "what you can do" bar, and close / reopen [3.4H, 3.17].
import { useState } from "react";
import { Flags, LitigatedBadge, StatusBadge, TypeBadge } from "@/components/Badges";
import { ResultMessage, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { closeBlockers, closeClaim, reopenClaim, type Result } from "@/lib/actions";
import { bodyLabel, causeLabel, deptLabel, firmLabel } from "@/lib/codes";
import { fmtDate, money } from "@/lib/format";
import { authorityText, canReopen, canWorkClaim, editBlockReason } from "@/lib/permissions";
import type { AppState } from "@/lib/store";
import type { Claim } from "@/lib/types";
import { isManager, roleLabel, userName } from "@/lib/users";

export default function ClaimHeader({ s, claim }: { s: AppState; claim: Claim }) {
  const sum = s.summaries.get(claim.id)!;
  const blocked = editBlockReason(s, claim);
  const [result, setResult] = useState<Result | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");

  const onClose = () => {
    const blockers = closeBlockers(claim.id);
    if (blockers.length) {
      setResult({ ok: false, error: `This claim can't be closed yet. ${blockers.join(" ")}` });
      return;
    }
    if (window.confirm(`Close ${claim.number}? Outstanding reserves of ${money(sum.outstanding)} will be set to $0.`)) {
      setResult(closeClaim(claim.id));
    }
  };
  const onReopen = (e: React.FormEvent) => {
    e.preventDefault();
    const r = reopenClaim(claim.id, reason);
    setResult(r);
    if (r.ok) {
      setReopening(false);
      setReason("");
    }
  };

  const can: string[] = [];
  if (!blocked) can.push("change reserves", "request and issue payments", "add diary entries", "close the claim");
  if (isManager(s.role)) can.push("approve requests within your authority");

  return (
    <header className="rounded border border-slate-200 bg-white">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{claim.number}</h1>
          <TypeBadge type={claim.type} />
          <StatusBadge status={claim.status} />
          {claim.litigated && <LitigatedBadge />}
          <Flags flags={sum.flags} />
          <div className="ml-auto flex gap-2">
            {claim.status !== "Closed" && canWorkClaim(s, claim) && (
              <button type="button" className={btnSecondary} onClick={onClose}>
                Close claim
              </button>
            )}
            {claim.status === "Closed" && canReopen(s.role) && !reopening && (
              <button type="button" className={btnSecondary} onClick={() => setReopening(true)}>
                Reopen claim
              </button>
            )}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4 xl:grid-cols-6">
          <Field label="Claimant" value={claim.claimantName} />
          <Field label="Department" value={deptLabel(claim.department)} />
          <Field label="Adjuster" value={userName(claim.adjusterId)} />
          <Field label="Date of loss" value={fmtDate(claim.dateOfLoss)} />
          <Field label="Date reported" value={fmtDate(claim.dateReported)} />
          <Field label="Cause" value={causeLabel(claim.cause)} />
          <Field label={claim.type === "WC" ? "Body part" : "Damage type"} value={bodyLabel(claim.bodyPartOrDamage)} />
          {claim.litigated && <Field label="Defense firm" value={firmLabel(claim.defenseFirmId)} />}
          {claim.closedDate && <Field label="Closed" value={fmtDate(claim.closedDate)} />}
        </dl>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-xl">
          <Total label="Paid" value={sum.paid} />
          <Total label="Outstanding reserve" value={sum.outstanding} />
          <Total label="Total incurred" value={sum.incurred} strong />
        </div>

        {reopening && (
          <form onSubmit={onReopen} className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex min-w-72 flex-col">
              <label htmlFor="reopen-reason" className={labelCls}>
                Reason for reopening (required)
              </label>
              <input id="reopen-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <button type="submit" className={btnPrimary}>
              Reopen
            </button>
            <button type="button" className={btnSecondary} onClick={() => setReopening(false)}>
              Cancel
            </button>
          </form>
        )}
        {result && (
          <div className="mt-3">
            <ResultMessage result={result} />
          </div>
        )}
      </div>

      <div
        className={`border-t px-4 py-2 text-sm ${blocked ? "border-amber-200 bg-amber-50 text-amber-950" : "border-sky-200 bg-sky-50 text-sky-950"}`}
      >
        <span className="font-semibold">
          {s.user.name} ({roleLabel(s.role)})
        </span>
        <span className="text-slate-700"> · {authorityText(s.limits, s.role)}</span>
        <span className="block sm:inline">
          {" · "}
          {blocked ? <strong>View only: {blocked}</strong> : null}
          {can.length > 0 && <span>{blocked ? " You can " : "You can "}{can.join(", ")}.</span>}
        </span>
      </div>
    </header>
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

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded border px-3 py-2 ${strong ? "border-slate-400 bg-slate-50" : "border-slate-200"}`}>
      <div className="text-xs text-slate-600">{label}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-bold" : "text-lg"}`}>{money(value)}</div>
    </div>
  );
}
