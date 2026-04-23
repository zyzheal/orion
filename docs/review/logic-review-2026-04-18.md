# Orion Platform - Business Logic Review Report

**Date**: 2026-04-18
**Auditor**: Automated Logic Review (Agent 7 of 8)
**Scope**: Data flow, state machines, boundary conditions, error recovery, transaction consistency, business rules

---

## Executive Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Logic Issues | 39 | |
| Source Files Analyzed | 18+ | |
| Transaction/Consistency Issues | 5 | |
| Design Doc Gaps | 3 modules | |
| **Overall Logic Correctness** | **POOR** | **Critical bugs in core workflows** |

### Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 9 | Incorrect business behavior, data corruption risk |
| P1 (High) | 20 | Missing edge case handling |
| P2 (Medium) | 10 | Minor logic gaps |

---

## P0: Critical Logic Bugs

### P0-01: `cancelRun` Does Not Stop In-Flight Stages/Tasks
**Location**: `PipelineRunService.ts:~180`

When a pipeline run is cancelled, the method only updates the run status to "cancelled" but does NOT stop currently executing stages or tasks.

**Impact**: Cancelled pipelines continue consuming compute resources indefinitely.

### P0-02: Saga `executeStages` is MOCK -- Always Succeeds
**Location**: `PipelineSaga.ts:239-267`

The saga execution pattern is entirely mocked. `executeStages()` always returns success. Compensation logic never fires.

**Impact**: No rollback possible for failed pipeline stages. Partial state corruption.

### P0-03: Compensation Skips EXECUTING Steps
**Location**: `SagaCoordinator.ts:~180`

When compensating a failed saga, only COMPLETED steps are rolled back. EXECUTING steps are skipped.

**Impact**: Interrupted operations leave resources in inconsistent state (e.g., allocated but never released).

### P0-04: `getCIByCiId` Hardcoded `tenantId=0`
**Location**: `CmdbService.ts:169`

```typescript
const ci = await this.getCI({ ciId, tenantId: 0 });
```

**Impact**: Cross-tenant data leakage. All users see tenant 0's CMDB data regardless of their actual tenant.

### P0-05: TenantContext Singleton Shared Across Requests
**Location**: `TenantContext.ts` (entire file)

The TenantContext is a singleton. Request A sets tenant context, then Request B reads it and gets Request A's tenant.

**Impact**: Complete tenant isolation failure. Data from one tenant returned to another.

### P0-06: `generateSessionSetSQL` Uses Raw SQL Interpolation
**Location**: `TenantContext.ts:~90`

```typescript
const sql = `SET SESSION "app.tenant_id" = '${tenantId}'`;
```

**Impact**: SQL injection via crafted tenant ID values.

### P0-07: EventBus `publish()` Returns Fake ID on Failure
**Location**: `event-bus-service.ts:166-169`

When publish fails, it returns a fake event ID instead of throwing or returning null.

**Impact**: Silent event loss. Callers believe events were published when they were not.

### P0-08: EventBus Always ACKs Even on Handler Error
**Location**: `event-bus-service.ts:209`

Despite `autoAck=false`, the event bus always sends ACK even when the handler throws an exception.

**Impact**: Failed handlers never retry. Events are permanently lost.

### P0-09: PluginExecutor Quota Not Released on Exception
**Location**: `plugin-executor-service.ts:288-293`

When a plugin execution throws, the allocated quota is not returned to the pool.

**Impact**: Permanent resource leak. Quota pool eventually exhausted. All plugins blocked.

---

## P1: High Severity Logic Issues

| ID | Issue | Location | Impact |
|---|---|---|---|
| P1-01 | Timeout does not cancel underlying task | `StageExecutor.ts` | Zombie processes consume resources |
| P1-02 | Fire-and-forget async without tracking | `PipelineEngine.ts` | Lost execution results |
| P1-03 | Wrong compensation status | `TransactionLog.ts` | Failed compensations marked as success |
| P1-04 | Stuck idempotency blocks forever | `IdempotencyChecker.ts` | Legitimate retries blocked permanently |
| P1-05 | Stale version reads on CMDB restore | `CmdbService.ts` | Drift detection reports false positives |
| P1-06 | Shared config mutation | `K8sReconciliationService.ts` | Thread safety violation |
| P1-07 | Mocked script execution | `cmdb-integration-service.ts` | Self-healing scripts never actually run |
| P1-08 | Script parameter injection | `cmdb-integration-service.ts:903` | Command injection via unescaped params |
| P1-09 | Quota division by zero | `TenantQuotaService.ts` | Runtime crash when tenant has 0 quota |
| P1-10 | No batch rollback for namespace allocation | `NamespacePoolService.ts` | Partial allocation on failure |
| P1-11 | Missing `clearTenant()` on error | `TenantMiddleware.ts` | Tenant context leaks to next request |
| P1-12 | No DLQ for failed event handlers | `event-bus-service.ts` | Poison messages block queue |
| P1-13 | Inconsistent publish error handling | `PipelineEventPublisher.ts` | Some errors swallowed, some thrown |
| P1-14 | Plugin uninstall skips cleanup | `plugin-manager-service.ts` | Orphaned resources after uninstall |
| P1-15 | Input validation bypass when sandbox disabled | `plugin-executor-service.ts` | Unrestricted code execution |
| P1-16 | Wrong pagination total | `PipelineController.ts` | Frontend shows incorrect total count |
| P1-17 | Missing trigger idempotency | `PipelineRunController.ts` | Double-click creates duplicate runs |
| P1-18 | No running-run check on pipeline delete | `PipelineController.ts` | Deleting pipeline with active run leaves orphan |
| P1-19 | Wrong Map key in `getPullPolicy` | `BuilderImageService.ts` | Always returns default pull policy |
| P1-20 | Run completion race condition | `PipelineRunService.ts` | Concurrent completions may double-count |

---

## P2: Medium Severity Logic Issues

1. Retry count off-by-one (retries N+1 instead of N)
2. Unknown task types silently succeed (no validation)
3. No topology cycle detection in CMDB (infinite traversal)
4. K8sWatch sync status lag (stale status displayed)
5. Missing SERVICE CI type in drift detection
6. Resource double-counting in quota calculation
7. Uncoordinated namespace max values
8. Plugin state machine gaps (no `disabling` state)
9. Inconsistent error messages across modules
10. Missing validation for pipeline stage ordering

---

## Transaction/Consistency Issues

| ID | Issue | Severity |
|---|---|---|
| T-001 | PipelineRunService and PipelineSaga maintain unsynchronized dual storage | P0 |
| T-002 | Quota allocated but not in try/finally -- leaks on exception | P1 |
| T-003 | Batch namespace allocation has no rollback on partial failure | P1 |
| T-004 | Async fire-and-forget in `executePendingStages` and `failDependentStages` | P1 |
| T-005 | Saga mock execution means entire distributed transaction safety net is non-functional | P0 |

---

## Design Doc Gaps

### Distributed Transaction Design
- Compensation only covers COMPLETED steps, not EXECUTING
- No stuck-detection for idempotency keys
- No DLQ for failed compensations
- No compensation timeout/retry mechanism

### NATS Event Bus Design
- DLQ not implemented
- No exponential backoff retry
- No event schema validation
- ACKs sent on handler error despite `autoAck=false`

### CMDB Design
- Tenant isolation bypassed via hardcoded tenantId=0
- Version race conditions on updates
- No topology cycle detection
- Missing SERVICE CI type in drift detection
