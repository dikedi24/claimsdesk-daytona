// Financial rules [3.4P, 3.4Q, 3.17]. Everything here is derived; nothing is stored.
// Reserve (per category) = total expected cost. Outstanding = reserve − paid. Incurred = paid + outstanding.
import { TODAY } from "./dates";
import { isAdjuster, limitRole } from "./users";
import {
  CATEGORIES,
  type AuthorityLimits,
  type Category,
  type Claim,
  type DiaryEntry,
  type LimitRole,
  type Payment,
  type ReserveTransaction,
  type Role,
} from "./types";

export interface CategoryTotals {
  reserve: number;
  paid: number;
  outstanding: number;
  pending: number; // requested or approved but not yet issued
}

export type FlagKind = "under_reserved" | "low_reserve" | "pending_approval" | "escalated" | "overdue_diary";

export const FLAG_LABELS: Record<FlagKind, string> = {
  under_reserved: "Under-reserved",
  low_reserve: "Low reserve",
  pending_approval: "Pending approval",
  escalated: "Escalated",
  overdue_diary: "Overdue diary",
};

export interface ClaimSummary {
  byCat: Record<Category, CategoryTotals>;
  reserve: number;
  paid: number;
  outstanding: number;
  incurred: number;
  flags: FlagKind[];
  overdueDiary: number;
  nextDiary?: string;
}

const LADDER: LimitRole[] = ["adjuster", "supervisor", "risk_manager"];
export const LIMIT_ROLE_LABELS: Record<LimitRole, string> = {
  adjuster: "Adjuster",
  supervisor: "Supervisor",
  risk_manager: "Risk Manager",
};

const within = (limit: number | null, amount: number) => limit === null || amount <= limit;

/**
 * Lowest level whose authority covers the amount, starting from the requester's own level [3.17D].
 * If that is the requester's own level, no approval by someone else is needed.
 */
export function requiredLevel(kind: "reserve" | "payment", amount: number, requesterRole: Role, limits: AuthorityLimits): LimitRole {
  const start = Math.max(0, LADDER.indexOf(limitRole(requesterRole) ?? "adjuster"));
  for (let i = start; i < LADDER.length; i++) if (within(limits[LADDER[i]][kind], amount)) return LADDER[i];
  return "risk_manager";
}

/** Can this role approve a pending item of this amount requested by requesterRole? */
export function canApprove(role: Role, kind: "reserve" | "payment", amount: number, requesterRole: Role, limits: AuthorityLimits) {
  const mine = limitRole(role);
  if (!mine || isAdjuster(role)) return false;
  const requester = limitRole(requesterRole) ?? "adjuster";
  if (LADDER.indexOf(mine) <= LADDER.indexOf(requester)) return false;
  return within(limits[mine][kind], amount);
}

const emptyTotals = (): Record<Category, CategoryTotals> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, { reserve: 0, paid: 0, outstanding: 0, pending: 0 }])) as Record<
    Category,
    CategoryTotals
  >;

/** Reserve balance per category, using approved transactions in date order (optionally as of a date). */
export function reserveBalances(reserves: ReserveTransaction[], asOf?: string): Record<Category, number> {
  const out: Record<Category, number> = { Medical: 0, Indemnity: 0, Expense: 0 };
  const sorted = reserves
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === "Approved" && (!asOf || r.date <= asOf))
    .sort((a, b) => a.r.date.localeCompare(b.r.date) || a.i - b.i);
  for (const { r } of sorted) out[r.category] = r.newBalance;
  return out;
}

export function summarize(
  claim: Claim,
  reserves: ReserveTransaction[],
  payments: Payment[],
  diary: DiaryEntry[],
  limits: AuthorityLimits,
): ClaimSummary {
  const byCat = emptyTotals();
  const balances = reserveBalances(reserves);
  for (const cat of CATEGORIES) byCat[cat].reserve = balances[cat];
  for (const p of payments) {
    if (p.status === "Issued") byCat[p.category].paid += p.amount;
    else if (p.status === "Requested" || p.status === "Approved") byCat[p.category].pending += p.amount;
  }

  const flags = new Set<FlagKind>();
  const open = claim.status !== "Closed";
  let reserve = 0;
  let paid = 0;
  for (const cat of CATEGORIES) {
    const t = byCat[cat];
    t.paid = Math.round(t.paid * 100) / 100;
    t.outstanding = open ? Math.max(0, Math.round((t.reserve - t.paid) * 100) / 100) : 0;
    reserve += t.reserve;
    paid += t.paid;
    if (!open) continue;
    if (t.pending > t.outstanding + 0.005) flags.add("under_reserved");
    else if (t.reserve > 0 && t.paid >= 0.8 * t.reserve) flags.add("low_reserve");
  }

  const pendingPays = payments.filter((p) => p.status === "Requested");
  const pendingRes = reserves.filter((r) => r.status === "PendingApproval");
  if (pendingPays.length || pendingRes.length) flags.add("pending_approval");
  const escalated =
    pendingPays.some((p) => requiredLevel("payment", p.amount, p.requestedByRole, limits) === "risk_manager") ||
    pendingRes.some((r) => requiredLevel("reserve", claimReserveAfter(balances, r), r.byRole, limits) === "risk_manager");
  if (escalated) flags.add("escalated");

  const openDiary = diary.filter((d) => !d.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdueDiary = openDiary.filter((d) => d.dueDate < TODAY).length;
  if (open && overdueDiary) flags.add("overdue_diary");

  const outstanding = CATEGORIES.reduce((s, c) => s + byCat[c].outstanding, 0);
  return {
    byCat,
    reserve,
    paid,
    outstanding,
    incurred: paid + outstanding,
    flags: [...flags],
    overdueDiary,
    nextDiary: openDiary[0]?.dueDate,
  };
}

/** Total claim reserve if a pending reserve change were approved (authority is checked on claim total). */
export function claimReserveAfter(balances: Record<Category, number>, r: Pick<ReserveTransaction, "category" | "newBalance">) {
  return CATEGORIES.reduce((s, c) => s + (c === r.category ? r.newBalance : balances[c]), 0);
}
