# Sessions Log

## SESSION_START — 2026-08-20 19:04
Project: RestoLedger (new)
Context: New multi-tenant ERP/accounting SaaS for street-food & QSR restaurants, modeled on the business described in Restopedia's job posting (LinkedIn 4456308420). Built independently using the CTS specialist framework — not affiliated with Restopedia.

## SESSION_END — 2026-08-20
Completed: Sprint 1 foundation (auth w/ lockout+refresh, multi-tenant model w/ RLS, tenant-scope guard, ledger post/reverse w/ audit trail). 32 tests passing, 98%+ combined coverage, 0 npm audit vulnerabilities. Pushed to github.com/rhorba/RestoLedger.
Found and fixed a real bug: Postgres session-variable pooling leak in RLS (see .logs/corrections.md) — caught by the e2e suite against real Postgres, not by inspection.
Next session: Sprint 2 — RBAC enforcement sweep, GET audit-log endpoint, web dashboard (Next.js + shadcn/ui per docs/ui-restoledger.md).

## SESSION_END — 2026-08-20 (Sprint 2)
Completed: full RBAC endpoint review (no gaps found), GET audit-log + GET dashboard backend endpoints, and the entire Sprint 2 web dashboard (Next.js/Tailwind/shadcn) — login, tenant switcher, dashboard, ledger, audit log, team invite. Manually QA'd in a real browser, then automated as a recorded Playwright E2E test.
Found and fixed during manual QA: a stale API server process (pre-dating a code change) was masking as a generic frontend error — not a code bug, but worth remembering when debugging "works via curl, fails in browser" symptoms locally.
Next session: Sprint 3 — mobile app (Expo/React Native), owner/staff daily entry, offline queue, store publishing.
