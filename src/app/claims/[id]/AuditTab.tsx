"use client";
// Audit trail: every change with user, role and timestamp [3.4R]. Seeded history is shown as dated rows.
import { Card, rowCls, tableCls, td, th, theadCls } from "@/components/ui";
import { fmtDateTime, money, moneyCents } from "@/lib/format";
import type { AppState } from "@/lib/store";
import type { Claim, Role } from "@/lib/types";
import { roleLabel, userName } from "@/lib/users";

interface Row {
  key: string;
  when: string; // ISO date or timestamp, for sorting
  userId: string;
  role: Role;
  action: string;
  details: string;
  history: boolean;
}

const isUserCreated = (id: string) => id.includes("-u");

const fmtWhen = (when: string) => fmtDateTime(when);

export default function AuditTab({ s, claim }: { s: AppState; claim: Claim }) {
  const rows: Row[] = s.audit
    .filter((a) => a.claimId === claim.id)
    .map((a) => ({ key: a.id, when: a.timestamp, userId: a.userId, role: a.role, action: a.action, details: a.details ?? "", history: false }));

  // History that existed before this demo session (seed data or converted records).
  if (claim.source !== "user") {
    const adjRole: Role = claim.type === "GL" ? "adjuster_gl" : "adjuster_wc";
    rows.push({
      key: "created",
      when: claim.dateReported,
      userId: claim.adjusterId,
      role: adjRole,
      action: "Claim reported",
      details: `${claim.type} claim set up; assigned to ${userName(claim.adjusterId)}.`,
      history: true,
    });
    for (const r of s.reservesByClaim.get(claim.id) ?? []) {
      if (isUserCreated(r.id)) continue;
      rows.push({
        key: r.id,
        when: r.date,
        userId: r.byUserId,
        role: r.byRole,
        action: r.status === "PendingApproval" ? "Reserve change submitted for approval" : "Reserve changed",
        details: `${r.category} reserve set to ${money(r.newBalance)} (${r.amount >= 0 ? "+" : "−"}${money(Math.abs(r.amount))}). ${r.reason}.`,
        history: true,
      });
    }
    for (const p of s.paymentsByClaim.get(claim.id) ?? []) {
      if (isUserCreated(p.id)) continue;
      rows.push({
        key: p.id + "-req",
        when: p.requestedDate,
        userId: p.requestedBy,
        role: p.requestedByRole,
        action: "Payment requested",
        details: `${moneyCents(p.amount)} ${p.category} to ${p.payee}.`,
        history: true,
      });
      if (p.issuedDate)
        rows.push({
          key: p.id + "-iss",
          when: p.issuedDate,
          userId: p.requestedBy,
          role: p.requestedByRole,
          action: "Payment issued",
          details: `${moneyCents(p.amount)} ${p.category} to ${p.payee}.`,
          history: true,
        });
    }
    if (claim.closedDate && claim.status === "Closed" && !s.audit.some((a) => a.claimId === claim.id && a.action === "Claim closed")) {
      rows.push({ key: "closed", when: claim.closedDate, userId: claim.adjusterId, role: adjRole, action: "Claim closed", details: "", history: true });
    }
  }

  rows.sort((a, b) => b.when.localeCompare(a.when));

  return (
    <Card title="Audit trail">
      <p className="mb-3 text-sm text-slate-700">
        Every change is recorded with who made it, their role, and when. Entries from this session are marked <strong>New</strong>.
      </p>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead className={theadCls}>
            <tr>
              <th className={th}>When</th>
              <th className={th}>User</th>
              <th className={th}>Role</th>
              <th className={th}>Action</th>
              <th className={th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`${rowCls} ${r.history ? "" : "bg-sky-50/60"}`}>
                <td className={`${td} whitespace-nowrap`}>{fmtWhen(r.when)}</td>
                <td className={td}>{userName(r.userId)}</td>
                <td className={td}>{roleLabel(r.role)}</td>
                <td className={td}>
                  {r.action}
                  {!r.history && <span className="ml-1 rounded bg-sky-700 px-1 text-xs font-semibold text-white">New</span>}
                </td>
                <td className={td}>{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
