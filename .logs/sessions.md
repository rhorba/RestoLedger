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

## SESSION_END — 2026-08-20 (Sprint 3)
Completed: mobile app (Expo/React Native) — auth, quick entry with offline queue, home/ledger/settings, role-based tab visibility. Added backend idempotency-key support (real dedup, not cosmetic) since the offline queue's correctness depends on it.
Manual QA done via Expo's web target (react-native-web) in a real browser — the only way to visually validate without a physical device/emulator in this environment. This is a real testing gap worth remembering: native-only behavior (haptics, real Keychain/Keystore, push notifications) was NOT exercised.
Two corrections logged: an RLS session-variable pooling bug (Sprint 1, still relevant context) and this sprint's offline-queue test-isolation lesson (fire-and-forget async calls can leak module state across Jest tests in the same file).
Next session: Sprint 4 — POS/payment integration behind the adapter interface (ADR-4), CI/CD pipeline, encrypted backup + restore drill, and the pre-launch Law 09-08/CNDP compliance checklist (needs actual legal review, not just documentation).
