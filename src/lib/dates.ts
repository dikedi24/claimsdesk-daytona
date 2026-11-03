// Fixed demo date: "today" is always November 1, 2026 so the demo looks identical whenever opened.
export const TODAY = "2026-11-01";

const DAY = 86_400_000;

export const dayNum = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / DAY);
export const fromDayNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => fromDayNum(dayNum(iso) + n);
export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);

/** A timestamp on the demo date, keeping the real clock time so audit events stay ordered. */
export function demoTimestamp(): string {
  const now = new Date();
  return `${TODAY}T${now.toISOString().slice(11)}`;
}
