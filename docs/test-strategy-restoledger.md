# Test Strategy: RestoLedger
**Architecture Reference**: docs/architecture-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: Test Architect

## 1. Risk Assessment
| Component | Impact | Frequency | Complexity | Test Level |
|---|---|---|---|---|
| Tenant-scoping middleware / RLS | H | H | M | Maximum |
| Ledger posting + reversal logic | H | H | M | Maximum |
| RBAC permission checks | H | H | M | Maximum |
| Audit log writing | H | M | L | High |
| POS/payment webhook handler | M | M | M | High |
| Dashboard/reporting aggregation | M | H | L | Standard |
| Auth (login/refresh) | H | H | L | High |

## 2. Test Pyramid Targets
| Layer | Coverage Target | Tooling |
|---|---|---|
| Unit | ≥ 60% of business logic | Jest |
| Integration | ≥ 40% of API + DB layer | Jest + Supertest + Testcontainers (real Postgres in CI) |
| E2E | Critical happy paths only | Playwright (web), Detox or manual (mobile — YAGNI on mobile E2E automation at v1) |
| **Combined gate** | **≥ 80%** — non-negotiable per CLAUDE.md rule 6 | CI blocks merge if below |

## 3. ATDD Acceptance Scenarios (critical paths)
```gherkin
Feature: Tenant isolation

  Scenario: Accountant cannot view another tenant's ledger
    Given accountant "Fatima" is a member of Tenant A only
    When she requests GET /api/v1/tenants/{TenantB.id}/ledger-entries
    Then the response is 403 Forbidden
    And no ledger data from Tenant B is returned

Feature: Ledger posting

  Scenario: Staff posts a revenue entry
    Given "Youssef" has the staff role on Tenant A
    When he posts a revenue entry of 500 MAD
    Then the entry appears in Tenant A's ledger
    And an audit log entry is created recording Youssef as the actor

  Scenario: Accountant reverses an entry
    Given a posted ledger entry of 500 MAD exists
    When the accountant reverses it with a reason
    Then a new offsetting entry of -500 MAD is created, linked via reversal_of_id
    And the original entry remains unmodified in the database
    And an audit log entry records the reversal

Feature: RBAC enforcement

  Scenario: Staff attempts to view the audit log
    Given "Youssef" has the staff role on Tenant A
    When he requests GET /api/v1/tenants/{TenantA.id}/audit-log
    Then the response is 403 Forbidden

Feature: POS webhook

  Scenario: Webhook with invalid signature is rejected
    Given a webhook payload with an incorrect HMAC signature
    When it is posted to /api/v1/webhooks/pos/{provider}
    Then the response is 401 Unauthorized
    And no ledger entry is created
```

## 4. Adversarial Checklist (high-risk components only)
- [ ] Tenant isolation: attempt to access every tenant-scoped endpoint with a valid token for a different tenant — must fail on all of them, not just the obvious ones
- [ ] RBAC: attempt every staff-role action against accountant-only and owner-only endpoints
- [ ] Ledger immutability: attempt direct UPDATE/DELETE against ledger_entry via API — must be structurally impossible (no endpoint exists), verify RLS also blocks it at the DB layer
- [ ] Webhook replay: resend a valid webhook payload twice — idempotency key must prevent double-posting
- [ ] Auth: token replay after logout, expired token acceptance, privilege escalation via role field tampering in request body
- [ ] Input abuse: negative amounts, zero amounts, extremely large amounts, non-numeric input, unicode in description fields

## 5. Release Gate Criteria
- [ ] All acceptance scenarios pass
- [ ] Combined unit + integration coverage ≥ 80%
- [ ] Cross-tenant adversarial checklist passes with zero leaks
- [ ] No critical/high security findings open (Semgrep/Trivy/Gitleaks clean per DevOps doc)
- [ ] E2E happy path passes (web: login → post entry → view dashboard → reverse entry) and is recorded per CLAUDE.md rule 9
