// Deterministic seed data: ~1,300 WC/GL claims dated 2021–2026, each with dated reserve
// and payment transactions so "as of" reports are meaningful [3.5]. All people are fictional.
import { CAUSES, DEFENSE_FIRMS, DIARY_CODES } from "./codes";
import { TODAY, addDays, dayNum, fromDayNum } from "./dates";
import { createRng, type Rng } from "./rng";
import { DEFAULT_LIMITS } from "./users";
import type {
  Category,
  Claim,
  ClaimType,
  DiaryEntry,
  PayeeType,
  Payment,
  ReserveTransaction,
  Role,
  SeedData,
} from "./types";

const SEED = 2704;

const FIRST = [
  "Avery", "Blake", "Carmen", "Dorian", "Elena", "Felix", "Greta", "Hollis", "Imani", "Jasper",
  "Keiko", "Luis", "Marisol", "Nolan", "Odette", "Pilar", "Quentin", "Rosalind", "Silas", "Tamsin",
  "Ulric", "Vera", "Wendell", "Xiomara", "Yusuf", "Zora", "Anders", "Bianca", "Cedric", "Delphine",
  "Emmett", "Fiona", "Gideon", "Harriet", "Ignatius", "Juniper", "Kofi", "Lorelei", "Magnus", "Noor",
];
const LAST = [
  "Ashgrove", "Brindle", "Calloway", "Dunmore", "Eastwick", "Fairbanks", "Galloway", "Hartwell",
  "Ironside", "Juniper", "Kestrel", "Larkspur", "Marchetti", "Northcott", "Oakhurst", "Pennywhistle",
  "Quarles", "Rookwood", "Stillwater", "Thornbury", "Umberfield", "Vantreese", "Whitlock", "Yarborough",
  "Zellweger", "Almondine", "Birchfield", "Copperfield", "Driftwood", "Elmsworth", "Foxglove",
  "Greenleaf", "Hollowell", "Inkberry", "Jessamine", "Kingsley", "Lindqvist", "Marlowe", "Nettlefold",
];

const PROVIDERS = [
  "Seabreeze Orthopedic Associates",
  "Tomoka Urgent Care",
  "Coastal Physical Therapy Group",
  "Halifax River Imaging Center",
  "Riverside Occupational Medicine",
  "Atlantic Pharmacy Services",
];
const VENDORS = ["Peninsula IME Services", "Volusia Court Reporting", "Sunshine State Records Retrieval"];

const WC_DEPTS: [string, number][] = [
  ["POL", 26], ["FIR", 22], ["PW", 20], ["UTL", 14], ["PRK", 9], ["FAC", 5], ["FIN", 2], ["HR", 2],
];
const GL_DEPTS: [string, number][] = [
  ["PW", 28], ["POL", 18], ["UTL", 16], ["PRK", 14], ["FAC", 10], ["FIR", 8], ["FIN", 3], ["HR", 3],
];
const WC_CAUSES: [string, number][] = [
  ["LIFT", 24], ["SLIP", 20], ["MVA", 12], ["STRUCK", 12], ["CUT", 8], ["REPET", 8], ["ASSAULT", 10], ["EXPOS", 6],
];
const GL_CAUSES: [string, number][] = [
  ["TRIP", 26], ["VEH", 24], ["PROP", 14], ["SEWER", 10], ["TREE", 8], ["POLICE", 10], ["PREM", 8],
];

