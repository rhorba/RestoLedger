# Database Design: RestoLedger
**Architecture Reference**: docs/architecture-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: DBA

## 1. Database Selection
- **Engine**: PostgreSQL
- **Rationale**: Strong row-level security support (needed for tenant isolation defense-in-depth per ADR-2), mature, well-supported by Prisma, YAGNI default for relational financial data
- **Hosting**: Managed Postgres (automated backups, point-in-time recovery — required by system design RPO of 1 hour)

## 2. Entity-Relationship Model
```
Tenant ──1:N──> TenantMembership ──N:1──> User
Tenant ──1:N──> LedgerEntry
LedgerEntry ──1:1──> AuditLogEntry
LedgerEntry ──0:1──> LedgerEntry (self-ref: reversal_of_id, for corrections)
Tenant ──1:N──> IntegrationConnection
IntegrationConnection ──1:N──> LedgerEntry (source_integration_id, nullable — manual entries have none)
```

## 3. Schema Design
```sql
-- Table: tenant
CREATE TABLE tenant (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: app_user
CREATE TABLE app_user (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: tenant_membership
CREATE TABLE tenant_membership (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenant(id),
  user_id       UUID NOT NULL REFERENCES app_user(id),
  role          TEXT NOT NULL CHECK (role IN ('owner','accountant','staff','firm_admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

-- Table: ledger_entry (append-only — no UPDATE/DELETE grants at app layer)
CREATE TABLE ledger_entry (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenant(id),
  entry_type            TEXT NOT NULL CHECK (entry_type IN ('revenue','expense','reconciliation')),
  amount_cents          BIGINT NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'MAD',
  description           TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL,
  reversal_of_id        UUID REFERENCES ledger_entry(id),
  source_integration_id UUID REFERENCES integration_connection(id),
  created_by_user_id    UUID NOT NULL REFERENCES app_user(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: audit_log_entry
CREATE TABLE audit_log_entry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenant(id),
  actor_user_id     UUID NOT NULL REFERENCES app_user(id),
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  before_state       JSONB,
  after_state        JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: integration_connection
CREATE TABLE integration_connection (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenant(id),
  provider            TEXT NOT NULL,
  encrypted_credentials BYTEA NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('active','disconnected','error')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Row-Level Security (defense-in-depth per ADR-2):**
```sql
ALTER TABLE ledger_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ledger_entry
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
-- Same pattern applied to audit_log_entry, integration_connection, tenant_membership
```

## 4. Index Strategy
| Table | Index Name | Columns | Query Pattern |
|---|---|---|---|
| ledger_entry | idx_ledger_tenant_occurred | (tenant_id, occurred_at DESC) | Dashboard: recent entries per tenant |
| ledger_entry | idx_ledger_reversal | (reversal_of_id) | Finding reversals for a given entry |
| tenant_membership | idx_membership_user | (user_id) | "Which tenants does this user belong to" |
| tenant_membership | idx_membership_tenant | (tenant_id) | "Who belongs to this tenant" (already covered by unique constraint) |
| audit_log_entry | idx_audit_tenant_created | (tenant_id, created_at DESC) | Audit log view, paginated |
| integration_connection | idx_integration_tenant | (tenant_id) | Tenant's connected providers |

## 5. Migration Plan
| Migration File | Description | Reversible |
|---|---|---|
| 001_initial_schema.sql | tenant, app_user, tenant_membership, ledger_entry, audit_log_entry, integration_connection + RLS policies | Yes |
| 002_indexes.sql | All indexes from section 4 | Yes |

## 6. Access Patterns
| Use Case | Query Pattern | Index Coverage |
|---|---|---|
| Dashboard load (recent activity) | SELECT ... WHERE tenant_id = ? ORDER BY occurred_at DESC LIMIT N | idx_ledger_tenant_occurred |
| P&L aggregation | SELECT SUM(amount_cents) ... WHERE tenant_id = ? AND occurred_at BETWEEN ? AND ? GROUP BY entry_type | idx_ledger_tenant_occurred |
| Accountant's tenant list | SELECT tenant_id FROM tenant_membership WHERE user_id = ? | idx_membership_user |
| Audit trail view | SELECT ... WHERE tenant_id = ? ORDER BY created_at DESC | idx_audit_tenant_created |

## 7. Sensitive Data
- Columns requiring encryption: `integration_connection.encrypted_credentials` (application-level envelope encryption before insert)
- Row-level security needed: Yes — `ledger_entry`, `audit_log_entry`, `integration_connection`, `tenant_membership` all carry RLS policies scoped to `tenant_id`
