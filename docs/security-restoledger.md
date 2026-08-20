# Security Baseline: RestoLedger
**Architecture Reference**: docs/architecture-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: Security Engineer

## 1. Threat Model (5-Minute)
- **What are we building?** A multi-tenant SaaS holding restaurants' financial ledgers and PII (owners, staff, accountants) for a Moroccan accounting-firm audience.
- **Who would attack it?** Opportunistic attackers scanning for exposed SaaS (credential stuffing, misconfig), a curious tenant trying to see another tenant's books (cross-tenant IDOR), and an insider (staff/accountant account) attempting privilege escalation.
- **Worst outcome?** One restaurant's financial data (revenue, expenses, owner PII) exposed to another tenant or to the public — reputational and legal (Law 09-08/CNDP) damage to the firm and every client.

## 2. STRIDE Analysis (top risks only)
| Threat | Component | Mitigation | Status |
|---|---|---|---|
| Spoofing | Auth endpoint | Rate limiting, account lockout after 5 failed attempts, bcrypt hashing | Done (Sprint 1) |
| Tampering | POS webhook endpoint | HMAC-SHA256 signature verification on every webhook before processing (constant-time compare) | Done (Sprint 4) |
| Repudiation | Ledger mutations | Append-only ledger + mandatory audit log entry per mutation, same DB transaction (ADR-3) | Done (Sprint 1) |
| Info Disclosure | Cross-tenant API responses | Tenant-scope middleware on every query + Postgres RLS (FORCE, non-superuser app role) as defense-in-depth + e2e cross-tenant tests in CI | Done (Sprint 1–4) |
| DoS | Public auth/webhook endpoints | Rate limiting (30/min/IP on auth; app-wide default elsewhere), no unauthenticated endpoint does expensive work | Done (Sprint 2) |
| Elevation of Privilege | RBAC role system | Server-side role check on every request via TenantMembershipGuard; roles never trusted from client input | Done (Sprint 1–2) |

## 3. Authentication Strategy
- **Type**: JWT — short-lived access token (15 min) + refresh token (7 days, rotated on use)
- **MFA**: Optional at v1, recommended for accountant/admin roles (they touch multiple tenants) — not blocking launch, flagged for v1.1
- **Password policy**: Min 10 chars, checked against a breach-list (e.g., HaveIBeenPwned range API) at signup/reset
- **Session management**: Refresh tokens stored `HttpOnly; Secure; SameSite=Strict`; access tokens in memory on clients, not localStorage

## 4. Authorization Model
- **Pattern**: RBAC, tenant-scoped (a user's role is per-tenant-membership, not global — an accountant can be "accountant" on Tenant A and have no access to Tenant B unless explicitly added)
- **Roles defined**:
  - `owner` — full access to their tenant's data, can invite staff, cannot delete audit history
  - `accountant` — full ledger + reporting access on assigned tenants, can reverse entries, cannot delete tenant
  - `staff` — can create ledger entries (daily sales/expenses) only, no access to reports, payroll-adjacent expense lines, or audit log
  - `firm_admin` — can create tenants, manage accountant assignments; not implicitly granted access to tenant financial data
- **Resource-level checks**: Yes — every ledger/audit/report endpoint checks tenant membership + role on the specific `:tenantId` in the path, not just "is authenticated"

## 5. Data Protection
- **PII fields**: user full name, email, phone; owner/staff tied to real people
- **Financially sensitive fields**: ledger amounts, bank/payment provider credentials (IntegrationConnection)
- **Encryption at rest**: database-level encryption (managed Postgres provider) + application-level encryption for `IntegrationConnection` credentials (API keys/secrets from POS providers) using envelope encryption, key in secret manager
- **Encryption in transit**: TLS 1.2+ enforced everywhere, HSTS enabled
- **Secrets management**: environment variables for app config, dedicated secret manager for provider credentials — never committed to git (`.env.example` only, per CLAUDE.md rule)

## 6. Compliance Notes — GDPR + Moroccan Law 09-08
- **Law 09-08 (Morocco, enforced by CNDP)**: governs processing of personal data. Before onboarding real client data: (1) register/declare the processing with CNDP as required for the data categories handled (financial + identity data), (2) designate a data controller contact, (3) document data retention (7 years for financial records per PRD) and cross-border transfer if hosting is outside Morocco. **This requires legal review — flagged as a hard gate before production launch with real client data**, not something to assume compliant from this doc alone.
- **GDPR-aligned practices** (if any EU-resident data is ever processed, and as general good practice): data-subject export/delete endpoints, breach notification process (72hr), data minimization (don't collect fields not in the PRD's data model).
- **Action**: DevOps foundation doc will include this as a pre-launch checklist item, not a v1 code task.

## 7. Security Requirements for Dev Team
- [x] All inputs validated server-side (NestJS class-validator on every DTO, `forbidNonWhitelisted`)
- [x] Output encoded for context; ORM (Prisma) parameterizes all queries — the one raw-SQL exception ($queryRaw calling the webhook lookup SECURITY DEFINER function) uses Prisma's tagged-template parameterization, never string concatenation
- [x] No secrets in code, logs, or error messages — error responses never leak stack traces in production; secrets live in `.env` (gitignored) with `.env.example` documenting names only
- [ ] HTTPS only; security headers configured — Helmet headers ARE set (HSTS, CSP, X-Content-Type-Options, etc.), but TLS termination itself depends on a hosting platform not yet chosen (devops-restoledger.md §3 "TBD") — **not done, blocked on deployment, not a code gap**
- [x] Dependencies scanned in CI (npm audit, `--audit-level=critical`) — Trivy/Semgrep from the original devops sketch not added; npm audit + Gitleaks cover the gate that exists today
- [x] Tenant-scope middleware is not optional per-route — enforced via TenantMembershipGuard + RLS (FORCE, non-superuser role); the one exception (webhook connection lookup) uses a narrowly-scoped SECURITY DEFINER function, documented in corrections.md, not a silent bypass
- [x] Every ledger-mutating endpoint writes an audit log entry in the same transaction (not best-effort, not async) — verified by e2e tests, including the POS-webhook path
