"use client";
// Client-side state: deterministic seed + a small localStorage "overlay" of user changes.
// The seed is regenerated on every load and never stored; only changes and flags are saved.
import Papa from "papaparse";
import { useSyncExternalStore } from "react";
import { demoTimestamp } from "./dates";
import { summarize, type ClaimSummary } from "./finance";
import { convert, type ConversionResult, type Corrections, type Mapping } from "./legacy";
import { getSeed } from "./seed";
import { DEFAULT_LIMITS, userForRole } from "./users";
import type {
  AuditEvent,
  AuthorityLimits,
  Claim,
  DiaryEntry,
  Notification,
  Payment,
  ReserveTransaction,
  Role,
  User,
} from "./types";

const STORAGE_KEY = "claimsdesk:v1";
export const BUNDLED_LEGACY_FILE = "/legacy_export.csv";

/** An approved legacy conversion. Only the decision and mapping are saved, never the rows [3.21]. */
export interface MigrationRecord {
  approvedAt: string;
  approvedBy: string;
  fileName: string;
  bundled: boolean; // bundled file can be re-converted on reload; uploads last for the session only
  mapping: Mapping;
  corrections: Corrections; // Risk Manager fixes to held rows, re-applied on every reload
  converted: number;
}

export interface Overlay {
  role: Role;
  newClaims: Claim[];
  claimEdits: Record<string, Partial<Claim>>;
  reserveTx: ReserveTransaction[];
  reserveUpdates: Record<string, Partial<ReserveTransaction>>;
  payments: Payment[];
  paymentUpdates: Record<string, Partial<Payment>>;
  diary: DiaryEntry[];
  diaryUpdates: Record<string, Partial<DiaryEntry>>;
  audit: AuditEvent[];
  notifications: Notification[];
  limits?: AuthorityLimits;
  migration?: MigrationRecord;
  seq: number;
}

const emptyOverlay = (): Overlay => ({
  role: "adjuster_wc",
  newClaims: [],
  claimEdits: {},
  reserveTx: [],
  reserveUpdates: {},
  payments: [],
  paymentUpdates: {},
  diary: [],
  diaryUpdates: {},
  audit: [],
  notifications: [],
  seq: 0,
});

export interface AppState {
  role: Role;
  user: User;
  limits: AuthorityLimits;
  claims: Claim[];
  claimsById: Map<string, Claim>;
  reserves: ReserveTransaction[];
  payments: Payment[];
  diary: DiaryEntry[];
  audit: AuditEvent[];
  notifications: Notification[];
  reservesByClaim: Map<string, ReserveTransaction[]>;
  paymentsByClaim: Map<string, Payment[]>;
  diaryByClaim: Map<string, DiaryEntry[]>;
  summaries: Map<string, ClaimSummary>;
  migration?: MigrationRecord;
  legacyStatus: LegacyStatus;
  legacyCount: number;
  legacyResult?: ConversionResult; // latest conversion run, including the held-for-correction queue
  legacyRows?: Record<string, string>[]; // parsed source rows (in memory only)
}

export type LegacyStatus = "none" | "loading" | "ready" | "error";

const applyUpdates = <T extends { id: string }>(items: T[], updates: Record<string, Partial<T>>) =>
  items.map((x) => (updates[x.id] ? { ...x, ...updates[x.id] } : x));

function groupBy<T extends { claimId: string }>(items: T[]) {
  const m = new Map<string, T[]>();
  for (const x of items) {
    const list = m.get(x.claimId);
    if (list) list.push(x);
    else m.set(x.claimId, [x]);
  }
  return m;
}

