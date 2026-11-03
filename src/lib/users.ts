// Fictional staff. Each role in the switcher maps to one named user [3.17].
import type { AuthorityLimits, LimitRole, Role, User } from "./types";

export const USERS: User[] = [
  { id: "u-wc1", name: "Pat Okafor-Lind", title: "WC Adjuster", role: "adjuster_wc" },
  { id: "u-wc2", name: "Sam Torvik", title: "WC Adjuster", role: "adjuster_wc" },
  { id: "u-gl1", name: "Jordan Quill", title: "GL Adjuster", role: "adjuster_gl" },
  { id: "u-sup", name: "Morgan Alcott", title: "Claims Supervisor", role: "supervisor" },
  { id: "u-rm", name: "Casey Delmar", title: "Risk Manager", role: "risk_manager" },
  { id: "u-ro", name: "Riley Fenwick", title: "Risk Analyst (read-only)", role: "readonly" },
];

export const ROLES: { role: Role; label: string; userId: string }[] = [
  { role: "adjuster_wc", label: "Adjuster (WC)", userId: "u-wc1" },
  { role: "adjuster_gl", label: "Adjuster (GL)", userId: "u-gl1" },
  { role: "supervisor", label: "Supervisor", userId: "u-sup" },
  { role: "risk_manager", label: "Risk Manager", userId: "u-rm" },
  { role: "readonly", label: "Read-only staff", userId: "u-ro" },
];

export const ADJUSTERS = USERS.filter((u) => u.role === "adjuster_wc" || u.role === "adjuster_gl");

const userMap = new Map(USERS.map((u) => [u.id, u]));
export const userName = (id?: string) => (id ? userMap.get(id)?.name ?? id : "");
export const userForRole = (role: Role): User => userMap.get(ROLES.find((r) => r.role === role)!.userId)!;
export const roleLabel = (role: Role) => ROLES.find((r) => r.role === role)?.label ?? role;

export const isAdjuster = (role: Role) => role === "adjuster_wc" || role === "adjuster_gl";
export const isManager = (role: Role) => role === "supervisor" || role === "risk_manager";

export function limitRole(role: Role): LimitRole | null {
  if (isAdjuster(role)) return "adjuster";
  if (role === "supervisor" || role === "risk_manager") return role;
  return null;
}

// Defaults from the RFP response; editable by the Risk Manager on the Admin page [3.17C].
export const DEFAULT_LIMITS: AuthorityLimits = {
  adjuster: { reserve: 25000, payment: 10000 },
  supervisor: { reserve: 100000, payment: 50000 },
  risk_manager: { reserve: null, payment: null },
};