const BODY_BY_CAUSE: Record<string, [string, number][]> = {
  LIFT: [["BACK", 6], ["SHLDR", 3], ["NECK", 1]],
  SLIP: [["KNEE", 4], ["FOOT", 3], ["BACK", 2], ["HAND", 1]],
  MVA: [["NECK", 4], ["BACK", 3], ["MULTI", 2], ["HEAD", 1]],
  STRUCK: [["HEAD", 3], ["HAND", 3], ["SHLDR", 2], ["FOOT", 2]],
  CUT: [["HAND", 8], ["MULTI", 1]],
  REPET: [["HAND", 6], ["SHLDR", 3], ["NECK", 1]],
  ASSAULT: [["HAND", 3], ["SHLDR", 3], ["HEAD", 2], ["KNEE", 2]],
  EXPOS: [["LUNG", 7], ["MULTI", 3]],
};
const DAMAGE_BY_CAUSE: Record<string, [string, number][]> = {
  TRIP: [["BI", 1]],
  VEH: [["VD", 6], ["BI", 4]],
  PROP: [["PD", 1]],
  SEWER: [["WD", 1]],
  TREE: [["PD", 2], ["VD", 1]],
  POLICE: [["CR", 2], ["BI", 1]],
  PREM: [["BI", 1]],
};

const BODY_TEXT: Record<string, string> = {
  BACK: "lower back", SHLDR: "shoulder", KNEE: "knee", HAND: "wrist", NECK: "neck",
  FOOT: "ankle", HEAD: "head", LUNG: "respiratory system", MULTI: "multiple body parts",
};

const DESCRIPTIONS: Record<string, string[]> = {
  LIFT: [
    "Employee strained {b} while lifting a manhole cover.",
    "Employee injured {b} moving equipment from the truck bed.",
    "Employee felt pain in {b} while lifting a patient during a medical call.",
  ],
  SLIP: [
    "Employee slipped on a wet floor and injured {b}.",
    "Employee tripped over a hose on the apparatus floor, injuring {b}.",
    "Employee fell on uneven ground at a job site and hurt {b}.",
  ],
  MVA: [
    "City vehicle was rear-ended at a traffic light; employee reports {b} pain.",
    "Employee injured {b} in a collision while responding to a call.",
  ],
  STRUCK: [
    "Employee was struck by a falling tool and injured {b}.",
    "Employee's {b} was struck by a swinging gate.",
  ],
  CUT: ["Employee cut {b} on sheet metal.", "Employee lacerated {b} while clearing brush."],
  REPET: ["Employee reports gradual onset of {b} pain from repetitive data entry.", "Employee reports {b} pain from repeated tool use."],
  ASSAULT: ["Officer injured {b} while taking a resisting subject into custody."],
  EXPOS: ["Firefighter treated for {b} irritation after smoke exposure at a structure fire.", "Employee experienced heat exhaustion affecting {b}."],
  TRIP: [
    "Pedestrian tripped on a raised sidewalk slab and fell.",
    "Resident tripped on a damaged curb and was injured.",
  ],
  VEH: [
    "City vehicle backed into claimant's parked car.",
    "City truck collided with claimant's vehicle at an intersection.",
    "Claimant alleges a City mower threw debris and damaged their vehicle.",
  ],
  PROP: ["Claimant alleges City crew damaged a fence during right-of-way work.", "Claimant's mailbox and landscaping damaged by a City vehicle."],
  SEWER: ["Sewer backup flooded claimant's home after a main blockage.", "Water main break flooded claimant's garage."],
  TREE: ["A City-owned tree limb fell onto claimant's property.", "Tree from City right-of-way fell on claimant's car during a storm."],
  POLICE: ["Claimant alleges excessive force during an arrest.", "Claimant alleges wrongful detention during a traffic stop."],
  PREM: ["Visitor fell on a broken step at a City park.", "Visitor injured by a loose railing at a City facility."],
};

interface Builder {
  rng: Rng;
  reserves: ReserveTransaction[];
  payments: Payment[];
  diary: DiaryEntry[];
  txSeq: number;
}

const round = (n: number, to: number) => Math.max(to, Math.round(n / to) * to);
const roundUp = (n: number, to: number) => Math.ceil(n / to) * to;
const cents = (n: number) => Math.round(n * 100) / 100;

function adjusterRole(adjusterId: string): Role {
  return adjusterId === "u-gl1" ? "adjuster_gl" : "adjuster_wc";
}

