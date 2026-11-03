// Coded values used by dropdowns, seed data and validation [3.4G].
import type { ClaimType } from "./types";

export interface Code {
  code: string;
  label: string;
}

export const DEPARTMENTS: Code[] = [
  { code: "POL", label: "Police" },
  { code: "FIR", label: "Fire" },
  { code: "PW", label: "Public Works" },
  { code: "UTL", label: "Utilities" },
  { code: "PRK", label: "Parks & Recreation" },
  { code: "FAC", label: "Facilities" },
  { code: "FIN", label: "Finance" },
  { code: "HR", label: "Human Resources" },
];

export interface CauseCode extends Code {
  type: ClaimType;
  dept?: string[]; // restrict to these departments when seeding
}

export const CAUSES: CauseCode[] = [
  { code: "LIFT", label: "Lifting / strain", type: "WC" },
  { code: "SLIP", label: "Slip, trip or fall", type: "WC" },
  { code: "MVA", label: "Vehicle accident", type: "WC" },
  { code: "STRUCK", label: "Struck by object", type: "WC" },
  { code: "CUT", label: "Cut / laceration", type: "WC" },
  { code: "REPET", label: "Repetitive motion", type: "WC" },
  { code: "ASSAULT", label: "Assault during arrest", type: "WC", dept: ["POL"] },
  { code: "EXPOS", label: "Heat / smoke exposure", type: "WC", dept: ["FIR"] },
  { code: "TRIP", label: "Trip hazard (sidewalk / roadway)", type: "GL", dept: ["PW"] },
  { code: "VEH", label: "City vehicle accident", type: "GL" },
  { code: "PROP", label: "Property damage", type: "GL" },
  { code: "SEWER", label: "Sewer / water backup", type: "GL", dept: ["UTL"] },
  { code: "TREE", label: "Tree or limb fall", type: "GL", dept: ["PRK", "PW"] },
  { code: "POLICE", label: "Police liability", type: "GL", dept: ["POL"] },
  { code: "PREM", label: "Premises injury (park / facility)", type: "GL", dept: ["PRK", "FAC"] },
];

export const BODY_PARTS: Code[] = [
  { code: "BACK", label: "Back" },
  { code: "SHLDR", label: "Shoulder" },
  { code: "KNEE", label: "Knee" },
  { code: "HAND", label: "Hand / wrist" },
  { code: "NECK", label: "Neck" },
  { code: "FOOT", label: "Ankle / foot" },
  { code: "HEAD", label: "Head" },
  { code: "LUNG", label: "Lungs / respiratory" },
  { code: "MULTI", label: "Multiple body parts" },
];

export const DAMAGE_TYPES: Code[] = [
  { code: "BI", label: "Bodily injury" },
  { code: "VD", label: "Vehicle damage" },
  { code: "PD", label: "Property damage" },
  { code: "WD", label: "Water damage" },
  { code: "CR", label: "Civil rights allegation" },
];

// Standard diary entries for quick-pick [3.4I].
export const DIARY_CODES: (Code & { days: number })[] = [
  { code: "REV30", label: "30-day file review", days: 30 },
  { code: "MEDSTAT", label: "Obtain medical status update", days: 14 },
  { code: "STMT", label: "Obtain recorded statement", days: 7 },
  { code: "RESREV", label: "Reserve review", days: 30 },
  { code: "LITSTAT", label: "Litigation status from defense counsel", days: 30 },
  { code: "RTW", label: "Return-to-work follow-up", days: 14 },
  { code: "SUBRO", label: "Subrogation review", days: 21 },
  { code: "CLOSE", label: "Closing review", days: 10 },
];

export const DEFENSE_FIRMS: Code[] = [
  { code: "DF1", label: "Halifax & Tomoka, P.A." },
  { code: "DF2", label: "Coquina Coast Legal Group" },
  { code: "DF3", label: "Ponce Inlet Defense Partners" },
  { code: "DF4", label: "Seabreeze, Ryder & Kemp, LLP" },
  { code: "DF5", label: "Indigo Bay Law, P.A." },
];

const index = (codes: Code[]) => new Map(codes.map((c) => [c.code, c.label]));
const deptMap = index(DEPARTMENTS);
const causeMap = index(CAUSES);
const bodyMap = new Map([...index(BODY_PARTS), ...index(DAMAGE_TYPES)]);
const diaryMap = index(DIARY_CODES);
const firmMap = index(DEFENSE_FIRMS);

// Codes used only by converted legacy claims when a legacy value has no match.
export const UNASSIGNED = "UNK";
export const OTHER = "OTHER";
export const deptLabel = (c: string) => deptMap.get(c) ?? (c === UNASSIGNED ? "Unassigned" : c);
export const causeLabel = (c: string) => causeMap.get(c) ?? (c === OTHER ? "Other / unspecified" : c);
export const bodyLabel = (c: string) => bodyMap.get(c) ?? (c === OTHER ? "Other / unspecified" : c);
export const diaryLabel = (c: string) => diaryMap.get(c) ?? c;
export const firmLabel = (c?: string) => (c ? firmMap.get(c) ?? c : "");
