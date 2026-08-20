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
