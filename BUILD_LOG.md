# Build log: ClaimsDesk

How this demo was built, why it looks the way it does, and what would come next. It is
written for a reader who handles claims, not software.

Live demo: https://claimsdesk-daytona.vercel.app/

---

## 1. Context

**The RFP.** The City of Daytona Beach's RFP 2704RFP asks for cloud claims management
software for its Risk Management Division. The City is self-insured and administers its own
workers' compensation (WC) and general liability (GL) claims. That means 3 adjusters plus 6
other staff, about 258 new claims a year, and about 16,000 historical claims in an on-premises
SQL Server 2019 database. The system must be live before September 30, 2027.

**Why this RFP.** It was chosen over a permitting RFP from Lexington, NC, for three reasons:
- **A smaller user base:** 9 users, whose roles are easy to show with a role switcher.
- **A clearer workflow:** intake, reserves, payments, approvals and closing, with well-defined
  money rules.
- **A concrete data migration:** a named SQL Server source and a stated record count. That
  makes it possible to show a credible conversion, not just talk about one.

**The audience.** The City's Risk Manager, who is non-technical. Every screen had to make sense
to someone who handles claims.

---

## 2. Approach

- **A standing brief (`CLAUDE.md`).** One file set the scope, tech choices, money rules, seed
  data, UX standards and working agreements. Every phase was built against it, which kept
  decisions consistent and stopped scope creep.
- **Six phase prompts, in sequence (`PROMPTS.md`).** Each phase had to leave the app usable on
  its own, so the demo would hold up if work stopped early. The order followed the brief's
  priorities: claim workspace → legacy migration → AI intake → reports → roadmap → polish.
- **Plan first for the logic-heavy phases.** For the foundation, claim workspace, migration and
  reports, a short written plan (data model, rules, files, how to verify it) was approved
  before any code was written.
- **The same finish line every phase:** build → lint → test → commit → push. Every push
  redeployed to Vercel automatically, so each phase could be checked live, by switching roles,
  before the next one started.
- **Testing went beyond "it compiles."**
  - Small scripts exercised the business rules directly: authority limits, under-reserved
    blocking, control totals that tie out.
  - A headless browser clicked through every page as each of the five roles, watching for
    errors, unlabeled form fields, broken numbers and layout overflow.

---

## 3. Phase by phase

| Phase | Commit | What it delivered |
|---|---|---|
| 1. Foundation | `1b6c866` | App shell, role switcher, Reset demo, ~1,300 seeded claims, claims search, dashboard |
| 2. Claim workspace | `41aad8c` | Reserves, payments, approvals, authority limits, diary, close/reopen, audit trail, Admin |
| 3. Legacy migration | `8ce5512`, `1ee29a2` | 16,000-row legacy file, field mapping, validation, conversion report, approval, correction queue |
| 4. AI-assisted intake | `03e8902` | New Claim form, "start from a report" with Claude, offline fallback |
| 5. Reports and Roadmap | `6fbd7f6` | "As of" report with drill-down, chart, litigation by firm, CSV everywhere; RFP coverage page |
| 6. Demo readiness | `746690d`, `51e8100`, `41f85d3` | Accessibility and clarity fixes, triaged follow-ups, README walkthrough |

### Phase 1: Foundation
- **Built:**
  - the app shell with the header, nav, role switcher and **Reset demo**;
  - a seed generator producing ~1,300 claims for 2021–2026, about 16% litigated, with dated
    reserve and payment history;
  - claims search with filters, and a role-aware dashboard showing my open claims, approvals,
    overdue diary and flags.
- **Key decisions:**
  - Seed data is regenerated in the browser from a fixed random seed, so it's identical on
    every load.
  - Only the user's *changes* are saved (in the browser), never the dataset. Each role maps to
    one fictional person.
- **Defaults accepted:**
  - the newest Next.js version, which needed small loading-boundary changes to build;
  - clearly fictional names throughout;
  - claim numbers by year of loss.
- **Verified by:**
  - a script confirming claim counts, litigation rate, and no negative outstanding reserves;
  - a headless-browser render of the dashboard, claims list and a claim page.

### Phase 2: Claim workspace
- **Built:**
  - claim tabs: Overview, Reserves, Payments, Diary, Audit trail;
  - payment request → approve or reject (a reason is required, and the requester is
    notified) → issue;
  - authority limits with escalation flags;
  - Under-reserved blocking and Low-reserve flags;
  - close and reopen rules;
  - owner-only diary editing;
  - a notifications bell, and an Admin page where only the Risk Manager edits limits.
- **Key decisions:**
  - Reserve authority is checked against the claim's **total** reserve.
  - A payment within the requester's own limit is approved automatically. Above it, it routes
    to the next level ("Awaiting Supervisor" or "Escalated: Risk Manager").
  - A "what you can do" bar on every claim makes role differences visible.
