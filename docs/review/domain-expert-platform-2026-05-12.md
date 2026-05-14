# Domain Expert Review: Platform Core Services

**Date**: 2026-05-12
**Scope**: orion-api-gateway, orion-platform-service, orion-frontend, platform-core

## Executive Summary
Platform core services are ~78-85% complete. Critical gaps exist in API gateway routing, EventBus wiring, and tenant isolation.

## P0 Findings (4)
| ID | Issue | Impact |
|----|-------|--------|
| P0-1 | Gateway routes `/api/v1/pipelines` → port 3002 (non-existent), should be port 3001 | Pipeline APIs return 502 |
| P0-2 | Auth proxy doesn't propagate X-Request-ID, X-Forwarded-For headers | Tracing broken |
| P0-3 | Redis connection leaked on gateway shutdown | Resource leak |
| P0-4 | RLS per-request connection may exhaust pool under load | Connection pool exhaustion |

## P1 Findings (17)
- P1-1: Auth middleware missing `?token=` query extraction
- P1-2: ServiceClient only knows about platform-service (no circuit breaker for other services)
- P1-5: StageExecutor variable context race condition (shared across concurrent runs)
- P1-6: EventBus failures silently swallowed (NATS failure → events lost)
- P1-7: Approval routes are TODO placeholder (pipeline approval via API impossible)
- P1-8: TenantIsolationService doesn't actually enforce isolation
- P1-9: Inconsistent DB-unavailable responses (404 vs 503)
- P1-13: Frontend auth check uses single role, not array
- P1-14: Role routes missing assignment/revocation endpoints
- P1-17: Proxy error handler memory leak (registered per-request)

## P2 Findings (10)
- P2-1: Pipeline checkNextStages lock doesn't protect executePendingStages
- P2-5: readyz only checks platform service, not Redis/NATS
- P2-8: NamespacePoolService in-memory only
- P2-10: Pipeline engine marks all RUNNING as FAILED on restart

## Security Findings (4)
- S-1: Tenant header not cross-validated against JWT claim (Medium)
- S-4: X-Tenant-ID spoofable if auth bypassed (High)
