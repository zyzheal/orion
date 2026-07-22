# Orion Platform Backend - Architecture Review

**Date**: 2026-05-06
**Scope**: `orion-platform-service` backend service
**Branch**: `feat/frontend-gap-implementation`

---

## 1. Critical Issues (Correctness, Safety)

### C-001: SQL Injection in TenantContext and RLSPolicyManager

**Severity**: Critical
**Files**:
- `src/services/tenant/TenantContext.ts`, line 151: `generateSessionSetSQL()`
- `src/services/tenant/TenantContext.ts`, line 183: `addTenantCondition()`
- `src/services/tenant/RLSPolicyManager.ts`, lines 147, 175, 278, 289

**Problem**: These methods use string interpolation to embed `tenantId` directly into SQL. While the current code path passes numeric values, the pattern is fundamentally unsafe:

```typescript
// TenantContext.ts:151 - Direct string interpolation
return `SELECT set_config('app.current_tenant', '${tenantId}', false), ...`

// TenantContext.ts:183 - Same pattern in WHERE clause
const tenantCondition = `tenant_id = ${tenantId}`;

// RLSPolicyManager.ts:147
const sql = `SELECT set_config('${this.sessionVariableName}', '${tenantId}', false), ...`
```

These methods exist to be called by services that should use parameterized queries instead. If any caller passes a non-numeric string, SQL injection is possible.

**Fix**: Replace all interpolated SQL with parameterized queries. The `DatabasePool.query()` already supports `$1, $2` parameter binding.

---

### C-002: TenantContext Global Singleton - Concurrent Request Data Leakage

**Severity**: Critical
**Files**:
- `src/services/tenant/TenantContext.ts`, line 327: `export const tenantContext = new TenantContext();`
- `src/api/routes.ts`, lines 191-208 (middleware sets/clears on global instance)

**Problem**: `tenantContext` is a module-level singleton storing `currentTenant` as a single instance property. The middleware sets it via `tenantContext.setTenant()` at `onRequest` and clears it at `onResponse`. In a concurrent Node.js server with Fastify's async handlers:

```
Request A: tenantContext.setTenant({ tenantId: 1 })
Request B: tenantContext.setTenant({ tenantId: 2 })  // Overwrites A's context
Request A: downstream code reads tenantContext.getCurrentTenant() -> { tenantId: 2 }  // WRONG!
```

This means any service code that reads `tenantContext.getCurrentTenant()` during DB queries or business logic may see another request's tenant ID.

**Note**: The RLS layer (setting `app.current_tenant` on the PostgreSQL connection) is ALSO vulnerable to this because it uses the same singleton value at `routes.ts:198`. However, since pg.Pool hands out different clients per query and the session variable is set on a per-connection basis, the RLS path is safer than the in-memory path -- but only if no code shares connections across requests.

**Fix**: Use Fastify's request decoration pattern (`request.tenantContext = {...}`) instead of a global singleton. Pass tenant context explicitly through method parameters.

---

### C-003: PromotionService Uses In-Memory State for Critical State Machine

**Severity**: Critical
**Files**:
- `src/services/artifact/PromotionService.ts`, lines 44-46
- `src/api/artifact-routes.ts`, line 31

**Problem**: `PromotionService` stores the current stage for each artifact in an in-memory `Map<string, PromotionStage>` and promotion history in an in-memory array. Even though `ArtifactPromotionRepository` exists and is conditionally passed in, the `setStage()`, `getCurrentStage()`, `getHistory()` methods (lines 57-80) only use the in-memory Maps:

```typescript
private currentStages: Map<string, PromotionStage> = new Map();
private promotionHistory: PromotionRecord[] = [];
```

On service restart, all promotion state is lost. This defeats the purpose of a 5-stage state machine for artifact lifecycle management.

**Fix**: Make `setStage()` and `getHistory()` use the repository for persistence.

---

### C-004: EscalationScheduler Singleton Created Without Dependencies

**Severity**: High
**Files**:
- `src/services/escalation/EscalationScheduler.ts`, line 108 (exported singleton)
- `src/api/routes.ts`, line 75 (imports `escalationScheduler`)