- **Defaults accepted:**
  - diary entries are locked even for supervisors (the brief's "non-owners" rule, applied
    literally);
  - an approved reserve change takes effect on the approval date.
- **Verified by:**
  - a script that walked the money rules end to end: above-limit routing, under-reserved
    blocks, rejection notices, close blocked by pending items, then allowed;
  - a render of every tab in the browser.

### Phase 3: Legacy migration
- **Built:**
  - a generator for `legacy_export.csv`: 16,000 rows with SQL Server–style column names,
    legacy department codes and `L-0012345` claim numbers, and deliberate problems
    (duplicates, impossible dates, unknown codes, missing names, negative amounts, totals that
    don't add up);
  - a wizard: select or upload → auto-mapped fields (editable) → validation → conversion
    report → **Approve conversion**, for the Risk Manager only.
- **Key decisions:**
  - Only the approval, the mapping and any corrections are saved. The 16,000 rows are rebuilt
    from the bundled file on each load.
  - Unknown department codes and causes convert as "Unassigned" / "Other" and are flagged, not
    rejected.
- **Defaults accepted:** an approved *uploaded* file lasts only for the browser session.
- **Verified by:**
  - a script confirming the exact planned count for every issue type, and $0.00 differences
    on records, paid, outstanding and incurred;
  - parse plus validation in about 0.15 seconds;
  - a browser click-through of the whole wizard as the Risk Manager.

### Phase 4: AI-assisted intake
- **Built:**
  - a validated New Claim form;
  - "Start from a report": paste a first report of injury or incident report, or pick one of
    three fictional samples, and Claude pre-fills the form;
  - every suggested field is outlined and marked **"AI suggestion — review before saving"**
    with a confidence level;
  - nothing saves until a person clicks Save, and the audit trail records which suggestions
    were accepted or changed.
- **Key decisions:**
  - The AI call runs only on the server, and its answer is constrained to the City's code
    lists.
  - Every answer is validated again before it reaches the form.
  - With no key, or if the call fails, a rule-based parser fills the form and the page says
    "Offline extraction" with the reason.
- **Defaults accepted:**
  - the fast, low-cost Claude model (Haiku 5.5) at low effort;
  - no extra libraries;
  - badges say "Suggested from report (offline parser)" when Claude wasn't used.
- **Verified by:**
  - the offline parser filling all 8 fields correctly on all 3 samples;
  - an invalid-key test proving the fallback;
  - a test with deliberately bad AI output proving the validator drops it;
  - a browser run of sample → review → change one field → save → audit entry;
  - later, a live check on Vercel (see course corrections).

### Phase 5: Reports and Roadmap
- **Built:**
  - an **"as of" report** by department, split WC vs. GL, rebuilt from dated transactions for
    any date, with click-through drill-down;
  - a claims-by-year chart with a Bar/Line toggle;
  - litigated claims by defense firm;
  - CSV download on every report;
  - a **Roadmap** page rating each RFP area as Built, Simulated in demo, or Roadmap, with the
    production approach.
- **Key decisions:**
  - The chart is a small custom chart, not a new library, with colour-blind-safe colours (run
    through a palette checker) and a data table for screen readers.
  - Converted legacy claims appear in reports once the conversion is approved.
- **Defaults accepted:** legacy claims show their final totals for past "as of" dates, since
  they have no transaction history. A note on the page says so.
- **Verified by:**
  - for today, the "as of" totals match the live claim totals exactly (219 open, $23,538,691
    incurred);
  - department rows add up to the totals;
  - in the browser: date changes, drill-down, the chart toggle, all CSV downloads, and the
    legacy years after approval.

### Phase 6: Demo readiness
- **Checked:** every page as each of the five roles at laptop widths (1280px and 1024px),
  70 page-and-role combinations, plus keyboard use, long names, empty states, no-key
  operation, and that **Reset demo** restores a clean state.
- **Fixed:**
  - a visible keyboard focus ring on the nav;
  - a working "skip to content" link;
  - "Good morning" replaced (wrong for afternoon demos);
  - legacy claims no longer show empty $0 tabs;
  - name and description limits enforced on save;
  - audit times in local time, not UTC;
  - a README walkthrough and a known-limitations section.
- **Verified by:** re-running the full sweep after the fixes: no errors, unlabeled fields,
  overflow or broken numbers.

---

## 4. Course corrections

- **"Rejected" became "Held for correction", with full dollar reconciliation.** The first
  migration "rejected" bad rows. RFP 3.2D requires conversion *without loss of data*, so the
  model changed:
  - Bad rows now wait in a queue with their reason, and the Risk Manager can fix a value inline
    and re-validate it, before or after approval.
  - The control totals now read Source = Converted + Held for correction + Duplicates excluded,
    with a $0.00 difference required in every column.
  - The summary now reads "15,390 converted · 370 held for correction · 240 duplicates excluded
    · 0 records lost."
- **Build order: migration before AI intake.** The brief was reordered before building began.
  The claim workspace and the conversion story matter most to a self-administered City with
  16,000 legacy claims. AI intake is valuable but less central, so it moved to phase 4.
- **Legacy data limited to 2006–2020.** Legacy rows were set as closed historical claims dated
  2006–2020, so they never overlap the seeded 2021–2026 claims. Reports can then combine both
  without double counting.
- **A fixed demo date (November 1, 2026).** "Today" is pinned, so overdue diary items, aging
  and report defaults look the same whenever an evaluator opens the demo.
- **The AI path stayed untested until a key was added on Vercel.** The build environment had no
  API key, so only the offline fallback and error handling could be proven at first. After the
  owner added a personal key in the Vercel project settings, one live call confirmed it: all
  8 fields correct in about 4 seconds.
- **Phase 6 triage.** The readiness pass produced a list of rough edges. The owner chose to fix
  four:
  - The chart now defaults to 2021–2026, with an **Include legacy history** toggle and a note.
    Converted years average about 1,000 claims, against about 220 in the current system.
  - Seeded history now respects authority limits: 1,146 historical reserve changes and 122
    payments now carry a Supervisor or Risk Manager approval.
  - The AI route gets a longer server time limit, so Vercel doesn't cut off a slow call.
  - A responsive phone/tablet layout entry was added to the Roadmap.

  Deliberately left as-is:
  - the second WC adjuster isn't a selectable role;
  - legacy "as of" figures use final totals;
  - long seeded audit trails;
  - a brief "Loading…" flash on each page;
  - claim numbers follow the year of loss.
- **Sub-claims identified as a gap.** The owner noticed the RFP's root claims with sub-claims
  and additional claimants (3.3D, 3.4D), which the demo doesn't model. It went on the Roadmap,
  with a note that discovery should check how the legacy system stores suffix claims. That may
  explain why the 16,000-record count exceeds the City's ~258 claims a year.

---

## 5. Deliberate non-goals

| Not built | Why |
|---|---|
| **A database** | A demo has to open instantly for any evaluator, with no setup and identical data every time. Seeded data plus browser storage does that, and **Reset demo** gives a clean slate. Production would use an encrypted managed database. |
| **Real sign-in** | A role switcher lets one evaluator see all five perspectives in seconds. Production would use single sign-on with the City's identity provider and multi-factor authentication (RFP 3.18G). |
| **Phone and tablet layouts** | Adjusters work at desks; laptop widths were tested. Phone views for supervisors approving on the go are on the Roadmap. |
| **Integrations** (Florida DWC EDI, bill review, City financial system) | They depend on the City's vendors, accounts and test environments, which aren't available for a demo. Each is on the Roadmap with the production approach. |

---

## 6. What I'd do next

1. **Discovery with the City:** the legacy database schema (including suffix claims), current
   reports, code tables, approval habits, and a sample export for a trial conversion.
2. **A usability session with the Risk Manager** using the demo walkthrough, to adjust wording
   and the defaults noted above.
3. **Production foundations:** database, SSO/MFA, role administration, audit retention,
   hosting and backups.
4. **The Roadmap integrations, in risk order:** a City financial system payment export, then
   DWC EDI FROI/SROI, then bill review.
5. **Sub-claims and additional claimants**, custom fields, document attachments, and responsive
   layouts.
6. **A formal accessibility audit and VPAT** before go-live.

### Running the work in parallel with multiple agents

The sequence above was built one phase at a time. Most of it can run in parallel once a shared
foundation exists:

1. **One lead agent first** sets the brief, data model, shared code lists and saved-state
   design. Every other workstream depends on these, so they must be fixed early and changed
   rarely.
2. **Then parallel workstreams**, each an agent on its own branch (or worktree) with a
   narrow brief:
   - claim workspace and money rules;
   - legacy migration (generator plus wizard);
   - AI intake (server route plus form);
   - reports and roadmap.

   Each writes to its own folders and adds actions in its own section, which keeps merge
   conflicts small.
3. **An independent reviewer agent** runs the role-by-role browser sweep and the rule-checking
   scripts on every merge. It reports problems without having written the code, so it isn't
   anchored on the author's assumptions.
4. **The lead merges in priority order:** workspace → migration → intake → reports. It resolves
   the few shared files (saved state, actions, README) and re-runs the full sweep before each
   deploy.

The same pattern fits production: a foundation team, then parallel tracks for conversion,
integrations and features, with continuous independent QA.
