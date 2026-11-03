# ClaimsDesk

A working demo of a cloud claims management system for the **City of Daytona Beach Risk
Management Division**, prepared in response to **RFP 2704RFP, "Claims Management Software."**
It covers workers' compensation (WC) and general liability (GL) claims.

All people, claims and medical details are **fictional**.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve the production build
npm run generate:legacy   # regenerate public/legacy_export.csv (deterministic)
```

**No API key is needed.** Without `ANTHROPIC_API_KEY`, everything works. The only difference is
on New Claim: "Fill form from report" uses an offline rule-based parser (which handles the 3
bundled samples) and shows an "Offline extraction" note.

Live demo: https://claimsdesk-daytona.vercel.app/

## Suggested demo walkthrough (about 10 minutes)

1. **Dashboard (Adjuster WC):** open claims, approvals, overdue diary and flags for Pat's
   caseload.
2. **New Claim:** pick the Public Works sample, then click **Fill form from report**. Point out
   the "review before saving" markers, change one field, and click **Save claim**. The audit
   trail shows which suggestions were accepted.
3. **Claim WC-2026-0047:** a low-reserve flag and a $57k reserve increase waiting for the
   Supervisor.
4. **Switch to Supervisor:** approve the reserve change. On WC-2026-0069, the $89,900 payment
   is *Escalated: Risk Manager*, so the Supervisor can't approve it.
5. **Switch to Risk Manager:** approve the payment. On **Admin**, change a limit and watch the
   routing update.
6. **Migration:** use the bundled file, then go through mapping, validation and the conversion
   report ("15,390 converted · 370 held for correction · 240 duplicates excluded · 0 records
   lost"). Fix one held row inline, then **Approve conversion**.
7. **Reports:** the "as of" report (change the date, click a department), the claims-by-year
   chart (Bar/Line, now back to 2006), litigation by firm, and CSV downloads.
8. **Roadmap:** what's built, what's simulated, and the production approach for the rest.
9. **Reset demo** to start clean.

## How the demo works

- **No database, no login.** About 1,300 claims dated 2021–2026, each with dated reserve and
  payment transactions, are generated in the browser from a fixed random seed. The data is
  identical on every load.
- **Seeded history respects authority limits.** Any historical reserve change that took a claim's
  total reserve above $25k, and any payment above $10k, carries an approval by the Supervisor
  (or by the Risk Manager above $100k reserve / $50k payment). These approvals appear in the
  audit trail.
- **Fixed demo date.** "Today" is always **November 1, 2026**, so overdue diary items and
  aging look the same whenever the demo is opened.
- **Role switcher** in the header (Adjuster WC, Adjuster GL, Supervisor, Risk Manager,
  Read-only staff). Each role is one fictional user, and permissions follow the role.
- **Your changes stay in your browser** (localStorage). Only changes and flags are saved,
  never the full dataset. **Reset demo** in the header clears them and restores the
  original data.

## What's built

| Area | Status |
| --- | --- |
| App shell, role switcher, notifications, Reset demo | Built |
| Seed data (WC/GL claims, reserves, payments, diary) | Built |
| Dashboard: open claims, pending approvals, overdue diary, financial flags | Built |
| Claims search and filters (type, status, department, adjuster, litigated) | Built |
| Claim workspace: reserves, payments, diary, close/reopen, audit trail | Built |
| Admin: authority limits (Risk Manager only) | Built |
| Legacy migration: mapping, validation, conversion report, approval | Built |
| New Claim with AI-assisted intake (offline fallback) | Built |
| Reports: as-of by department with drill-down, claims-by-year chart, litigation by firm, CSV | Built |
| Roadmap: RFP coverage (Built / Simulated in demo / Roadmap) | Built |

### Financial rules in the claim workspace
- **Incurred = paid + outstanding reserve**, tracked per category (Medical, Indemnity, Expense).
- **Authority limits** (defaults: Adjuster $25k reserve / $10k payment; Supervisor $100k / $50k;
  Risk Manager unlimited). Reserve authority applies to the claim's total reserve. Anything
  above the user's limit is routed to the next level, shown as "Awaiting Supervisor" or
  "Escalated: Risk Manager". The Risk Manager can change the limits on the Admin page.
- **Payments**: requested → approved or rejected (a rejection needs a reason and notifies the
  requester) → issued. A payment within the requester's own authority is approved automatically.
- **Under-reserved**: a payment larger than the reserve left in its category is blocked.
- **Low reserve**: flagged when 80% or more of a category's reserve has been paid.
- **Closing a claim** requires no pending or unissued payments and no pending reserve changes.
  Closing sets outstanding reserves to $0. The Supervisor or Risk Manager can reopen a claim.
- **Diary**: standard entries pick a default due date. Only the owner can edit or complete an
  entry.
- **Audit trail**: every change records the user, role and time.

### Legacy migration
`public/legacy_export.csv` is a generated stand-in for the City's SQL Server export: 16,000 closed
claims from 2006–2020, with legacy column names, department codes and claim numbers
(`L-0012345`). It deliberately contains data problems: 240 duplicates, 160 bad or impossible
dates, 100 unknown department codes, 80 missing claimant names, 50 negative paid amounts, and 80
rows where paid + reserve doesn't equal incurred.

The Migration page walks through: select the bundled file or upload a CSV → field mapping
(auto-matched, editable) → validation → conversion report → **Approve conversion** (Risk Manager
only).
- **No record is discarded** (RFP 3.2D, "without loss of data"). Each row is converted, **held
  for correction**, or excluded as a duplicate of a claim that did convert. The report summary reads
  like "15,390 converted · 370 held for correction · 240 duplicates excluded · 0 records lost."
- **Control totals** for records, paid, outstanding and incurred: Source total = Converted + Held
  for correction + Duplicates excluded, with a $0.00 difference required in every column before
  approval. If corrections change a dollar amount, their net effect is shown on its own line.
- **Correction queue:** the Risk Manager can fix a held row's values inline and re-validate it. If
  it passes, it converts immediately. This works before or after approval, and every correction
  is audit-logged.
- The exceptions list can be downloaded as CSV.
- Approved claims appear in Claims search as closed, read-only historical claims.
- Only the approval, the field mapping and the corrections are saved, never the rows. The
  conversion is rebuilt from the bundled file on each load.

Regenerate the file with `npm run generate:legacy`. It's deterministic, so the output is identical
each time.

### New Claim and AI-assisted intake
- A validated claim form: coded dropdowns filtered by claim type, date pickers, required fields,
  and checks such as "reported can't be before the date of loss". Saved claims are numbered
  `WC-2026-0001` / `GL-2026-0001`, and a "recorded statement" diary reminder is added for the
  adjuster.
- **Start from a report:** paste a first report of injury or incident report, or pick one of the
  3 bundled fictional samples. The form is pre-filled, and every suggested field is outlined and
  marked "AI suggestion — review before saving" with a confidence level until someone changes or
  keeps it.
- **AI is advisory.** Nothing is saved until a person clicks **Save claim**. The audit trail
  records which suggested fields were accepted as-is and which were changed (with both values).
- **How the AI call works:** `POST /api/extract` runs on the server only. It sends the report to
  Claude with `@anthropic-ai/sdk`, using a JSON schema that limits coded fields to our code
  lists. The result is validated again (codes, real past dates, cause matching the claim type)
  before anything reaches the form.
- **Offline fallback:** if `ANTHROPIC_API_KEY` is missing or the call fails, a rule-based parser
  fills the form (it handles the 3 samples). The page shows an "Offline extraction" note giving
  the reason, and the badges say "Suggested from report (offline parser)".

### Reports
- **"As of" report:** open claim counts and incurred by department, split WC vs. GL, as they
  stood on any date. Figures are rebuilt from dated reserve and payment transactions. Select a
  department to drill down to its claims, with each claim's status, paid, outstanding and
  incurred on that date.
- **Claims by year:** claims reported or total incurred per loss year, WC vs. GL, switchable
  between bar and line. The default range is 2021–2026. Once the conversion is approved, an
  **Include legacy history** toggle adds 2006–2020, with a note that those rows reflect the City's
  stated 16,000-record count. The chart is a small dependency-free SVG with a legend, hover values
  and a data table.
- **Litigated claims by defense firm:** claim count, active claims, total paid to the firm,
  and incurred.
- **CSV download on every report**, including the drill-down.
- **Converted legacy claims:** once the conversion is approved, the reports include them and
  the "as of" loss-year range extends back to 2006. They carry final summary totals only.

### Roadmap
A table of the RFP requirement areas, each marked **Built**, **Simulated in demo** or
**Roadmap**, with what the demo does and one line on the production approach. This includes
Florida DWC EDI, bill review, City financial system integration, HIPAA with SSO/MFA, hosting and
backups, custom fields, and data export at termination.

### What each role can do
| Role | Can do |
| --- | --- |
| Adjuster (WC / GL) | Enter new claims; work their own claims: reserves, payments, diary, close |
| Supervisor | Work any claim; approve up to $100k reserve / $50k payment; reopen |
| Risk Manager | Everything, with unlimited authority; edit authority limits; approve or roll back the legacy conversion |
| Read-only staff | View only |

## Known limitations of the demo

- Data lives in one browser (localStorage). Two people won't see each other's changes, and
  **Reset demo** clears them.
- Converted legacy claims carry summary totals only. "As of" reports show their final totals
  for past dates, and an approved *uploaded* file lasts only until the page reloads (the
  bundled file is rebuilt on every load).
- Desktop-first: tested at 1280px and 1024px widths. Phone layouts are not optimized.

## Environment variables

Both are optional. The app works fully without them.

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Turns on AI suggestions for claim intake. Read only by the server route; never sent to the browser | unset (offline rule-based parser) |
| `ANTHROPIC_MODEL` | Model used for intake suggestions | `claude-haiku-5-5` |

Put them in `.env.local`, which is git-ignored and must never be committed.

## Project layout

```
src/app/            pages (dashboard, claims, claims/[id] workspace tabs, admin, placeholders)
src/components/     shell (header, nav), badges, shared UI
src/lib/seed.ts     deterministic seed data generator
src/lib/finance.ts  reserve/paid/outstanding/incurred rules, flags, authority limits
src/lib/actions.ts  claim actions (reserves, payments, diary, close) with validation and audit
src/lib/permissions.ts what the current role may do
src/lib/legacy.ts   legacy field mapping, validation rules, control totals
src/lib/intake.ts   intake extraction schema, validation, offline rule-based parser
src/lib/reports.ts  as-of, by-department, litigation and by-year report calculations
src/components/Chart.tsx  dependency-free bar/line SVG chart
src/app/api/extract/route.ts  server route that calls Claude (falls back to the offline parser)
src/lib/store.ts    seed + localStorage overlay, Reset demo
scripts/generate-legacy.mjs  generates public/legacy_export.csv
src/lib/selectors.ts role-aware dashboard queries
```
