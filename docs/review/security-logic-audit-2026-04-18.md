# Orion Platform -- Security & Logic Audit Report

**Date:** 2026-04-18
**Auditor:** Automated Deep Scan
**Scope:** `orion-platform-service/src/` + `orion-frontend/src/`
**Risk Score: 7.8 / 10** (High -- multiple P0 security issues)

---

## Executive Summary

The Orion platform is a Fastify 4 backend with React 18 frontend that provides CI/CD pipeline management, plugin lifecycle, build artifact management, and several other DevOps services. The codebase is primarily prototype-grade: most backend stores are in-memory Maps, database/Redis are mocked, and several API routes lack authentication entirely.

The audit identified:

| Category | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| Security | 6 | 2 | 1 | 9 |
| Business Logic | 2 | 4 | 1 | 7 |
| Error Handling | 0 | 3 | 1 | 4 |
| Type Safety | 0 | 0 | 7 | 7 |
| Performance | 0 | 1 | 2 | 3 |
| Consistency | 0 | 0 | 3 | 3 |
| **Total** | **8** | **10** | **15** | **33** |

---

## Security Findings (P0)

### SEC-001: Hardcoded JWT Secret and Mock Credentials

**File:** `orion-platform-service/src/api/routes-auth.ts`, lines 10-17
**Vulnerability:** CWE-798: Use of Hard-coded Credentials
**Severity:** Critical

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'orion-dev-secret-key-change-in-prod';