**Problem**: `escalationScheduler` is exported as a module-level singleton constructed with no arguments:

```typescript
export const escalationScheduler = new EscalationScheduler();
```

This means `this.db`, `this.eventBus`, and `this.ticketRepo` are all `undefined`. In `routes.ts:400-407`, the scheduler's `start()` is called conditionally when `options.database && options.eventBus` are truthy, but the scheduler instance already has `undefined` for these fields. The `start()` method will try to run with no database access.

**Fix**: Create the scheduler instance inside `routes.ts` or `app.ts` after DB/EventBus are available, passing the dependencies via constructor.

---

### C-005: JWT_SECRET Validated at Module Import Time

**Severity**: High
**File**: `src/middleware/authMiddleware.ts`, lines 18-21

**Problem**: If `JWT_SECRET` is not set as an environment variable, the module throws immediately at import time:

```typescript
const JWT_SECRET: string = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for authMiddleware');
}
```

This means health check endpoints (`/healthz`, `/livez`) will fail to start because `authMiddleware.ts` is imported by `routes.ts` which is imported by `app.ts`. The server cannot even serve health checks without a valid JWT secret.

**Fix**: Move the validation to be conditional -- only throw when the middleware is actually invoked on a protected route. Or use a dummy secret in development mode with a clear warning.

---

## 2. Design Issues (Coupling, Cohesion, Maintainability)

### D-001: Dual ArtifactService Confusion

**Severity**: High
**Files**:
- `src/services/artifact/ArtifactService.ts` (37 lines, simple CRUD)
- `src/services/build/ArtifactService.ts` (376 lines, multi-arch, fallback Map, download tracking)

**Problem**: Two completely different `ArtifactService` classes with different responsibilities:

| Aspect | `services/artifact/` | `services/build/` |
|--------|---------------------|-------------------|
| Repository | `ArtifactRepository` | `BuildArtifactRepository` |
| Features | Basic CRUD | Multi-arch build, download tracking, cleanup, Map fallback |
| Used by | `artifact-routes.ts` | `build-routes.ts` |
| Singleton export | None | Yes (`export const artifactService = new ArtifactService()`) |

The domain names suggest these should be different concepts (artifact registry vs build artifacts), but the shared name `ArtifactService` creates constant confusion. Routes registered under `/v1/artifacts` (artifact-routes) and `/v1/artifacts` (build-routes at prefix `/v1/`) will conflict or override each other.

**Evidence**: Both `artifact-routes.ts` and `build-routes.ts` register routes under the same `/artifacts` path. The build-routes mounts at `/v1/` (line 265 of routes.ts), while artifact-routes mounts at `/v1/artifacts`. This means build-routes captures `/v1/artifacts` before artifact-routes can.

**Fix**: Rename one or both services to make domains distinct (e.g., `ArtifactRegistryService` vs `BuildArtifactService`). Ensure route prefixes don't overlap.

---

### D-002: No DI Container - Manual Service Wiring in routes.ts

**Severity**: High
**Files**:
- `src/api/routes.ts` (601 lines)
- `src/api/build-routes.ts` (374 lines)
- Many `-routes.ts` files

**Problem**: There is no DI container. Services are manually instantiated in route files:

```typescript
// routes.ts lines 222-247 - Pipeline services manually wired
const pipelineRepository = new PipelineRepository(options.database);
const pipelineService = new PipelineService(pipelineRepository!);
const engine = new PipelineEngine(pipelineService, runService, eventPublisher, stageExecutor);
```

```typescript
// build-routes.ts lines 39-83 - 10+ services manually created
const builderImageService = new BuilderImageService();
const buildCacheService = new BuildCacheService(configRepo, entryRepo);
const k8sBuildExecutor = new K8sBuildExecutor(undefined, buildCacheService, builderImageService);
```

This creates several problems:
1. **routes.ts is 601 lines** and growing -- hard to maintain
2. **Service lifecycle is unclear** -- who owns the instances?
3. **Testing is harder** -- no way to swap implementations without editing route files
4. **No circular dependency detection** -- manual imports make cycles invisible until runtime

The `registerWithRoleGuard()` helper (lines 164-176) is good for auth, but it doesn't help with service DI.

