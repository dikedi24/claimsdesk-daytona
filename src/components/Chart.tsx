"use client";
// Small dependency-free SVG chart: two series by year, grouped bars or lines [3.9F].
// Palette: categorical slots 1–2 of the validated reference palette (blue, orange), checked for
// colour-vision deficiency and contrast. Identity is never colour-alone: legend + direct labels + table.
import { useId, useState } from "react";

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export interface ChartProps {
  data: ({ year: number } & Record<string, number>)[];
  series: SeriesDef[];
  mode: "bar" | "line";
  title: string; // accessible name, e.g. "Claims reported per year, WC vs GL"
  format: (n: number) => string; // full value (tooltip, table)
  formatAxis: (n: number) => string; // compact value (axis ticks)
}

const W = 760;
const H = 300;
const M = { top: 16, right: 44, bottom: 32, left: 64 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/** Round axis maximum and ~5 clean ticks. */
function niceTicks(max: number) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = max / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

/** Bar with a 4px rounded data end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return "";
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export default function Chart({ data, series, mode, title, format, formatAxis }: ChartProps) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] ?? 0)));
  const { top, ticks } = niceTicks(max);
  const n = data.length;
  const band = PLOT_W / Math.max(1, n);
  const yOf = (v: number) => M.top + PLOT_H - (v / top) * PLOT_H;
  const xCenter = (i: number) => M.left + band * i + band / 2;

  // Grouped bars: each bar at most 24px, 2px surface gap between the pair, leftover band is air.
  const gap = 2;
  const barW = Math.max(3, Math.min(24, (band * 0.7 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const labelEvery = n > 12 ? 2 : 1;

  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-slate-800" aria-hidden="true">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-labelledby={`${id}-title`} className="block max-h-80" onMouseLeave={() => setHover(null)}>
          <title id={`${id}-title`}>{title}. The data table below lists every value.</title>
          {/* Recessive grid and y-axis ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={1} />
              <text x={M.left - 8} y={yOf(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="#475569">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {/* X-axis labels */}
          {data.map((d, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={d.year} x={xCenter(i)} y={H - M.bottom + 18} textAnchor="middle" fontSize={12} fill="#475569">
                {d.year}
              </text>
            ) : null,
          )}

          {hover !== null && (
            mode === "bar" ? (
              <rect x={M.left + band * hover} y={M.top} width={band} height={PLOT_H} fill="#f1f5f9" />
            ) : (
              <line x1={xCenter(hover)} x2={xCenter(hover)} y1={M.top} y2={M.top + PLOT_H} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            )
          )}

          {mode === "bar"
            ? data.map((d, i) =>
                series.map((s, k) => {
                  const v = d[s.key] ?? 0;
                  const x = xCenter(i) - groupW / 2 + k * (barW + gap);
                  return <path key={`${d.year}-${s.key}`} d={barPath(x, yOf(v), barW, yOf(0) - yOf(v))} fill={s.color} />;
                }),
              )
            : series.map((s) => {
                const pts = data.map((d, i) => `${xCenter(i)},${yOf(d[s.key] ?? 0)}`).join(" ");
                const last = data[n - 1];
                return (
                  <g key={s.key}>
                    <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {data.map((d, i) => (
                      <circle key={d.year} cx={xCenter(i)} cy={yOf(d[s.key] ?? 0)} r={hover === i ? 5 : 4} fill={s.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                    {/* Direct label at the line end (identity is not colour-alone) */}
                    {last && (
                      <text x={xCenter(n - 1) + 9} y={yOf(last[s.key] ?? 0)} dy="0.32em" fontSize={12} fontWeight={600} fill="#1e293b">
                        {s.key}
                      </text>
                    )}
                  </g>
                );
              })}

          {/* Hit targets: one full-height band per year, larger than the marks */}
          {data.map((d, i) => (
            <rect key={`hit-${d.year}`} x={M.left + band * i} y={M.top} width={band} height={PLOT_H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>

        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow"
            style={{
              left: `${(xCenter(hover) / W) * 100}%`,
              transform: xCenter(hover) > W * 0.7 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <div className="mb-1 font-semibold">{data[hover].year}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}: <span className="font-semibold tabular-nums">{format(data[hover][s.key] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-[#0b5394] hover:underline">Show data table</summary>
        <table className="mt-2 w-full max-w-xl border-collapse text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="border-b border-slate-300 bg-slate-50">
            <tr>
              <th scope="col" className="px-3 py-1 text-left">
                Year
              </th>
              {series.map((s) => (
                <th key={s.key} scope="col" className="px-3 py-1 text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year} className="border-b border-slate-100">
                <th scope="row" className="px-3 py-1 text-left font-normal">
                  {d.year}
                </th>
                {series.map((s) => (
                  <td key={s.key} className="px-3 py-1 text-right tabular-nums">
                    {format(d[s.key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
