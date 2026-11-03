"use client";
// Dashboard: my open claims, pending approvals, overdue diary items, and flags [3.4K, 3.17D].
import Link from "next/link";
import { Flags, StatusBadge, TypeBadge } from "@/components/Badges";
import { Card, Loading, PageTitle, linkCls, rowCls, tableCls, td, th, theadCls } from "@/components/ui";
import { LIMIT_ROLE_LABELS } from "@/lib/finance";
import { count, fmtDate, money } from "@/lib/format";
import { daysBetween, TODAY } from "@/lib/dates";
import { diaryLabel, deptLabel } from "@/lib/codes";
import {
  flaggedClaimsFor,
  myOpenClaims,
  overdueDiaryFor,
  pendingApprovalsFor,
  seesOwnCaseloadOnly,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { isAdjuster, userName } from "@/lib/users";

function Stat({ label, value, href, tone = "slate" }: { label: string; value: number; href: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "border-slate-300",
    blue: "border-blue-400",
    red: "border-red-400",
    amber: "border-amber-400",
  };
  return (
    <Link
      href={href}
      className={`block rounded border border-l-8 bg-white px-4 py-3 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${tones[tone]}`}
    >
      <span className="block text-3xl font-bold text-slate-900">{count(value)}</span>
      <span className="text-sm text-slate-700">{label}</span>
    </Link>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-slate-600">{children}</p>;

export default function Dashboard() {
  const s = useAppState();
  if (!s) return <Loading />;

  const own = seesOwnCaseloadOnly(s.role);
  const open = myOpenClaims(s);
  const approvals = pendingApprovalsFor(s);
  const overdue = overdueDiaryFor(s);
  const flagged = flaggedClaimsFor(s);
  const approvalsTitle = isAdjuster(s.role)
    ? "My requests awaiting approval"
    : s.role === "readonly"
      ? "Pending approvals (view only)"
      : "Awaiting your approval";

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Good morning, ${s.user.name.split(" ")[0]}`}
        subtitle={own ? "Your caseload as of today." : "Office-wide view of all adjusters' claims as of today."}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={own ? "My open claims" : "Open claims (all adjusters)"} value={open.length} href={own ? "/claims?mine=1&status=open" : "/claims?status=open"} />
        <Stat label={approvalsTitle} value={approvals.length} href="#approvals" tone="blue" />
        <Stat label="Overdue diary items" value={overdue.length} href="#diary" tone="red" />
        <Stat label="Claims with financial flags" value={flagged.length} href="#flags" tone="amber" />
      </div>

      <div id="approvals">
        <Card title={approvalsTitle}>
          {approvals.length === 0 ? (
            <Empty>Nothing waiting. All requests are within authority or already decided.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead className={theadCls}>
                  <tr>
                    <th className={th}>Claim</th>
                    <th className={th}>Request</th>
                    <th className={th}>Category</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={th}>Requested by</th>
                    <th className={th}>Date</th>
                    <th className={th}>Needs approval from</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id} className={rowCls}>
                      <td className={td}>
                        <Link href={`/claims/${a.claimId}?tab=${a.kind === "payment" ? "payments" : "reserves"}`} className={linkCls}>
                          {s.claimsById.get(a.claimId)?.number}
                        </Link>
                      </td>
                      <td className={td}>{a.detail}</td>
                      <td className={td}>{a.category}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        {a.kind === "reserve" ? `+${money(a.amount)}` : money(a.amount)}
                        {a.kind === "reserve" && (
                          <span className="block text-xs text-slate-500">claim total {money(a.checkedAmount)}</span>
                        )}
                      </td>
                      <td className={td}>{userName(a.requestedBy)}</td>
                      <td className={td}>{fmtDate(a.date)}</td>
                      <td className={td}>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                            a.level === "risk_manager"
                              ? "border-purple-300 bg-purple-50 text-purple-800"
                              : "border-blue-300 bg-blue-50 text-blue-800"
                          }`}
                        >
                          {a.level === "risk_manager" ? "Escalated: " : ""}
                          {LIMIT_ROLE_LABELS[a.level]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div id="diary">
          <Card title="Overdue diary items">
            {overdue.length === 0 ? (
              <Empty>No overdue diary items.</Empty>
            ) : (
              <table className={tableCls}>
                <thead className={theadCls}>
                  <tr>
                    <th className={th}>Claim</th>
                    <th className={th}>Reminder</th>
                    {!own && <th className={th}>Owner</th>}
                    <th className={th}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.slice(0, 15).map((d) => (
                    <tr key={d.id} className={rowCls}>
                      <td className={td}>
                        <Link href={`/claims/${d.claimId}?tab=diary`} className={linkCls}>
                          {s.claimsById.get(d.claimId)?.number}
                        </Link>
                      </td>
                      <td className={td}>{diaryLabel(d.code)}</td>
                      {!own && <td className={td}>{userName(d.ownerId)}</td>}
                      <td className={td}>
                        {fmtDate(d.dueDate)}{" "}
                        <span className="text-xs font-semibold text-red-700">({daysBetween(d.dueDate, TODAY)} days late)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {overdue.length > 15 && <p className="mt-2 text-sm text-slate-600">Showing 15 of {overdue.length}.</p>}
          </Card>
        </div>

        <div id="flags">
          <Card
            title="Financial flags"
            action={
              <Link href="/claims?flagged=1" className={`${linkCls} text-sm`}>
                View all
              </Link>
            }
          >
            {flagged.length === 0 ? (
              <Empty>No open claims are flagged.</Empty>
            ) : (
              <table className={tableCls}>
                <thead className={theadCls}>
                  <tr>
                    <th className={th}>Claim</th>
                    <th className={th}>Claimant</th>
                    <th className={`${th} text-right`}>Outstanding</th>
                    <th className={th}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.slice(0, 15).map((c) => {
                    const sum = s.summaries.get(c.id)!;
                    return (
                      <tr key={c.id} className={rowCls}>
                        <td className={td}>
                          <Link href={`/claims/${c.id}`} className={linkCls}>
                            {c.number}
                          </Link>
                        </td>
                        <td className={td}>{c.claimantName}</td>
                        <td className={`${td} text-right tabular-nums`}>{money(sum.outstanding)}</td>
                        <td className={td}>
                          <Flags flags={sum.flags.filter((f) => f !== "overdue_diary")} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {flagged.length > 15 && <p className="mt-2 text-sm text-slate-600">Showing 15 of {flagged.length}.</p>}
          </Card>
        </div>
      </div>

      <Card
        title={own ? "My open claims (most recent)" : "Open claims (most recent)"}
        action={
          <Link href={own ? "/claims?mine=1&status=open" : "/claims?status=open"} className={`${linkCls} text-sm`}>
            View all {count(open.length)}
          </Link>
        }
      >
        {open.length === 0 ? (
          <Empty>No open claims.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Claim</th>
                  <th className={th}>Type</th>
                  <th className={th}>Claimant</th>
                  <th className={th}>Department</th>
                  <th className={th}>Reported</th>
                  {!own && <th className={th}>Adjuster</th>}
                  <th className={`${th} text-right`}>Incurred</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {open.slice(0, 10).map((c) => (
                  <tr key={c.id} className={rowCls}>
                    <td className={td}>
                      <Link href={`/claims/${c.id}`} className={linkCls}>
                        {c.number}
                      </Link>
                    </td>
                    <td className={td}>
                      <TypeBadge type={c.type} />
                    </td>
                    <td className={td}>{c.claimantName}</td>
                    <td className={td}>{deptLabel(c.department)}</td>
                    <td className={td}>{fmtDate(c.dateReported)}</td>
                    {!own && <td className={td}>{userName(c.adjusterId)}</td>}
                    <td className={`${td} text-right tabular-nums`}>{money(s.summaries.get(c.id)!.incurred)}</td>
                    <td className={td}>
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