function build(o: Overlay): AppState {
  const seed = getSeed();
  const limits = o.limits ?? DEFAULT_LIMITS;
  const claims = applyUpdates([...seed.claims, ...legacyClaims, ...o.newClaims], o.claimEdits);
  const reserves = applyUpdates([...seed.reserves, ...o.reserveTx], o.reserveUpdates);
  const payments = applyUpdates([...seed.payments, ...o.payments], o.paymentUpdates);
  const diary = applyUpdates([...seed.diary, ...o.diary], o.diaryUpdates);
  const reservesByClaim = groupBy(reserves);
  const paymentsByClaim = groupBy(payments);
  const diaryByClaim = groupBy(diary);
  const summaries = new Map<string, ClaimSummary>();
  for (const c of claims) {
    summaries.set(
      c.id,
      summarize(c, reservesByClaim.get(c.id) ?? [], paymentsByClaim.get(c.id) ?? [], diaryByClaim.get(c.id) ?? [], limits),
    );
  }
  return {
    role: o.role,
    user: userForRole(o.role),
    limits,
    claims,
    claimsById: new Map(claims.map((c) => [c.id, c])),
    reserves,
    payments,
    diary,
    audit: o.audit,
    notifications: o.notifications,
    reservesByClaim,
    paymentsByClaim,
    diaryByClaim,
    summaries,
    migration: o.migration,
    legacyStatus,
    legacyCount: legacyClaims.length,
    legacyResult: legacyResult ?? undefined,
    legacyRows: legacyRows ?? undefined,
  };
}

let overlay: Overlay | null = null;
let state: AppState | null = null;
const listeners = new Set<() => void>();

// Converted legacy claims live in memory only; they are rebuilt from the bundled file on load.
let legacyClaims: Claim[] = [];
let legacyStatus: LegacyStatus = "none";
let legacyResult: ConversionResult | null = null;
let legacyRows: Record<string, string>[] | null = null;

function refresh() {
  if (!overlay) return;
  state = build(overlay);
  listeners.forEach((l) => l());
}

/** Fetches and parses the bundled legacy export. */
export async function fetchBundledLegacy(): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const res = await fetch(BUNDLED_LEGACY_FILE);
  if (!res.ok) throw new Error(`Could not load ${BUNDLED_LEGACY_FILE} (${res.status})`);
  const parsed = Papa.parse<Record<string, string>>(await res.text(), { header: true, skipEmptyLines: true });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

async function reloadApprovedLegacy(m: MigrationRecord) {
  legacyStatus = "loading";
  try {
    const { rows } = await fetchBundledLegacy();
    setLegacyConversion(rows, convert(rows, m.mapping, m.corrections ?? {}));
  } catch {
    legacyStatus = "error";
  }
  refresh();
}

/** Puts converted claims into search and reports (on approval, correction, or rollback with nulls). */
export function setLegacyConversion(rows: Record<string, string>[] | null, result: ConversionResult | null) {
  legacyRows = rows;
  legacyResult = result;
  legacyClaims = result?.converted ?? [];
  legacyStatus = result ? "ready" : "none";
}

function load(): Overlay {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyOverlay(), ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage: start clean.
  }
  return emptyOverlay();
}

function getSnapshot(): AppState {
  if (!state) {
    overlay = load();
    if (overlay.migration?.bundled) {
      legacyStatus = "loading";
      void reloadApprovedLegacy(overlay.migration);
    } else if (overlay.migration) {
      // An uploaded file's conversion can't be rebuilt after a reload.
      overlay = { ...overlay, migration: undefined };
    }
    state = build(overlay);
  }
  return state;
}

/** Current state for use outside React (actions). */
export const getState = getSnapshot;

const getServerSnapshot = () => null;

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Returns null during server render and hydration; pages show a loading state until then. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Applies a change to the overlay, saves it, and re-derives state. */
export function updateOverlay(fn: (o: Overlay) => Overlay) {
  getSnapshot();
  overlay = fn(overlay!);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    // Storage full or blocked; keep the in-memory change for this session.
  }
  state = build(overlay);
  listeners.forEach((l) => l());
}

/** Next unique id for user-created records (prefix keeps them distinct from seed ids). */
export function nextId(o: Overlay, prefix: string): [string, Overlay] {
  const seq = o.seq + 1;
  return [`${prefix}-u${seq}`, { ...o, seq }];
}

/** Audit trail entry with the acting user's role and a timestamp [3.4R]. */
export function auditEvent(o: Overlay, action: string, claimId?: string, details?: string): Overlay {
  const [id, o2] = nextId(o, "a");
  const user = userForRole(o.role);
  return {
    ...o2,
    audit: [...o2.audit, { id, claimId, timestamp: demoTimestamp(), userId: user.id, role: o.role, action, details }],
  };
}

export function setRole(role: Role) {
  updateOverlay((o) => ({ ...o, role }));
}

/** Clears all saved changes and reloads, restoring the exact seeded state. */
export function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.location.reload();
}
