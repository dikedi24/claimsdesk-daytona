"use client";
// In-app notifications for the current user (e.g. a rejected payment) [3.17].
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { markNotificationsRead } from "@/lib/actions";
import type { AppState } from "@/lib/store";

export default function Notifications({ s }: { s: AppState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mine = s.notifications.filter((n) => n.toUserId === s.user.id).reverse();
  const unread = mine.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => setOpen(!open)}
        className="relative rounded border border-white/70 px-2.5 py-1 text-sm hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-96 rounded border border-slate-300 bg-white text-slate-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <h2 className="text-sm font-semibold">Notifications for {s.user.name}</h2>
            {unread > 0 && (
              <button type="button" className="text-xs font-medium text-[#0b5394] hover:underline" onClick={() => markNotificationsRead(s.user.id)}>
                Mark all read
              </button>
            )}
          </div>
          {mine.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-600">No notifications.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {mine.map((n) => (
                <li key={n.id} className={`border-b border-slate-100 px-3 py-2 text-sm ${n.read ? "" : "bg-sky-50"}`}>
                  {n.claimId ? (
                    <Link href={`/claims/${n.claimId}?tab=payments`} className="hover:underline" onClick={() => setOpen(false)}>
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