**Fix**: Introduce a simple DI container or factory pattern. Create a `services/ServiceRegistry.ts` that builds all services with their dependencies and exports them. Routes should receive pre-built service instances via options, not create them.

---

### D-003: TenantIsolationService "Four-Layer Validation" is Largely No-Op

**Severity**: High
**Files**: `src/services/tenant/TenantIsolationService.ts`

**Problem**: The service claims to validate four layers of tenant isolation, but the implementation is mostly cosmetic:

- **Layer 1 (API)**: Compares header `x-tenant-id` with context `tenantId` (line 128-129) -- valid but trivial
- **Layer 2 (Service)**: Just checks `tenantId > 0` (line 138) -- this is not validation, it's a null check
- **Layer 3 (Repository)**: Checks if `context.repository` string contains "tenant" (line 148) -- this is string matching, not actual verification that SQL includes `WHERE tenant_id=?`
- **Layer 4 (Database RLS)**: Checks if `context.databaseSession` has matching values (line 161-166) -- but `databaseSession` is never populated in the calling code

The `validateFourLayers()` method is called nowhere in the actual request pipeline. The real isolation is done by `TenantValidatorMiddleware` (Layer 1) and `RLSPolicyManager` (Layer 4), not by this service.

**Fix**: Either implement actual validation (e.g., parse SQL queries to verify tenant conditions, check RLS table status) or remove the "four-layer" abstraction and call the real mechanisms directly.

---

### D-004: PipelineService Has Inline Stage Execution That Bypasses PipelineEngine

**Severity**: Medium
**File**: `src/services/pipeline/PipelineService.ts`, lines 344-413

**Problem**: `PipelineService.executePipeline()` and `executeStage()` implement a simplified pipeline execution loop inline:

```typescript
private async executePipeline(runId: string, pipelineId: string): Promise<void> {
  const stages = await this.repository.findStagesByPipeline(pipelineId);
  for (const stage of stages) {
    await this.executeStage(runId, stage);
  }
}
```

But `routes.ts` (line 237) also creates a full `PipelineEngine` with `StageExecutor` and `TaskRunner`. Which one actually runs pipelines? The `PipelineService.triggerRun()` calls its own `executePipeline()` (line 334), while `PipelineRunController` uses the `PipelineEngine` for execution. This creates two competing execution paths.

**Fix**: Remove the inline execution from `PipelineService` or make it a thin delegation to `PipelineEngine`.

---

### D-005: K8sBuildExecutor Created with Undefined K8s Client

**Severity**: Medium
**File**: `src/api/build-routes.ts`, line 58-62

**Problem**:
```typescript
const k8sBuildExecutor = new K8sBuildExecutor(
  undefined,  // Mock K8s client
  buildCacheService,
  builderImageService
);
```

The comment says "Mock K8s client" but it's `undefined`. This means any K8s build operations will throw at runtime. There's no mock implementation -- just null.

**Fix**: Either inject a real K8s client or provide a proper mock/stub implementation.

---

## 3. Consistency Issues (Pattern Drift)

### S-001: Multiple Module-Level Singletons with Mutable State

**Files**:
- `src/services/tenant/TenantContext.ts:327` -- `tenantContext` singleton
- `src/services/tenant/TenantQuotaService.ts:448` -- `tenantQuotaService` singleton
- `src/services/tenant/NamespacePoolService.ts:488` -- `namespacePoolService` singleton
- `src/services/build/ArtifactService.ts:375` -- `artifactService` singleton
- `src/services/escalation/EscalationScheduler.ts:108` -- `escalationScheduler` singleton
- `src/config/UnifiedConfigService.ts:802` -- `unifiedConfig` singleton
- `src/services/escalation/EscalationConfigService.ts` -- `escalationConfigService` singleton

**Problem**: At least 7 singletons with mutable state exported at module level. This pattern:
- Makes testing difficult (state persists between tests)
- Creates hidden coupling (any file can import and mutate shared state)
- Violates the DI pattern that other services follow (e.g., `PipelineService`, `PipelineRunService` accept dependencies via constructor)

