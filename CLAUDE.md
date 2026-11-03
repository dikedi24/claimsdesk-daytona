# CLAUDE.md — ClaimsDesk (Daytona Beach RFP 2704RFP demo)

## What we're building and why
A working demo of a cloud claims management system (CMS), built in response to the
City of Daytona Beach RFP 2704RFP, "Claims Management Software." The City's Risk
Management Division is self-insured and self-administered for **workers' compensation
(WC)** and **general liability (GL)** claims.

- Users: 3 adjusters (2 WC, 1 GL) plus 6 other staff (read-only to data entry).
- Volume: ~148 WC + ~110 GL new claims/year; ~16,000 claims in the legacy system.
- Legacy: on-prem Microsoft SQL Server 2019 database (15 GB). Must migrate without data loss.
- Deadline: live before 9/30/2027.

**Audience for the demo:** the City's Risk Manager, who is non-technical. Every screen
should make sense to someone who handles claims, not someone who writes software.

**This is a focused demo.** Favor working, coherent flows over
breadth. When in doubt, build less and make it solid.

## Tech decisions (already made — don't relitigate)
- Next.js (App Router) + TypeScript + Tailwind. Deploy target: Vercel.
- **No database and no real auth.** Data is seeded deterministically from code/JSON.
  User changes persist in the browser via localStorage (store only changes and flags,
  never the full 16k-row dataset; localStorage is ~5 MB). Include a "Reset demo" button.
