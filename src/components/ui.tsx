// Small shared UI pieces.
export function PageTitle({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <p role="status" className="text-slate-600">
      Loading claims…
    </p>
  );
}

export function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
export const td = "px-3 py-2 align-top";
export const tableCls = "w-full border-collapse text-sm";
export const theadCls = "border-b border-slate-300 bg-slate-50";
export const rowCls = "border-b border-slate-100 hover:bg-slate-50";
export const linkCls = "font-medium text-[#0b5394] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";
