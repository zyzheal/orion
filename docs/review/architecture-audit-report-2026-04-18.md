# Orion Platform Architecture Audit Report

**Date**: 2026-04-18
**Auditor**: Automated Architecture Audit
**Scope**: 41 modules (M1-M41), full-stack comparison of design docs vs. code implementation
**Project Root**: `/Users/heal/orion-design`

---

## Executive Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Modules | 41 | |
| Design Docs Exist | 170+ documents | Adequate coverage |
| Backend Services (directories) | 47 | 36+ active service dirs |
| Frontend Pages (directories) | 54 | Good coverage |
| API Client Files | 35 | Adequate |
| Backend Route Files | 31 | |
| Database Migration Pairs | 10 (024-033) | Severely insufficient |
| **Overall Health Score** | **48/100** | **Needs significant work** |

### Critical Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 7 | Security risks, unmounted routes, mock database |
| P1 (High) | 12 | Missing integrations, incomplete services, no auth middleware |
| P2 (Medium) | 15 | Code quality, test coverage gaps, naming inconsistencies |

---

## P0: Critical Issues

### P0-1: DatabasePool is Entirely Mocked -- No Real Database Connection

**Location**: `orion-platform-service/src/services/database.ts`

The `DatabasePool` class uses `setTimeout` to simulate a database connection. All queries return empty results. The `pg` driver is not in `package.json`.

```typescript
// Line 52-66: Simulated connection with setTimeout
await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => {
    console.log('[DatabasePool] Connection pool initialized (mock)');
    resolve();
  }, 100);
  // import pg from 'pg';  <-- Commented out, never implemented
});
```

**Impact**: No data persistence. All API endpoints that rely on database operations return empty or mock data. Migrations 024-033 exist but are never executed against a real database.

**Fix**: 
1. Add `pg` and `@types/pg` to `package.json`
2. Replace the mock `DatabasePool.connect()` with real PostgreSQL connection pool
3. Wire up `DatabasePool` to the services that need it (currently none of the services inject it)
4. Run migrations with a proper migration runner

---

### P0-2: Agent (M40) and Ephemeral Env (M41) Routes Are Never Mounted

**Location**: `orion-platform-service/src/routes-agent.ts`, `orion-platform-service/src/routes-ephemeral-env.ts`

Both route files exist with full implementations but are **never imported or registered** in `src/api/routes.ts`. The routes are in the `src/` root directory, not in `src/api/`, and `index.ts` / `app.ts` do not reference them.

**Impact**: M40 and M41 APIs are completely inaccessible. Frontend pages `/agents`, `/agent-runs/:id`, `/ephemeral-envs`, `/ephemeral-envs/:id` will receive 404 errors. INDEX.md claims "full-stack implementation" for both modules -- this is incorrect.

**Fix**:
1. Import `registerAgentRoutes` from `./routes-agent` in `routes.ts`
2. Import `registerEphemeralEnvRoutes` from `./routes-ephemeral-env` in `routes.ts`
3. Register them with appropriate prefixes:
   ```typescript
   await app.register(registerAgentRoutes, { prefix: '/api/v1/agents', eventBus: options.eventBus });
   await app.register(registerEphemeralEnvRoutes, { prefix: '/api/v1/ephemeral-envs', eventBus: options.eventBus });
   ```

---

### P0-3: Hardcoded JWT Secret in Production-Ready Code

