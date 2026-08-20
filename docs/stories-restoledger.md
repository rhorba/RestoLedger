# Stories: RestoLedger
**PRD**: docs/prd-restoledger.md
**Architecture**: docs/architecture-restoledger.md
**Test Strategy**: docs/test-strategy-restoledger.md

## Epic 1: Foundation — Auth, Multi-Tenancy, Core Ledger
Stand up the modular monolith with tenant isolation and an append-only ledger — nothing is usable without this.

### Story 1.1: User auth (signup/login/refresh)
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev

As a user, I want to log in with email/password, so that I can access my tenant's data securely.

**Acceptance Criteria**:
```gherkin
Given a registered user with a valid password
When they POST /api/v1/auth/login
Then they receive an access token (15min) and refresh token (7 days)
```
**Technical Notes**: JWT per security-restoledger.md §3; bcrypt/Argon2 hashing; account lockout after 5 failures.
**Dependencies**: none

---

### Story 1.2: Tenant + tenant_membership model
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev

As a firm_admin, I want to create a tenant and assign users with roles, so that each restaurant client is isolated.

**Acceptance Criteria**:
```gherkin
Given a firm_admin is authenticated
When they POST /api/v1/tenants with a name
Then a new tenant is created and the admin can assign memberships with a role
```
**Technical Notes**: Uses `tenant`, `tenant_membership` tables from database-restoledger.md §3.
**Dependencies**: 1.1

---

### Story 1.3: Tenant-scope middleware + RLS
**Priority**: Must | **Size**: L | **Specialist**: Backend Dev

As a security requirement, every tenant-scoped query must be impossible to run without a tenant filter, so that cross-tenant leaks are structurally prevented.

**Acceptance Criteria**: See test-strategy-restoledger.md "Tenant isolation" scenario — accountant on Tenant A gets 403 on Tenant B's data, verified by automated test.
**Technical Notes**: ADR-2 in architecture-restoledger.md — app middleware + Postgres RLS policies (database-restoledger.md §3).
**Dependencies**: 1.2

---

### Story 1.4: Post ledger entry (append-only)
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev

As an owner/accountant/staff, I want to post a revenue or expense entry, so that the tenant's financial record is up to date.

**Acceptance Criteria**: See test-strategy-restoledger.md "Ledger posting" scenario.
**Technical Notes**: ADR-3 — no UPDATE/DELETE endpoint exists for `ledger_entry`.
**Dependencies**: 1.3

---

### Story 1.5: Reverse ledger entry
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev

As an accountant, I want to reverse an incorrect entry, so that corrections don't compromise the audit trail.

**Acceptance Criteria**: See test-strategy-restoledger.md "Accountant reverses an entry" scenario.
**Technical Notes**: `reversal_of_id` self-reference per database-restoledger.md §3.
**Dependencies**: 1.4

## Sprint Allocation — Sprint 1
| Sprint | Stories | Estimated Effort |
|---|---|---|
| Sprint 1 | 1.1, 1.2, 1.3, 1.4, 1.5 | ~2 weeks |

---

## Epic 2: RBAC, Audit Trail, Web Dashboard
Make the system usable and defensible for an accountant managing multiple clients.

### Story 2.1: RBAC enforcement on every endpoint
**Priority**: Must | **Size**: L | **Specialist**: Backend Dev

As a security requirement, staff must not access accountant/owner-only endpoints, so that permissions match the PRD's role model.

**Acceptance Criteria**: See test-strategy-restoledger.md "RBAC enforcement" scenario.
**Technical Notes**: Roles per security-restoledger.md §4.
**Dependencies**: 1.3

---

### Story 2.2: Audit log on every ledger mutation
**Priority**: Must | **Size**: M | **Specialist**: Backend Dev

As an accountant, I want every ledger change logged with who/when/what, so that I can defend the books in an audit.

**Acceptance Criteria**: Every post/reverse action in Epic 1 writes an `audit_log_entry` in the same transaction (no best-effort/async writes).
**Technical Notes**: security-restoledger.md §7 — audit write is transactional, not optional.
**Dependencies**: 1.4, 1.5

---

### Story 2.3: Web dashboard — P&L summary + cash position
**Priority**: Must | **Size**: L | **Specialist**: Frontend Dev

As an owner or accountant, I want to see today/week/month P&L and cash position, so that I have real-time visibility.

**Acceptance Criteria**: Dashboard loads in < 2s p95 for a tenant with 12 months of data (NFR-1).
**Technical Notes**: ui-restoledger.md wireframe "Web Dashboard"; Next.js + shadcn/ui.
**Dependencies**: 1.4

---

### Story 2.4: Tenant switcher + ledger/audit views (accountant)
**Priority**: Must | **Size**: M | **Specialist**: Frontend Dev

As an accountant, I want to switch between my assigned tenants and view each one's ledger and audit log, so that I can manage multiple clients from one place.

