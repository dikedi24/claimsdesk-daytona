import { FLAG_LABELS, type FlagKind } from "@/lib/finance";
import type { ClaimStatus, ClaimType } from "@/lib/types";

const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap border";

const STATUS: Record<ClaimStatus, string> = {
  Open: "bg-green-50 text-green-800 border-green-300",
  Reopened: "bg-amber-50 text-amber-900 border-amber-300",
  Closed: "bg-slate-100 text-slate-700 border-slate-300",
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={`${base} ${STATUS[status]}`}>{status}</span>;
}

export function TypeBadge({ type }: { type: ClaimType }) {
  const cls = type === "WC" ? "bg-sky-50 text-sky-900 border-sky-300" : "bg-violet-50 text-violet-900 border-violet-300";
  return (
    <span className={`${base} ${cls}`} title={type === "WC" ? "Workers' compensation" : "General liability"}>
      {type}
    </span>
  );
}

const FLAG: Record<FlagKind, string> = {
  under_reserved: "bg-red-50 text-red-800 border-red-300",
  low_reserve: "bg-amber-50 text-amber-900 border-amber-300",
  pending_approval: "bg-blue-50 text-blue-800 border-blue-300",
  escalated: "bg-purple-50 text-purple-800 border-purple-300",
  overdue_diary: "bg-orange-50 text-orange-900 border-orange-300",
};

export function FlagBadge({ flag }: { flag: FlagKind }) {
  return <span className={`${base} ${FLAG[flag]}`}>{FLAG_LABELS[flag]}</span>;
}

export function Flags({ flags }: { flags: FlagKind[] }) {
  if (!flags.length) return <span className="text-slate-500">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <FlagBadge key={f} flag={f} />
      ))}
    </span>
  );
}

export function LitigatedBadge() {
  return <span className={`${base} bg-rose-50 text-rose-800 border-rose-300`}>Litigated</span>;
}