function makeClaim(rng: Rng, type: ClaimType, year: number, lossDay: number): Omit<Claim, "id" | "number"> {
  const causeCode = rng.weighted(type === "WC" ? WC_CAUSES : GL_CAUSES);
  const cause = CAUSES.find((c) => c.code === causeCode)!;
  const department = cause.dept ? rng.pick(cause.dept) : rng.weighted(type === "WC" ? WC_DEPTS : GL_DEPTS);
  const body = rng.weighted(type === "WC" ? BODY_BY_CAUSE[causeCode] : DAMAGE_BY_CAUSE[causeCode]);
  const description = rng.pick(DESCRIPTIONS[causeCode]).replace("{b}", BODY_TEXT[body] ?? "");
  const lag = type === "WC" ? rng.weighted([[0, 4], [1, 4], [2, 2], [rng.int(3, 10), 1]] as const) : rng.int(1, 45);
  const reported = Math.min(lossDay + lag, dayNum(TODAY) - 2);
  const litigated =
    type === "GL" ? rng.chance(causeCode === "POLICE" ? 0.65 : causeCode === "TRIP" ? 0.4 : 0.24) : rng.chance(0.07);
  const adjusterId = type === "GL" ? "u-gl1" : rng.chance(0.5) ? "u-wc1" : "u-wc2";
  return {
    type,
    status: "Open",
    claimantName: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    department,
    dateOfLoss: fromDayNum(lossDay),
    dateReported: fromDayNum(reported),
    cause: causeCode,
    bodyPartOrDamage: body,
    description,
    adjusterId,
    litigated,
    defenseFirmId: litigated ? rng.pick(DEFENSE_FIRMS).code : undefined,
    source: "seed",
  };
}

/** Initial reserve per category (0 = category not used on this claim). */
function initialReserves(rng: Rng, c: Omit<Claim, "id" | "number">): Record<Category, number> {
  if (c.type === "WC") {
    const indemnityLikely = ["LIFT", "MVA", "SLIP", "ASSAULT"].includes(c.cause) ? 0.55 : 0.3;
    return {
      Medical: round(rng.lognormal(c.litigated ? 9000 : 3500, 0.8), 100),
      Indemnity: rng.chance(c.litigated ? 0.95 : indemnityLikely) ? round(rng.lognormal(c.litigated ? 18000 : 6000, 0.8), 100) : 0,
      Expense: c.litigated ? round(rng.lognormal(12000, 0.5), 500) : rng.chance(0.25) ? round(rng.lognormal(900, 0.5), 100) : 0,
    };
  }
  const bodily = ["BI", "CR"].includes(c.bodyPartOrDamage);
  return {
    Medical: bodily && rng.chance(0.4) ? round(rng.lognormal(2500, 0.7), 100) : 0,
    Indemnity: round(rng.lognormal(c.litigated ? 30000 : bodily ? 6000 : 3500, 0.75), 100),
    Expense: c.litigated ? round(rng.lognormal(18000, 0.5), 500) : rng.chance(0.3) ? round(rng.lognormal(700, 0.5), 100) : 0,
  };
}

function payee(rng: Rng, c: Claim, cat: Category): { payee: string; payeeType: PayeeType; defenseFirmId?: string } {
  if (cat === "Medical") return { payee: rng.pick(PROVIDERS), payeeType: "provider" };
  if (cat === "Indemnity") {
    if (c.type === "GL" && c.bodyPartOrDamage === "VD" && rng.chance(0.5)) return { payee: "Coastal Collision & Auto Body", payeeType: "vendor" };
    return { payee: c.claimantName, payeeType: "claimant" };
  }
  if (c.litigated && c.defenseFirmId && rng.chance(0.85)) {
    const firm = DEFENSE_FIRMS.find((f) => f.code === c.defenseFirmId)!;
    return { payee: firm.label, payeeType: "defense_firm", defenseFirmId: firm.code };
  }
  return { payee: rng.pick(VENDORS), payeeType: "vendor" };
}

