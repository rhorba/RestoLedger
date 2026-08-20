# System Design: RestoLedger
**PRD Reference**: docs/prd-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: System Designer

## 1. Non-Functional Requirements
| Attribute | Target | Notes |
|---|---|---|
| Availability | 99.5% SLA | Single-region v1; acceptable per PRD NFR-4 |
| Latency (p99) | 500ms API, 2s dashboard load | Restaurant-scale data volume, not high-frequency trading |
| Throughput | ~50 RPS peak | Dozens-to-low-hundreds of tenants in v1, not thousands |
| Data Volume | < 1 GB/day across all tenants | Daily sales/expense entries, not high-frequency transactions |
| Retention | 7 years financial records | Moroccan accounting record-keeping norm |
| Recovery (RTO) | 4 hours | Solo/small team — realistic, not aspirational |
| Recovery (RPO) | 1 hour | Daily automated backups + point-in-time recovery |

## 2. Component Topology
```
[Clients: Web (Accountant/Owner) / Mobile (Expo, Owner+Staff)]
        ↓ HTTPS
[Reverse proxy / TLS termination]
        ↓
[API — modular monolith]
  ├── Auth & RBAC module
  ├── Tenant module
  ├── Ledger module (financial records, immutable)
  ├── Reconciliation module
  ├── Integration module (POS/payment adapter)
  ├── Audit module (writes on every ledger mutation)
  └── Reporting module (P&L, dashboards, exports)
        ↓
[PostgreSQL — row-level tenant scoping]
        ↓
[Object storage — encrypted backups, exports]

[External: POS/Payment provider webhook + REST]
[Observability: structured logs → error tracking → uptime monitor]
```

## 3. Integration Patterns
| Integration | Pattern | Reason |
|---|---|---|
| POS/payment provider | REST (pull) + Webhook (push) with signature verification | Real-time updates via webhook, reconciliation via periodic REST pull as fallback if webhook missed |
| Mobile app ↔ API | REST + JWT bearer auth | Simple, matches Expo/React Native norms, no need for GraphQL at this scale |
| Backups | Scheduled job → encrypted object storage | Decouples backup cadence from app deploys |

## 4. Scalability Strategy
- Scaling approach: vertical scaling of a single API instance + managed Postgres for v1; horizontal scaling deferred until real load data justifies it (YAGNI)
- Cache strategy: none in v1 — dashboard queries are indexed and scoped per-tenant, expected to be fast without a cache layer at this data volume
- Queue strategy: none in v1 — webhook processing is synchronous with idempotency keys; revisit if POS integration volume grows

## 5. System Design Decision Records

### SDR-1: Modular monolith over microservices
- **NFR Driver**: Team size (solo/small), 99.5% availability target, data volume < 1GB/day
- **Decision**: Single deployable API with clear module boundaries (auth, tenant, ledger, integration, audit, reporting)
- **Alternatives**: Microservices — rejected, adds operational overhead (service discovery, distributed tracing, network failure modes) with no throughput/team justification
- **Re-evaluate when**: Tenant count or team size grows 10x, or a single module needs independent scaling/deploy cadence

### SDR-2: No cache/queue layer in v1
- **NFR Driver**: Throughput target (~50 RPS), data volume (<1GB/day)
- **Decision**: Direct DB reads with proper indexing; synchronous webhook processing with idempotency
- **Alternatives**: Redis cache, message queue for webhooks — rejected as premature at this scale
- **Re-evaluate when**: Dashboard p99 latency exceeds target under real load, or webhook volume causes processing backlog

### SDR-3: Single-region hosting
- **NFR Driver**: Target market is Morocco; 99.5% availability is acceptable, not 99.99%
- **Decision**: Single-region deployment (EU or Morocco-adjacent region for latency + potential data-residency alignment with Law 09-08)
- **Alternatives**: Multi-region — rejected, no requirement justifies the complexity/cost
- **Re-evaluate when**: CNDP guidance requires in-country data residency, or uptime incidents show single-region is insufficient
