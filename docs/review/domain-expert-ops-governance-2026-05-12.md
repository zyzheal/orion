# Domain Expert Review: Operations & Governance Services

**Date**: 2026-05-12
**Scope**: 15 services (audit, security, risk, governance, cmdb, config-mgmt, monitor, notify, selfhealing, dr, ticket, approval, chatops, skill, plugin)

## P0 Findings (4)
| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| P0-1 | cmdb-svc | All 7 methods are pure stubs (no DB, no topology, no reconciliation) | Service completely non-functional |
| P0-2 | config-mgmt-svc | All 10 methods are pure stubs (no version control, no diff, no rollback) | Service completely non-functional |
| P0-3 | selfhealing-svc | All 8 methods are pure stubs. `makeDecision()` returns hardcoded autoExecute: true with 0.8 confidence | Dangerous if wired to real infrastructure |
| P0-4 | monitor-svc | All route endpoints return HTTP 501 | Monitoring completely unavailable |

## P1 Findings (6)
- P1-1: security-svc — Policy evaluation always returns `passed: true`, overrides not persisted
- P1-2: notify-svc — PostgreSQL repository exists but no CREATE TABLE DDL (queries fail on first start)
- P1-3: ticket-svc — ~65 TODOs across DispatchEngine, WorkflowService, SLAService; workflow state machine not implemented
- P1-4: audit-svc — `deleteById()` physically deletes audit logs, breaking hash chain integrity
- P1-5: audit-svc — `SecurityComplianceService` bypasses repository layer, uses raw SQL
- P1-6: approval-svc — Duplicate service files in `src/services/` and `src/services/approval/`

## P2 Findings (6)
- plugin-svc — All in-memory, no persistence
- dr-svc — `findPlanForConfig()` always returns null
- monitor-svc — No Prometheus/metrics integration
- chatops-svc — Command parsing exists but execution not wired

## Services in Good Shape
- audit-svc — PostgreSQL with hash chain (except deletion issue)
- risk-svc — PostgreSQL with proper repository pattern
- governance-svc — PostgreSQL with complete DDL and triggers
- dr-svc — Substantial implementation with health checks, failover
- approval-svc — PostgreSQL with tests
- chatops-svc — PostgreSQL with command registry
- skill-svc — PostgreSQL with proper repository pattern