The `TenantQuotaService` singleton holds a `usage: Map<string, TenantUsage>` that accumulates API call counts across all requests and all tenants. On a multi-tenant production system, this Map grows unbounded.

**Fix**: Remove module-level singletons. Export factory functions instead, and let the DI wiring create instances.

---

### S-002: Inconsistent Repository Null Handling

**Files**: Throughout services

**Problem**: Services handle missing repositories differently:

| Service | Pattern | Behavior |
|---------|---------|----------|
| `PipelineService` | Constructor takes `PipelineRepository \| null`, stores as nullable | Throws `"Database not available"` on mutations, returns `[]`/`null` on reads |
| `PipelineRunService` | Constructor takes optional, has `setEventPublisher` setter | Falls back to in-memory domain models |
| `build/ArtifactService` | Constructor takes optional | Falls back to in-memory `Map` |
| `artifact/ArtifactService` | Constructor takes **required** `ArtifactRepository` | Always throws if no DB |

The three patterns ("throw on no DB", "fallback to memory", "require at construction") coexist with no documented rationale. This makes it impossible to reason about service behavior when DB is unavailable.

**Fix**: Standardize on one pattern. Recommendation: require repository at construction (fail fast), no fallback to in-memory state in production code paths.

---

### S-003: TenantValidatorMiddleware Code Duplication

**File**: `src/services/tenant/TenantValidatorMiddleware.ts`

**Problem**: The file contains both a class `TenantValidatorMiddleware` with a `getHandler()` method (lines 42-116) AND a standalone function `createTenantValidatorMiddleware` (lines 129-193) that implements the **exact same logic** -- duplicated verbatim:

- Both skip paths with `config.skipPaths?.some(path => request.url.startsWith(path))`
- Both parse `x-tenant-id` header
- Both check for tenant mismatch
- Both call `tenantContext.setTenant()`

This is 65 lines of duplicated code. `routes.ts` uses the standalone function, but the class is also exported.

**Fix**: Remove the class or make the function use the class. Only one implementation should exist.

---

### S-004: Mixed Route Registration Patterns

**File**: `src/api/routes.ts`

**Problem**: There are three different patterns for registering routes with auth:

```typescript
// Pattern 1: registerWithRoleGuard (auth + role guard)
await registerWithRoleGuard(app, buildRoutes, '/v1/', { database: options.database });

// Pattern 2: app.register with manual auth hook
await app.register(async (instance: FastifyInstance) => {
  instance.addHook('onRequest', authenticateUser);
  await instance.register(pipelineVersionRoutes, { prefix: '/v1/pipelines', ... });
});

// Pattern 3: registerWithRoleGuard but without role check (some routes)
await registerWithRoleGuard(app, artifactRoutes, '/v1/artifacts', { database: options.database });
```

Pattern 2 is used for Phase 1 P0 routes (pipelineVersion, pipelineBudget, autonomousPipeline, securityCompliance) while Pattern 1 is used for everything else. The difference: Pattern 2 adds `authenticateUser` but NOT `roleGuard`, while Pattern 1 adds both. This inconsistency means some admin-only routes may be missing role checks.

**Fix**: Use a single registration helper for all routes. Define role requirements per-route in a configuration table.

---

### S-005: `PipelineRunService` Hardcoded Default Tenant

**File**: `src/services/pipeline/PipelineRunService.ts`, line 74

```typescript
tenant_id: '00000000-0000-0000-0000-0000-000000000000', // Default tenant (should come from context)
```

The comment says it should come from context, but the code always uses the hardcoded UUID. This means all pipeline runs created through this mapping path are attributed to a fake tenant, breaking tenant isolation for any downstream queries.

**Fix**: Pass tenant context to the mapping method or inject it from the calling code.

---

## 4. Missing Capabilities (Design Doc vs Implementation)

### M-001: EventBus Not Wired to NATS at Service Level

**Status**: Known but still present
**Files**: `src/services/event-bus-service.ts`

**Evidence**: The `EventBusService` is fully implemented with NATS connectivity, but looking at `src/index.ts:61-78`:

```typescript
eventBus = new EventBusService({ servers: cfg.nats.servers, ... });
try { await eventBus.connect(); } catch (error) {
  console.warn('Event Bus connection failed, continuing without Event Bus');
}
```

