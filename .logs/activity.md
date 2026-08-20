## MILESTONE — 2026-08-20
PRD drafted: docs/prd-restoledger.md — RestoLedger, multi-tenant financial/ledger SaaS for Moroccan street-food/QSR restaurants (accounting-firm-managed model). Comprehensive scope chosen by user. Awaiting approval.

## MILESTONE — 2026-08-20
Batch 1 complete: System Design, Architecture, Security Baseline, Database Design drafted.
- system-design-restoledger.md: modular monolith, single-region, no cache/queue in v1 (SDR-1/2/3)
- architecture-restoledger.md: NestJS+Postgres+Next.js+Expo/Prisma stack, row-level tenant scoping + RLS, append-only ledger, POS adapter interface (ADR-1..4)
- security-restoledger.md: RBAC (owner/accountant/staff/firm_admin), JWT auth, envelope encryption for integration credentials, Law 09-08/CNDP flagged as legal-review gate before real client data
- database-restoledger.md: Postgres schema (tenant, app_user, tenant_membership, ledger_entry, audit_log_entry, integration_connection) + RLS policies + index strategy

## MILESTONE — 2026-08-20
Batch 2 complete: UX Foundation + UI Foundation drafted.
- ux-restoledger.md: personas (owner/accountant/staff), IA, 3 core flows, mobile+web wireframes, empty/loading/error states
- ui-restoledger.md: Tailwind + shadcn/ui (web) + NativeWind (mobile), shared token set, component inventory

## MILESTONE — 2026-08-20
Batch 3 complete: Test Strategy, DevOps Foundation, Stories drafted. ALL 10 foundation docs complete for RestoLedger:
prd, system-design, architecture, security, database, ux, ui, test-strategy, devops, stories.
Epics/sprints: Sprint1 (auth+tenancy+ledger core), Sprint2 (RBAC+audit+web dashboard), Sprint3 (mobile app), Sprint4 (POS integration+compliance+CI/CD).
Foundation-doc session complete. No code written yet per CLAUDE.md rule 13 (mandatory doc-first gate).

## PUSH — 2026-08-20
Pushed to https://github.com/rhorba/RestoLedger, branch main, commit 8b4b3d4.

## SESSION_START — Sprint 1 EXECUTE — 2026-08-20
Env vars collected: DATABASE_URL (local docker-compose Postgres, port 5433), JWT_ACCESS_SECRET/JWT_REFRESH_SECRET (generated dev-only random secrets), PORT, NODE_ENV. Written to api/.env.example (placeholders, committed) and api/.env (real dev values, gitignored).
Local Postgres started via docker-compose (restoledger-postgres, port 5433) — separate from other local projects' containers (moqawil on 5434).
NestJS API scaffolded in api/. Dependencies installed: Prisma 7.9.1, @nestjs/jwt, @nestjs/passport, passport-jwt, bcrypt, class-validator/transformer, helmet, @nestjs/config.
npm audit: fixed high-severity deepmerge-ts transitive vuln via package.json overrides pin (^8.0.1) — 0 vulnerabilities.

## MILESTONE — Sprint 1 SHIP — 2026-08-20
Sprint 1 (Foundation: auth, multi-tenancy, core ledger) complete and pushed to origin/main (aec986e).
No video recording this sprint — no UI exists yet (web dashboard is Sprint 2, mobile is Sprint 3); Playwright E2E recording applies from Sprint 2 onward per CLAUDE.md rule 9.
Next: Sprint 2 (RBAC full sweep across all endpoints, audit-log read endpoint, web dashboard).

## MILESTONE — Sprint 2 batch 1 (backend) — 2026-08-20
Story 2.1 (RBAC sweep): reviewed all Sprint 1 endpoints — createTenant/listMine intentionally open to any authenticated user (self-serve, self-scoped), everything else guarded. No gaps found.
Story 2.2 (audit read-side): GET /tenants/:tenantId/audit-log added (owner/accountant), paginated.
Story 2.3 backend half: GET /tenants/:tenantId/dashboard added — today/week/month P&L summary (revenue, expenses, cashPosition) via groupBy aggregation, owner/accountant only.
43 tests passing (unit + e2e), combined coverage 99.05% stmts / 81.41% branch / 97.01% funcs / 98.93% lines.

## MILESTONE — Sprint 2 batch 2 (web dashboard) — 2026-08-20
Story 2.3/2.4 frontend: Next.js 16 + Tailwind + shadcn/ui web app scaffolded in web/.
Pages: /login (register+login tabs), /dashboard (P&L cards, today/week/month), /ledger (list, post entry dialog, reverse dialog), /audit (audit trail table), /team (owner-only invite form). Tenant switcher in app shell nav.
API client (web/src/lib/api.ts) + auth context (web/src/lib/auth-context.tsx) wired to the Sprint 1/2 backend endpoints.
SECURITY NOTE (also in corrections.md): tokens stored in localStorage, not HttpOnly cookies — security-restoledger.md §3 ideal requires a BFF, deferred. Must harden before real client data.
CORS enabled on API (main.ts) with explicit WEB_ORIGIN allowlist — caught and fixed a stale-server-process bug during manual testing (old process pre-dated the CORS code change, held port 3000, masked as a "Something went wrong" toast in the browser).
Manually QA'd full golden path in a real browser (Chrome via claude-in-chrome): register → create tenant → post entry → dashboard reflects it → reverse entry → audit log shows both actions → team invite form renders.
Automated as Playwright E2E test (web/e2e/golden-path.spec.ts) with video recording — passes.

## VIDEO_RECORDED — 2026-08-20
Scenario: Sprint 2 golden path — register, create tenant, post ledger entry, verify dashboard, reverse entry, verify audit log.
Saved to .recordings/sprint2-golden-path-2026-08-20.webm (not committed — .recordings/ is gitignored, evidence kept locally).

## MILESTONE — Sprint 2 SHIP — 2026-08-20
Sprint 2 (RBAC sweep, audit-log endpoint, dashboard, web UI) complete and pushed to origin/main (b865e02).
Backend: 43 tests passing, 99.05%/81.41%/97.01%/98.93% combined coverage, 0 npm audit vulnerabilities.
Frontend: lint clean, build clean, Playwright E2E golden path passing with video recorded.
Next: Sprint 3 (mobile app — Expo/React Native, owner+staff daily entry, offline queue, App/Play Store publishing).

## MILESTONE — Sprint 3 SHIP — 2026-08-20
Sprint 3 (Mobile app: auth, quick entry, offline queue, home/ledger/settings) complete and pushed to origin/main (5bd60e1).
Story 3.4 (store publishing) intentionally stopped short of actual submission — requires the user's own Apple Developer ($99/yr) and Google Play ($25) accounts, signing credentials, and business/legal details (privacy policy, content rating) that only they can provide. Handoff doc: docs/mobile-publishing.md.
Backend gained Idempotency-Key support for ledger entry creation this sprint (needed for real offline-queue dedup, not just client-side pretending). 47 backend tests passing, mobile: 7 unit tests + manual QA via Expo web preview (real device/simulator testing not available in this environment — noted as a real gap, not silently skipped).
Next: Sprint 4 (POS/payment integration, CI/CD, encrypted backups + restore drill, pre-launch compliance checklist).
