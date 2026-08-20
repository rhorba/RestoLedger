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

## 7. Pre-Launch Compliance Checklist (from Security Baseline)
- [ ] CNDP declaration/registration completed for Law 09-08 (legal review required — not a code task)
- [ ] Data retention policy (7 years) implemented in backup/archival strategy
- [ ] Hosting region confirmed against any Law 09-08 data-residency guidance received during legal review
- [ ] GDPR data-subject export/delete endpoints functional if any EU-resident data is in scope
