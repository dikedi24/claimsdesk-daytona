"use client";
// User actions on claims. Each validates against the financial rules, writes to the
// localStorage overlay, and records an audit event [3.4H–R, 3.17].
import { BODY_PARTS, CAUSES, DAMAGE_TYPES, DEPARTMENTS, DIARY_CODES, bodyLabel, causeLabel, deptLabel, diaryLabel } from "./codes";
import { FIELD_LABELS, type ExtractKey } from "./intake";
import { TODAY, addDays, demoTimestamp } from "./dates";
import { LIMIT_ROLE_LABELS, canApprove, claimReserveAfter, requiredLevel } from "./finance";
import { money, moneyCents } from "./format";
import { canEditClaim, canWorkClaim, canReopen } from "./permissions";
import { convert, summaryLine, type ConversionResult, type Corrections, type Mapping } from "./legacy";
import { auditEvent, getState, nextId, setLegacyConversion, updateOverlay, type Overlay } from "./store";
import {
  CATEGORIES,
  type AuthorityLimits,
  type Category,
  type Claim,
  type ClaimType,
  type DiaryEntry,
  type PayeeType,
  type Payment,
} from "./types";
import { DEFAULT_LIMITS, USERS, limitRole, userName } from "./users";

export type Result = { ok: true; message: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const done = (message: string): Result => ({ ok: true, message });

function notify(o: Overlay, toUserId: string, message: string, claimId?: string): Overlay {
  const [id, o2] = nextId(o, "n");
  return { ...o2, notifications: [...o2.notifications, { id, toUserId, message, claimId, read: false, timestamp: demoTimestamp() }] };
}

function claimContext(claimId: string) {
  const s = getState();
  const claim = s.claimsById.get(claimId);
  const sum = s.summaries.get(claimId);
  return { s, claim, sum };
}

const balancesOf = (byCat: Record<Category, { reserve: number }>) =>
  Object.fromEntries(CATEGORIES.map((c) => [c, byCat[c].reserve])) as Record<Category, number>;

// ---------- Reserves ----------

/** Sets a category's reserve. Above the user's authority it waits for approval [3.17D]. */
export function changeReserve(claimId: string, category: Category, newBalance: number, reason: string): Result {
  const { s, claim, sum } = claimContext(claimId);
  if (!claim || !sum) return fail("Claim not found.");
  if (!canEditClaim(s, claim)) return fail("You don't have permission to change this claim.");
  if (!Number.isFinite(newBalance) || newBalance < 0) return fail("Enter a reserve amount of $0 or more.");
  if (!reason.trim()) return fail("A reason is required for every reserve change.");
  const t = sum.byCat[category];
  if (newBalance < t.paid) return fail(`The ${category} reserve can't be less than what has already been paid (${moneyCents(t.paid)}).`);
  if (Math.abs(newBalance - t.reserve) < 0.005) return fail("The new reserve is the same as the current reserve.");
  const pendingSame = (s.reservesByClaim.get(claimId) ?? []).some((r) => r.category === category && r.status === "PendingApproval");
  if (pendingSame) return fail(`A ${category} reserve change is already waiting for approval.`);

  const total = claimReserveAfter(balancesOf(sum.byCat), { category, newBalance });
  const level = requiredLevel("reserve", total, s.role, s.limits);
  const own = level === limitRole(s.role);
  const amount = Math.round((newBalance - t.reserve) * 100) / 100;

  updateOverlay((o) => {
    const [id, o2] = nextId(o, "r");
    const o3 = {
      ...o2,
      reserveTx: [
        ...o2.reserveTx,
        {
          id,
          claimId,
          category,
          date: TODAY,
          amount,
          newBalance,
          byUserId: s.user.id,
          byRole: s.role,
          reason: reason.trim(),
          status: own ? ("Approved" as const) : ("PendingApproval" as const),
        },
      ],
    };
    return auditEvent(
      o3,
      own ? "Reserve changed" : "Reserve change submitted for approval",
      claimId,
      `${category}: ${money(t.reserve)} → ${money(newBalance)} (claim total ${money(total)}). Reason: ${reason.trim()}.` +
        (own ? "" : ` Exceeds your authority; routed to ${LIMIT_ROLE_LABELS[level]}.`),
    );
  });
  return done(
    own
      ? `${category} reserve set to ${money(newBalance)}.`
      : `Claim total of ${money(total)} exceeds your reserve authority. Sent to ${LIMIT_ROLE_LABELS[level]} for approval.`,
  );
}

export function decideReserve(txId: string, decision: "approve" | "reject", rejectReason = ""): Result {
  const s = getState();
  const r = s.reserves.find((x) => x.id === txId);
  if (!r || r.status !== "PendingApproval") return fail("This reserve change is no longer pending.");
  const sum = s.summaries.get(r.claimId)!;
  const total = claimReserveAfter(balancesOf(sum.byCat), r);
  if (!canApprove(s.role, "reserve", total, r.byRole, s.limits)) return fail("This change is above your approval authority.");
  if (decision === "reject" && !rejectReason.trim()) return fail("A reason is required to reject.");
  if (decision === "approve" && r.newBalance < sum.byCat[r.category].paid)
    return fail(`Payments since the request exceed ${money(r.newBalance)}; ask for a new reserve change.`);

  updateOverlay((o) => {
    const current = sum.byCat[r.category].reserve;
    const update =
      decision === "approve"
        ? { status: "Approved" as const, decidedBy: s.user.id, date: TODAY, amount: Math.round((r.newBalance - current) * 100) / 100 }
        : { status: "Rejected" as const, decidedBy: s.user.id, rejectReason: rejectReason.trim() };
    let o2: Overlay = { ...o, reserveUpdates: { ...o.reserveUpdates, [txId]: update } };
    const claimNo = s.claimsById.get(r.claimId)?.number;
    o2 = notify(
      o2,
      r.byUserId,
      decision === "approve"
        ? `${s.user.name} approved your ${r.category} reserve change to ${money(r.newBalance)} on ${claimNo}.`
        : `${s.user.name} rejected your ${r.category} reserve change on ${claimNo}: "${rejectReason.trim()}"`,
      r.claimId,
    );
    return auditEvent(
      o2,
      decision === "approve" ? "Reserve change approved" : "Reserve change rejected",
      r.claimId,
      `${r.category} to ${money(r.newBalance)} requested by ${userName(r.byUserId)}.` +
        (decision === "reject" ? ` Reason: ${rejectReason.trim()}` : ""),
    );
  });
  return done(decision === "approve" ? "Reserve change approved." : "Reserve change rejected and the requester was notified.");
}

// ---------- Payments ----------

export interface PaymentInput {
  category: Category;
  payee: string;
  payeeType: PayeeType;
  amount: number;
  memo: string;
}

/** Money still available in a category: outstanding reserve less payments already in flight. */
export function availableToPay(claimId: string, category: Category, excludePaymentId?: string) {
  const { s, sum } = claimContext(claimId);
  if (!sum) return 0;
  const inFlight = (s.paymentsByClaim.get(claimId) ?? [])
    .filter((p) => p.category === category && p.id !== excludePaymentId && (p.status === "Requested" || p.status === "Approved"))
    .reduce((t, p) => t + p.amount, 0);
  return Math.round((sum.byCat[category].outstanding - inFlight) * 100) / 100;
}

const underReserved = (category: Category, amount: number, available: number) =>
  `Under-reserved: this ${moneyCents(amount)} payment is more than the ${category} reserve still available (${moneyCents(
    Math.max(0, available),
  )}). Increase the reserve first.`;

export function requestPayment(claimId: string, input: PaymentInput): Result {
  const { s, claim } = claimContext(claimId);
  if (!claim) return fail("Claim not found.");
  if (!canEditClaim(s, claim)) return fail("You don't have permission to request payments on this claim.");
  if (!input.payee.trim()) return fail("Enter a payee.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail("Enter a payment amount greater than $0.");
  const amount = Math.round(input.amount * 100) / 100;
  const available = availableToPay(claimId, input.category);
  if (amount > available + 0.005) return fail(underReserved(input.category, amount, available)); // [3.4Q]

  const level = requiredLevel("payment", amount, s.role, s.limits);
  const own = level === limitRole(s.role);
  const firm = claim.litigated && input.payeeType === "defense_firm" ? claim.defenseFirmId : undefined;

  updateOverlay((o) => {
    const [id, o2] = nextId(o, "p");
    const payment: Payment = {
      id,
      claimId,
      category: input.category,
      payee: input.payee.trim(),
      payeeType: input.payeeType,
      defenseFirmId: firm,
      amount,
      requestedDate: TODAY,
      requestedBy: s.user.id,
      requestedByRole: s.role,
      status: own ? "Approved" : "Requested",
      approvedBy: own ? s.user.id : undefined,
      memo: input.memo.trim() || undefined,
    };
    return auditEvent(
      { ...o2, payments: [...o2.payments, payment] },
      own ? "Payment requested and approved (within own authority)" : "Payment requested — routed for approval",
      claimId,
      `${moneyCents(amount)} ${input.category} to ${payment.payee}.` + (own ? "" : ` Requires ${LIMIT_ROLE_LABELS[level]} approval.`),
    );
  });
  return done(
    own
      ? `Payment of ${moneyCents(amount)} approved within your authority. It is ready to issue.`
      : `Payment of ${moneyCents(amount)} exceeds your authority and was sent to ${LIMIT_ROLE_LABELS[level]} for approval.`,
  );
}

export function decidePayment(paymentId: string, decision: "approve" | "reject", rejectReason = ""): Result {
  const s = getState();
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || p.status !== "Requested") return fail("This payment is no longer waiting for approval.");
  if (!canApprove(s.role, "payment", p.amount, p.requestedByRole, s.limits)) return fail("This payment is above your approval authority.");
  if (decision === "reject" && !rejectReason.trim()) return fail("A reason is required to reject a payment.");
  if (decision === "approve") {
    const committed = (s.paymentsByClaim.get(p.claimId) ?? [])
      .filter((x) => x.category === p.category && x.status === "Approved" && x.id !== p.id)
      .reduce((t, x) => t + x.amount, 0);
    const available = s.summaries.get(p.claimId)!.byCat[p.category].outstanding - committed;
    if (p.amount > available + 0.005) return fail(underReserved(p.category, p.amount, available));
  }
  const claimNo = s.claimsById.get(p.claimId)?.number;

  updateOverlay((o) => {
    const update: Partial<Payment> =
      decision === "approve"
        ? { status: "Approved", approvedBy: s.user.id }
        : { status: "Rejected", rejectedBy: s.user.id, rejectReason: rejectReason.trim() };
    let o2: Overlay = { ...o, paymentUpdates: { ...o.paymentUpdates, [paymentId]: { ...o.paymentUpdates[paymentId], ...update } } };
    o2 = notify(
      o2,
      p.requestedBy,
      decision === "approve"
        ? `${s.user.name} approved your ${moneyCents(p.amount)} payment to ${p.payee} on ${claimNo}.`
        : `${s.user.name} rejected your ${moneyCents(p.amount)} payment to ${p.payee} on ${claimNo}: "${rejectReason.trim()}"`,
      p.claimId,
    );
    return auditEvent(
      o2,
      decision === "approve" ? "Payment approved" : "Payment rejected",
      p.claimId,
      `${moneyCents(p.amount)} ${p.category} to ${p.payee}, requested by ${userName(p.requestedBy)}.` +
        (decision === "reject" ? ` Reason: ${rejectReason.trim()}` : ""),
    );
  });
  return done(decision === "approve" ? "Payment approved. It is ready to issue." : "Payment rejected and the requester was notified.");
}

export function issuePayment(paymentId: string): Result {
  const s = getState();
  const p = s.payments.find((x) => x.id === paymentId);
  if (!p || p.status !== "Approved") return fail("Only approved payments can be issued.");
  const claim = s.claimsById.get(p.claimId)!;
  if (!canEditClaim(s, claim)) return fail("You don't have permission to issue payments on this claim.");
  const outstanding = s.summaries.get(p.claimId)!.byCat[p.category].outstanding;
  if (p.amount > outstanding + 0.005) return fail(underReserved(p.category, p.amount, outstanding));

  updateOverlay((o) =>
    auditEvent(
      { ...o, paymentUpdates: { ...o.paymentUpdates, [paymentId]: { ...o.paymentUpdates[paymentId], status: "Issued", issuedDate: TODAY } } },
      "Payment issued",
      p.claimId,
      `${moneyCents(p.amount)} ${p.category} to ${p.payee}.`,
    ),
  );
  return done(`Payment of ${moneyCents(p.amount)} issued to ${p.payee}.`);
}

// ---------- Close / reopen ----------

/** Items that must be resolved before a claim can close. */
export function closeBlockers(claimId: string): string[] {
  const s = getState();
  const out: string[] = [];
  for (const p of s.paymentsByClaim.get(claimId) ?? []) {
    if (p.status === "Requested") out.push(`Payment of ${moneyCents(p.amount)} to ${p.payee} is waiting for approval.`);
    if (p.status === "Approved") out.push(`Payment of ${moneyCents(p.amount)} to ${p.payee} is approved but not issued.`);
  }
  for (const r of s.reservesByClaim.get(claimId) ?? [])
    if (r.status === "PendingApproval") out.push(`${r.category} reserve change to ${money(r.newBalance)} is waiting for approval.`);
  return out;
}

export function closeClaim(claimId: string): Result {
  const { s, claim, sum } = claimContext(claimId);
  if (!claim || !sum) return fail("Claim not found.");
  if (!canEditClaim(s, claim)) return fail("You don't have permission to close this claim.");
  const blockers = closeBlockers(claimId);
  if (blockers.length) return fail(`This claim can't be closed yet: ${blockers.join(" ")}`);

  updateOverlay((o) => {
    let o2 = o;
    for (const cat of CATEGORIES) {
      const t = sum.byCat[cat];
      if (Math.abs(t.reserve - t.paid) < 0.005) continue;
      const [id, next] = nextId(o2, "r");
      o2 = {
        ...next,
        reserveTx: [
          ...next.reserveTx,
          {
            id,
            claimId,
            category: cat,
            date: TODAY,
            amount: Math.round((t.paid - t.reserve) * 100) / 100,
            newBalance: t.paid,
            byUserId: s.user.id,
            byRole: s.role,
            reason: "Closing adjustment — reserve to paid",
            status: "Approved",
          },
        ],
      };
    }
    o2 = { ...o2, claimEdits: { ...o2.claimEdits, [claimId]: { ...o2.claimEdits[claimId], status: "Closed", closedDate: TODAY } } };
    return auditEvent(o2, "Claim closed", claimId, `Outstanding reserves of ${money(sum.outstanding)} released; total incurred ${money(sum.paid)}.`);
  });
  return done(`Claim closed. Outstanding reserves set to $0; total incurred is ${money(sum.paid)}.`);
}

export function reopenClaim(claimId: string, reason: string): Result {
  const { s, claim } = claimContext(claimId);
  if (!claim) return fail("Claim not found.");
  if (!canReopen(s.role) || !canWorkClaim(s, claim)) return fail("Only a Supervisor or the Risk Manager can reopen a claim.");
  if (claim.status !== "Closed") return fail("This claim is not closed.");
  if (!reason.trim()) return fail("A reason is required to reopen a claim.");
  updateOverlay((o) =>
    auditEvent(
      { ...o, claimEdits: { ...o.claimEdits, [claimId]: { ...o.claimEdits[claimId], status: "Reopened", closedDate: "" } } },
      "Claim reopened",
      claimId,
      `Reason: ${reason.trim()}`,
    ),
  );
  return done("Claim reopened. Set new reserves as needed.");
}

// ---------- Diary [3.4I, 3.4K, 3.4L] ----------

export function addDiary(claimId: string, code: string, note: string, dueDate: string): Result {
  const { s, claim } = claimContext(claimId);
  if (!claim) return fail("Claim not found.");
  if (!canEditClaim(s, claim)) return fail("You don't have permission to add diary entries on this claim.");
  if (!note.trim()) return fail("Enter a note or pick a standard entry.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return fail("Choose a due date.");
  updateOverlay((o) => {
    const [id, o2] = nextId(o, "d");
    const entry: DiaryEntry = { id, claimId, dueDate, code: code || "CUSTOM", note: note.trim(), ownerId: s.user.id, completed: false, createdDate: TODAY };
    return auditEvent({ ...o2, diary: [...o2.diary, entry] }, "Diary entry added", claimId, `"${entry.note}" due ${dueDate}.`);
  });
  return done("Diary entry added.");
}

export function defaultDueDate(code: string) {
  return addDays(TODAY, DIARY_CODES.find((d) => d.code === code)?.days ?? 7);
}

function ownedEntry(id: string) {
  const s = getState();
  const d = s.diary.find((x) => x.id === id);
  if (!d) return { s, error: "Diary entry not found." };
  if (d.ownerId !== s.user.id) return { s, error: `Locked: only ${userName(d.ownerId)} can change this entry.` };
  return { s, d };
}

export function updateDiary(id: string, note: string, dueDate: string): Result {
  const { d, error } = ownedEntry(id);
  if (!d) return fail(error!);
  if (!note.trim()) return fail("The note can't be empty.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return fail("Choose a due date.");
  updateOverlay((o) =>
    auditEvent(
      { ...o, diaryUpdates: { ...o.diaryUpdates, [id]: { ...o.diaryUpdates[id], note: note.trim(), dueDate } } },
      "Diary entry edited",
      d.claimId,
      `"${note.trim()}" due ${dueDate}.`,
    ),
  );
  return done("Diary entry updated.");
}

export function completeDiary(id: string): Result {
  const { d, error } = ownedEntry(id);
  if (!d) return fail(error!);
  updateOverlay((o) =>
    auditEvent(
      { ...o, diaryUpdates: { ...o.diaryUpdates, [id]: { ...o.diaryUpdates[id], completed: true } } },
      "Diary entry completed",
      d.claimId,
      `"${d.note}"`,
    ),
  );
  return done("Diary entry marked complete.");
}

// ---------- Notifications ----------

export function markNotificationsRead(userId: string) {
  updateOverlay((o) => ({ ...o, notifications: o.notifications.map((n) => (n.toUserId === userId ? { ...n, read: true } : n)) }));
}

// ---------- Authority limits [3.17C] ----------

export function saveLimits(limits: AuthorityLimits): Result {
  const s = getState();
  if (s.role !== "risk_manager") return fail("Only the Risk Manager can change authority limits.");
  for (const [lr, l] of Object.entries(limits)) {
    for (const v of [l.reserve, l.payment]) if (v !== null && (!Number.isFinite(v) || v < 0)) return fail(`Invalid amount for ${lr}.`);
  }
  const fmt = (n: number | null) => (n === null ? "unlimited" : money(n));
  const changes = (Object.keys(limits) as (keyof AuthorityLimits)[])
    .flatMap((lr) =>
      (["reserve", "payment"] as const)
        .filter((k) => limits[lr][k] !== s.limits[lr][k])
        .map((k) => `${LIMIT_ROLE_LABELS[lr]} ${k}: ${fmt(s.limits[lr][k])} → ${fmt(limits[lr][k])}`),
    )
    .join("; ");
  if (!changes) return fail("No changes to save.");
  updateOverlay((o) => auditEvent({ ...o, limits }, "Authority limits changed", undefined, changes));
  return done("Authority limits saved. Approval routing has been updated.");
}

export function restoreDefaultLimits(): Result {
  return saveLimits(DEFAULT_LIMITS);
}

export const canEditLimits = (role: string) => role === "risk_manager";

// ---------- Legacy conversion [3.2D, 3.21] ----------

/** Plain-language outcome for a re-validated row. */
export function correctionOutcome(r: ConversionResult, line: number): Result {
  const held = r.held.find((h) => h.row === line);
  if (held) return fail(`Line ${line} is still held for correction: ${held.detail}`);
  if (r.duplicates.some((d) => d.row === line)) return fail(`Line ${line} now duplicates an earlier claim number and is excluded.`);
  return done(`Line ${line} now passes validation and converts.`);
}

export function approveConversion(
  result: ConversionResult,
  rows: Record<string, string>[],
  mapping: Mapping,
  corrections: Corrections,
  fileName: string,
  bundled: boolean,
): Result {
  const s = getState();
  if (s.role !== "risk_manager") return fail("Only the Risk Manager can approve the conversion.");
  if (s.migration) return fail("A conversion has already been approved. Roll it back first to approve a different file.");
  const t = result.totals;
  setLegacyConversion(rows, result);
  updateOverlay((o) =>
    auditEvent(
      {
        ...o,
        migration: { approvedAt: demoTimestamp(), approvedBy: s.user.id, fileName, bundled, mapping, corrections, converted: result.converted.length },
      },
      "Legacy conversion approved",
      undefined,
      `${fileName}: ${t.source.rows} source records — ${summaryLine(result)}. ` +
        `Converted paid ${money(t.converted.paid)}, outstanding ${money(t.converted.outstanding)}; held for correction ${money(t.held.paid)} paid. Control totals tie out.`,
    ),
  );
  return done(`Conversion approved. ${summaryLine(result)}.`);
}

/** Fixes a held row after approval and re-validates it; if it passes, it converts immediately. */
export function correctLegacyRow(line: number, fix: Record<string, string>): Result {
  const s = getState();
  if (s.role !== "risk_manager") return fail("Only the Risk Manager can correct held rows.");
  const m = s.migration;
  if (!m || !s.legacyRows) return fail("The converted data is not loaded yet.");
  const before = s.legacyRows[line - 2];
  const claimNumber = s.legacyResult?.held.find((h) => h.row === line)?.claimNumber;
  const corrections: Corrections = { ...m.corrections, [line]: { ...m.corrections?.[line], ...fix } };
  const result = convert(s.legacyRows, m.mapping, corrections);
  const outcome = correctionOutcome(result, line);
  setLegacyConversion(s.legacyRows, result);
  const was = (col: string) => m.corrections?.[line]?.[col] ?? before?.[col] ?? "";
  const changes =
    Object.entries(fix)
      .filter(([col, v]) => v !== was(col))
      .map(([col, v]) => `${col}: "${was(col)}" → "${v}"`)
      .join("; ") || "no values changed";
  updateOverlay((o) =>
    auditEvent(
      { ...o, migration: { ...m, corrections, converted: result.converted.length } },
      outcome.ok ? "Held legacy row corrected and converted" : "Held legacy row corrected (still held)",
      undefined,
      `Line ${line}${claimNumber ? ` (${claimNumber})` : ""}: ${changes}`,
    ),
  );
  return outcome;
}

export function rollbackConversion(): Result {
  const s = getState();
  if (s.role !== "risk_manager") return fail("Only the Risk Manager can roll back the conversion.");
  if (!s.migration) return fail("There is no approved conversion to roll back.");
  setLegacyConversion(null, null);
  updateOverlay((o) => auditEvent({ ...o, migration: undefined }, "Legacy conversion rolled back", undefined, s.migration!.fileName));
  return done("Conversion rolled back. Converted claims have been removed.");
}

// ---------- Claim intake [3.3, 3.4G, 3.16] ----------

export interface NewClaimInput {
  type: string;
  claimantName: string;
  department: string;
  dateOfLoss: string;
  dateReported: string;
  cause: string;
  bodyPartOrDamage: string;
  description: string;
  adjusterId: string;
}

/** What the AI (or offline parser) suggested, so the audit trail can record what was accepted. */
export interface IntakeAssist {
  source: "ai" | "offline";
  model?: string;
  suggested: Partial<Record<ExtractKey, string>>;
}

export const canCreateClaims = (role: string) => role !== "readonly";

/** Required-field and consistency checks. Returns field → message. */
export function validateNewClaim(v: NewClaimInput): Partial<Record<keyof NewClaimInput, string>> {
  const e: Partial<Record<keyof NewClaimInput, string>> = {};
  if (v.type !== "WC" && v.type !== "GL") e.type = "Choose WC or GL.";
  if (v.claimantName.trim().length < 2) e.claimantName = "Enter the claimant's name.";
  else if (v.claimantName.trim().length > 80) e.claimantName = "Keep the claimant's name to 80 characters or fewer.";
  if (!DEPARTMENTS.some((d) => d.code === v.department)) e.department = "Choose a department.";
  const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  if (!dateOk(v.dateOfLoss)) e.dateOfLoss = "Enter the date of loss.";
  else if (v.dateOfLoss > TODAY) e.dateOfLoss = "The date of loss can't be in the future.";
  if (!dateOk(v.dateReported)) e.dateReported = "Enter the date reported.";
  else if (v.dateReported > TODAY) e.dateReported = "The date reported can't be in the future.";
  else if (dateOk(v.dateOfLoss) && v.dateReported < v.dateOfLoss) e.dateReported = "The date reported can't be before the date of loss.";
  const cause = CAUSES.find((c) => c.code === v.cause);
  if (!cause || (v.type && cause.type !== v.type)) e.cause = "Choose a cause.";
  const bodyList = v.type === "GL" ? DAMAGE_TYPES : BODY_PARTS;
  if (!bodyList.some((b) => b.code === v.bodyPartOrDamage)) e.bodyPartOrDamage = v.type === "GL" ? "Choose a damage type." : "Choose a body part.";
  if (v.description.trim().length < 10) e.description = "Describe what happened (at least 10 characters).";
  else if (v.description.trim().length > 1000) e.description = "Keep the description to 1,000 characters or fewer.";
  const adj = USERS.find((u) => u.id === v.adjusterId);
  if (!adj || (v.type === "WC" && adj.role !== "adjuster_wc") || (v.type === "GL" && adj.role !== "adjuster_gl"))
    e.adjusterId = "Choose an adjuster for this claim type.";
  return e;
}

const displayValue = (k: ExtractKey, v: string) =>
  k === "department" ? deptLabel(v) : k === "cause" ? causeLabel(v) : k === "bodyPartOrDamage" ? bodyLabel(v) : v;

/** Saves a new claim. Only called when a person clicks Save; AI suggestions are never saved on their own. */
export function createClaim(v: NewClaimInput, assist?: IntakeAssist): Result & { claimId?: string } {
  const s = getState();
  if (!canCreateClaims(s.role)) return fail("Read-only staff can't create claims.");
  const errors = validateNewClaim(v);
  if (Object.keys(errors).length) return fail("Some fields need attention before saving.");

  const type = v.type as ClaimType;
  const year = v.dateOfLoss.slice(0, 4);
  const prefix = `${type}-${year}-`;
  const seq = s.claims.reduce((m, c) => (c.number.startsWith(prefix) ? Math.max(m, Number(c.number.slice(prefix.length)) || 0) : m), 0) + 1;
  const number = `${prefix}${String(seq).padStart(4, "0")}`;
  const claim: Claim = {
    id: number,
    number,
    type,
    status: "Open",
    claimantName: v.claimantName.trim(),
    department: v.department,
    dateOfLoss: v.dateOfLoss,
    dateReported: v.dateReported,
    cause: v.cause,
    bodyPartOrDamage: v.bodyPartOrDamage,
    description: v.description.trim(),
    adjusterId: v.adjusterId,
    litigated: false,
    source: "user",
  };

  updateOverlay((o) => {
    let o2: Overlay = { ...o, newClaims: [...o.newClaims, claim] };
    o2 = auditEvent(o2, "Claim created", number, `${type} claim for ${claim.claimantName}, ${deptLabel(claim.department)}; assigned to ${userName(claim.adjusterId)}.`);

    if (assist && Object.keys(assist.suggested).length) {
      const keys = Object.keys(assist.suggested) as ExtractKey[];
      const accepted = keys.filter((k) => assist.suggested[k] === v[k]);
      const changed = keys.filter((k) => assist.suggested[k] !== v[k]);
      const by = assist.source === "ai" ? `AI (${assist.model ?? "Claude"})` : "Offline rule-based parser";
      const details =
        `${by} suggested ${keys.length} field(s). ` +
        `Accepted as suggested: ${accepted.map((k) => FIELD_LABELS[k]).join(", ") || "none"}. ` +
        `Changed before saving: ${
          changed.map((k) => `${FIELD_LABELS[k]} (suggested "${displayValue(k, assist.suggested[k]!)}", saved "${displayValue(k, v[k])}")`).join("; ") || "none"
        }. Reviewed and saved by ${s.user.name}.`;
      o2 = auditEvent(o2, assist.source === "ai" ? "AI-assisted intake reviewed" : "Report-assisted intake reviewed", number, details);
    }

    // Starting reminder for the assigned adjuster [3.4I].
    const [id, o3] = nextId(o2, "d");
    o2 = {
      ...o3,
      diary: [
        ...o3.diary,
        { id, claimId: number, dueDate: defaultDueDate("STMT"), code: "STMT", note: diaryLabel("STMT"), ownerId: v.adjusterId, completed: false, createdDate: TODAY },
      ],
    };
    return o2;
  });
  return { ok: true, message: `Claim ${number} created.`, claimId: number };
}
