# Code Review Fixes Log

## Second Round: Critical, Important, and Suggestion Fixes

Date: 2026-04-28
Branch: `feat/frontend-gap-implementation`

All items from the first code review have been addressed. Below is the detailed fix log.

---

### Critical (C)

#### C3: EventBusService.publish race condition — FIXED
**Issue**: Between persisting the event record (line 324) and publishing to NATS (line 367), if the connection drops, the event is left in `published` status but never delivered.

**Fix**: Restructured `publish()` to always persist first with `pending_published` status, then attempt NATS publish. On success, update to `delivered`. On failure, the event remains as `pending_published` and is automatically retried when NATS reconnects via `retryPendingEvents()`.

**Files changed**:
- `src/services/event-bus-service.ts` — publish() rewritten with `pending_published` status
- `src/repositories/EventBusRepository.ts` — Added `pending_published` to status type
- `src/db/migrations/054_create_event_bus_tables.sql` — Added `pending_published` to CHECK constraint
- `src/db/migrations/055b_add_event_fallback_retry.sql` — Updated CHECK constraint for existing DBs
- `EventBusEventRepository.findPendingFallbackEvents()` — Now queries both `pending_fallback` AND `pending_published`

---

### Important (I)

#### I1: Persist SelfHealingGuardian audit log to PostgreSQL — FIXED
**Issue**: Audit log entries were stored only in-memory (`this.auditLog: HealingAuditEntry[]`), lost on process restart.

**Fix**:
1. Created `HealingAuditRepository` for PostgreSQL persistence
2. Created migration `055c_create_self_healing_audit_log.sql`
3. Modified `SelfHealingGuardian` to accept an optional `auditRepo` parameter
4. `recordAudit()` now writes to PostgreSQL first, falls back to in-memory on DB failure
5. `queryAudit()` and `getAuditStats()` query PostgreSQL when available, fall back to in-memory
6. `SelfHealingService.executeHealingActions()` now injects the repository into the guardian

**Files changed**:
- `src/repositories/HealingAuditRepository.ts` — NEW
- `src/db/migrations/055c_create_self_healing_audit_log.sql` — NEW
- `src/services/self-healing/SelfHealingGuardian.ts` — Added `auditRepo` field, async `recordAudit()`, async `queryAudit()`, async `getAuditStats()`
- `src/services/self-healing/index.ts` — Export `HealingAuditRepository`

#### I2: Add memory limit to stormWindow Map — FIXED
**Issue**: `stormWindow` Map grows unbounded, potentially consuming excessive memory under sustained alert storms.

**Fix**: Added `MAX_STORM_WINDOW_SIZE = 10_000` constant. In `shouldSuppress()`, after cleaning expired windows, if the size still exceeds the limit, the oldest entries are evicted via `evictOldestStormEntries()`.

**Files changed**:
- `src/services/self-healing/SelfHealingGuardian.ts` — Added `MAX_STORM_WINDOW_SIZE`, `evictOldestStormEntries()` method, size check in `shouldSuppress()`

#### I3: Add exponential backoff to retryPendingEvents — FIXED
**Issue**: `retryPendingEvents()` retries all pending events back-to-back without delay, potentially overwhelming NATS on recovery.

**Fix**: Added exponential backoff delay between retries: `100ms * 2^(i-1)`, capped at 5 seconds.

**Files changed**:
- `src/services/event-bus-service.ts` — Added delay loop with exponential backoff in `retryPendingEvents()`

#### I4: Fix retryCount timing inconsistency — FIXED
**Issue**: In failure handling, `event.retryCount + 1` was used to check max retries, but `event.retryCount` was the value from the initial fetch, not reflecting concurrent updates.

**Fix**: Use the returned entity from `incrementRetryCount()` to get the actual current retry count.

**Files changed**:
- `src/services/event-bus-service.ts` — Now uses `updatedEvent?.retryCount` from the `incrementRetryCount()` return value

#### I5: Add timeout protection to health checks — FIXED
**Issue**: Slow health checks could block the entire health check chain indefinitely.

**Fix**: Added `checkTimeoutMs` option (default 5s) to `HealthChecker`. Each check is wrapped with `withTimeout()` using `Promise.race()`. If a check exceeds the timeout, it returns `{ status: 'down', message: 'Check timed out' }`.

**Files changed**:
- `src/services/health.ts` — Added `checkTimeoutMs` config, `withTimeout()` method, updated `check()` and `checkReady()` to use it

---

### Suggestion (S)

#### S1: Fix empty `type.replace(/\./g, '.')` — FIXED
**Issue**: `type.replace(/\./g, '.')` is a no-op — replacing `.` with `.` does nothing.

**Fix**: Removed the redundant replace, just use `type` directly as the subject.

**Files changed**:
- `src/services/event-bus-service.ts` — `options?.subject || type`

#### S2: Replace console.log/warn with pino structured logging — FIXED
**Issue**: EventBusService used `console.log/warn/error` for logging, which lacks structured context and log level control.

**Fix**: Added `pino` logger (`const logger = pino({ name: 'event-bus-service' })`) and replaced all `console.*` calls with appropriate `logger.info/warn/error` calls with structured context.

**Files changed**:
- `src/services/event-bus-service.ts` — All console.* calls replaced with pino logger

#### S5: Fix Dockerfile `--production=false` to `--omit=dev` — FIXED
**Issue**: `npm ci --production=false` is deprecated; modern npm uses `--omit=dev`.

**Fix**: Changed to `npm ci --omit=dev`.

**Files changed**:
- `orion-platform-service/Dockerfile`

#### S7: Fix approvers field always empty in audit entries — FIXED
**Issue**: `recordAudit()` was called with `approvers: []` even when an approval existed. The comment said "Will be populated from approval if any" but it never was.

**Fix**:
1. `executeHealingActions()` now accepts an `approvers: string[]` parameter
2. `respondToApproval()` passes `[response.respondedBy]` when calling `executeHealingActions()`
3. All `recordAudit()` calls now properly pass the approvers array

**Files changed**:
- `src/services/self-healing/SelfHealingService.ts` — `executeHealingActions()` signature updated, approvers passed through
- `src/services/self-healing/SelfHealingGuardian.ts` — `recordAudit()` is now `async` (for DB persistence)

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 (C3) | Fixed |
| Important | 5 (I1-I5) | Fixed |
| Suggestion | 4 (S1,S2,S5,S7) | Fixed |

### Test Results
- `health.test.ts`: 13 tests passing
- `SelfHealingService.test.ts`: 71 tests passing
- `HealthCheckService.test.ts`: 26 tests passing
- **Total: 110 tests passing**

### Type Check
- `tsc --noEmit --skipLibCheck`: 0 errors (excluding pre-existing AgentSandbox ESM tsconfig issue)
