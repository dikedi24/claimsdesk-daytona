import { PageTitle } from "./ui";

export default function Placeholder({ title, summary, items }: { title: string; summary: string; items: string[] }) {
  return (
    <div className="max-w-3xl">
      <PageTitle title={title} subtitle={summary} />
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">Coming in a later build of this demo:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
