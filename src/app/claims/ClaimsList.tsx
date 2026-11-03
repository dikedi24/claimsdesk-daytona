"use client";
// Claims search and filters [3.4H, 3.5].
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Flags, LitigatedBadge, StatusBadge, TypeBadge } from "@/components/Badges";
import { Loading, PageTitle, linkCls, rowCls, tableCls, td, th, theadCls } from "@/components/ui";
import { DEPARTMENTS, deptLabel } from "@/lib/codes";
import { count, fmtDate, money } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { ADJUSTERS, isAdjuster, userName } from "@/lib/users";

const PAGE = 50;
const selectCls = "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";

interface Filters {
  q: string;
  type: string;
  status: string;
  dept: string;
  adjuster: string;
  litigated: string;
  mine: boolean;
  flagged: boolean;
}

export default function ClaimsList() {
  const s = useAppState();
  const params = useSearchParams();
  const [f, setF] = useState<Filters>(() => ({
    q: "",
    type: "",
    status: params.get("status") ?? "",
    dept: "",
    adjuster: "",
    litigated: "",
    mine: params.get("mine") === "1",
    flagged: params.get("flagged") === "1",
  }));
  const [page, setPage] = useState(0);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setPage(0);
  };

  const rows = useMemo(() => {
    if (!s) return [];
    const q = f.q.trim().toLowerCase();
    return s.claims
      .filter((c) => {
        if (f.type && c.type !== f.type) return false;
        if (f.status === "open" && c.status === "Closed") return false;
        if (f.status === "closed" && c.status !== "Closed") return false;
        if (f.dept && c.department !== f.dept) return false;
        if (f.adjuster && c.adjusterId !== f.adjuster) return false;
        if (f.litigated === "yes" && !c.litigated) return false;
        if (f.litigated === "no" && c.litigated) return false;
        if (f.mine && isAdjuster(s.role) && c.adjusterId !== s.user.id) return false;
        if (f.flagged && c.status === "Closed") return false;
        if (f.flagged && !s.summaries.get(c.id)?.flags.some((x) => x !== "overdue_diary" && x !== "pending_approval"))
          return false;
        if (q) {
          const hay = `${c.number} ${c.claimantName} ${c.description} ${userName(c.adjusterId)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.dateOfLoss.localeCompare(a.dateOfLoss) || b.number.localeCompare(a.number));
  }, [s, f]);

  if (!s) return <Loading />;

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const canMine = isAdjuster(s.role);

  return (
    <div>
      <PageTitle title="Claims" subtitle="Search all workers' compensation and general liability claims." />

      <form
        role="search"
        aria-label="Filter claims"
        onSubmit={(e) => e.preventDefault()}
        className="mb-4 flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-slate-50 p-3"
      >
        <div className="flex min-w-64 flex-1 flex-col">
          <label htmlFor="q" className="text-xs font-semibold text-slate-700">
            Search
          </label>
          <input
            id="q"
            type="search"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Claim number, claimant, description…"
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
        </div>
        <Select id="type" label="Type" value={f.type} onChange={(v) => set("type", v)} options={[["WC", "Workers' comp"], ["GL", "General liability"]]} />
        <Select id="status" label="Status" value={f.status} onChange={(v) => set("status", v)} options={[["open", "Open"], ["closed", "Closed"]]} />
        <Select id="dept" label="Department" value={f.dept} onChange={(v) => set("dept", v)} options={DEPARTMENTS.map((d) => [d.code, d.label])} />
        <Select id="adjuster" label="Adjuster" value={f.adjuster} onChange={(v) => set("adjuster", v)} options={ADJUSTERS.map((u) => [u.id, u.name])} />
        <Select id="litigated" label="Litigated" value={f.litigated} onChange={(v) => set("litigated", v)} options={[["yes", "Yes"], ["no", "No"]]} />
        <div className="flex flex-col gap-1 pb-1 text-sm">
          {canMine && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.mine} onChange={(e) => set("mine", e.target.checked)} /> My claims only
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.flagged} onChange={(e) => set("flagged", e.target.checked)} /> Financial flags only
          </label>
        </div>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
          onClick={() => {
            setF({ q: "", type: "", status: "", dept: "", adjuster: "", litigated: "", mine: false, flagged: false });
            setPage(0);
          }}
        >
          Clear filters
        </button>
      </form>

      <p className="mb-2 text-sm text-slate-700" aria-live="polite">
        {count(rows.length)} claim{rows.length === 1 ? "" : "s"} found
      </p>

      {rows.length === 0 ? (
        <p className="rounded border border-slate-200 p-6 text-center text-slate-600">No claims match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className={tableCls}>
            <caption className="sr-only">Claims matching the current filters</caption>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Claim</th>
                <th className={th}>Type</th>
                <th className={th}>Claimant</th>
                <th className={th}>Department</th>
                <th className={th}>Date of loss</th>
                <th className={th}>Adjuster</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Paid</th>
                <th className={`${th} text-right`}>Outstanding</th>
                <th className={`${th} text-right`}>Incurred</th>
                <th className={th}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const sum = s.summaries.get(c.id)!;
                return (
                  <tr key={c.id} className={rowCls}>
                    <td className={`${td} whitespace-nowrap`}>
                      <Link href={`/claims/${c.id}`} className={linkCls}>
                        {c.number}
                      </Link>
                    </td>
                    <td className={td}>
                      <TypeBadge type={c.type} />
                    </td>
                    <td className={td}>
                      {c.claimantName} {c.litigated && <LitigatedBadge />}
                    </td>
                    <td className={td}>{deptLabel(c.department)}</td>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(c.dateOfLoss)}</td>
                    <td className={td}>{userName(c.adjusterId)}</td>
                    <td className={td}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{money(sum.paid)}</td>
                    <td className={`${td} text-right tabular-nums`}>{money(sum.outstanding)}</td>
                    <td className={`${td} text-right tabular-nums font-medium`}>{money(sum.incurred)}</td>
                    <td className={td}>
                      <Flags flags={sum.flags} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-3 flex items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-xs font-semibold text-slate-700">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
