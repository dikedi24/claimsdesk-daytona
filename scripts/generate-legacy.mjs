// Generates public/legacy_export.csv: ~16,000 closed historical claims (2006–2020) shaped like a
// SQL Server export from the City's legacy system, with deliberate data-quality issues [3.2D, 3.21].
// Deterministic (fixed seed). Run: npm run generate:legacy
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "legacy_export.csv");

// mulberry32
let a = 160_000 >>> 0;
const rand = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (items) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) if ((r -= w) < 0) return v;
  return items[items.length - 1][0];
};
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const lognormal = (median, sigma) => median * Math.exp(sigma * normal());

const BASE = 15_760;
const DUPES = 240;
const ISSUES = { badDate: 160, unknownDept: 100, missingName: 80, negativePaid: 50, mismatch: 80 };

const FIRST = ["ALDEN", "BRISA", "CORMAC", "DESMA", "EZRA", "FARRAH", "GUNNAR", "HALINA", "IVO", "JOLENE", "KAI", "LEORA", "MATTIAS",
  "NESSA", "ORRIN", "PERPETUA", "RHETT", "SABINE", "TOBIAS", "URSULA", "VALEN", "WINSLOW", "YARA", "ZEKE", "AMARYLLIS", "BRAM",
  "CELESTE", "DAX", "ESME", "FINLAY"];
const LAST = ["ABERNATHY", "BLACKWOOD", "CROSSLEY", "DELACROIX", "EVERHART", "FENWICKE", "GRISWOLD", "HAWTHORNE", "INGLEBY",
  "JARDINE", "KILBRIDE", "LOCKWOOD", "MERRIWEATHER", "NIGHTINGALE", "OSGOOD", "PEMBERTON", "QUILLON", "RAVENSCROFT", "SALTONSTALL",
  "TREMAINE", "UPSHAW", "VANDERMEER", "WHITTAKER", "YORKSHIRE", "ZIMMERLY", "ASHCOMBE", "BELLWEATHER", "CHADWICK", "DRUMMOND",
  "ELLSWORTH"];

const WC_DEPTS = [["PD", 26], ["FD", 22], ["PW", 20], ["UT", 14], ["PR", 9], ["BM", 5], ["FN", 2], ["HR", 2]];
const GL_DEPTS = [["PW", 28], ["PD", 18], ["UT", 16], ["PR", 14], ["BM", 10], ["FD", 8], ["FN", 3], ["HR", 3]];
const BAD_DEPTS = ["XX", "AIR", "CDV", "99", "TRN"];

const WC_CAUSES = [["LIFTING", 24], ["SLIP/FALL", 20], ["AUTO ACCIDENT", 12], ["STRUCK BY", 12], ["CUT/PUNCTURE", 8],
  ["REPETITIVE MOTION", 8], ["ASSAULT", 8], ["EXPOSURE", 6], ["MISC", 1]];
const GL_CAUSES = [["SIDEWALK TRIP", 26], ["AUTO LIABILITY", 24], ["PROPERTY DAMAGE", 14], ["SEWER BACKUP", 10], ["TREE FALL", 8],
  ["POLICE PROFESSIONAL", 10], ["PREMISES", 8], ["MISC", 1]];
const WC_PARTS = [["LOW BACK", 26], ["SHOULDER", 14], ["KNEE", 14], ["HAND/WRIST", 16], ["NECK", 10], ["ANKLE/FOOT", 10], ["HEAD", 5],
  ["LUNGS", 2], ["MULTIPLE", 3]];
const GL_PARTS = {
  "SIDEWALK TRIP": ["BODILY INJURY"], "AUTO LIABILITY": ["AUTO DAMAGE", "BODILY INJURY"], "PROPERTY DAMAGE": ["PROPERTY"],
  "SEWER BACKUP": ["WATER DAMAGE"], "TREE FALL": ["PROPERTY", "AUTO DAMAGE"], "POLICE PROFESSIONAL": ["CIVIL RIGHTS", "BODILY INJURY"],
  PREMISES: ["BODILY INJURY"], MISC: ["PROPERTY"],
};
const DESC = {
  LIFTING: "EE STRAINED BACK LIFTING MATERIALS", "SLIP/FALL": "EE SLIPPED ON WET SURFACE, FELL", "AUTO ACCIDENT": "CITY VEH REAR-ENDED AT LIGHT",
  "STRUCK BY": "EE STRUCK BY FALLING OBJECT", "CUT/PUNCTURE": "EE CUT HAND ON SHEET METAL", "REPETITIVE MOTION": "GRADUAL ONSET, REPETITIVE TASKS",
  ASSAULT: "OFFICER INJURED DURING ARREST", EXPOSURE: "SMOKE INHALATION AT FIRE SCENE", "SIDEWALK TRIP": "CLMT TRIPPED ON RAISED SIDEWALK",
  "AUTO LIABILITY": "CITY VEH STRUCK CLMT VEHICLE", "PROPERTY DAMAGE": "CITY CREW DAMAGED FENCE, LANDSCAPING", "SEWER BACKUP": "SEWER BACKUP INTO RESIDENCE",
  "TREE FALL": "CITY TREE LIMB FELL ON PROPERTY", "POLICE PROFESSIONAL": "ALLEGED EXCESSIVE FORCE", PREMISES: "CLMT FELL AT CITY PARK",
  MISC: "SEE PAPER FILE",
};
const EXAMINERS = ["JBW", "MKR", "TLS", "DPH", "RAG"];
const ZIPS = ["32114", "32117", "32118", "32119", "32124"];

