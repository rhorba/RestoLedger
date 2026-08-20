# Pre-Launch Compliance Checklist (Story 4.4)

**Status**: Technical controls below are implemented and tested. The legal/registration items are not — they require an actual lawyer or compliance professional familiar with Moroccan data protection law, not an AI agent. This document exists so that review has a concrete starting point instead of a blank page.

**Hard gate**: no real (non-test) client financial or personal data goes into RestoLedger until the "Legal & Registration" section below is signed off by a human with the authority to do so.

---

## 1. What Law 09-08 / CNDP actually requires (general orientation, not legal advice)

Morocco's Law 09-08 (protection of individuals regarding the processing of personal data) is enforced by the CNDP (Commission Nationale de contrôle de la protection des Données à caractère Personnel). At a minimum, an organization processing personal data in Morocco typically needs to:

- **Declare or seek authorization** for the processing with CNDP before it starts, depending on the data categories involved (financial data and identity data — which RestoLedger handles — tend to require more than a simple declaration; **confirm the exact regime with counsel**, this is not something to infer from a template).
- **Designate a data controller** — a named accountable person/role, not just "the company."
- **Document the purpose, categories of data, and retention period** for each processing activity.
- **Inform data subjects** (in RestoLedger's case: restaurant owners, accountants, staff whose accounts exist in the system) how their data is used.
- **Restrict cross-border data transfer** unless the destination country is recognized as providing adequate protection, or another legal basis applies — relevant if hosting ends up outside Morocco.
- **Notify CNDP and affected individuals in the event of a data breach** (exact timelines and thresholds should be confirmed with counsel, not assumed).

## 2. Legal & Registration (human action required — not implemented, not implementable by AI)

- [ ] Confirm with counsel which CNDP regime applies (simple declaration vs. authorization) given RestoLedger processes financial + identity data
- [ ] File the CNDP declaration/authorization before onboarding the first real (non-test) client
- [ ] Designate and document a data controller contact
- [ ] Draft and publish a privacy notice / terms of service covering data collected (email, full name, financial transaction data) and its purpose
- [ ] Confirm hosting region against Law 09-08 data-residency expectations once a hosting platform is chosen (devops-restoledger.md §3) — if hosting outside Morocco, confirm the legal basis for that transfer
- [ ] Define and document the incident/breach notification process (who notifies CNDP, within what timeframe, who notifies affected tenants)
- [ ] Confirm the 7-year financial record retention policy (already implemented technically — see §4 below) matches actual Moroccan accounting-record retention law, not just an assumption carried from the PRD

## 3. GDPR readiness (only relevant if any EU-resident data enters scope — confirm applicability first)

- [ ] Confirm whether any current or planned users are EU residents (if none, this section may not apply — don't build for a requirement that isn't real, per YAGNI)
- [ ] If applicable: data-subject export endpoint (not yet built — would extend the existing `GET /tenants/:id/export` CSV/PDF export from a tenant-financial-data feature to a per-user personal-data export)
- [ ] If applicable: data-subject deletion/erasure process (tension with the append-only ledger and 7-year retention requirement — erasure of a specific user's PII from historical audit/ledger records needs a designed approach, e.g. anonymizing the `createdByUserId`/`actorUserId` reference rather than deleting the financial record itself; **not yet designed, flag for legal + engineering joint review**)

## 4. Technical controls already implemented (verifiable in this repo, not aspirational)

| Control | Status | Where |
|---|---|---|
| Tenant data isolation (RLS + app-layer guard) | Done, tested | `api/prisma/migrations/*_row_level_security`, e2e cross-tenant tests |
| Encryption at rest for integration credentials | Done, tested | `api/src/integrations/credentials-cipher.ts`, AES-256-GCM |
| Encryption in transit | Partial | Helmet HSTS header set; actual TLS termination depends on hosting platform (not chosen yet) |
| Audit trail on every financial mutation | Done, tested | `ledger_entry` + `audit_log_entry`, same-transaction writes, e2e-verified including POS webhook path |
| Password hashing, account lockout, rate limiting | Done, tested | `api/src/auth/auth.service.ts` |
| Encrypted backups + restore verification | Done, verified 2026-08-20 | `api/scripts/backup-db.sh`, `api/scripts/restore-drill.sh` — actually run, not just written (docs/devops-restoledger.md §6) |
| 7-year financial record retention (technical) | Documented target, not yet enforced by an automated policy | system-design-restoledger.md §1; no automated archival/deletion job exists yet — not needed until real data volume makes manual retention unmanageable (YAGNI) |
| Dependency vulnerability scanning | Done | CI `npm audit --audit-level=critical`, all three sub-projects |
| Secrets scanning | Done, proven | CI Gitleaks job — caught a real issue (secret-shaped test fixture) during Sprint 4, see `.logs/corrections.md` |

## 5. Explicitly out of scope until triggered by a real need

- Automated data retention/deletion jobs (manual review is sufficient at current data volume)
- SOC 2 / ISO 27001 — not requested by the PRD, would be a significant scope increase; revisit only if a client or partner requires it
- Multi-region hosting / data residency beyond Morocco — no current requirement

---

**Bottom line for whoever reads this before launch**: sections 2 and 3 need a human with legal authority, not more engineering. Section 4 is real and tested. Don't treat this document as compliance — treat it as the list of what still needs a human signature before compliance is true.
