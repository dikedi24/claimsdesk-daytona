"use client";
// Claim workspace: header, permissions bar and tabs [3.4H–R, 3.11, 3.17].
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useRef, useState } from "react";
import { Loading, linkCls } from "@/components/ui";
import { useAppState } from "@/lib/store";
import AuditTab from "./AuditTab";
import ClaimHeader from "./ClaimHeader";
import DiaryTab from "./DiaryTab";
import OverviewTab from "./OverviewTab";
import PaymentsTab from "./PaymentsTab";
import ReservesTab from "./ReservesTab";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "reserves", label: "Reserves" },
  { key: "payments", label: "Payments" },
  { key: "diary", label: "Diary" },
  { key: "audit", label: "Audit trail" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ClaimView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const initial = TABS.find((t) => t.key === search.get("tab"))?.key ?? "overview";
  const [tab, setTab] = useState<TabKey>(initial);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = useAppState();
  if (!s) return <Loading />;

  const claim = s.claimsById.get(decodeURIComponent(id));
  if (!claim) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Claim not found</h1>
        <p className="mt-2">
          <Link href="/claims" className={linkCls}>
            Back to claims
          </Link>
        </p>
      </div>
    );
  }

  const counts: Partial<Record<TabKey, number>> = {
    payments: (s.paymentsByClaim.get(claim.id) ?? []).filter((p) => p.status === "Requested" || p.status === "Approved").length,
    reserves: (s.reservesByClaim.get(claim.id) ?? []).filter((r) => r.status === "PendingApproval").length,
    diary: s.summaries.get(claim.id)!.overdueDiary,
  };

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + TABS.length) % TABS.length;
    setTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link href="/claims" className={linkCls}>
          ← Claims
        </Link>
      </p>
      <ClaimHeader s={s} claim={claim} />

      <div role="tablist" aria-label="Claim sections" className="flex flex-wrap gap-1 border-b border-slate-300">
        {TABS.map((t, i) => {
          const selected = tab === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onKey(e, i)}
              className={`-mb-px rounded-t border px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                selected
                  ? "border-slate-300 border-b-white bg-white font-semibold text-[#0b3a5b]"
                  : "border-transparent text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t.label}
              {!!counts[t.key] && (
                <span className="ml-1.5 rounded-full bg-blue-700 px-1.5 text-xs font-semibold text-white">{counts[t.key]}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="focus:outline-none">
        {tab === "overview" && <OverviewTab s={s} claim={claim} />}
        {tab === "reserves" && <ReservesTab s={s} claim={claim} />}
        {tab === "payments" && <PaymentsTab s={s} claim={claim} />}
        {tab === "diary" && <DiaryTab s={s} claim={claim} />}
        {tab === "audit" && <AuditTab s={s} claim={claim} />}
      </div>
    </div>
  );
}
