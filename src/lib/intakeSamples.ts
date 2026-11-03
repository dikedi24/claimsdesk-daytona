// Bundled sample reports for "Start from a report" [3.3, 3.16]. All people and details are fictional.

export interface SampleReport {
  id: string;
  label: string;
  text: string;
}

export const SAMPLE_REPORTS: SampleReport[] = [
  {
    id: "wc-lifting",
    label: "WC — First report of injury (Public Works, lifting)",
    text: `CITY OF DAYTONA BEACH
EMPLOYER'S FIRST REPORT OF INJURY OR ILLNESS
(Internal copy — Risk Management)

Employee Name: Teodora Vance-Ellery
Job Title: Maintenance Worker II
Department: Public Works — Streets Division
Supervisor: Lyle Brannock

Date of Injury: 10/27/2026        Time: 9:40 AM
Date Reported to Employer: 10/28/2026
Location: Manhole at Beach St & Orange Ave

Description of Injury/Accident:
Employee was lifting a manhole cover with a lifting hook when the hook slipped. She felt a sharp
pain in her lower back and was unable to continue working. Taken to Tomoka Urgent Care, diagnosed
with a lumbar strain, placed on light duty for 2 weeks.

Part of Body Injured: Lower back
Nature of Injury: Strain
Witness: Arlo Penhallow (crew member)
Lost time expected: No — light duty available

Completed by: L. Brannock, Streets Supervisor      Date: 10/28/2026`,
  },
  {
    id: "wc-slip",
    label: "WC — First report of injury (Fire, slip and fall)",
    text: `FIRST REPORT OF INJURY — CITY OF DAYTONA BEACH FIRE DEPARTMENT

Injured Employee: Captain Desmond Thorne-Alvarez
Position: Fire Captain, Station 5
Dept: Fire

Date/time of incident: October 22, 2026 at approx. 0715 hrs
Reported to supervisor: October 22, 2026

What happened:
During morning apparatus checks, the employee slipped on a wet floor in the apparatus bay
(hose had just been washed) and twisted his left knee as he fell. Swelling noted immediately.
Evaluated at Riverside Occupational Medicine; MRI ordered for possible meniscus tear.

Body part(s): left knee
Treatment: Clinic visit, MRI pending
Off duty: Yes, until MRI results

Reported by: Battalion Chief R. Okonkwo-Sterling`,
  },
  {
    id: "gl-vehicle",
    label: "GL — Citizen incident report (Utilities truck, vehicle damage)",
    text: `CITY OF DAYTONA BEACH — RISK MANAGEMENT
GENERAL LIABILITY INCIDENT REPORT (Citizen Claim)

Claimant Name: Reginald Oakshott
Claimant Address: 412 Seagrape Lane, Daytona Beach, FL 32118
Phone: (386) 555-0147

Date of Incident: 10/19/2026
Date Claim Received: 10/24/2026
Location: Parking lot, 1200 block of Mason Ave

City Department Involved: Utilities
City Vehicle/Unit: Utilities service truck #U-217

Description of Incident:
Claimant states his parked 2021 sedan was struck when a City Utilities service truck backed out
of a parking space. The rear bumper and tail light were damaged. The City driver stopped and
exchanged information. Claimant has submitted a repair estimate of $2,850 from Coastal Collision
& Auto Body. No injuries reported.

Type of Damage: Vehicle damage (rear bumper, tail light)
Police report: DBPD #26-118842

Taken by: Risk Management intake desk`,
  },
];
