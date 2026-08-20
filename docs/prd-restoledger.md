# PRD: RestoLedger
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: PM | **Status**: Draft

## 1. Problem Statement
Street-food and quick-service restaurant (QSR) owners in Morocco run on thin margins and cash-heavy operations, but rely on outsourced accounting firms for financial visibility — meaning owners see their real numbers weeks after the fact, via spreadsheets or PDFs. Accounting firms managing many restaurant clients need a single platform to enter, reconcile, and report financial data per client without one client seeing another's books, while staying compliant with Moroccan data law.

## 2. Goals & Success Metrics
| Goal | Metric | Target |
|---|---|---|
| Give owners real-time financial visibility | Time from transaction to visible in dashboard | < 24h |
| Let accounting firms manage many clients safely | Cross-tenant data leakage incidents | 0 |
| Make books audit-ready | Financial records with full audit trail | 100% |
| Reduce manual reconciliation effort | Hours/week spent reconciling per client | -50% vs. spreadsheet baseline |
| Mobile access for owners | Owners using mobile app weekly | ≥ 60% of active accounts |

## 3. User Stories
As a **restaurant owner**, I want to see my daily revenue, expenses, and cash position on my phone, so that I can make decisions without waiting on my accountant.
As an **accountant/bookkeeper**, I want to manage financial records for multiple restaurant clients from one dashboard, so that I don't juggle separate spreadsheets or logins.
As an **accountant**, I want every entry and edit to a client's financial record logged with who/when, so that I can defend the books in an audit.
As a **restaurant owner**, I want to invite my staff with limited permissions (e.g., enter daily sales but not view payroll), so that I control who sees sensitive data.
As a **firm admin**, I want each client's data fully isolated from every other client, so that a bug or breach in one tenant can't expose another's finances.
As a **restaurant owner**, I want to connect my POS or payment provider, so that daily sales import automatically instead of manual entry.

## 4. Scope

### In Scope
- Multi-tenant SaaS (one tenant = one restaurant/client of the accounting firm)
- Financial ledger: revenue, expenses, cash reconciliation, basic P&L
- RBAC: owner, accountant, staff roles with per-tenant permissions
- Audit trail on all financial record changes
- Web dashboard (accountant + owner) and mobile app (owner + staff, React Native/Expo, iOS + Android)
- One POS/payment integration (webhook + REST) as reference implementation
- GDPR-aligned data handling + Moroccan Law 09-08 compliance baseline
- Encrypted backups, encryption at rest for sensitive fields
- CI/CD with automated tests, staging environment, basic monitoring

### Out of Scope (v1)
- Payroll processing (beyond viewing payroll as an expense line)
- Tax filing automation / direct integration with Moroccan tax authority (DGI)
- Multiple POS/payment integrations beyond the first reference one
- White-labeling for other accounting firms
- In-app messaging/chat between owner and accountant

## 5. Requirements

### Functional
- FR-1: System supports multiple isolated tenants (restaurants), each owned by an accounting-firm relationship
- FR-2: Users authenticate and are scoped to one or more tenants via RBAC (owner / accountant / staff)
- FR-3: Financial records (transactions, reconciliations) are append-only/immutable once posted; corrections are new entries, not edits
- FR-4: Every create/update/delete on financial data writes an audit log entry (who, when, what, before/after)
- FR-5: Owner and staff can enter daily sales/expenses via mobile app
- FR-6: Accountant can view/manage all their assigned tenants from one web dashboard
- FR-7: Dashboard shows real-time P&L summary, cash position, and expense breakdown per tenant
- FR-8: System integrates with at least one external POS/payment API via webhook + polling fallback
- FR-9: Admins can export a tenant's financial data (CSV/PDF) for external audit or tax prep

### Non-Functional
- NFR-1: Performance — dashboard loads in < 2s p95 for a tenant with 12 months of daily transactions
- NFR-2: Security — RBAC enforced at the API layer on every request; tenant isolation verified by automated tests
- NFR-3: Compliance — GDPR data-subject rights (export/delete) + Moroccan Law 09-08 (CNDP) registration readiness
- NFR-4: Availability — 99.5% uptime target for v1 (single-region acceptable)
- NFR-5: Data integrity — financial ledger is append-only; backups tested via periodic restore drills
- NFR-6: Accessibility — WCAG AA for web dashboard

## 6. Constraints & Assumptions
- Team is small (solo/independent build) — architecture must stay a modular monolith, not microservices
- Target market is Morocco — French-language UI is required at launch; compliance references Moroccan Law 09-08 (CNDP)
- No existing POS integration partnership yet — first integration is a generic REST/webhook adapter, provider TBD
- Mobile apps ship via Expo (managed workflow) to keep iOS/Android maintenance low for a small team

## 7. Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Tenant data isolation bug leaks one client's financials to another | M | H | Row-level tenant scoping enforced in DB + middleware; automated cross-tenant access tests in CI |
| Solo/small team can't sustain "comprehensive" scope (compliance + mobile + integrations) | H | M | Build in the 4 sequenced sprints below; ship Sprint 1-2 as usable product before layering compliance/integration depth |
| Moroccan Law 09-08 / CNDP requirements misunderstood | M | M | Security Engineer documents specific CNDP requirements in security baseline doc; flag for legal review before real client data is processed |
| POS/payment provider API is unstable or has no sandbox | M | M | Build integration behind an adapter interface; abstract provider specifics so swapping providers doesn't touch core ledger logic |

## 8. Timeline
| Milestone | Target |
|---|---|
| Foundation docs approved (this session) | 2026-08-20 |
| Architecture + DB + Security approved | Session 1 (same day) |
| Sprint 1: Core ledger + auth + multi-tenancy (web) | +2 weeks |
| Sprint 2: RBAC + audit trail + dashboard | +2 weeks |
| Sprint 3: Mobile app (owner/staff entry + view) | +3 weeks |
| Sprint 4: POS integration + compliance hardening + CI/CD | +3 weeks |
| v1.0 ship | ~10 weeks from Sprint 1 start |
