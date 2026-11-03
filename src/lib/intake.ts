// Claim intake: extraction schema, validation, and the offline rule-based parser [3.3, 3.4G, 3.16].
// Shared by the server route (validates Claude's JSON) and the client (offline fallback display).
import { BODY_PARTS, CAUSES, DAMAGE_TYPES, DEPARTMENTS } from "./codes";
import { TODAY } from "./dates";
import type { ClaimType } from "./types";

export type ExtractKey =
  | "type"
  | "claimantName"
  | "department"
  | "dateOfLoss"
  | "dateReported"
  | "cause"
  | "bodyPartOrDamage"
  | "description";

export const EXTRACT_KEYS: ExtractKey[] = [
  "type",
  "claimantName",
  "department",
  "dateOfLoss",
  "dateReported",
  "cause",
  "bodyPartOrDamage",
  "description",
];

export const FIELD_LABELS: Record<ExtractKey, string> = {
  type: "Claim type",
  claimantName: "Claimant",
  department: "Department",
  dateOfLoss: "Date of loss",
  dateReported: "Date reported",
  cause: "Cause",
  bodyPartOrDamage: "Body part / damage type",
  description: "Description",
};

export type Confidence = "high" | "medium" | "low";

export interface Suggestion {
  value: string;
  confidence: Confidence;
}

export interface ExtractResponse {
  source: "ai" | "offline";
  model?: string;
  reason?: string; // why the offline parser was used
  fields: Partial<Record<ExtractKey, Suggestion>>;
  warnings: string[];
}

