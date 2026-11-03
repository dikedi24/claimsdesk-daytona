"use client";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { resetDemo, setRole, useAppState } from "@/lib/store";
import { ROLES } from "@/lib/users";
import Notifications from "./Notifications";
import { fmtDate } from "@/lib/format";
import { TODAY } from "@/lib/dates";
import type { Role } from "@/lib/types";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/claims", label: "Claims" },
  { href: "/new-claim", label: "New Claim" },
  { href: "/migration", label: "Migration" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin" },
  { href: "/roadmap", label: "Roadmap" },
];

function Header() {
  const s = useAppState();
  const onReset = () => {
    if (window.confirm("Reset the demo? All changes made in this browser will be cleared.")) resetDemo();
  };
  return (
    <header className="bg-[#0b3a5b] text-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="mr-auto">
          <Link href="/" className="text-xl font-bold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            ClaimsDesk
          </Link>
          <p className="text-sm text-sky-100">City of Daytona Beach · Risk Management</p>
        </div>
        <p className="text-sm text-sky-100" title="The demo always treats today as this date">
          Demo date: <span className="font-semibold text-white">{fmtDate(TODAY)}</span>
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="role" className="text-sm text-sky-100">
            Viewing as
          </label>
          <select
            id="role"
            className="rounded border border-sky-200 bg-white px-2 py-1 text-sm text-slate-900"
            value={s?.role ?? "adjuster_wc"}
            disabled={!s}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r.role} value={r.role}>
                {r.label}
              </option>
            ))}
          </select>
          {s && (
            <span className="text-sm">
              <span className="font-semibold">{s.user.name}</span>
              <span className="text-sky-100"> · {s.user.title}</span>
            </span>
          )}
        </div>
        {s && <Notifications s={s} />}
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-white/70 px-3 py-1 text-sm font-medium hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Reset demo
        </button>
      </div>
    </header>
  );
}

function ActiveNav() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="w-48 shrink-0 border-r border-slate-200 bg-slate-50">
      <ul className="py-3">
        {NAV.map((n) => {
          const active = !!pathname && (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href));
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`block border-l-4 px-4 py-2 text-sm focus:outline-none focus-visible:bg-sky-100 ${
                  active
                    ? "border-[#0b3a5b] bg-white font-semibold text-[#0b3a5b]"
                    : "border-transparent text-slate-700 hover:bg-white hover:text-slate-900"
                }`}
              >
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:p-2">
        Skip to main content
      </a>
      <Header />
      <div className="flex flex-1">
        <Suspense fallback={<NavList pathname={null} />}>
          <ActiveNav />
        </Suspense>
        <main id="main" className="min-w-0 flex-1 px-6 py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