function addReserve(b: Builder, c: Claim, cat: Category, day: number, newBalance: number, prev: number, reason: string) {
  b.reserves.push({
    id: `r${++b.txSeq}`,
    claimId: c.id,
    category: cat,
    date: fromDayNum(day),
    amount: cents(newBalance - prev),
    newBalance: cents(newBalance),
    byUserId: c.adjusterId,
    byRole: adjusterRole(c.adjusterId),
    reason,
    status: "Approved",
  });
}

/** Builds the dated reserve and payment history for one claim and sets its final status. */
function buildFinancials(b: Builder, c: Claim) {
  const { rng } = b;
  const today = dayNum(TODAY);
  const reported = dayNum(c.dateReported);
  const medianDays = c.litigated ? 620 : c.type === "WC" ? 210 : 220;
  const closeDay = reported + Math.max(20, Math.round(rng.lognormal(medianDays, 0.6)));
  const closed = closeDay < today;
  const end = closed ? closeDay : today - 1;
  const init = initialReserves(rng, c);

  for (const cat of ["Medical", "Indemnity", "Expense"] as Category[]) {
    if (!init[cat]) continue;
    const start = reported + rng.int(0, 3);
    let reserve = init[cat];
    addReserve(b, c, cat, start, reserve, 0, "Initial reserve");

    const ultimate = cents(init[cat] * rng.lognormal(0.95, 0.45));
    const n = Math.min(10, Math.max(1, Math.round(ultimate / (cat === "Medical" ? 1500 : 4000)) + rng.int(0, 2)));
    const span = Math.max(1, closeDay - start - 7);
    const days = Array.from({ length: n }, () => start + 7 + Math.floor(rng.next() * span)).sort((x, y) => x - y);
    const weights = days.map(() => 0.4 + rng.next());
    const wsum = weights.reduce((s, w) => s + w, 0);

    let paid = 0;
    days.forEach((day, i) => {
      if (day > end) return; // future payment on an open claim: not made yet
      const amount = cents((ultimate * weights[i]) / wsum);
      if (amount <= 0) return;
      if (paid + amount > reserve) {
        const next = roundUp((paid + amount) * (1.15 + rng.next() * 0.4), 500);
        addReserve(b, c, cat, day, next, reserve, "Reserve increase — updated estimate");
        reserve = next;
      }
      paid = cents(paid + amount);
      b.payments.push({
        id: `p${++b.txSeq}`,
        claimId: c.id,
        category: cat,
        ...payee(rng, c, cat),
        amount,
        requestedDate: fromDayNum(day - rng.int(1, 5)),
        requestedBy: c.adjusterId,
        requestedByRole: adjusterRole(c.adjusterId),
        status: "Issued",
        approvedBy: c.adjusterId,
        issuedDate: fromDayNum(day),
      });
    });

    if (closed && reserve !== paid) addReserve(b, c, cat, closeDay, paid, reserve, "Closing adjustment — reserve to paid");
  }

  if (closed) {
    c.status = "Closed";
    c.closedDate = fromDayNum(closeDay);
  }
}

function reserveBalance(b: Builder, claimId: string, cat: Category) {
  let bal = 0;
  for (const r of b.reserves) if (r.claimId === claimId && r.category === cat && r.status === "Approved") bal = r.newBalance;
  return bal;
}
/** Latest transaction day on a claim category, so inserted adjustments stay in date order. */
function lastTxDay(b: Builder, claimId: string, cat: Category) {
  let last = 0;
  for (const r of b.reserves) if (r.claimId === claimId && r.category === cat) last = Math.max(last, dayNum(r.date));
  for (const p of b.payments) if (p.claimId === claimId && p.category === cat && p.issuedDate) last = Math.max(last, dayNum(p.issuedDate));
  return last;
}
function paidTotal(b: Builder, claimId: string, cat: Category) {
  return b.payments
    .filter((p) => p.claimId === claimId && p.category === cat && p.status === "Issued")
    .reduce((s, p) => s + p.amount, 0);
}