const CONFIDENCES = ["high", "medium", "low"] as const;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function validDate(v: string) {
  if (!isoDate.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v <= TODAY && v >= "2000-01-01";
}

/** JSON schema for Claude's structured output. Coded fields are constrained to our code lists ("" = not found). */
export function extractionSchema() {
  const field = (value: Record<string, unknown>) => ({
    type: "object",
    properties: { value, confidence: { type: "string", enum: [...CONFIDENCES] } },
    required: ["value", "confidence"],
    additionalProperties: false,
  });
  const codes = (list: { code: string }[]) => ({ type: "string", enum: ["", ...list.map((c) => c.code)] });
  return {
    type: "object",
    properties: {
      type: field({ type: "string", enum: ["", "WC", "GL"] }),
      claimantName: field({ type: "string" }),
      department: field(codes(DEPARTMENTS)),
      dateOfLoss: field({ type: "string" }),
      dateReported: field({ type: "string" }),
      cause: field(codes(CAUSES)),
      bodyPartOrDamage: field(codes([...BODY_PARTS, ...DAMAGE_TYPES])),
      description: field({ type: "string" }),
    },
    required: EXTRACT_KEYS,
    additionalProperties: false,
  };
}

/**
 * Validates extracted fields against our rules and code lists. Anything invalid is dropped (with a warning)
 * rather than shown to the user as a suggestion. Used on both AI and offline results.
 */
export function validateExtraction(raw: unknown): { fields: Partial<Record<ExtractKey, Suggestion>>; warnings: string[] } {
  const fields: Partial<Record<ExtractKey, Suggestion>> = {};
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") return { fields, warnings: ["The extraction result was not a JSON object."] };
  const obj = raw as Record<string, unknown>;

  const take = (k: ExtractKey): Suggestion | null => {
    const f = obj[k];
    if (!f || typeof f !== "object") return null;
    const { value, confidence } = f as Record<string, unknown>;
    if (typeof value !== "string" || !CONFIDENCES.includes(confidence as Confidence)) {
      warnings.push(`${FIELD_LABELS[k]}: malformed suggestion ignored.`);
      return null;
    }
    const v = value.trim();
    return v ? { value: v, confidence: confidence as Confidence } : null;
  };

  const type = take("type");
  if (type && (type.value === "WC" || type.value === "GL")) fields.type = type;
  else if (type) warnings.push(`Claim type "${type.value}" is not WC or GL; ignored.`);
  const claimType = fields.type?.value as ClaimType | undefined;

  const name = take("claimantName");
  if (name) fields.claimantName = { ...name, value: name.value.slice(0, 80) };

  const dept = take("department");
  if (dept && DEPARTMENTS.some((d) => d.code === dept.value)) fields.department = dept;
  else if (dept) warnings.push(`Department code "${dept.value}" is not recognized; ignored.`);

  for (const k of ["dateOfLoss", "dateReported"] as const) {
    const d = take(k);
    if (d && validDate(d.value)) fields[k] = d;
    else if (d) warnings.push(`${FIELD_LABELS[k]} "${d.value}" is not a valid past date; ignored.`);
  }
  if (fields.dateOfLoss && fields.dateReported && fields.dateReported.value < fields.dateOfLoss.value) {
    warnings.push("Date reported was before the date of loss; ignored.");
    delete fields.dateReported;
  }

  const cause = take("cause");
  const causeDef = cause && CAUSES.find((c) => c.code === cause.value);
  if (cause && causeDef && (!claimType || causeDef.type === claimType)) fields.cause = cause;
  else if (cause) warnings.push(`Cause "${cause.value}" doesn't fit a ${claimType ?? "this"} claim; ignored.`);

  const body = take("bodyPartOrDamage");
  const bodyList = claimType === "GL" ? DAMAGE_TYPES : claimType === "WC" ? BODY_PARTS : [...BODY_PARTS, ...DAMAGE_TYPES];
  if (body && bodyList.some((b) => b.code === body.value)) fields.bodyPartOrDamage = body;
  else if (body) warnings.push(`Body part / damage type "${body.value}" doesn't fit this claim; ignored.`);

  const desc = take("description");
  if (desc) fields.description = { ...desc, value: desc.value.slice(0, 1000) };

  return { fields, warnings };
}

// ---------- Offline rule-based parser (no API key, or the AI call failed) ----------

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseLooseDate(s: string): string | null {
  const us = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return iso[0];
  const long = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i.exec(s);
  if (long) return `${long[3]}-${String(MONTHS.indexOf(long[1].toLowerCase()) + 1).padStart(2, "0")}-${long[2].padStart(2, "0")}`;
  return null;
}

/** First labelled line matching any of the labels ("Label: value"). */
function labelled(text: string, labels: string[]): string | null {
  for (const l of labels) {
    const m = new RegExp(`^\\s*${l}\\s*:\\s*(.+)$`, "im").exec(text);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

/** Multi-line block after a heading such as "Description of Incident:" up to the next blank line. */
function block(text: string, headings: string[]): string | null {
  for (const h of headings) {
    const m = new RegExp(`${h}[^\\n]*:\\s*\\n([\\s\\S]+?)(\\n\\s*\\n|$)`, "i").exec(text);
    if (m) return m[1].replace(/\s*\n\s*/g, " ").trim();
  }
  return null;
}

const DEPT_WORDS: [RegExp, string][] = [
  [/\bpolice\b|\bDBPD\b/i, "POL"],
  [/\bfire\b/i, "FIR"],
  [/public works|streets/i, "PW"],
  [/utilit/i, "UTL"],
  [/parks|recreation/i, "PRK"],
  [/facilit/i, "FAC"],
  [/financ/i, "FIN"],
  [/human resources|\bHR\b/i, "HR"],
];

/** A simple keyword parser. It handles the bundled samples and similarly labelled reports. */
export function ruleParse(text: string): { fields: Partial<Record<ExtractKey, Suggestion>>; warnings: string[] } {
  const raw: Record<string, Suggestion> = {};
  const put = (k: ExtractKey, value: string | null | undefined, confidence: Confidence) => {
    if (value) raw[k] = { value, confidence };
  };
  const lower = text.toLowerCase();

  const isWC = /first report of injury|injured employee|employee name|workers'? comp/i.test(text);
  const isGL = /general liability|citizen|claimant name|property damage/i.test(text);
  put("type", isWC && !isGL ? "WC" : isGL && !isWC ? "GL" : null, "medium");

  const name = labelled(text, ["Employee Name", "Injured Employee", "Claimant Name", "Claimant", "Name"]);
  put("claimantName", name?.replace(/^(captain|lieutenant|officer|firefighter|sgt\.?|mr\.?|ms\.?|mrs\.?)\s+/i, ""), "medium");

  const deptLine = labelled(text, ["City Department Involved", "Department", "Dept"]) ?? "";
  const dept = DEPT_WORDS.find(([re]) => re.test(deptLine))?.[1];
  put("department", dept, deptLine ? "medium" : "low");

  const lossLine = labelled(text, ["Date of Injury", "Date of Incident", "Date of Loss", "Date/time of incident", "Date/Time of Incident"]);
  put("dateOfLoss", lossLine && parseLooseDate(lossLine), "medium");
  const rptLine = labelled(text, ["Date Reported to Employer", "Date Reported", "Reported to supervisor", "Date Claim Received", "Date Received"]);
  put("dateReported", rptLine && parseLooseDate(rptLine), "medium");

  const type = raw.type?.value;
  let cause: string | null = null;
  if (/lift/.test(lower)) cause = "LIFT";
  else if (/slipp|wet floor|tripped|fell/.test(lower)) cause = type === "GL" ? "TRIP" : "SLIP";
  if (type === "GL" && /truck|vehicle|backed|collid/.test(lower)) cause = "VEH";
  else if (type === "WC" && /collision|rear-ended|vehicle accident/.test(lower)) cause = "MVA";
  put("cause", cause, "low");

  let body: string | null = null;
  if (type === "GL") {
    if (/bumper|vehicle damage|sedan|car\b/.test(lower)) body = "VD";
    else if (/flood|water/.test(lower)) body = "WD";
    else if (/injur/.test(lower)) body = "BI";
  } else {
    const part = labelled(text, ["Part of Body Injured", "Body part\\(s\\)", "Body part"])?.toLowerCase() ?? lower;
    if (/back/.test(part)) body = "BACK";
    else if (/knee/.test(part)) body = "KNEE";
    else if (/shoulder/.test(part)) body = "SHLDR";
    else if (/wrist|hand/.test(part)) body = "HAND";
    else if (/neck/.test(part)) body = "NECK";
    else if (/ankle|foot/.test(part)) body = "FOOT";
  }
  put("bodyPartOrDamage", body, "low");

  put("description", block(text, ["Description of Injury", "Description of Incident", "Description of Accident", "What happened"]), "medium");

  return validateExtraction(raw);
}
