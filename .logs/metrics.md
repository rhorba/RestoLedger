## SPRINT_SNAPSHOT — Sprint 1 — 2026-08-20
Coverage (combined unit + integration, jest.combined.json): 98.86% stmts, 80.62% branch, 96% funcs, 98.72% lines — clears the 80% gate (CLAUDE.md rule 6).
Tests: 32 passed (22 unit, 5 e2e/integration against real Postgres+RLS, 5 covering auth refresh — see auth.service.spec.ts).
npm audit: 0 vulnerabilities.
Stories completed: 1.1 (auth), 1.2 (tenant + membership model), 1.3 (tenant-scope middleware + RLS), 1.4 (post ledger entry), 1.5 (reverse ledger entry).
