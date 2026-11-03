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
| App shell, role switcher, Reset demo | Built |
| Seed data (WC/GL claims, reserves, payments, diary) | Built |
| Dashboard: open claims, pending approvals, overdue diary, financial flags | Built |
| Claims search and filters (type, status, department, adjuster, litigated) | Built |
| Claim summary (read-only) | Built; full workspace next |
| New Claim with AI-assisted intake, Migration, Reports, Admin, Roadmap | Placeholder pages |

## Environment variables

Both are optional. The app works fully without them.

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Turns on AI suggestions for claim intake (server-side only) | unset (rule-based fallback) |
| `ANTHROPIC_MODEL` | Model used for intake suggestions | `claude-haiku-5-5` |

Put them in `.env.local`, which is git-ignored and must never be committed.

## Project layout

```
src/app/            pages (dashboard, claims, claims/[id], placeholders)
src/components/     shell (header, nav), badges, shared UI
src/lib/seed.ts     deterministic seed data generator
src/lib/finance.ts  reserve/paid/outstanding/incurred rules, flags, authority limits
src/lib/store.ts    seed + localStorage overlay, Reset demo
src/lib/selectors.ts role-aware dashboard queries
```