**Acceptance Criteria**: Tenant switcher only shows tenants the accountant is a member of; switching tenants scopes all views correctly.
**Technical Notes**: ux-restoledger.md Flow 3; component from ui-restoledger.md §3.
**Dependencies**: 2.1, 2.2, 2.3

## Sprint Allocation — Sprint 2
| Sprint | Stories | Estimated Effort |
|---|---|---|
| Sprint 2 | 2.1, 2.2, 2.3, 2.4 | ~2 weeks |

---

## Epic 3: Mobile App (Owner + Staff)
Get owners and staff off spreadsheets and onto their phones for daily entry and visibility.

### Story 3.1: Mobile auth + quick entry screen
**Priority**: Must | **Size**: L | **Specialist**: Frontend Dev (mobile/Expo)

As staff, I want to log a sale in under a minute, so that daily entry doesn't slow down service.

**Acceptance Criteria**: ux-restoledger.md Flow 1 — entry saves in < 1 min interaction, queues locally on network failure with "pending sync" badge.
**Technical Notes**: Expo + NativeWind per ui-restoledger.md §1.
**Dependencies**: 1.1, 1.4

---

### Story 3.2: Mobile home — owner's daily snapshot
**Priority**: Must | **Size**: M | **Specialist**: Frontend Dev (mobile/Expo)

As an owner, I want to see today's cash position on app open, so that I don't need to call my accountant.

**Acceptance Criteria**: ux-restoledger.md Flow 2.
**Dependencies**: 2.3, 3.1

---

### Story 3.3: Offline queue + sync reliability
**Priority**: Must | **Size**: M | **Specialist**: Frontend Dev (mobile/Expo)

As staff in a restaurant with unreliable connectivity, I want my entries to save locally and sync when back online, so that I never lose an entry.

**Acceptance Criteria**: Entries made offline are queued, synced on reconnect, and never duplicated (idempotency key per entry).
**Dependencies**: 3.1

---

### Story 3.4: App Store / Play Store publishing
**Priority**: Must | **Size**: M | **Specialist**: DevOps

As the product owner, I want the app published on both stores, so that real users can install it (PRD requirement — published iOS + Android apps).

**Acceptance Criteria**: App passes store review, listed under both platforms.
**Technical Notes**: Expo EAS Build/Submit per devops-restoledger.md §3.
**Dependencies**: 3.1, 3.2, 3.3

## Sprint Allocation — Sprint 3
| Sprint | Stories | Estimated Effort |
|---|---|---|
| Sprint 3 | 3.1, 3.2, 3.3, 3.4 | ~3 weeks |

---

## Epic 4: POS Integration, Compliance Hardening, CI/CD
Close the loop on automation and make the platform launch-ready.

### Story 4.1: POS/payment adapter interface + first provider implementation
**Priority**: Must | **Size**: L | **Specialist**: Backend Dev

As an owner, I want my POS to feed sales automatically, so that I don't have to enter them manually.

**Acceptance Criteria**: See test-strategy-restoledger.md "POS webhook" scenario — invalid signature rejected, valid webhook creates ledger entry, replay doesn't duplicate.
**Technical Notes**: ADR-4 adapter interface, architecture-restoledger.md §2.
**Dependencies**: 1.4

---

### Story 4.2: CI/CD pipeline with coverage + security gates
**Priority**: Must | **Size**: M | **Specialist**: DevOps/DevSecOps

As the team, I want CI to block merges below 80% coverage or with critical security findings, so that quality doesn't regress.

**Acceptance Criteria**: Pipeline stages per devops-restoledger.md §2; a PR with coverage < 80% or a critical Semgrep/Trivy/Gitleaks finding fails CI.
**Dependencies**: none (can start early, listed here for sequencing with launch)

---

### Story 4.3: Encrypted backups + restore drill
**Priority**: Must | **Size**: S | **Specialist**: DevOps

As the team, I want backups tested via restore drills, so that RPO/RTO targets are real, not assumed.
**Acceptance Criteria**: Scheduled restore-drill job runs and alerts on failure per devops-restoledger.md §6.
**Dependencies**: none

---

### Story 4.4: Pre-launch compliance checklist
**Priority**: Must | **Size**: S (coordination, not code) | **Specialist**: PM + Security Engineer

As the team, I want the Law 09-08/CNDP and data-retention checklist confirmed before onboarding real client data, so that we don't launch non-compliant.
**Acceptance Criteria**: All items in devops-restoledger.md §7 checked off, with legal review documented (not just "looks fine").
**Dependencies**: none — must complete before first real (non-test) tenant onboards

## Sprint Allocation — Sprint 4
| Sprint | Stories | Estimated Effort |
|---|---|---|
| Sprint 4 | 4.1, 4.2, 4.3, 4.4 | ~3 weeks |