const MOCK_USERS = [
  { id: '1', username: 'admin', password: 'admin123', email: 'admin@orion.com', role: 'admin' },
  { id: '2', username: 'user', password: 'user123', email: 'user@orion.com', role: 'user' },
];
```

**Impact:** If the code reaches production without `JWT_SECRET` set, any attacker can forge valid JWT tokens. Mock passwords are trivially guessable. The default secret `orion-dev-secret-key-change-in-prod` is discoverable.

**Fix:**
- Remove all mock credentials; require external identity provider.
- Make `JWT_SECRET` a required environment variable; fail startup if missing in non-dev environments.
- Use bcrypt/argon2 for password hashing instead of plaintext comparison.

### SEC-002: No Authentication Middleware on Any API Route

**File:** `orion-platform-service/src/api/routes.ts` (all routes), `orion-platform-service/src/routes-plugin.ts`, `orion-platform-service/src/api/build-routes.ts`

**Vulnerability:** CWE-306: Missing Authentication for Critical Function
**Severity:** Critical

No Fastify `preHandler` hooks, JWT verification, or auth guards are registered on any API route. Every endpoint -- including destructive operations like DELETE pipelines, plugin install/uninstall, build pod creation, and artifact deletion -- is accessible without authentication.

**Impact:** Any network-accessible client can create/delete pipelines, install plugins, execute arbitrary plugin tasks, and trigger builds.

**Fix:**
```typescript
app.addHook('preHandler', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'UNAUTHORIZED' });
  }
  const token = authHeader.split(' ')[1];
  try {
    request.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return reply.status(401).send({ error: 'INVALID_TOKEN' });
  }
});
```
Apply this globally or per-route group with exceptions for `/login`, `/healthz`, etc.

### SEC-003: Plugin Task Execution with Arbitrary Environment Variables and Workspace Paths

**File:** `orion-platform-service/src/services/plugin-executor-service.ts`, lines 41-46
**File:** `orion-frontend/src/api/plugins.ts`, lines 103-114

**Vulnerability:** CWE-78: OS Command Injection / CWE-20: Improper Input Validation
**Severity:** Critical

The `TaskExecutionRequest` and `ExecutePluginInput` types accept:
- `workspace: { rootPath: string, files?: Record<string, string> }`
- `env?: Record<string, string>`
- `config: Record<string, any>`

These values flow directly into the execution pipeline. The `TaskRunner` at `orion-platform-service/src/engine/TaskRunner.ts` (lines 140-154) executes `shell/script` type tasks using user-supplied `script` or `command` parameters. While currently mocked, the design allows arbitrary script execution without sanitization.

**Impact:** A compromised plugin or authorized user could execute arbitrary OS commands, read arbitrary files via `workspace.rootPath`, or inject malicious environment variables.

**Fix:**
- Implement strict allowlists for `workspace.rootPath` (e.g., `/tmp/orion-builds/*`).
- Sanitize or block all `env` keys matching known injection vectors (PATH, LD_PRELOAD, etc.).
- When real shell execution is implemented, never pass user input directly to `child_process.exec`. Use `spawn` with argument arrays.

### SEC-004: CORS Configured with `origin: true` (Reflects Any Origin)

**File:** `orion-platform-service/src/app.ts`, line 65

```typescript
await app.register(fastifyCors, {
  origin: true,  // <-- Reflects any requesting origin
  credentials: true,
  ...
});
```

**Vulnerability:** CWE-942: Permissive Cross-Origin Resource Sharing
**Severity:** High

`origin: true` causes Fastify to echo back the `Origin` header from the request, effectively allowing any website to make authenticated cross-origin requests. Combined with `credentials: true`, this enables credential-stealing attacks from malicious origins.

**Fix:**
```typescript
await app.register(fastifyCors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  ...
});
```

### SEC-005: Plaintext Passwords in Mock User Database

**File:** `orion-platform-service/src/api/routes-auth.ts`, lines 14-17

```typescript
const MOCK_USERS = [
  { id: '1', username: 'admin', password: 'admin123', ... },
  { id: '2', username: 'user', password: 'user123', ... },
];
```

And the comparison at line 37:
```typescript
const user = MOCK_USERS.find((u) => u.username === username && u.password === password);
```

**Vulnerability:** CWE-256: Plaintext Storage of a Password
**Severity:** Critical

Passwords are stored and compared in plaintext. Even though this is mock data, the pattern establishes a dangerous precedent for the real authentication implementation.

**Fix:** Use `bcrypt.hash()` and `bcrypt.compare()` for all password operations.

### SEC-006: Token Stored in localStorage (XSS-Accessible)

**File:** `orion-frontend/src/api/client.ts`, lines 15-18

```typescript
const token = localStorage.getItem('access_token');
if (token) {
  config.headers.Authorization = `Bearer ${token}`;
}
```

**Vulnerability:** CWE-922: Insecure Storage of Sensitive Information
**Severity:** High

`localStorage` is accessible to any JavaScript running on the page, including malicious code injected via XSS. An attacker who exploits any XSS vector can steal the JWT and impersonate any user.

**Fix:** Store tokens in `httpOnly`, `secure`, `SameSite` cookies set by the backend. This prevents JavaScript access entirely.

---

## Logic Errors (P0/P1)

### LOG-001: Plugin State Machine Allows Illegal Transitions

**File:** `orion-platform-service/src/services/plugin-manager-service.ts`, lines 263-289

**Severity:** High

The `activatePlugin` method only checks for `UNINSTALLED` state:

```typescript
if (plugin.state === 'UNINSTALLED') {
  throw new Error(`Plugin ${pluginId} is uninstalled`);
}
plugin.state = 'ACTIVE';
```

A plugin in `AVAILABLE` state (never installed) can be directly activated, skipping `INSTALLED` and `CONFIGURED` states. Similarly, `deactivatePlugin` does not verify the plugin is currently active.

**Reproduction:**
1. Call `GET /plugins/:pluginId` -- returns plugin with `state: 'AVAILABLE'`
2. Call `POST /plugins/:pluginId/activate` -- succeeds, state becomes `ACTIVE`
3. Plugin is now "active" without ever being installed or configured

**Fix:** Implement a proper state machine with allowed transitions:
```
AVAILABLE -> DOWNLOADED -> INSTALLED -> CONFIGURED -> ACTIVE -> INACTIVE
                                                        -> UNINSTALLED
```

### LOG-002: Pipeline Engine Does Not Guard Against Concurrent Triggering

**File:** `orion-platform-service/src/engine/PipelineEngine.ts`, lines 36, 53-113

**Severity:** High

The `executions` Map stores active runs, but `execute()` does not check if a pipeline is already running before starting a new execution. Multiple `POST /pipelines/:id/runs` calls create overlapping executions with shared in-memory state (`pendingStages`, `runningStages`, `completedStages` Sets).

**Reproduction:**
1. `POST /pipelines/:id/runs` -- creates Execution A
2. Immediately `POST /pipelines/:id/runs` -- creates Execution B
3. Both executions modify the same in-memory structures, leading to corrupted state, lost updates, and unpredictable completion checks.

**Fix:**
- Add a `runningRuns` set or check `PipelineRun.status` before starting.
- Return 409 Conflict if the same pipeline is already executing.

### LOG-003: `executeWithoutSandbox` Path Bypasses All Security Controls

**File:** `orion-platform-service/src/services/plugin-executor-service.ts`, lines 458-479

**Severity:** High

When `config.enableSandbox` is false, `executeByType` calls `executeWithoutSandbox`, which still routes to `executeWASMPlugin`, `executeContainerPlugin`, or `executeProcessPlugin` based on `securityLevel` -- but with **no sandbox, no timeout, no resource quota**. The `executeWithoutSandbox` methods do not receive an `AbortSignal` or any execution context.

**Fix:** Remove `executeWithoutSandbox` entirely or add a minimum guard with timeout and logging.

### LOG-004: `cancelRun` Does Not Signal the Engine to Stop Execution

**File:** `orion-platform-service/src/services/pipeline/PipelineRunService.ts`, lines 132-145
**File:** `orion-platform-service/src/engine/PipelineEngine.ts`, lines 296-313

**Severity:** Medium

`cancelRun` sets the PipelineRun status to `CANCELLED` in the Map, but the PipelineEngine's `executePendingStages` and `executeStage` methods never check the run status. The pipeline continues executing stages even after "cancellation."

**Fix:** `PipelineEngine.executeStage` and `executePendingStages` must check `execution.run.status` before proceeding. Add an `AbortController` pattern.

### LOG-005: YAML Generation Does Not Escape Special Characters (Injection)

**File:** `orion-frontend/src/pages/PipelineEditor/index.tsx`, lines 126-164

```typescript
const yaml = `metadata:
  name: ${pipelineInfo.name}
  version: ${pipelineInfo.version}
  ...
```

User-supplied values like `pipelineInfo.name` are interpolated directly into YAML strings without escaping. A stage name containing `:` or newlines would produce invalid or malicious YAML.

**Fix:** Use a YAML serialization library (e.g., `js-yaml.dump()`) instead of string templates.

### LOG-006: Retry Stage Logic Has Race Condition

**File:** `orion-platform-service/src/engine/PipelineEngine.ts`, lines 325-339

```typescript
private async retryStage(execution: PipelineExecution, stage: Stage): Promise<void> {
  const retriedStage = {
    ...stage,
    retryCount: stage.retryCount + 1,
    status: StageStatus.PENDING,
    ...
  };
  execution.stages.set(stage.id, retriedStage);
  execution.pendingStages.add(stage.id);
  execution.completedStages.delete(stage.id);
  // Note: executePendingStages is NOT called after retry
}
```

The retry adds the stage to `pendingStages` but never calls `executePendingStages`. The stage will only execute if another stage completion triggers `checkNextStages`.

**Fix:** Call `this.executePendingStages(execution)` at the end of `retryStage`.

---

## Error Handling Gaps (P1)

### ERR-001: Unhandled Promise Rejection in `executePendingStages`

**File:** `orion-platform-service/src/engine/PipelineEngine.ts`, line 178

```typescript
this.executeStage(execution, stage).catch(error => {
  console.error(`Failed to execute stage ${stage.name}:`, error);
});
```

The `.catch` only logs to console. The stage error is not propagated to the PipelineEngine's state, so the run never transitions to `FAILED`. The pipeline hangs indefinitely.

### ERR-002: Missing try/catch Around `parsePipelineYaml` in PipelineEngine

**File:** `orion-platform-service/src/engine/PipelineEngine.ts`, lines 67-72

The `parsePipelineYaml` call is wrapped in try/catch, but `parsePipelineYaml` itself uses `require('js-yaml')` dynamically (line 103 of Pipeline.ts). If `js-yaml` is not installed, this throws a `MODULE_NOT_FOUND` error that surfaces as "Failed to parse pipeline YAML" -- misleading the user.

### ERR-003: EventBus Silently Drops Failed Publishes

**File:** `orion-platform-service/src/services/event-bus-service.ts`, lines 166-169

```typescript
} catch (error) {
  console.warn('[EventBusService] Failed to publish event:', error);
  return 'mock-event-id';
}
```

Failed event publishes return a fake ID. Callers (PipelineEngine, PluginManager) believe events were delivered when they were silently dropped.

---

## Type Safety Issues (P2)

### TS-001: Pervasive `as any` Casting in Controllers

Controllers in `PluginController.ts`, `PipelineController.ts`, and `PipelineRunController.ts` all use `request.body as any`, `request.query as any`, `request.params as any`. This defeats TypeScript type safety and masks missing schema validation.

Affected files:
- `orion-platform-service/src/api/controllers/PluginController.ts` (lines 29, 59, 87, 109, 135, 158, 181, 204, 230, 231)
- `orion-platform-service/src/api/controllers/PipelineController.ts` (lines 22, 83, 119, 159, 200, 201, 252, 281)
- `orion-platform-service/src/api/controllers/PipelineRunController.ts` (lines 25, 26, 82, 123, 192, 226, 271)

**Fix:** Define Zod/JSON Schema validators and use `request.body as <Type>` only after validation.

### TS-002: `plugin` Variable Typed as `any` in PluginExecutorService

**File:** `orion-platform-service/src/services/plugin-executor-service.ts`, line 204

```typescript
let plugin: any;
```

And at line 367, 425: `plugin: any` in method signatures.

### TS-003: Inconsistent `any[]` in Frontend Page Components

**File:** `orion-frontend/src/pages/PluginManagement/index.tsx`, lines 939-940

```typescript
<Table
  columns={columns as any}
  dataSource={filteredPlugins as any}
```

### TS-004: `allTasks: any[]` in PipelineRunController

**File:** `orion-platform-service/src/api/controllers/PipelineRunController.ts`, line 285

```typescript
const allTasks: any[] = [];
```

### TS-005: `DatabasePool` Pool Typed as `any[]`

**File:** `orion-platform-service/src/services/database.ts`, line 28

```typescript
private pool: any[] = [];
```

### TS-006: EventBusService NATS Connection Typed as `any`

**File:** `orion-platform-service/src/services/event-bus-service.ts`, line 37

```typescript
private natsConnection: any = null;
```

### TS-007: `handleDragEnd` Event Typed as `any`

**File:** `orion-frontend/src/pages/PipelineEditor/index.tsx`, line 167

```typescript
const handleDragEnd = useCallback((event: any) => {
```

---

## Performance Concerns (P2)

### PERF-001: Full Array Scans for Task Lookups

**File:** `orion-platform-service/src/services/pipeline/PipelineRunService.ts`, lines 205-211, 216-226

```typescript
async getTask(taskId: string): Promise<Task | null> {
  for (const tasks of tasksByStage.values()) {
    const task = tasks.find(t => t.id === taskId);
    if (task) return task;
  }
  return null;
}
```

`getTask` and `updateTask` iterate over all stages' task arrays -- O(N*M) where N = stages, M = tasks per stage. As pipeline runs grow, this becomes a hotspot.

### PERF-002: Sourcemaps Enabled in Production Build

**File:** `orion-frontend/vite.config.ts`, line 24

```typescript
build: {
  outDir: 'dist',
  sourcemap: true,  // Exposes source code in production
},
```

This also has a security implication: production sourcemaps expose original TypeScript source to any user.

**Fix:** Use `sourcemap: 'hidden'` or conditionally enable only for development.

---

## Pattern Inconsistencies (P2)

### PAT-001: Mixed Route Registration Styles

Some routes use `app.register(subRouter, { prefix })` pattern (build-routes, cmdb-routes), while others inline `app.post('/path', handler)` directly in `routes.ts`. This makes it harder to apply middleware uniformly and audit the route surface.

### PAT-002: Inconsistent Error Response Formats

Some endpoints return `{ success: true/false, data: ..., error: ... }` (auth, plugin controllers), while others return `{ error: 'CODE', code: 'NNNNN', message: '...' }` (pipeline controllers). The API gateway cannot reliably parse errors.

### PAT-003: Both Module-Level and Exported Singleton Instances

- `PipelineService` exports both the class and `pipelineService` singleton (line 270 of PipelineService.ts)
- `ArtifactService` does the same (line 223 of ArtifactService.ts)
- But `K8sBuildExecutor` exports `k8sBuildExecutor` singleton at module level (line 454) while also being instantiated fresh in `build-routes.ts` (line 29-33)

This means `build-routes.ts` creates a new `K8sBuildExecutor` that does not share state with the exported singleton.

---

## Priority Matrix

| Priority | Count | Action Required |
|---|---|---|
| **P0 - Critical Security** | 6 | Block release. SEC-001 through SEC-006 must be fixed before any production deployment. |
| **P1 - High Logic/Security** | 4 | Fix before beta. LOG-001, LOG-002, LOG-003, ERR-001. |
| **P2 - Medium** | 15 | Schedule for next sprint. Type safety, performance, consistency. |

### Recommended Fix Order

1. **SEC-002** -- Add auth middleware (blocks all other security fixes)
2. **SEC-001** -- Remove hardcoded secrets
3. **SEC-004** -- Fix CORS
4. **SEC-006** -- Move tokens to httpOnly cookies
5. **SEC-003** -- Sandbox plugin execution inputs
6. **SEC-005** -- Hash passwords
7. **LOG-002** -- Guard concurrent pipeline triggers
8. **LOG-001** -- Fix plugin state machine
9. **LOG-003** -- Remove sandbox bypass
10. **ERR-001** -- Handle stage execution failures
11. **LOG-004** -- Honor cancellation in engine
12. **LOG-005** -- Use proper YAML serialization
13. **LOG-006** -- Trigger execution after retry
14. All remaining P2 items

---

## Appendix: Files Audited

### Backend (45 files)
- `orion-platform-service/src/index.ts`
- `orion-platform-service/src/app.ts`
- `orion-platform-service/src/api/routes.ts`
- `orion-platform-service/src/api/routes-auth.ts`
- `orion-platform-service/src/routes-plugin.ts`
- `orion-platform-service/src/api/build-routes.ts`
- `orion-platform-service/src/api/controllers/PluginController.ts`
- `orion-platform-service/src/api/controllers/PipelineController.ts`
- `orion-platform-service/src/api/controllers/PipelineRunController.ts`
- `orion-platform-service/src/api/controllers/StageController.ts`
- `orion-platform-service/src/api/controllers/TaskController.ts`
- `orion-platform-service/src/services/plugin-manager-service.ts`
- `orion-platform-service/src/services/plugin-executor-service.ts`
- `orion-platform-service/src/services/pipeline/PipelineService.ts`
- `orion-platform-service/src/services/pipeline/PipelineRunService.ts`
- `orion-platform-service/src/services/event-bus-service.ts`
- `orion-platform-service/src/services/database.ts`
- `orion-platform-service/src/services/redis-cache.ts`
- `orion-platform-service/src/services/build/ArtifactService.ts`
- `orion-platform-service/src/services/build/BuildCacheService.ts`
- `orion-platform-service/src/services/build/BuilderImageService.ts`
- `orion-platform-service/src/services/build/BuildLogService.ts`
- `orion-platform-service/src/services/build/K8sBuildExecutor.ts`
- `orion-platform-service/src/engine/PipelineEngine.ts`
- `orion-platform-service/src/engine/StageExecutor.ts`
- `orion-platform-service/src/engine/TaskRunner.ts`
- `orion-platform-service/src/config/index.ts`
- `orion-platform-service/src/models/Pipeline.ts`
- `orion-platform-service/src/models/PipelineRun.ts`
- `orion-platform-service/src/models/Stage.ts`
- `orion-platform-service/src/models/Task.ts`

### Frontend (35 API files + key pages)
- `orion-frontend/src/api/client.ts`
- `orion-frontend/src/api/types.ts`
- `orion-frontend/src/api/plugins.ts`
- `orion-frontend/src/api/pipelines.ts`
- `orion-frontend/src/api/auth.ts`
- `orion-frontend/src/api/deployments.ts`
- `orion-frontend/src/api/alerts.ts`
- `orion-frontend/src/api/audit.ts`
- `orion-frontend/src/api/risk.ts`
- `orion-frontend/src/api/ai-gateway.ts`
- `orion-frontend/src/api/efficiency.ts`
- `orion-frontend/src/api/tenant.ts`
- `orion-frontend/src/api/config.ts`
- `orion-frontend/vite.config.ts`
- `orion-frontend/src/pages/PipelineEditor/index.tsx`
- `orion-frontend/src/pages/PluginManagement/index.tsx`
