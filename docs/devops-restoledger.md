# DevOps Foundation: RestoLedger
**Architecture**: docs/architecture-restoledger.md
**Security**: docs/security-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: DevOps/DevSecOps

## 1. Environment Strategy
| Environment | Purpose | Deploy Trigger |
|---|---|---|
| local | Development | Manual (docker-compose: Postgres + API) |
| staging | QA / Preview, safe for POS provider sandbox testing | Auto on PR merge to `main` |
| production | Live restaurant/accountant data | Manual tag / approved release only |

## 2. CI Pipeline (GitHub Actions)
```yaml
stages:
  - lint            # ESLint + TypeScript check
  - test            # unit + integration (Testcontainers Postgres); fail if combined coverage < 80%
  - security-scan   # Semgrep (SAST), Trivy (SCA), Gitleaks (secrets) — critical findings block merge
  - build           # Docker image, tagged with commit SHA
  - deploy-staging  # auto on PR merge to main
  - deploy-prod     # manual approval gate, requires staging smoke test pass first
```

## 3. Infrastructure
- **Hosting**: Managed platform (Railway/Render/Fly.io class) — no self-managed Kubernetes, matches SDR-1 (small team, YAGNI)
- **Compute**: Containerized API (Docker), single instance for v1 (vertical scale per system design)
- **Database**: Managed PostgreSQL with automated daily encrypted backups + point-in-time recovery (RPO 1hr per system design)
- **Mobile distribution**: Expo EAS Build + EAS Submit for iOS App Store / Google Play releases
- **Secrets**: Platform's built-in secret manager for API keys/DB credentials; envelope-encryption key for `integration_connection.encrypted_credentials` stored separately from the DB itself

## 4. Security Scanning Gates
| Scanner | Scan Type | Fail Threshold |
|---|---|---|
| Semgrep | SAST — code vulnerabilities | Critical findings |
| Trivy | SCA — dependency CVEs | Critical CVEs |
| Gitleaks | Secrets detection | Any secrets found |

## 5. Docker Setup
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
```

## 6. Monitoring Baseline
| Signal | Tool | Alert Threshold |
|---|---|---|
| Logs | Structured JSON logs → platform log aggregation | Error rate > 5/min |
| Errors | Sentry-class error tracker | Any unhandled exception in ledger/audit modules (financial-critical paths) |
| Uptime | External uptime monitor (e.g., UptimeRobot-class) | 2 consecutive failed health checks |
| Backup verification | Scheduled restore-drill job | Restore drill failure → immediate alert |

### Backup & restore drill (Story 4.3 — implemented and verified)
- `api/scripts/backup-db.sh` — `pg_dump` (via `docker exec` locally; a real deployment runs it wherever has network access to the managed Postgres instance) → gzip → AES-256-CBC encrypt (openssl, PBKDF2-derived key from `BACKUP_ENCRYPTION_PASSPHRASE`). Output: `api/backups/restoledger-<UTC-timestamp>.sql.gz.enc` (gitignored — never commit backup files, encrypted or not).
- `api/scripts/restore-drill.sh <backup-file>` — decrypts, restores into a disposable `restoledger_restore_drill_<timestamp>` database (never the real dev/prod DB), verifies table count + applied migration count, then drops the drill database. Exits non-zero on any failure — wire this into a scheduled job with alerting once a hosting platform is chosen.
- **Actually run, not just written**: both scripts were executed against the local dev database on 2026-08-20 — backup produced a 124K encrypted file, restore drill passed (7 tables, 8 applied migrations), drill database cleaned up automatically. This is what "restore drill" is supposed to mean — proof the backup is usable, not just that a file exists.
- `BACKUP_ENCRYPTION_PASSPHRASE` is a separate secret from `INTEGRATION_ENCRYPTION_KEY` (different rotation policy — backup encryption keys typically need longer retention than a live app secret, since old backups must stay decryptable).

## 7. Pre-Launch Compliance Checklist
Superseded by the dedicated document: **docs/pre-launch-compliance-checklist.md** (Story 4.4) — expands this into what's actually legally required (with the caveat that it needs real legal review, not an AI's reading of the law) versus what's already technically implemented and tested.
