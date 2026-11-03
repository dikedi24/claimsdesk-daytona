// What the current role may do on a claim [3.17, 3.18].
import { money } from "./format";
import type { AppState } from "./store";
import type { AuthorityLimits, Claim, Role } from "./types";
import { isAdjuster, isManager, limitRole, userName } from "./users";

/** Adjusters work their own caseload; Supervisor and Risk Manager can work any claim. */
export function canWorkClaim(s: AppState, claim: Claim): boolean {
  if (s.role === "readonly" || claim.source === "legacy") return false;
  if (isAdjuster(s.role)) return claim.adjusterId === s.user.id;
  return true;
}

/** True if the claim can be changed by this role right now (open and within their caseload). */
export function canEditClaim(s: AppState, claim: Claim): boolean {
  return claim.status !== "Closed" && canWorkClaim(s, claim);
}

/** Plain-language reason the current user can't change this claim, or null if they can. */
export function editBlockReason(s: AppState, claim: Claim): string | null {
  if (claim.source === "legacy") return "This is a converted historical claim from the legacy system and is read-only.";
  if (s.role === "readonly") return "Read-only staff can view claims but not change them.";
  if (isAdjuster(s.role) && claim.adjusterId !== s.user.id)
    return `This claim is assigned to ${userName(claim.adjusterId)}. You can view it but not change it.`;
  if (claim.status === "Closed")
    return isManager(s.role) ? "This claim is closed. Reopen it to make changes." : "This claim is closed.";
  return null;
}

export const canReopen = (role: Role) => isManager(role);

const limitText = (n: number | null) => (n === null ? "unlimited" : `up to ${money(n)}`);

export function authorityText(limits: AuthorityLimits, role: Role): string {
  const lr = limitRole(role);
  if (!lr) return "No financial authority";
  const l = limits[lr];
  return `Reserves ${limitText(l.reserve)} · Payments ${limitText(l.payment)}`;
}
