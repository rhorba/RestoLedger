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
