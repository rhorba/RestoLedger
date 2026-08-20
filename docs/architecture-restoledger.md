# Architecture: RestoLedger
**PRD Reference**: docs/prd-restoledger.md
**System Design Reference**: docs/system-design-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: Software Architect

## 1. Overview
RestoLedger is a modular-monolith TypeScript API (NestJS) backed by PostgreSQL, with a Next.js web dashboard and an Expo React Native mobile app. Tenant isolation is enforced at the database row level (not separate DBs/schemas) to keep operations simple at v1 scale while remaining airtight via mandatory tenant-scoping middleware.

## 2. Architecture Decision Records

### ADR-1: Tech stack — TypeScript across the board
- **Context**: Solo/small team; PRD requires web + mobile + backend; fastest sustainable velocity for one team owning everything
- **Decision**: NestJS (API) + PostgreSQL + Next.js (web dashboard) + Expo/React Native (mobile) + Prisma (ORM/migrations)
- **Alternatives**: Polyglot (e.g., Go backend) — rejected, adds context-switching cost for a small team with no throughput requirement that TS can't meet; Django/Python — rejected, weaker shared-type story with a TS mobile/web frontend
- **Consequences**: One language across the stack; shared types between API and clients; NestJS's module system maps directly to the ledger/tenant/audit/integration boundaries from the system design

### ADR-2: Row-level multi-tenancy with mandatory scoping middleware
- **Context**: PRD FR-1 and NFR-2 require hard tenant isolation; team size rules out per-tenant databases (operational overhead)
- **Decision**: Single database, `tenant_id` column on every tenant-scoped table, enforced via (a) Postgres Row-Level Security policies as the last line of defense, and (b) an application-layer middleware that injects tenant scope into every query — no query path may bypass it
- **Alternatives**: Schema-per-tenant — rejected, migration/ops complexity scales linearly with tenant count; DB-per-tenant — rejected, same problem, worse
- **Consequences**: Every new table/query must go through the scoped repository layer; CI includes automated cross-tenant access tests (see test strategy) as a release gate

### ADR-3: Append-only ledger, corrections as new entries
- **Context**: PRD FR-3 requires immutable financial records for audit defensibility
- **Decision**: Ledger table is insert-only at the application layer (no UPDATE/DELETE exposed); corrections are modeled as reversal + new entry, linked to the original
- **Alternatives**: Mutable rows with a separate audit log — rejected, audit log becomes the source of truth for "what really happened," which is weaker than making immutability structural
- **Consequences**: Reporting module must aggregate reversals correctly; slightly more storage, acceptable at this data volume (system design: <1GB/day)

### ADR-4: Adapter interface for POS/payment integration
- **Context**: PRD notes provider is TBD; system design SDR requires abstraction so a provider swap doesn't touch ledger logic
- **Decision**: `PosProviderAdapter` interface (fetchTransactions, verifyWebhookSignature, mapToLedgerEntry); concrete provider implementation is the only piece that changes per provider
- **Alternatives**: Direct provider SDK calls from the ledger module — rejected, couples core financial logic to a third party's API shape
- **Consequences**: First provider implementation ships behind this interface even though only one provider exists at launch
- **Update (Sprint 4 EXECUTE)**: the webhook route carries `:connectionId`, not just `:provider` — discovered while implementing that RLS blocks looking up a connection before its tenant is known (no session context exists yet for an anonymous webhook). The connectionId is the pre-signature-check identifier; a `SECURITY DEFINER` DB function (migration `20260820214000`) does the narrow, provider+id-scoped lookup. See .logs/corrections.md.

## 3. System Design
```
[Next.js Web] ──┐
                 ├─→ [NestJS API] → [Auth/RBAC MW] → [Tenant-scope MW] → [Module] → [Postgres, RLS + tenant_id]
[Expo Mobile] ───┘                                                          ↓
                                                                     [Audit module: writes on every mutation]
                                                                          ↓
                                                          [POS/Payment Adapter] → [External provider]
```

## 4. Data Model
```
Tenant ──1:N──> User (via tenant_membership, carries Role)
Tenant ──1:N──> LedgerEntry (immutable, append-only)
LedgerEntry ──1:1──> AuditLogEntry (who/when/what/before-after)
Tenant ──1:N──> IntegrationConnection (POS/payment credentials, per tenant)
User ──N:N──> Tenant (via tenant_membership; a user — e.g. an accountant — can belong to many tenants)
```
Full schema → `docs/database-restoledger.md` (DBA)

## 5. API Design
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/v1/auth/login | Authenticate, issue JWT | Public |
| POST | /api/v1/tenants | Create tenant (firm admin only) | Required — admin |
| GET | /api/v1/tenants/:id/dashboard | P&L summary, cash position | Required — tenant member |
| POST | /api/v1/tenants/:id/ledger-entries | Post a financial entry | Required — owner/accountant/staff (scoped by permission) |
| GET | /api/v1/tenants/:id/ledger-entries | List entries (paginated, filterable) | Required — tenant member |
| POST | /api/v1/tenants/:id/ledger-entries/:entryId/reverse | Reverse an entry (new offsetting entry) | Required — accountant |
| GET | /api/v1/tenants/:id/audit-log | View audit trail | Required — accountant/owner |
| POST | /api/v1/tenants/:id/integrations | Connect POS/payment provider | Required — owner/accountant |
| POST | /api/v1/webhooks/pos/:provider/:connectionId | Receive POS/payment webhook | Signature-verified, no user auth |
| GET | /api/v1/tenants/:id/export | Export financial data (CSV/PDF) | Required — accountant/owner |

## 6. Security Considerations
[Full detail → docs/security-restoledger.md]
- Authentication: JWT (short-lived access + refresh token)
- Authorization: RBAC (owner/accountant/staff) enforced per-request, tenant-scoped
- Data protection: encryption at rest for PII/financial fields, TLS in transit, secrets in env vars/secret manager (never code)
- Key risks: cross-tenant data leakage, webhook spoofing, privilege escalation via role misconfiguration

## 7. Infrastructure
- Hosting: managed platform (e.g., Railway/Render/Fly.io class) — avoids self-managed Kubernetes for a solo team (YAGNI)
- Database: managed PostgreSQL with automated encrypted backups + point-in-time recovery
- CI/CD: GitHub Actions — lint, test (coverage gate), security scan, build, deploy
- Monitoring: structured logging + error tracking (e.g., Sentry-class tool) + uptime monitor

## 8. Technical Risks
| Risk | Mitigation | Owner |
|---|---|---|
| Tenant-scoping middleware has a gap, causing cross-tenant leak | RLS as defense-in-depth even if app layer fails; automated cross-tenant tests in CI as release gate | Backend Dev / Test Architect |
| Append-only ledger design slows down "just fix this typo" support requests | Document correction workflow (reversal + new entry) clearly for support/ops; UI must make corrections easy despite immutability | Backend Dev / UX |
| Single provider adapter interface designed for a provider that doesn't exist yet — could guess wrong shape | Keep adapter interface minimal (3 methods); expect to revise once first real provider is chosen | Software Architect |
