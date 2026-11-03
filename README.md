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
```

## How the demo works

- **No database, no login.** About 1,300 claims dated 2021–2026, each with dated reserve and
  payment transactions, are generated in the browser from a fixed random seed. The data is
  identical on every load.
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
| New Claim with AI-assisted intake, Migration, Reports, Roadmap | Placeholder pages |

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

### What each role can do
| Role | Can do |
| --- | --- |
| Adjuster (WC / GL) | Work their own claims: reserves, payments, diary, close |
| Supervisor | Work any claim; approve up to $100k reserve / $50k payment; reopen |
| Risk Manager | Everything, with unlimited authority; edit authority limits |
| Read-only staff | View only |

## Environment variables

Both are optional. The app works fully without them.

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Turns on AI suggestions for claim intake (server-side only) | unset (rule-based fallback) |
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
src/lib/store.ts    seed + localStorage overlay, Reset demo
src/lib/selectors.ts role-aware dashboard queries
```