/** Seeds a handful of in-flight items around the demo date so the dashboard has work on it. */
function seedPendingWork(b: Builder, claims: Claim[]) {
  const { rng } = b;
  const today = dayNum(TODAY);
  const open = claims.filter((c) => c.status === "Open" && dayNum(c.dateReported) < today - 30);
  const take = (k: number, pred: (c: Claim) => boolean) => {
    const pool = open.filter(pred);
    const out: Claim[] = [];
    while (out.length < k && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    return out;
  };
  const used = new Set<string>();
  const unused = (c: Claim) => !used.has(c.id);

  // Payment requests above adjuster authority: most route to Supervisor, a few to Risk Manager [3.17D].
  const plan: { amount: [number, number]; underReserved?: boolean }[] = [
    ...Array.from({ length: 6 }, () => ({ amount: [11000, 45000] as [number, number] })),
    ...Array.from({ length: 2 }, () => ({ amount: [55000, 90000] as [number, number] })),
    { amount: [12000, 30000], underReserved: true },
    { amount: [12000, 30000], underReserved: true },
  ];
  for (const item of plan) {
    const [c] = take(1, (x) => unused(x) && (x.litigated || x.type === "WC"));
    if (!c) continue;
    used.add(c.id);
    const cat: Category = "Indemnity";
    const amount = round(rng.int(item.amount[0], item.amount[1]), 50);
    let reserve = reserveBalance(b, c.id, cat);
    const paid = paidTotal(b, c.id, cat);
    const reqDay = today - rng.int(1, 12);
    const outstanding = reserve - paid;
    const adjDay = (back: number) => Math.min(reqDay, Math.max(reqDay - back, lastTxDay(b, c.id, cat)));
    if (item.underReserved) {
      // Leave outstanding below the request so the claim shows "Under-reserved" [3.4Q].
      const target = paid + Math.round(amount * 0.6);
      if (reserve > target || reserve === 0) {
        addReserve(b, c, cat, adjDay(rng.int(5, 20)), target, reserve, reserve ? "Reserve adjustment" : "Initial reserve");
      }
    } else if (outstanding < amount) {
      const next = roundUp(paid + amount * 1.25, 500);
      addReserve(b, c, cat, adjDay(rng.int(3, 15)), next, reserve, "Reserve increase — settlement evaluation");
      reserve = next;
    }
    b.payments.push({
      id: `p${++b.txSeq}`,
      claimId: c.id,
      category: cat,
      ...payee(rng, c, cat),
      amount,
      requestedDate: fromDayNum(reqDay),
      requestedBy: c.adjusterId,
      requestedByRole: adjusterRole(c.adjusterId),
      status: "Requested",
      memo: c.litigated ? "Mediated settlement" : c.type === "WC" ? "Impairment benefits" : "Settlement of claim",
    });
  }

  // Reserve increases above adjuster authority, awaiting approval.
  for (const c of take(4, unused)) {
    used.add(c.id);
    const cat: Category = c.type === "WC" ? "Medical" : "Indemnity";
    const prev = reserveBalance(b, c.id, cat);
    const next = round(Math.max(prev, 5000) + rng.int(26000, 60000), 500);
    b.reserves.push({
      id: `r${++b.txSeq}`,
      claimId: c.id,
      category: cat,
      date: fromDayNum(Math.max(today - rng.int(1, 6), lastTxDay(b, c.id, cat))),
      amount: next - prev,
      newBalance: next,
      byUserId: c.adjusterId,
      byRole: adjusterRole(c.adjusterId),
      reason: c.type === "WC" ? "Surgery recommended by treating physician" : "Plaintiff demand received",
      status: "PendingApproval",
    });
  }

  // Diary: one upcoming or overdue reminder per open claim [3.4I, 3.4K].
  for (const c of claims) {
    if (c.status !== "Open") continue;
    const code = c.litigated
      ? rng.pick(["LITSTAT", "RESREV", "REV30"])
      : c.type === "WC"
        ? rng.pick(["MEDSTAT", "RTW", "REV30", "RESREV"])
        : rng.pick(["REV30", "SUBRO", "STMT", "RESREV"]);
    const overdue = rng.chance(0.12);
    const due = overdue ? today - rng.int(1, 21) : today + rng.int(0, 30);
    const def = DIARY_CODES.find((d) => d.code === code)!;
    b.diary.push({
      id: `d${++b.txSeq}`,
      claimId: c.id,
      dueDate: fromDayNum(due),
      code,
      note: def.label,
      ownerId: c.adjusterId,
      completed: false,
      createdDate: fromDayNum(due - def.days),
    });
  }
}

/** Approver whose default authority covers the amount, or null if the adjuster's own limit does. */
function approverFor(kind: "reserve" | "payment", amount: number): string | null {
  const within = (limit: number | null) => limit === null || amount <= limit;
  if (within(DEFAULT_LIMITS.adjuster[kind])) return null;
  return within(DEFAULT_LIMITS.supervisor[kind]) ? "u-sup" : "u-rm";
}

/**
 * Seeded history never contradicts authority limits [3.17C, 3.17D]: any historical reserve change that left
 * the claim's total reserve above the adjuster's limit, and any payment above the adjuster's payment limit,
 * carries an approval by the Supervisor or Risk Manager. Pending seeded items stay pending.
 */
function applyAuthority(b: Builder) {
  const byClaim = new Map<string, { r: ReserveTransaction; i: number }[]>();
  b.reserves.forEach((r, i) => {
    if (r.status !== "Approved") return;
    const list = byClaim.get(r.claimId);
    if (list) list.push({ r, i });
    else byClaim.set(r.claimId, [{ r, i }]);
  });
  for (const list of byClaim.values()) {
    list.sort((x, y) => x.r.date.localeCompare(y.r.date) || x.i - y.i);
    const bal: Record<Category, number> = { Medical: 0, Indemnity: 0, Expense: 0 };
    for (const { r } of list) {
      bal[r.category] = r.newBalance;
      const approver = approverFor("reserve", bal.Medical + bal.Indemnity + bal.Expense);
      if (approver) {
        r.decidedBy = approver;
        r.historicalApproval = true;
      }
    }
  }
  for (const p of b.payments) {
    if (p.status !== "Issued") continue;
    const approver = approverFor("payment", p.amount);
    if (approver) {
      p.approvedBy = approver;
      p.historicalApproval = true;
    }
  }
}

let cached: SeedData | null = null;

export function getSeed(): SeedData {
  if (cached) return cached;
  const rng = createRng(SEED);
  const b: Builder = { rng, reserves: [], payments: [], diary: [], txSeq: 0 };
  const claims: Claim[] = [];
  const lastLoss = dayNum(addDays(TODAY, -4));

  for (let year = 2021; year <= 2026; year++) {
    const start = dayNum(`${year}-01-01`);
    const end = Math.min(dayNum(`${year}-12-31`), lastLoss);
    const frac = (end - start + 1) / 365;
    const counts: [ClaimType, number][] = [
      ["WC", Math.round((128 + rng.int(-9, 9)) * frac)],
      ["GL", Math.round((94 + rng.int(-7, 7)) * frac)],
    ];
    for (const [type, n] of counts) {
      const yearClaims = Array.from({ length: n }, () => makeClaim(rng, type, year, start + rng.int(0, end - start)));
      yearClaims.sort((x, y) => x.dateReported.localeCompare(y.dateReported) || x.dateOfLoss.localeCompare(y.dateOfLoss));
      yearClaims.forEach((c, i) => {
        const number = `${type}-${year}-${String(i + 1).padStart(4, "0")}`;
        claims.push({ ...c, id: number, number });
      });
    }
  }

  for (const c of claims) buildFinancials(b, c);
  seedPendingWork(b, claims);
  applyAuthority(b);

  cached = { claims, reserves: b.reserves, payments: b.payments, diary: b.diary };
  return cached;
}