const DAY = 86_400_000;
const start = Date.UTC(2006, 0, 1) / DAY;
const end = Date.UTC(2020, 11, 31) / DAY;
const iso = (d) => new Date(d * DAY).toISOString().slice(0, 10);
const sqlDate = (s) => `${s} 00:00:00.000`;
const money4 = (n) => n.toFixed(4); // SQL Server money columns export with 4 decimals

const rows = [];
for (let i = 0; i < BASE; i++) {
  const lob = rand() < 0.57 ? "WC" : "GL";
  const cause = weighted(lob === "WC" ? WC_CAUSES : GL_CAUSES);
  const loss = start + int(0, end - start);
  const rpt = loss + (lob === "WC" ? int(0, 6) : int(1, 40));
  const lit = lob === "GL" ? rand() < 0.22 : rand() < 0.06;
  const close = rpt + Math.max(20, Math.round(lognormal(lit ? 600 : 200, 0.6)));
  const paid = Math.round(lognormal(lit ? 28000 : lob === "WC" ? 4200 : 3500, 1.0) * 100) / 100;
  const os = rand() < 0.04 ? Math.round(lognormal(1200, 0.7) * 100) / 100 : 0;
  rows.push({
    LOB_CD: lob,
    CLMNT_LAST_NM: pick(LAST),
    CLMNT_FIRST_NM: pick(FIRST),
    DEPT_CD: weighted(lob === "WC" ? WC_DEPTS : GL_DEPTS),
    LOSS_DT: sqlDate(iso(loss)),
    RPT_DT: sqlDate(iso(rpt)),
    CLOSE_DT: sqlDate(iso(Math.min(close, Date.UTC(2021, 11, 31) / DAY))),
    CAUSE_DESC: cause,
    INJ_PART_DESC: lob === "WC" ? weighted(WC_PARTS) : pick(GL_PARTS[cause]),
    LOSS_DESC: DESC[cause],
    EXAMINER_CD: pick(EXAMINERS),
    LIT_FLG: lit ? "Y" : "N",
    TOT_PD_AMT: paid,
    OS_RSV_AMT: os,
    TOT_INCUR_AMT: Math.round((paid + os) * 100) / 100,
    CLM_STAT_CD: "C",
    ZIP_CD: pick(ZIPS),
    _loss: loss,
  });
}

// Chronological legacy numbering.
rows.sort((x, y) => x._loss - y._loss);
rows.forEach((r, i) => {
  r.CLM_NBR = `L-${String(10_001 + i).padStart(7, "0")}`;
});

// Assign each issue to distinct rows so counts are exact.
const order = rows.map((_, i) => i);
for (let i = order.length - 1; i > 0; i--) {
  const j = int(0, i);
  [order[i], order[j]] = [order[j], order[i]];
}
let cursor = 0;
const take = (n) => order.slice(cursor, (cursor += n)).map((i) => rows[i]);

take(ISSUES.badDate).forEach((r, k) => {
  const loss = r._loss;
  switch (k % 5) {
    case 0: r.LOSS_DT = "1900-01-01 00:00:00.000"; break; // SQL Server default date
    case 1: r.LOSS_DT = sqlDate(`${2008 + (k % 10)}-02-30`); break; // impossible calendar date
    case 2: r.RPT_DT = sqlDate(iso(loss - int(10, 200))); break; // reported before loss
    case 3: r.CLOSE_DT = sqlDate(iso(loss - int(5, 120))); break; // closed before loss
    default: r.LOSS_DT = sqlDate(iso(Date.UTC(2031, 0, 1) / DAY + int(0, 900))); // future date
  }
});
take(ISSUES.unknownDept).forEach((r) => (r.DEPT_CD = pick(BAD_DEPTS)));
take(ISSUES.missingName).forEach((r) => (r.CLMNT_LAST_NM = ""));
take(ISSUES.negativePaid).forEach((r) => {
  r.TOT_PD_AMT = -Math.abs(r.TOT_PD_AMT);
  r.TOT_INCUR_AMT = Math.round((r.TOT_PD_AMT + r.OS_RSV_AMT) * 100) / 100;
});
take(ISSUES.mismatch).forEach((r) => {
  r.TOT_INCUR_AMT = Math.round((r.TOT_INCUR_AMT + (rand() < 0.5 ? -1 : 1) * int(100, 5000)) * 100) / 100;
});
const clean = order.slice(cursor).map((i) => rows[i]);

// Duplicates: exact copies of clean rows inserted near the original (re-exported records).
const all = [...rows];
for (let k = 0; k < DUPES; k++) {
  const src = clean[int(0, clean.length - 1)];
  const at = all.indexOf(src) + int(1, 40);
  all.splice(Math.min(at, all.length), 0, { ...src });
}

const HEADERS = ["CLM_ID", "CLM_NBR", "LOB_CD", "CLMNT_LAST_NM", "CLMNT_FIRST_NM", "DEPT_CD", "LOSS_DT", "RPT_DT", "CLOSE_DT",
  "CAUSE_DESC", "INJ_PART_DESC", "LOSS_DESC", "EXAMINER_CD", "LIT_FLG", "TOT_PD_AMT", "OS_RSV_AMT", "TOT_INCUR_AMT", "CLM_STAT_CD",
  "ZIP_CD"];
const esc = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const lines = [HEADERS.join(",")];
all.forEach((r, i) => {
  const rec = { ...r, CLM_ID: 100_001 + i, TOT_PD_AMT: money4(r.TOT_PD_AMT), OS_RSV_AMT: money4(r.OS_RSV_AMT), TOT_INCUR_AMT: money4(r.TOT_INCUR_AMT) };
  lines.push(HEADERS.map((h) => esc(rec[h])).join(","));
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\r\n") + "\r\n");
console.log(`Wrote ${all.length} rows to ${OUT}`);
