// Core data model for ClaimsDesk. Dates are ISO "YYYY-MM-DD" strings (timestamps are full ISO).

export type ClaimType = "WC" | "GL";
export type ClaimStatus = "Open" | "Closed" | "Reopened";
export type Category = "Medical" | "Indemnity" | "Expense";
export const CATEGORIES: Category[] = ["Medical", "Indemnity", "Expense"];

export type Role = "adjuster_wc" | "adjuster_gl" | "supervisor" | "risk_manager" | "readonly";

export interface User {
  id: string;
  name: string;
  title: string;
  role: Role;
}

export interface Claim {
  id: string;
  number: string; // WC-2026-0001 / GL-2026-0001 / legacy L-0012345
  type: ClaimType;
  status: ClaimStatus;
  claimantName: string;
  department: string; // department code, see codes.ts
  dateOfLoss: string;
  dateReported: string;
  cause: string; // cause code
  bodyPartOrDamage: string; // body part code (WC) or damage type code (GL)
  description: string;
  adjusterId: string;
  litigated: boolean;
  defenseFirmId?: string;
  closedDate?: string;
  source: "seed" | "user" | "legacy";
}

// A reserve transaction sets the category's total reserve to newBalance (amount = change).
// Outstanding = reserve − paid. Pending transactions do not count until approved [3.17D].
export interface ReserveTransaction {
  id: string;
  claimId: string;
  category: Category;
  date: string;
  amount: number;
  newBalance: number;
  byUserId: string;
  byRole: Role;
  reason: string;
  status: "Approved" | "PendingApproval" | "Rejected";
}

export type PaymentStatus = "Requested" | "Approved" | "Rejected" | "Issued";
export type PayeeType = "provider" | "claimant" | "defense_firm" | "vendor";

export interface Payment {
  id: string;
  claimId: string;
  category: Category;
  payee: string;
  payeeType: PayeeType;
  defenseFirmId?: string;
  amount: number;
  requestedDate: string;
  requestedBy: string;
  requestedByRole: Role;
  status: PaymentStatus;
  approvedBy?: string;
  rejectReason?: string;
  issuedDate?: string;
  memo?: string;
}

export interface DiaryEntry {
  id: string;
  claimId: string;
  dueDate: string;
  code: string;
  note: string;
  ownerId: string;
  completed: boolean;
  createdDate: string;
}

export interface AuditEvent {
  id: string;
  claimId?: string;
  timestamp: string;
  userId: string;
  role: Role;
  action: string;
  details?: string;
}

export interface Notification {
  id: string;
  toUserId: string;
  message: string;
  claimId?: string;
  read: boolean;
  timestamp: string;
}

// null = unlimited. Adjusters share one limit row [3.17C].
export type LimitRole = "adjuster" | "supervisor" | "risk_manager";
export type AuthorityLimits = Record<LimitRole, { reserve: number | null; payment: number | null }>;

export interface SeedData {
  claims: Claim[];
  reserves: ReserveTransaction[];
  payments: Payment[];
  diary: DiaryEntry[];
}