The catch block silently swallows the error. The service continues in "fallback mode" where events are persisted to PostgreSQL but never actually published to NATS. This means:
- Event-driven features (cross-service communication, async pipelines, notification triggers) don't work
- All event consumers (if any existed) would never receive events
- The system operates as a monolith with synchronous calls only

This is acceptable as a deployment strategy (NATS as optional), but should be clearly documented and monitored.

---

### M-002: No Tenant Context Propagation to Services

**Status**: Partial gap

**Problem**: The tenant context is set in middleware on the global `tenantContext` singleton, but individual services (`PipelineService`, `BuildService`, etc.) don't receive or use tenant context. They either:
- Accept `tenantId` as a method parameter (inconsistent across services)
- Don't filter by tenant at all (e.g., `PipelineService.list()` accepts `tenantId` but `PipelineService.getById()` doesn't validate the resource's tenant)

This means any service method can be called with any tenant ID -- there's no enforcement that the caller has access to that tenant's resources.

**Fix**: Add a `TenantAwareService` base class or interface that validates tenant context before operations.

---

### M-003: No Structured Observability Integration

**Status**: Missing

**Problem**: The codebase uses `console.log`, `console.warn`, `console.error` in many places (e.g., `database.ts:49,65,79`, `routes.ts:184`). While `pino` is used in some services (`event-bus-service.ts`, `UnifiedConfigService.ts`), there's no consistent observability strategy:

- No trace IDs propagated through service calls
- No structured logging format enforced
- `DatabasePool` uses plain `console.log` instead of the configured logger
- No metrics collection (beyond the EventBus in-memory counters)

The `app.ts` configures Fastify with a pino logger and request serializers, but individual services bypass it.

---

## 5. Recommendations (Prioritized by Impact)

### P0: Fix Immediately

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| C-002 | TenantContext global singleton data leakage | Multi-tenant data exposure | Medium |
| C-001 | SQL injection in tenant SQL generation | Security vulnerability | Low |
| C-003 | PromotionService in-memory state | Data loss on restart | Low |
| C-004 | EscalationScheduler singleton without deps | Feature silently broken | Low |

### P1: Fix Within Sprint

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| C-005 | JWT_SECRET blocks health checks | Service startup failure | Low |
| D-001 | Dual ArtifactService confusion | Route conflicts, maintenance burden | Medium |
| D-003 | Four-layer isolation no-op | False security assurance | Medium |
| S-001 | 7+ module-level mutable singletons | Testing, coupling, memory leaks | Medium |

### P2: Architecture Improvement

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| D-002 | No DI container / manual wiring | Maintainability, testability | High |
| D-004 | Dual pipeline execution paths | Confusion, potential bugs | Medium |
| S-002 | Inconsistent repository null handling | Unpredictable behavior | Medium |
| M-002 | No tenant context propagation | Tenant isolation gap | Medium |

### P3: Nice to Have

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| S-003 | TenantValidatorMiddleware duplication | Maintenance overhead | Low |
| S-004 | Mixed route registration patterns | Inconsistent auth | Low |
| S-005 | Hardcoded default tenant | Tenant attribution | Low |
| D-005 | Undefined K8s client | Build feature broken | Low |
| M-003 | No structured observability | Debug difficulty | Medium |

---

## Summary

The codebase has made significant progress since the previous review -- the Repository pattern migration is largely complete, the EventBusService has proper fallback semantics, and the four-layer tenant isolation concept is well-designed. However:

1. **The TenantContext global singleton remains the single biggest risk** -- it can cause cross-tenant data leakage under concurrent load. This is not theoretical; it will happen in production with any non-trivial traffic.

2. **The DI approach is ad-hoc** -- services are manually instantiated in route files, creating a 600+ line monolithic wiring file with no abstraction. A simple factory/container pattern would cut this by 60% and make testing straightforward.

3. **Several critical services (PromotionService, EscalationScheduler) have broken state management** that will cause data loss or silent failures in production.

4. **The dual ArtifactService problem persists** with the added complication of overlapping route prefixes.