- **Role switcher** in the header instead of login: Adjuster (WC), Adjuster (GL),
  Supervisor, Risk Manager, Read-only staff. Each role maps to one named fake user
  (e.g., the WC adjuster sees "my claims" as that person's caseload). Permissions follow
  the selected role.
- **Fixed demo date:** treat "today" as **November 1, 2026** everywhere (seed data,
  overdue diary items, aging, "as of" defaults) so the demo looks the same whenever
  an evaluator opens it.
- Because state lives in localStorage, render data-dependent pages as client components
  (or load state after mount) to avoid hydration mismatches.
- The repo folder already contains CLAUDE.md and PROMPTS.md. If `create-next-app`
  refuses a non-empty folder, scaffold in a temp subfolder and move the files up,
  keeping CLAUDE.md and PROMPTS.md in place.
- AI calls go through a server route only. The API key is read from `ANTHROPIC_API_KEY`;
  model from `ANTHROPIC_MODEL` (default `claude-haiku-5-5`). Use `@anthropic-ai/sdk`.
- **The app must fully work with no API key set** (deterministic fallback, see below).
- Use clearly fake people and data. Claims contain medical info, so no real names.

## Scope
Sections below are referenced by number in PROMPTS.md. **Build order and priority if
we stop early:** claim workspace (2) → legacy migration (3) → AI intake (1) →
reports (4) → roadmap (5). The app should be coherent if we stop after any phase.
RFP section references are in brackets — keep them visible in code comments and the
Roadmap page.

### 1. Claim intake [3.3, 3.4G, 3.16]
- New claim form: type (WC/GL), claimant, department, date of loss, date reported,
  cause, body part / damage type, description, assigned adjuster.
- Validated dropdowns for coded fields; date pickers; required-field validation.
- **"Start from a report"**: paste text of a first report of injury / incident report
  (or choose one of 3 bundled samples). AI pre-fills the form. Every AI-filled field is
  visibly marked "AI suggestion — review before saving." Nothing saves until a human
  clicks Save. Record an audit event noting which fields were AI-suggested and accepted.
- Fallback when no API key: a simple rule-based parser that works on the 3 samples.

### 2. Claim workspace [3.4H–R, 3.11, 3.17]
- Claim header: number (WC-2026-0001 / GL-2026-0001), status, adjuster, totals.
- **Reserves** by category (Medical, Indemnity, Expense) with change history.
- **Payments**: request → approve/reject (reject requires a reason and notifies the
  requester in-app) → issued. Recurring payment schedules are optional.
- **Financial rules:**
  - Incurred = Paid + Outstanding reserve.
  - Authority limits by role (defaults: Adjuster $25k reserve / $10k payment;
    Supervisor $100k / $50k; Risk Manager unlimited). Above-limit actions route to the
    next level with a visible flag [3.17D]. Limits are editable on an Admin page,
    by Risk Manager only [3.17C].
  - A payment cannot exceed the outstanding reserve for its category. The claim shows
    an "Under-reserved" flag and blocks the payment [3.4Q].
  - "Low reserve" flag when paid ≥ 80% of the category reserve [3.4P].
  - Closing a claim requires no pending payments; outstanding goes to $0.
- **Diary**: dated reminders, quick-pick standard entries from codes [3.4I], overdue
  items surfaced on the dashboard [3.4K], entries locked from editing for non-owners [3.4L].
- **Audit trail**: every change logged with user role and timestamp.

### 3. Legacy migration [3.2D, 3.21]
- Bundle a generated `legacy_export.csv` with ~16,000 rows (mirroring the City's stated
  count), shaped like a SQL Server export: different column names than ours, legacy
  department codes, legacy claim numbers (e.g., `L-0012345`).
- Legacy rows are **closed historical claims dated 2006–2020**, so they never overlap
  the seeded 2021–2026 claims. Each row carries summary financials (total paid, final
  reserve, closed date) rather than transaction history; reports use those totals.
- Seed deliberate issues: duplicates, bad or impossible dates, unknown department codes,
  missing claimant names, negative paid amounts, and rows where paid + reserve doesn't
  equal the row's incurred total.
- Migration page flow: Upload/select file → field mapping (auto-mapped, editable) →
  validation → **Conversion report** → "Approve conversion" (Risk Manager only).
- Conversion report must show: source vs. converted record counts, rejected rows with
  reasons, duplicates, mapping exceptions, and **financial control totals** (total
  paid and total outstanding reserves in source vs. converted, which must tie out).
- Provide a CSV download of the exceptions list.
- After approval, converted claims appear in search and reports.

### 4. Reports [3.5–3.10]
- **"As of" report**: pick a date; show open claim counts and incurred by department,
  WC vs. GL, as they stood on that date (requires dated reserve/payment transactions).
  Click a department to drill down to its claims [3.5G].
- **Litigated claims** by defense firm: count, active, total paid to firm [3.10C].
- CSV export on every report [3.5D].
- A simple chart that can switch between bar and line [3.9F].

### 5. Roadmap / RFP coverage page
A table of the RFP's Appendix A areas with status: **Built**, **Simulated in demo**,
or **Roadmap**, plus one line on how production would handle it. Must include:
Florida DWC EDI FROI/SROI reporting [3.14D], bill review and fee schedule integration
[3.13B], City financial system integration [3.11B], HIPAA safeguards and SSO/MFA
[3.18G], 24x7 hosting and backups [3.12], admin-defined custom fields [3.15D],
native-format data export at termination [3.21D].

## Seed data
- Departments: Police, Fire, Public Works, Utilities, Parks & Recreation, Facilities,
  Finance, Human Resources.
- 2021–2026: ~1,300 claims at realistic annual volumes, ~15% litigated (GL-heavy),
  realistic WC causes (lifting, slip/fall, vehicle) and GL types (trip hazard, vehicle,
  property damage).
- Each claim has dated reserve changes and payments so "as of" reports are meaningful.
- Use a fixed random seed so data is identical on every load.
- Defense firms: 4–5 fictional Florida firms.

## UX guidelines
- Plain, government-appropriate look. Readable tables, clear status badges.
- Dashboard home: my open claims, overdue diary items, pending approvals, flags.
- Accessibility: semantic HTML, labeled inputs, keyboard navigable, sufficient contrast
  (RFP 5.19 requires WCAG 2.0 AA for public-facing services).
- Desktop-first, but nothing should break on a laptop screen.

## Working agreements
- Before each phase: state a short plan, then build. Keep phases small.
- Run `npm run build` before declaring a phase done; fix all type and build errors.
- Commit after each working phase with a clear message.
- Don't add dependencies without reason. papaparse for CSV and a small chart library
  are fine.
- Never commit secrets. `.env.local` stays in `.gitignore`.
- Keep `README.md` current: what it is, how to run, which env vars exist.
- AI is advisory only. It never saves, approves, pays, or closes anything by itself.
