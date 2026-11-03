"use client";
// Authority limits by role, editable by the Risk Manager only [3.17C].
import { useState } from "react";
import { Card, Loading, PageTitle, ResultMessage, btnPrimary, btnSecondary, inputCls, rowCls, tableCls, td, th, theadCls } from "@/components/ui";
import { restoreDefaultLimits, saveLimits, type Result } from "@/lib/actions";
import { LIMIT_ROLE_LABELS } from "@/lib/finance";
import { fmtDateTime, money } from "@/lib/format";
import { useAppState, type AppState } from "@/lib/store";
import type { AuthorityLimits, LimitRole } from "@/lib/types";
import { roleLabel, userName } from "@/lib/users";

const LEVELS: LimitRole[] = ["adjuster", "supervisor", "risk_manager"];
type Draft = Record<LimitRole, { reserve: string; payment: string }>;

const toDraft = (l: AuthorityLimits): Draft =>
  Object.fromEntries(
    LEVELS.map((k) => [k, { reserve: l[k].reserve === null ? "" : String(l[k].reserve), payment: l[k].payment === null ? "" : String(l[k].payment) }]),
  ) as Draft;

const fromDraft = (d: Draft): AuthorityLimits =>
  Object.fromEntries(
    LEVELS.map((k) => [
      k,
      { reserve: d[k].reserve.trim() === "" ? null : Number(d[k].reserve), payment: d[k].payment.trim() === "" ? null : Number(d[k].payment) },
    ]),
  ) as AuthorityLimits;

export default function AdminLimits() {
  const s = useAppState();
  const [result, setResult] = useState<Result | null>(null);
  if (!s) return <Loading />;
  // Re-mount the editor when saved limits change so the draft starts from current values.
  return <Editor key={JSON.stringify(s.limits)} s={s} result={result} setResult={setResult} />;
}

function Editor({ s, result, setResult }: { s: AppState; result: Result | null; setResult: (r: Result) => void }) {
  const editable = s.role === "risk_manager";
  const [draft, setDraft] = useState<Draft>(() => toDraft(s.limits));
  const history = s.audit.filter((a) => a.action === "Authority limits changed").reverse();

  const set = (k: LimitRole, field: "reserve" | "payment", v: string) => setDraft((d) => ({ ...d, [k]: { ...d[k], [field]: v } }));

  return (
    <div className="max-w-4xl space-y-5">
      <PageTitle title="Admin: authority limits" subtitle="The most each role can reserve on a claim and pay in one payment without approval from a higher level." />

      {!editable && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>View only.</strong> Only the Risk Manager can change authority limits. You are viewing as {roleLabel(s.role)}.
        </p>
      )}
      <ResultMessage result={result} />

      <Card title="Limits by role">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setResult(saveLimits(fromDraft(draft)));
          }}
        >
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Role</th>
                <th className={th}>Reserve authority (claim total)</th>
                <th className={th}>Payment authority (per payment)</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((k) => (
                <tr key={k} className={rowCls}>
                  <th scope="row" className={`${td} text-left font-medium`}>
                    {LIMIT_ROLE_LABELS[k]}
                  </th>
                  {(["reserve", "payment"] as const).map((field) => (
                    <td key={field} className={td}>
                      {editable ? (
                        <div className="flex items-center gap-1">
                          <span aria-hidden="true">$</span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            className={`${inputCls} w-40`}
                            aria-label={`${LIMIT_ROLE_LABELS[k]} ${field} limit in dollars (blank = unlimited)`}
                            placeholder="Unlimited"
                            value={draft[k][field]}
                            onChange={(e) => set(k, field, e.target.value)}
                          />
                        </div>
                      ) : (
                        <span className="tabular-nums">{s.limits[k][field] === null ? "Unlimited" : money(s.limits[k][field]!)}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-600">
            Leave a field blank for unlimited. Requests above a role&apos;s limit are routed to the next level up with a visible flag [3.17D].
          </p>
          {editable && (
            <div className="mt-3 flex gap-2">
              <button type="submit" className={btnPrimary}>
                Save limits
              </button>
              <button type="button" className={btnSecondary} onClick={() => setResult(restoreDefaultLimits())}>
                Restore defaults
              </button>
            </div>
          )}
        </form>
      </Card>

      <Card title="Change history">
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">Limits are at their default values. No changes in this demo session.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                {fmtDateTime(h.timestamp)} — {userName(h.userId)}: {h.details}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
