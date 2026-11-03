const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const num = new Intl.NumberFormat("en-US");

export const money = (n: number) => money0.format(n);
export const moneyCents = (n: number) => money2.format(n);
export const count = (n: number) => num.format(n);
export const fmtDate = (iso?: string) => (iso ? dateFmt.format(new Date(iso.slice(0, 10) + "T00:00:00Z")) : "—");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
/** Axis-style money: $0, $500K, $1.2M. */
export const moneyCompact = (n: number) => `$${compact.format(n)}`;
export const countCompact = (n: number) => compact.format(n);