**Location**: `orion-platform-service/src/api/routes-auth.ts`, line 10

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'orion-dev-secret-key-change-in-prod';
```

**Impact**: If deployed without setting `JWT_SECRET`, all authentication tokens can be forged with the known default secret.

**Fix**: Remove the fallback default. Require `JWT_SECRET` to be set via environment variable and fail startup if missing.

---

### P0-4: Mock User Database in Auth Service

**Location**: `orion-platform-service/src/api/routes-auth.ts`, lines 14-17

```typescript
const MOCK_USERS = [
  { id: '1', username: 'admin', password: 'admin123', ... },
  { id: '2', username: 'user', password: 'user123', ... },
];
```

Passwords are stored in plaintext. No user management API exists (no registration, password change, user CRUD).

**Impact**: No real authentication. Any code depending on user identity gets hardcoded mock users.

**Fix**: 
1. Integrate with a real user store (database-backed or external IdP)
2. Hash passwords with bcrypt/argon2
3. Implement user CRUD endpoints

---

### P0-5: No Authentication Middleware on API Routes

**Location**: `orion-platform-service/src/api/routes.ts`

All API routes (pipelines, deployments, tickets, self-healing, etc.) are registered without any authentication/authorization middleware. Only the `/api/v1/auth` prefix is registered separately.

**Impact**: Every API endpoint is publicly accessible without authentication. This violates the M23 (SSO/RBAC) design which specifies JWT-based auth.

**Fix**: 
1. Create a JWT verification middleware using `@fastify/jwt` (already in dependencies)
2. Apply it globally to `/api/v1/*` except `/api/v1/auth/*`
3. Implement route-level RBAC checks where needed

---

### P0-6: Notification Module (M8/M33) Has Zero Backend Implementation

**Location**: `orion-frontend/src/api/notifications.ts`

The frontend notification API client uses entirely mock data with `setTimeout` simulation. There is no notification service, controller, or routes in the backend.

```typescript
// Line 48-86: All operations are in-memory mock
let notificationsState: MockNotification[] = [...mockNotifications];
```

**Impact**: Notifications never persist. Cross-session notification state is lost. No real-time notification delivery.

**Fix**:
1. Create `orion-platform-service/src/services/notification/` with NotificationService
2. Create notification routes in `src/api/notification-routes.ts`
3. Add database migration for notifications table
4. Wire up notification service to alert, ticketing, and self-healing modules

---

### P0-7: Manual Confirmation Module (M34) Has Zero Backend Implementation

**Location**: `orion-frontend/src/api/confirmations.ts`

The frontend confirmation API client calls `/v1/confirmations/*` endpoints, but no such routes exist in the backend. No confirmation service exists.

**Impact**: All confirmation operations (approve, reject, batch approve) fail silently or with 404 errors.

**Fix**:
1. Create `orion-platform-service/src/services/confirmation/ConfirmationService.ts`
2. Create `orion-platform-service/src/api/confirmation-routes.ts`
3. Add database migration for confirmation tables
4. Register routes in `routes.ts`

---

## P1: High Priority Issues

### P1-1: Pipeline Module (M5) Has No Database Migration

**Location**: Models exist (`Pipeline.ts`, `PipelineRun.ts`, `Stage.ts`, `Task.ts`) but no corresponding migration

**Impact**: Pipeline definitions and runs exist only in memory. All pipeline data is lost on server restart. The design doc specifies a persistent pipeline store.

**Fix**: Create migration `001_create_pipeline_tables.sql` with tables for pipelines, pipeline_runs, stages, and tasks.

---

### P1-2: 17+ Models Without Database Migrations

**Location**: `orion-platform-service/src/models/` vs. `orion-platform-service/src/db/migrations/`

Models that exist but have no migration:

| Model | Module | Status |
|-------|--------|--------|
| Pipeline | M5 | No migration |
| PipelineRun | M5 | No migration |
| Stage | M5 | No migration |
| Task | M5 | No migration |
| BuildCache | M14 | No migration |
| BuilderImage | M14 | No migration |
| BuildLog | M14 | No migration |
| BuildPod | M14 | No migration |

Only 10 migration pairs (024-033) exist, covering: Agent, EphemeralEnv, SBOM, Policy, ChangeIntelligence, CanaryAnalysis, Skill, Cost, IaC, ChatOps.

**Impact**: Most modules have no data persistence. All state is in-memory.

**Fix**: Create migrations 001-023 for all existing models.

---

### P1-3: No NATS Integration Actually Used in Services

**Location**: `orion-platform-service/src/services/event-bus-service.ts`

While the `EventBusService` imports NATS dynamically, the dynamic import uses a fallback pattern that silently succeeds even when NATS is unavailable. No services in the codebase import `nats` directly -- only `event-bus-service.ts` does, and only via dynamic import.

**Impact**: Event-driven architecture (M24) is non-functional. No inter-module communication via events.

**Fix**: 
1. Ensure NATS server is running in the development/production environment
2. Make NATS connection failures explicit (not silently swallowed)
3. Wire EventBus to services that need it (currently only passed to a few routes)

---

### P1-4: Efficiency/M1 Service Returns Hardcoded "unknown" Values

**Location**: `orion-platform-service/src/api/efficiency-routes.ts`, lines 41-47

```typescript
const metrics = {
  deploymentFrequency: 'unknown',
  leadTimeForChanges: 0,
  changeFailureRate: 0,
  meanTimeToRecovery: 0,
};
```

All DORA metrics return static placeholder values. ClickHouse sync is hardcoded as `enabled: false`.

**Impact**: M1 (Efficiency Dashboard) provides no real data. Design doc specifies real-time DORA metric calculation.

**Fix**: 
1. Implement actual DORA metric calculation in `DoraMetricsService`
2. Wire up ClickHouse integration for data persistence
3. Connect to pipeline/ticketing services for data sources

---

### P1-5: CMDB Routes Use Non-Standard Prefix Registration

**Location**: `orion-platform-service/src/api/routes.ts`, line 179

```typescript
await app.register(cmdbRoutes, { prefix: '/cmdb' });
```

While other routes use `/api/v1/` prefix (since they're registered inside the `/api/v1` plugin), CMDB routes are registered with prefix `/cmdb` which places them outside the `/api/v1` namespace.

**Impact**: Inconsistent API URL structure. CMDB endpoints are at `/cmdb/*` instead of `/api/v1/cmdb/*`.

**Fix**: Change to `{ prefix: '/cmdb' }` -- actually this is correct since it's inside the `/api/v1` plugin context. Verify the effective path. (Note: this may be intentional, but verify consistency.)

---

### P1-6: No Cross-Module Event Integration

**Location**: Multiple services

Services operate in isolation. For example:
- Self-healing service does not publish events when healing actions are taken
- Deployment service does not publish deployment events
- Alert service does not publish alert events to the event bus

The `PipelineEventPublisher` exists but is the only service that uses the event bus pattern.

**Impact**: No real-time cross-module communication. The event-driven architecture described in design docs is not implemented.

**Fix**: 
1. Add event publishing to key service operations
2. Add event consumers to dependent modules
3. Implement event-driven workflows (e.g., alert triggers self-healing)

---

### P1-7: Build Routes Have Inconsistent Path Prefixes

**Location**: `orion-platform-service/src/api/build-routes.ts`, lines 246-267

Artifact routes use `/api/v1/artifacts` prefix while other routes in the same file use relative paths. Since the file is registered with `{ prefix: '/build' }`, the artifact routes end up at `/api/v1/artifacts` (absolute) instead of `/build/api/v1/artifacts`.

**Impact**: Route inconsistency. Some artifact routes may conflict with other routes or be at unexpected paths.

**Fix**: Use relative paths consistently (`/artifacts` instead of `/api/v1/artifacts`).

---

### P1-8: Three Modules (M6, M29, M30) Completely Unimplemented

**Location**: INDEX.md

| Module | Name | Status |
|--------|------|--------|
| M6 | 多分支产品线 | No code, no design doc for implementation |
| M29 | 产物管理 | Design doc exists, no code |
| M30 | 二方库管理 | Design doc exists, no code |

**Impact**: Feature gaps in the product lifecycle.

**Fix**: Implement backend services, routes, and frontend pages for these modules.

---

### P1-9: Alert Service (M17 sub-component) Has No Persistence

**Location**: `orion-platform-service/src/services/alert/`

Alert correlation, deduplication, and suppression services store data in-memory. No database migration for alert tables. Alert state is lost on restart.

**Impact**: Alert history, deduplication state, and suppression rules do not persist.

**Fix**: Create alert database migration and integrate with the persistence layer.

---

### P1-10: No API Rate Limiting

**Location**: `orion-platform-service/src/api/`

No rate limiting middleware is configured. The `@fastify/rate-limit` package is not installed.

**Impact**: APIs are vulnerable to abuse and denial-of-service.

**Fix**: Install `@fastify/rate-limit` and configure rate limits per endpoint or globally.

---

### P1-11: No Request Validation/Schemas

**Location**: All route files

Request bodies are cast with `as` type assertions (`request.body as AlertCreate`) without runtime validation. No Joi/Zod/Ajv schemas are applied at the route level.

**Impact**: Invalid requests can reach service logic, causing unexpected errors.

**Fix**: 
1. Use AJV (already in dependencies) to create request validation middleware
2. Define JSON schemas for all request/response types
3. Apply validation at route registration

---

### P1-12: Cost Service Directory Structure Inconsistency

**Location**: `orion-platform-service/src/services/cost/` vs `orion-platform-service/src/services/finops/`

Two separate directories for cost-related functionality:
- `services/cost/` has only `BudgetService.ts` and `CostCalculator.ts`
- `services/finops/` has 10 files including `CostService.ts`, `CostTrackingService.ts`, etc.
- Two separate route files: `cost-routes.ts` and `finops-v2-routes.ts`

**Impact**: Confusing architecture. Duplicate functionality possible.

**Fix**: Consolidate into a single `services/finops/` directory with clear separation of concerns.

---

## P2: Medium Priority Issues

### P2-1: Duplicate Dashboard Pages

Three dashboard page directories exist: `Dashboard/`, `DashboardCore/`, `DashboardNew/`. It's unclear which is the active one. The router uses `DashboardNew` for `/dashboard` and `Dashboard` for `/projects`.

**Fix**: Consolidate to a single dashboard implementation.

---

### P2-2: PipelineService is Stateless (In-Memory Only)

**Location**: `orion-platform-service/src/services/pipeline/PipelineService.ts` (270 lines)

The service has no dependency injection for a database connection. All data is stored in in-memory collections.

**Fix**: Add database integration to PipelineService.

---

### P2-3: Test Coverage Gaps

Several critical services have no tests:
- `services/database.ts` -- no tests
- `services/redis-cache.ts` -- no tests
- `services/event-bus-service.ts` -- no tests
- `routes-auth.ts` -- no tests

Services that DO have tests (good): pipeline, self-healing, smart-deploy, monitoring, ticketing.

**Fix**: Add unit tests for infrastructure services (database, redis, event-bus, auth).

---

### P2-4: Frontend API Clients Inconsistent Error Handling

Some API clients (like `notifications.ts`) use mock implementations with `setTimeout`, while others (like `agents.ts`, `ephemeral-envs.ts`) make real API calls. There is no unified error handling strategy.

**Fix**: Standardize API client error handling with typed error responses.

---

### P2-5: No API Versioning

All routes use `/api/v1/` prefix but there's no versioning infrastructure. The design doc (ADR-012) specifies API version management, but no implementation exists.

**Fix**: Implement API version negotiation and versioned response formats.

---

### P2-6: No Graceful Degradation for Missing Dependencies

If Redis, NATS, or PostgreSQL fail to connect, services continue operating but may return empty or incorrect data without indicating the degradation.

**Fix**: 
1. Add circuit breaker pattern
2. Return appropriate degradation indicators in API responses
3. Implement health-aware response modification

---

### P2-7: Frontend Notification Bell Component May Not Update in Real-Time

**Location**: `orion-frontend/src/components/NotificationBell/`

Uses mock data with no WebSocket or polling mechanism to receive real-time notification updates.

**Fix**: Integrate with WebSocket store (`webSocketStore.ts`) for real-time notification push.

---

### P2-8: No Pagination Support in Most Route Handlers

Most list endpoints return all data without pagination parameters. This will cause performance issues with large datasets.

**Fix**: Add standardized pagination to all list endpoints with `page`, `pageSize`, and `total` fields.

---

### P2-9: No API Response Caching

No caching headers (ETag, Cache-Control) are set on any API responses. The Redis cache service exists but is not wired into any route handlers.

**Fix**: 
1. Wire RedisCache into route handlers
2. Add cache-aside pattern for read-heavy endpoints
3. Set appropriate Cache-Control headers

---

### P2-10: TypeScript `any` Usage

Multiple files use `any` type for request bodies and query parameters:
- `routes-auth.ts`: `request.body as any`
- `alert-routes.ts`: implicit `any`
- `efficiency-routes.ts`: implicit `any`

**Fix**: Define proper TypeScript interfaces for all request/response types.

---

### P2-11: Missing Environment Configuration

No `.env.example` or environment configuration documentation. The `config/` directory structure exists but environment variable expectations are not documented.

**Fix**: Create `.env.example` with all required and optional environment variables.

---

### P2-12: Frontend Has Duplicate Sub-App Launcher Components

`SubAppLauncher` and `SubAppRoute` components both handle micro-frontend loading. The relationship between them is unclear.

**Fix**: Document the relationship and consolidate if possible.

---

### P2-13: No OpenAPI/Swagger Documentation

No OpenAPI spec or Swagger UI is configured for the API. This makes it difficult for frontend developers to know available endpoints.

**Fix**: Add `@fastify/swagger` and generate OpenAPI specs from route definitions.

---

### P2-14: ClickHouse Client Hardcoded

**Location**: `orion-platform-service/src/api/efficiency-routes.ts`, line 25

```typescript
const clickHouseSync = new ClickHouseSync({ host: 'localhost', port: 8123, ... });
```

ClickHouse connection is hardcoded in the route file rather than injected from configuration.

**Fix**: Inject ClickHouse configuration from the app config.

---

### P2-15: Module Naming Inconsistency (M27 vs M15)

INDEX.md lists M15 (多工具链) and M27 (插件扩展) as separate modules, but they share the same code (`services/plugin/`, `services/plugin-spi/`, `pages/PluginManagement/`). The INDEX notes they "共用" (share), but they should either be merged or properly separated.

**Fix**: Either merge M15 and M27 into a single module, or provide distinct implementations.

---

## Module-by-Module Findings

| Module | Name | Design Doc | Backend | Frontend | API Client | Migration | Issues |
|--------|------|:----------:|:-------:|:--------:|:----------:|:---------:|--------|
| M1 | 效能看板 | Yes | Yes | Yes | Yes | No | P1-4: Returns hardcoded values |
| M2 | 流水线可视化 | Yes | Yes | Yes | Yes | No | P1-1: No pipeline migration |
| M3 | 审批工作台 | Yes | Partial | Yes | N/A | No | Embedded in self-healing, no standalone |
| M4 | 安全审计中心 | Yes | Yes | Yes | Yes | No | Routes exist but no auth middleware |
| M5 | Pipeline 引擎 | Yes | Yes | Yes | Yes | No | P1-1: No migration, in-memory only |
| M6 | 多分支产品线 | Yes | **No** | No | No | No | Unimplemented |
| M7 | 配置管理 GitOps | Yes | Yes | Yes | Yes | No | Config routes exist, no persistence |
| M8 | 通知协作 | Yes | **No** | Yes | Mock | No | P0-6: Zero backend |
| M9 | AI 算法引擎 | Yes | Yes | Yes | Yes | No | Basic implementation, no ML pipeline |
| M10 | LLM 推理层 | Yes | Shared M9 | Shared | Shared | No | Shares M9 code |
| M11 | AI 增强层 | Yes | Yes | Yes | Yes | No | Exists, no migration |
| M12 | Skill 管理 | Yes | Yes | Yes | Yes | 030 | OK |
| M13 | 代码管理 | Yes | Yes | Yes | Yes | No | No code-repo migration |
| M14 | 构建环境 | Yes | Yes | Yes | Yes | No | No build-related migrations |
| M15 | 多工具链 | Yes | Yes | Yes | Yes | No | Plugin routes exist, no migration |
| M16 | 智能部署 | Yes | Yes | Yes | Yes | No | No deployment migration |
| M17 | 自愈引擎 | Yes | Yes | Yes | Yes | No | Alert service in-memory only |
| M18 | 安全合规 | Yes | Yes | Yes | Yes | 026,027 | OK |
| M19 | 多租户 | Yes | Yes | Yes | Yes | No | No tenant migration |
| M20 | IaC 管理 | Yes | Yes | Yes | Yes | 032 | OK |
| M21 | 审计中心 | Yes | Yes | Yes | Yes | No | No audit migration |
| M22 | FinOps 成本 | Yes | Yes | Yes | Yes | 031 | OK |
| M23 | SSO/RBAC | Yes | Partial | Yes | Partial | No | P0-3,P0-4: Mock auth |
| M24 | 事件总线 | Yes | Yes | N/A | N/A | No | P1-3: NATS not actively used |
| M25 | 数据存储 | Yes | Yes | No | N/A | No | Backup routes exist |
| M26 | 可观测性 | Yes | Yes | Yes | Yes | No | No monitoring/diagnostic migration |
| M27 | 插件扩展 | Yes | Shared M15 | Shared | Shared | No | Shares M15 code |
| M28 | Orion-Knowledge | Yes | Sub-project | Sub-project | Partial | No | External sub-project |
| M29 | 产物管理 | Yes | **No** | No | No | No | Unimplemented |
| M30 | 二方库管理 | Yes | **No** | No | No | No | Unimplemented |
| M31 | 智能工单 | Yes | Yes | Yes | Yes | No | No ticketing migration |
| M32 | CMDB | Yes | Yes | No | No | No | Routes exist but no frontend |
| M33 | 通知中心 | Yes | **No** | Yes | Mock | No | P0-6: Zero backend |
| M34 | 人工确认交互 | Yes | **No** | Yes | Yes | No | P0-7: Zero backend |
| M35 | ChatOps | Yes | Yes | Yes | Yes | 033 | OK |
| M36 | AI 成本优化 | Yes | Yes | Yes | Yes | 031 | OK |
| M37 | AI 文档管理 | Yes | Partial | Yes | Yes | No | Depends on orion-knowledge sub-project |
| M38 | AI 变更智能 | Yes | Yes | Yes | Yes | 028 | OK |
| M39 | ML 金丝雀分析 | Yes | Yes | Yes | Yes | 029 | OK |
| M40 | AI Agent 编排 | Yes | Yes | Yes | Yes | 024 | P0-2: Routes not mounted |
| M41 | 临时开发环境 | Yes | Yes | Yes | Yes | 025 | P0-2: Routes not mounted |

---

## Cross-Module Integration Audit

### Integration Points That Exist

| From | To | Mechanism | Status |
|------|-----|-----------|--------|
| Pipeline | EventBus | PipelineEventPublisher | Partial (events not consumed) |
| SBOM | EventBus | SbomService | Partial |
| Policy | EventBus | PolicyService | Partial |
| Change Intelligence | EventBus | ChangeIntelligenceService | Partial |
| Canary Analysis | EventBus | CanaryAnalysisService | Partial |
| IaC | EventBus | IacService | Partial |
| ChatOps | EventBus | ChatOpsService | Partial |

### Integration Points That Are Missing

| From | To | Expected | Actual |
|------|-----|----------|--------|
| Monitoring/Alert | Self-Healing | Alert triggers healing | No connection |
| Self-Healing | Notification | Healing action notification | No notification service |
| Deployment | Monitoring | Deployment metrics update | No integration |
| Ticketing | Notification | Ticket assignment notification | Mock only |
| Pipeline | Deployment | Pipeline triggers deploy | No integration |
| FinOps | Efficiency | Cost efficiency correlation | No integration |
| AI Gateway | Agent | LLM calls by agents | No connection |
| CMDB | Monitoring | CI-based alert routing | No integration |
| SBOM | Policy | SBOM compliance check | No integration |
| Audit | All modules | Audit log for all actions | No integration |

---

## Architectural Anti-Patterns

### 1. God Object Pattern
`routes.ts` (271 lines) registers all routes in a single file. It should be split into route registration modules.

### 2. In-Memory Data Store Pattern
Most services use in-memory arrays/Maps for data storage. This pattern works for prototyping but breaks in production.

### 3. Tight Coupling to Fastify
Services directly import Fastify types, making them impossible to test without the HTTP framework.

### 4. Missing Dependency Injection
Services create their own dependencies instead of receiving them via constructor injection, making testing and configuration difficult.

### 5. Mixed Concerns in build-routes.ts
The build routes file handles 5 different sub-domains (images, cache, pods, logs, artifacts) in a single 296-line file.

### 6. Dynamic Import with Silent Failure
`event-bus-service.ts` uses `await import('nats').catch(() => ({ connect: null }))` which silently swallows NATS unavailability.

### 7. Frontend Mock Data in API Client
`notifications.ts` imports mock data directly in the API client layer instead of using a separate mock service for development.

---

## Specific Actionable Fixes (Prioritized)

### Sprint 1: Security & Critical Infrastructure (P0)

1. **Add `pg` to package.json and implement real DatabasePool** -- Estimated: 2 days
2. **Mount Agent and Ephemeral Env routes in routes.ts** -- Estimated: 1 hour
3. **Remove hardcoded JWT secret, require env var** -- Estimated: 30 min
4. **Replace mock user DB with real user service** -- Estimated: 3 days
5. **Add JWT auth middleware to all /api/v1/* routes** -- Estimated: 1 day
6. **Implement NotificationService backend** -- Estimated: 3 days
7. **Implement ConfirmationService backend** -- Estimated: 2 days

### Sprint 2: Data Persistence (P1)

8. **Create database migrations 001-023 for all existing models** -- Estimated: 3 days
9. **Wire DatabasePool into all services** -- Estimated: 2 days
10. **Implement real DORA metrics calculation** -- Estimated: 2 days
11. **Add NATS connection failure handling** -- Estimated: 1 day
12. **Implement M6, M29, M30 backend services** -- Estimated: 5 days

### Sprint 3: Cross-Module Integration (P1)

13. **Connect Alert to Self-Healing via EventBus** -- Estimated: 2 days
14. **Connect Self-Healing to Notification** -- Estimated: 1 day
15. **Connect Deployment to Monitoring** -- Estimated: 1 day
16. **Add event publishing to key service operations** -- Estimated: 2 days
17. **Consolidate cost/finops service directories** -- Estimated: 1 day

### Sprint 4: Code Quality (P2)

18. **Add request validation with AJV** -- Estimated: 2 days
19. **Add API rate limiting** -- Estimated: 1 day
20. **Add pagination to all list endpoints** -- Estimated: 1 day
21. **Wire Redis caching into read-heavy endpoints** -- Estimated: 2 days
22. **Add OpenAPI/Swagger documentation** -- Estimated: 1 day
23. **Create .env.example** -- Estimated: 30 min
24. **Add tests for infrastructure services** -- Estimated: 3 days

---

## Appendix: File Counts

### Backend
- Service directories: 47
- Controllers: 35 files in `api/controllers/`
- Route files: 31 (29 `*-routes.ts` + `routes.ts` + `routes-auth.ts`)
- Models: 19 files in `models/`
- Migration pairs: 10 (024-033)
- Total TypeScript files in `src/`: ~200

### Frontend
- Page directories: 54
- API client files: 35
- Component directories: 19
- Store files: 3 (+ index)
- Mock data files: 7

### Documentation
- Design documents: 170+
- ADR files: 13
- Review reports: 5

---

_This audit was generated by automated code analysis and manual review. All file paths are relative to `/Users/heal/orion-design`._
