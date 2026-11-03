# Claude Code prompts — run in order

Paste one at a time. Wait for each phase to build cleanly, check it in the browser
(`npm run dev`), then `git push` before moving on. Vercel redeploys on every push.

---

## Prompt 1 — Plan, scaffold, seed data
```
Read CLAUDE.md fully. This is a focused demo for a government RFP, so scope discipline matters.

First, give me a short build plan: the phases you'll take, the data model (Claim, ReserveTransaction, Payment, DiaryEntry, AuditEvent, AuthorityLimits), the file/folder structure, and how localStorage persistence and "Reset demo" will work without storing the full dataset. Keep the plan to one screen. Wait for my OK.

After I approve, build Phase 1 only:
- Scaffold Next.js (App Router, TypeScript, Tailwind) in the current folder.
- App shell: header with app name "ClaimsDesk", City of Daytona Beach Risk Management label, role switcher, "Reset demo" button; left nav for Dashboard, Claims, New Claim, Migration, Reports, Admin, Roadmap (placeholder pages are fine for later phases).
- Deterministic seed data generator per CLAUDE.md (fixed seed, ~1,300 claims 2021–2026 with dated reserve and payment transactions).
- Claims list with search and filters (type, status, department, adjuster, litigated).
- Dashboard with my open claims, pending approvals, overdue diary items, and flags.
- README with run instructions.
Run npm run build, fix errors, and commit.
If the folder isn't empty and create-next-app refuses, scaffold in a temp subfolder and move the files up, keeping CLAUDE.md and PROMPTS.md.
```

## Prompt 2 — Claim workspace and financial rules
```
Build Phase 2 per CLAUDE.md section 2: the claim detail workspace.
Reserves by category with history, payment request/approve/reject flow, authority limits by role with escalation flags, under-reserved blocking, low-reserve flag, diary with code-based quick entries, close-claim rules, and a full audit trail tab. Add the Admin page for editing authority limits (Risk Manager only).
Switching roles in the header must visibly change what the user can do. Build, fix, commit.
```

## Prompt 3 — Legacy migration
```
Build Phase 3 per CLAUDE.md section 3: legacy data migration.
Write a script that generates legacy_export.csv (~16,000 rows, SQL Server–style column names, legacy department codes, and the seeded data-quality issues listed in CLAUDE.md). Commit the generated CSV to /public.
Build the Migration page: select bundled file or upload → auto field mapping (editable) → validation → Conversion Report → Approve conversion (Risk Manager only).
The report must show source vs. converted counts, rejected rows with reasons, duplicates, mapping exceptions, and financial control totals that tie out. Add a CSV download of exceptions. Keep it fast in the browser. Build, fix, commit.
```

## Prompt 4 — Intake with advisory AI
```
Build Phase 4 per CLAUDE.md section 1: the New Claim page.
Include 3 realistic bundled sample reports (two WC first reports of injury, one GL incident report) as plain text with fake data. Add a server route that sends the pasted report to Claude using @anthropic-ai/sdk and returns structured JSON for our claim fields, with a per-field confidence. Validate the JSON before using it.
If ANTHROPIC_API_KEY is missing or the call fails, fall back to a rule-based parser that handles the 3 samples, and show a small "offline extraction" note.
AI-filled fields must be visibly marked for review; nothing saves until the user clicks Save; log which AI fields were accepted in the audit trail. Build, fix, commit.
```

## Prompt 5 — Reports and Roadmap
```
Build Phase 5 per CLAUDE.md sections 4 and 5.
Reports: "as of" date report by department with drill-down, WC vs GL split, litigated claims by defense firm, CSV export on each, and one chart that can switch between bar and line. Include converted legacy claims if the conversion was approved.
Roadmap page: the RFP coverage table with Built / Simulated in demo / Roadmap statuses and one line each on the production approach, including every item listed in CLAUDE.md section 5. Build, fix, commit.
```

## Prompt 6 — Polish and demo readiness
```
Do a demo-readiness pass. Click through every page as each role and fix anything broken or confusing. Check: empty states, number and date formatting, long names, keyboard navigation and labels on forms, no console errors, and that "Reset demo" restores a clean state.
Make sure the app works with no ANTHROPIC_API_KEY set. Update README. Build, fix, commit.
List anything you consider still rough so I can decide whether to fix it or leave it.
```

---

## If something goes wrong
- Build fails on Vercel but not locally: "The Vercel build failed with this log: [paste]. Fix it."
- Claude Code starts gold-plating: "Stop. Return to the CLAUDE.md scope. What's the smallest change that finishes this phase?"
- Want to wrap up early: skip to Prompt 6 with whatever phases are done.
