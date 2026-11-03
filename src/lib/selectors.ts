// Role-aware views over app state used by the dashboard and claims list.
import { TODAY } from "./dates";
import { canApprove, claimReserveAfter, requiredLevel, type FlagKind } from "./finance";
import type { AppState } from "./store";
import type { Category, Claim, DiaryEntry, LimitRole, Role } from "./types";
import { isAdjuster, isManager } from "./users";

/** Adjusters see their own caseload; everyone else sees the whole office. */
export const seesOwnCaseloadOnly = (role: Role) => isAdjuster(role);

export function scopedClaims(s: AppState): Claim[] {
  return seesOwnCaseloadOnly(s.role) ? s.claims.filter((c) => c.adjusterId === s.user.id) : s.claims;
}

export function myOpenClaims(s: AppState): Claim[] {
  return scopedClaims(s)
    .filter((c) => c.status !== "Closed")
    .sort((a, b) => b.dateReported.localeCompare(a.dateReported));
}

export interface ApprovalItem {
  kind: "payment" | "reserve";
  id: string;
  claimId: string;
  category: Category;
  amount: number; // payment amount, or reserve change
  checkedAmount: number; // what authority is checked against
  date: string;
  requestedBy: string;
  requestedByRole: Role;
  level: LimitRole; // level whose authority is required
  detail: string;
  canAct: boolean;
}

export function allPendingApprovals(s: AppState): ApprovalItem[] {
  const items: ApprovalItem[] = [];
  for (const p of s.payments) {
    if (p.status !== "Requested") continue;
    items.push({
      kind: "payment",
      id: p.id,
      claimId: p.claimId,
      category: p.category,
      amount: p.amount,
      checkedAmount: p.amount,
      date: p.requestedDate,
      requestedBy: p.requestedBy,
      requestedByRole: p.requestedByRole,
      level: requiredLevel("payment", p.amount, p.requestedByRole, s.limits),
      detail: `Payment to ${p.payee}${p.memo ? ` — ${p.memo}` : ""}`,
      canAct: canApprove(s.role, "payment", p.amount, p.requestedByRole, s.limits),
    });
  }
  for (const r of s.reserves) {
    if (r.status !== "PendingApproval") continue;
    const sum = s.summaries.get(r.claimId);
    const balances = { Medical: 0, Indemnity: 0, Expense: 0 } as Record<Category, number>;
    if (sum) for (const c of Object.keys(balances) as Category[]) balances[c] = sum.byCat[c].reserve;
    const total = claimReserveAfter(balances, r);
    items.push({
      kind: "reserve",
      id: r.id,
      claimId: r.claimId,
      category: r.category,
      amount: r.amount,
      checkedAmount: total,
      date: r.date,
      requestedBy: r.byUserId,
      requestedByRole: r.byRole,
      level: requiredLevel("reserve", total, r.byRole, s.limits),
      detail: `Reserve change — ${r.reason}`,
      canAct: canApprove(s.role, "reserve", total, r.byRole, s.limits),
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/** Adjusters: their own requests. Supervisor/RM: items they can approve. Read-only: everything (view only). */
export function pendingApprovalsFor(s: AppState): ApprovalItem[] {
  const all = allPendingApprovals(s);
  if (isAdjuster(s.role)) return all.filter((i) => i.requestedBy === s.user.id);
  if (isManager(s.role)) return all.filter((i) => i.canAct);
  return all;
}

export function overdueDiaryFor(s: AppState): DiaryEntry[] {
  const scope = new Set(scopedClaims(s).filter((c) => c.status !== "Closed").map((c) => c.id));
  return s.diary
    .filter((d) => !d.completed && d.dueDate < TODAY && scope.has(d.claimId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

const FINANCIAL_FLAGS: FlagKind[] = ["under_reserved", "low_reserve", "escalated"];

export function flaggedClaimsFor(s: AppState): Claim[] {
  return myOpenClaims(s).filter((c) => s.summaries.get(c.id)?.flags.some((f) => FINANCIAL_FLAGS.includes(f)));
}
