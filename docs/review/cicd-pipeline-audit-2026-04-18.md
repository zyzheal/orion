# CI/CD Pipeline Engine Audit Report

**Date**: 2026-04-18
**Scope**: Pipeline Engine module (backend + frontend)
**Method**: Design doc comparison vs. actual code audit

---

## Executive Summary

| Sub-Module | Completion | Verdict |
|---|---|---|
| PipelineEngine (orchestration) | 55% | Functional skeleton, all executors mocked |
| StageExecutor | 60% | Sequential task execution with timeout, but no parallelism |
| TaskRunner | 15% | Every task type returns fake data; zero real execution |
| PipelineService (CRUD) | 75% | Full CRUD + validation, but in-memory Map only |
| PipelineRunService | 70% | Full lifecycle API, but in-memory Map; cancel does not stop in-flight work |
| Controllers (4) | 80% | 18 endpoints registered, all have try/catch, proper error codes |
| PipelineEventPublisher | 40% | Correct event types, but eventBus is null by default; all publishes are skipped |
| Saga / PipelineSaga | 35% | Definition exists but executeStages step is a hard-coded mock (sets all stages SUCCESS instantly) |
| SagaCoordinator | 60% | Generic saga engine works, but not wired into PipelineEngine's hot path |
| PipelineEventListener | 50% | Code exists, not instantiated anywhere at startup |
| Frontend: PipelineList | 70% | Table with filters works, but calls `getPipelineRuns()` with no args and expects fields (`name`, `branch`, `author`) that the backend never returns |
| Frontend: PipelineDetail | 55% | Stage timeline + log viewer exist, falls back to mockData on API error, no real-time updates |
| Frontend: PipelineEditor | 85% | Drag-and-drop reorder, YAML preview Drawer, Stage CRUD all present; strongest frontend component |
| Frontend: Routes | 100% | All 5 pipeline routes registered (`/pipelines`, `/pipelines/:id`, `/pipelines/new`, `/pipelines/edit/:id`) |
| **Overall Pipeline Module** | **~48%** | **Skeleton complete, real execution absent** |

---

## Detailed Feature Audit Matrix

| # | Design Doc Feature | Backend Status | Frontend Status | Gaps |
|---|---|---|---|---|
| 1 | Pipeline YAML definition & parsing | DONE - `parsePipelineYaml()` in Pipeline.ts uses js-yaml | DONE - Editor generates YAML, preview Drawer | YAML schema validation limited to stage names + cycle check |
| 2 | Pipeline CRUD (create/read/update/delete) | DONE - PipelineService with Map storage | PARTIAL - Editor calls real API; List page calls `getPipelineRuns()` (runs, not pipelines) | No list page calls `getPipelines()`, so the list view shows run data labeled as "pipelines" |
| 3 | Pipeline YAML validation API | DONE - POST `/pipelines/validate` | NOT USED - Editor generates YAML but never calls validate endpoint before save | Missed pre-save validation opportunity |
| 4 | Pipeline version tracking | DONE - `getVersions()` in service + route | NOT IMPLEMENTED - no UI for version list | Missing frontend page |
| 5 | Pipeline execution (trigger) | DONE - POST `/pipelines/:id/runs` triggers engine | PARTIAL - `triggerPipeline()` in API client exists, but no UI button to trigger from list/detail | PipelineList "Retry" button is disabled and has no handler |
| 6 | Stage orchestration with dependencies | DONE - DAG evaluation in `checkNextStages()` | DONE - Editor configures `dependsOn`, Detail shows linear timeline | No parallel Stage execution (stages run sequentially via `for...of`) |
| 7 | Stage conditional execution (`if`) | PARTIAL - `evaluateCondition()` only handles `==` operator | DONE - Editor does not expose condition expression UI | Only simple equality checks supported; no `!=`, `&&`, `\|\|`, regex |
| 8 | Stage timeout | DONE - Stage has `timeoutSeconds`, but timeout is set per-task in StageExecutor (line 63-64), not per-stage | NOT VISIBLE - Detail page shows duration but no timeout indicator | Stage-level timeout defined in model but not enforced; only task-level timeout works |
| 9 | Stage retry | DONE - `retryStage()` in engine + POST `/stages/:id/retry` | NOT IMPLEMENTED - no retry button in Detail page | Retry API exists but not connected to UI |
| 10 | Task execution (real) | MOCKED - TaskRunner has 5 task type handlers, all return fake data via `sleep()` | NOT APPLICABLE | Git/Npm/K8s/Shell/Mock tasks all simulated with hardcoded results |
| 11 | Task timeout | DONE - `Promise.race` with setTimeout in StageExecutor:63 | NOT VISIBLE | Timeout works, but does not cancel underlying async operation (leak) |
| 12 | Task retry | DONE - `canRetryTask()`, POST `/tasks/:id/retry` | NOT IMPLEMENTED - no retry button | API exists, no UI |
| 13 | Task log streaming | PARTIAL - Logs stored as string in Task model, GET `/tasks/:id/log` returns static string | PARTIAL - Detail page shows logs from mock data, no streaming | No WebSocket/SSE endpoint for live log streaming |
| 14 | PipelineRun cancel | PARTIAL - `cancelRun()` in service only updates status to CANCELLED | PARTIAL - API client has `cancelPipelineRun()`, no UI button | Cancel does NOT stop in-flight stages/tasks; just changes status |
| 15 | PipelineRun list with filters | DONE - `listRuns()` with status/triggerType/pipelineId filters | PARTIAL - PipelineList calls `getPipelineRuns()` with no filter params | Backend field names differ from frontend expectations |
| 16 | PipelineRun detail (stages + tasks) | DONE - `getRunDetail()` aggregates run+stages+tasks | DONE - Detail page renders stages/steps | |
| 17 | Event publishing (NATS JetStream) | PARTIAL - EventPublisher code correct, but `eventBus` defaults to `null`, so all events are `console.log`-only | NOT APPLICABLE | NATS integration never wired up; `EventBusService` not started in `index.ts` |
| 18 | Event subscription (EventListener) | CODE EXISTS - PipelineEventListener not instantiated at startup | NOT APPLICABLE | Dead code without external consumer |
| 19 | Saga distributed transaction | PARTIAL - PipelineSaga definition exists, but `executeStages` step is a 1-line mock (sets all stages SUCCESS, `durationMs: 1000`) | NOT APPLICABLE | Saga is never invoked by PipelineEngine; engine has its own direct execution path |
| 20 | Saga idempotency | DONE - IdempotencyChecker with Redis fallback to Map | NOT APPLICABLE | |
| 21 | Saga transaction logging | DONE - TransactionLog with in-memory storage | NOT APPLICABLE | |
| 22 | Build cache (per-stage) | MODEL ONLY - `cache` field in PipelineStage model; no backend service | PARTIAL - StageModal has cache config UI; API client has save/restore/delete endpoints | Backend has no cache service implementation |
| 23 | Artifact management | MODEL ONLY - `artifacts` field in PipelineStage | PARTIAL - StageModal has artifact UI; API client has upload/download/list/delete | Backend has no artifact service |
| 24 | Real-time execution status | NOT IMPLEMENTED | PARTIAL - WebSocket infrastructure exists (`ws-client.ts`, `useWebSocket`, `webSocketStore`) but not connected to pipeline events | No SSE/WebSocket endpoint for pipeline status |
| 25 | Schedule trigger | MODEL ONLY - `TriggerType.SCHEDULE` enum exists | NOT IMPLEMENTED | No cron scheduler, no `/pipelines/:id/schedules` endpoint |
| 26 | Git webhook trigger | NOT IMPLEMENTED | NOT IMPLEMENTED | No webhook receiver, no code-repo integration for pipeline |
| 27 | Pipeline concurrency control | NOT IMPLEMENTED | NOT APPLICABLE | No limit on concurrent runs |
| 28 | Environment variables / secrets | MODEL ONLY - `config` field on Task | PARTIAL - StageModal has env var textarea | No secret vault integration |
| 29 | Pipeline approval gate | NOT IMPLEMENTED | NOT IMPLEMENTED | No manual approval stage type |

---

## All Mock / Simulated Implementations

### Backend Mocks

| Location | Mock Description | Impact |
|---|---|---|
| `PipelineService.ts:17` | `pipelines = new Map<string, Pipeline>()` | All pipeline data lost on restart |
| `PipelineService.ts:18` | `pipelineVersions = new Map<string, Pipeline[]>()` | Version tracking in-memory only |
| `PipelineRunService.ts:23` | `pipelineRuns = new Map<string, PipelineRun>()` | All run data lost on restart |
| `PipelineRunService.ts:24` | `stagesByRun = new Map<string, Stage[]>()` | Stage data lost on restart |
| `PipelineRunService.ts:25` | `tasksByStage = new Map<string, Task[]>()` | Task data lost on restart |
| `TaskRunner.ts:79-94` | `executeGitTask()` - returns fake `commit: 'abc123'` after 100ms sleep | No real git operations |
| `TaskRunner.ts:100-113` | `executeNpmTask()` - returns fake `exitCode: 0, output: 'Build completed successfully'` after 200ms sleep | No real build |
| `TaskRunner.ts:119-134` | `executeK8sTask()` - returns fake `status: 'completed'` after 300ms sleep | No real K8s operations |
| `TaskRunner.ts:140-153` | `executeShellTask()` - returns fake `exitCode: 0, stdout: 'Command executed successfully'` after 100ms sleep | No real shell execution |
| `TaskRunner.ts:159-170` | `executeMockTask()` - returns `{ simulated: true }` after 50ms sleep | Fallback for unknown types |
| `PipelineEventPublisher.ts:36` | `eventBus = null` by default | All `publish*()` methods log to console and return immediately (line 270-272) |
| `PipelineSaga.ts:247-258` | `executeStages` step: iterates stages, sets `status: SUCCESS`, `durationMs: 1000` instantly | Saga never actually runs the engine |
| `PipelineSaga.ts:85-87` | Own set of `Map` stores (duplicate, separate from PipelineRunService) | Data isolation between Saga and Engine paths |
| `SagaCoordinator.ts:94` | `runningTransactions = new Map<string, NodeJS.Timeout>()` | Transaction tracking in-memory |
| `TransactionLog.ts:77-79` | `InMemoryTransactionLogStorage` uses `Map` | Transaction logs not persisted |
| `IdempotencyChecker.ts:61-83` | `InMemoryStorage` fallback when Redis unavailable | Idempotency not durable across restarts |
| `StageExecutor.ts:63-64` | Task timeout uses `setTimeout` but does NOT abort underlying task promise | Resource leak on timeout |

### Frontend Mocks

| Location | Mock Description | Impact |
|---|---|---|
| `PipelineDetail/index.tsx:23` | Imports `mockPipelines` from `@/pages/__mocks__/mockData` | Falls back to mock data on API error (line 58, 63) |
| `PipelineList/index.tsx:39` | Calls `getPipelineRuns()` with no pipelineId - API expects `/v1/pipelines/${pipelineId}/runs` but is called without ID | The API function requires a `pipelineId` parameter but is invoked with zero args, so it fetches `/v1/pipelines/undefined/runs` which will 404 |
| `PipelineList/index.tsx:40` | Reads `response.data.data` expecting fields `name`, `branch`, `author`, `commit` | Backend PipelineRun API returns `pipelineId`, `status`, `triggerType` - field names do not match |
| `PipelineDetail/index.tsx:56-58` | Reads `response.data.data` expecting `stages`, `runNumber`, `branch`, `commit` | Backend returns different structure: `{ run, stages, tasks }` with different field names |
| All pages | No real-time polling or WebSocket subscription for running pipelines | Users must manually refresh to see status changes |

---

## Frontend Component Richness Analysis

### What Exists

| Component | Features Present |
|---|---|
| **PipelineEditor** (index.tsx) | Drag-and-drop reorder (dnd-kit), add/edit/delete stages, dependency config, YAML generation + Drawer preview with copy, form validation, dependency cycle detection, cache config UI, artifact config UI, save to API |
| **StageItem** | Sortable card, type icon, timeout display, retry count display, dependency list display, cache indicator, artifact indicator, edit/delete buttons |
| **StageModal** | Stage name/type/timeout/retry/dependsOn config, script/command/image/env fields, cache enable+key+paths+restoreKeys, artifact paths+expiry, form validation |
| **PipelineList** | Table with 7 columns, SearchFilterBar (search + status/branch filters), StatusBadge, refresh button, create button, navigate to detail, relative time formatting |
| **PipelineDetail** | Info header with Descriptions, stage timeline visualization (colored circles + connector lines), stage detail cards with step list, log viewer tab with syntax highlighting, re-run button, back button, progress percentage |

### What Is Missing

| Missing Feature | Priority | Notes |
|---|---|---|
| Real-time status updates (WebSocket/SSE) | P0 | No live update of running pipeline status; requires manual refresh |
| Pipeline trigger button on list page | P1 | No "Run" button next to pipelines |
| Pipeline version list UI | P2 | Backend endpoint exists, no page |
| Log streaming (tail -f style) | P0 | Log viewer is static; no auto-scroll or live append |
| Cancel run button on detail page | P1 | API exists, no UI |
| Retry stage/task buttons on detail page | P2 | APIs exist, no UI |
| Schedule trigger configuration UI | P2 | No cron UI, no backend support |
| Approval gate UI | P2 | Not designed yet |
| Artifact download from detail page | P2 | API client has endpoint, no UI |
| Pipeline comparison (diff between versions) | P3 | Not implemented |
| Execution graph visualization (DAG view) | P2 | Timeline is linear, does not show parallel branches |
| Filter by pipeline name on list page | P1 | Current filter only shows status/branch, not pipeline name |
| Export run results | P3 | Not implemented |

---

## Logic Bugs (with File:Line References)

### BUG-1: Stage timeout does not cancel underlying task (resource leak)
- **File**: `orion-platform-service/src/engine/StageExecutor.ts:63-71`
- **Issue**: `Promise.race` between `executePromise` and `timeoutPromise`. When timeout fires, the `reject` happens but `taskRunner.run()` continues executing in the background. The underlying task is never cancelled.
- **Impact**: Zombie tasks consume resources indefinitely.

### BUG-2: cancelRun does not stop in-flight stages or tasks
- **File**: `orion-platform-service/src/services/pipeline/PipelineRunService.ts:132-144`
- **Issue**: `cancelRun()` only updates the PipelineRun status to `CANCELLED`. It does not signal the `PipelineEngine` to abort running stages, nor does it clear the execution context from `executions` Map.
- **Impact**: A "cancelled" pipeline continues running until natural completion.

### BUG-3: PipelineEngine execution context is never cleaned up on cancel
- **File**: `orion-platform-service/src/engine/PipelineEngine.ts:36`
- **Issue**: The `executions` Map entry is only deleted in `checkRunCompletion()` (line 311). If a run is cancelled via `cancelRun()`, the engine's execution context persists indefinitely.

### BUG-4: PipelineEngine runs stages sequentially, not respecting parallelism
- **File**: `orion-platform-service/src/engine/PipelineEngine.ts:156`
- **Issue**: `executePendingStages()` uses `for (const stageId of stagesToExecute)` with `this.executeStage(...).catch(...)` for each. While it fires all pending stages without awaiting, the function is `async` and the loop itself does not prevent sequential execution of dependent stages. The parallelism only works for stages with no dependencies. Stages with the same dependency set that could run in parallel will be launched, but error handling via `.catch()` means failures are silently swallowed.

### BUG-5: failDependentStages does not await service calls
- **File**: `orion-platform-service/src/engine/PipelineEngine.ts:356-357`
- **Issue**: `this.runService.updateStage(skippedStage)` and `this.eventPublisher.publishStageSkipped(...)` are called without `await`. These are async operations that may not complete before the function returns.

### BUG-6: checkNextStages called synchronously but invokes async executePendingStages
- **File**: `orion-platform-service/src/engine/PipelineEngine.ts:286`
- **Issue**: `this.executePendingStages(execution)` returns a Promise but is not awaited. Errors from newly triggered stages will be unhandled.

### BUG-7: PipelineSaga has its own separate in-memory storage
- **File**: `orion-platform-service/src/saga/PipelineSaga.ts:85-87`
- **Issue**: PipelineSaga defines `pipelineRuns`, `stagesByRun`, `tasksByStage` Maps that are separate from PipelineRunService's Maps. If the Saga path is used, data is isolated from the Engine path, causing inconsistency.

### BUG-8: PipelineSaga executeStages step is a hard-coded mock
- **File**: `orion-platform-service/src/saga/PipelineSaga.ts:247-258`
- **Issue**: The step sets every stage to `SUCCESS` with `durationMs: 1000` instantly. It does not call `StageExecutor` or `PipelineEngine`. This makes the entire saga flow a no-op for actual execution.

### BUG-9: Event publisher defaults to null eventBus
- **File**: `orion-platform-service/src/events/PipelineEventPublisher.ts:36, 270-272`
- **Issue**: `this.eventBus` is `null` by default. All `publish*()` methods check `if (!this.eventBus)` and return early with a console.log. Events are never actually published unless `setEventBus()` is called.

### BUG-10: Frontend PipelineList calls API with wrong parameters
- **File**: `orion-frontend/src/pages/PipelineList/index.tsx:39`
- **Issue**: `getPipelineRuns()` requires a `pipelineId: string` parameter (per `pipelines.ts:144`), but is called with zero arguments. This produces `/v1/pipelines/undefined/runs`.

### BUG-11: Frontend/Backend field name mismatch
- **File**: `orion-frontend/src/pages/PipelineList/index.tsx:59-64` vs `orion-platform-service/src/api/controllers/PipelineRunController.ts:93-105`
- **Issue**: Frontend expects `pipeline.name`, `pipeline.branch`, `pipeline.author`. Backend returns `pipelineId`, `status`, `triggerType`, `triggerBy`. The list page will render all undefined values.

### BUG-12: Frontend PipelineDetail expects wrong response shape
- **File**: `orion-frontend/src/pages/PipelineDetail/index.tsx:56-58` vs `orion-platform-service/src/api/controllers/PipelineRunController.ts:137-176`
- **Issue**: Frontend expects `response.data.data` to be a flat object with `name`, `runNumber`, `branch`, `commit`, `stages`. Backend returns `{ run: {...}, stages: [...], tasks: [...] }` with different field names.

### BUG-13: YAML preview in Editor uses non-standard format
- **File**: `orion-frontend/src/pages/PipelineEditor/index.tsx:127-162`
- **Issue**: Generated YAML uses `type`, `timeout`, `retryCount` as stage fields, but the backend parser (`parsePipelineYaml`) expects `uses` (with `@` syntax) in `steps` array, and `timeout`/`retries` at stage level. The frontend's YAML format is incompatible with the backend's parser.

### BUG-14: evaluateCondition only supports `==`
- **File**: `orion-platform-service/src/engine/PipelineEngine.ts:381`
- **Issue**: Regex `/^(\S+)\s*==\s*'([^']+)'$/` only matches equality. Any other expression (like `!=`, `&&`, `>`) falls through to `return true` (line 397), effectively bypassing the condition.

---

## Architecture Issues

| # | Issue | Severity | Description |
|---|---|---|---|
| A1 | All storage is in-memory | CRITICAL | `Map()` used everywhere. Zero data persistence. All pipelines, runs, stages, tasks, saga logs, and idempotency records are lost on restart. |
| A2 | No WebSocket for real-time logs | HIGH | Design docs specify event-driven architecture with NATS JetStream, but NATS is never connected. Frontend has WebSocket infrastructure (`ws-client.ts`) but it is not subscribed to pipeline events. |
| A3 | No connection to real build executors | CRITICAL | TaskRunner simulates all task types. No Docker/K8s pod creation, no shell execution, no git operations. The entire execution engine is a mock. |
| A4 | PipelineEngine and PipelineSaga are disconnected | HIGH | Two separate execution paths exist (Engine direct path vs. Saga path), but they are not integrated. The Saga is never called by the Engine, and the Engine does not use Saga's transaction guarantees. |
| A5 | No NATS/EventBus startup | HIGH | `EventBusService` is passed to `apiRoutes()` but never actually started in `index.ts`. The event bus is never connected to NATS. |
| A6 | No schedule/cron trigger implementation | MEDIUM | `TriggerType.SCHEDULE` exists in the model, but there is no cron scheduler, no queue, no `/schedules` endpoint. |
| A7 | No webhook receiver for Git triggers | MEDIUM | Design docs describe webhook flow (GitLab -> Orion -> Pipeline trigger), but no webhook endpoint exists. |
| A8 | No concurrency control for pipeline runs | MEDIUM | No limit on how many pipelines can run simultaneously. No queue or semaphore. |
| A9 | Frontend/Backend API contract mismatch | HIGH | Multiple endpoints return field names that differ from what the frontend expects. This is not just a mock issue -- even with a real database, the data mapping would be wrong. |
| A10 | No health check on NATS connection | MEDIUM | Event publisher logs "Event Bus not connected" but never attempts reconnection or alerts. |
| A11 | PipelineEditor YAML format incompatible with backend parser | HIGH | The editor generates YAML with `type`, `timeout`, `retryCount` per stage, but the backend expects `steps` with `uses` syntax (`git/checkout@v1`). Saving from the editor would fail YAML validation on the backend. |
| A12 | No secret/credential management | MEDIUM | No integration with Vault or any secret store. Environment variables are plaintext. |

---

## API Route Coverage

### Registered Pipeline Routes (18 total)

| Method | Path | Handler | Status |
|---|---|---|---|
| POST | `/api/v1/pipelines` | PipelineController.create | Implemented |
| GET | `/api/v1/pipelines` | PipelineController.list | Implemented |
| GET | `/api/v1/pipelines/:id` | PipelineController.getById | Implemented |
| GET | `/api/v1/pipelines/:id/versions` | PipelineController.getVersions | Implemented |
| PUT | `/api/v1/pipelines/:id` | PipelineController.update | Implemented |
| DELETE | `/api/v1/pipelines/:id` | PipelineController.delete | Implemented |
| POST | `/api/v1/pipelines/validate` | PipelineController.validate | Implemented |
| POST | `/api/v1/pipelines/:id/runs` | PipelineRunController.trigger | Implemented |
| GET | `/api/v1/pipeline-runs` | PipelineRunController.list | Implemented |
| GET | `/api/v1/pipeline-runs/:id` | PipelineRunController.getById | Implemented |
| POST | `/api/v1/pipeline-runs/:id/cancel` | PipelineRunController.cancel | Implemented |
| GET | `/api/v1/pipeline-runs/:id/stages` | PipelineRunController.getStages | Implemented |
| GET | `/api/v1/pipeline-runs/:id/tasks` | PipelineRunController.getTasks | Implemented |
| GET | `/api/v1/stages/:id` | StageController.getById | Implemented |
| GET | `/api/v1/stages/:id/tasks` | StageController.getTasks | Implemented |
| POST | `/api/v1/stages/:id/retry` | StageController.retry | Implemented |
| GET | `/api/v1/tasks/:id` | TaskController.getById | Implemented |
| GET | `/api/v1/tasks/:id/log` | TaskController.getLog | Implemented |
| POST | `/api/v1/tasks/:id/retry` | TaskController.retry | Implemented |

### Missing Endpoints (per design docs)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/pipelines/:id/schedules` | Create schedule trigger |
| GET | `/api/v1/pipelines/:id/schedules` | List schedules |
| DELETE | `/api/v1/pipelines/:id/schedules/:sid` | Delete schedule |
| POST | `/api/v1/webhooks/:adapter` | Receive Git webhook |
| GET | `/api/v1/pipeline-runs/:id/logs` | Stream run logs (SSE) |
| GET | `/api/v1/pipeline-runs/:id/events` | Stream execution events (SSE) |
| POST | `/api/v1/pipeline-runs/:id/retry` | Retry entire run |
| GET | `/api/v1/pipelines/:id/runs` | List runs for a pipeline |
| GET | `/api/v1/caches` | List caches (API client references it) |
| GET | `/api/v1/artifacts` | List artifacts (API client references it) |

---

## Prioritized Gap List

### P0 (Critical - blocks production readiness)

1. **Replace all in-memory Map storage with database** - Every data structure (pipelines, runs, stages, tasks, saga logs, idempotency records) uses `Map()`. Nothing survives a restart.
2. **Implement real task executors** - TaskRunner must actually execute git commands, shell scripts, npm builds, and K8s deployments instead of returning fake data.
3. **Wire up NATS EventBus** - EventPublisher's `eventBus` is null. NATS JetStream must be connected for event-driven architecture.
4. **Fix frontend/backend API contract mismatches** - PipelineList, PipelineDetail, and PipelineEditor all expect different field names than what the backend returns. Even with a real DB, the UI would be blank.
5. **Fix PipelineEditor YAML format to match backend parser** - Editor generates incompatible YAML that would fail validation on save.

### P1 (High - significant functional gaps)

6. **Implement WebSocket/SSE for real-time log streaming** - Running pipelines have no way to show live progress to users.
7. **Implement cancelRun to actually stop in-flight work** - Current cancel only changes status; stages and tasks continue running.
8. **Add task cancellation on timeout** - Task timeout should abort the underlying async operation, not just resolve the race.
9. **Integrate Saga with PipelineEngine** - Either use Saga for transaction guarantees or remove it. Currently both exist but are disconnected.
10. **Add Pipeline trigger UI** - No "Run" button on PipelineList or PipelineDetail pages.
11. **Add missing API endpoints** - Schedule CRUD, webhook receiver, retry run, list runs per pipeline, log streaming.
12. **Add `await` to fire-and-forget async calls in PipelineEngine** - Lines 356-357 and 286 have unhandled promises.

### P2 (Medium - nice-to-have)

13. **Add Pipeline version list UI** - Backend endpoint exists.
14. **Add Stage/Task retry buttons on Detail page** - APIs exist.
15. **Implement schedule/cron trigger backend** - Model exists, no scheduler.
16. **Implement approval gate stage type** - Not designed yet.
17. **Add DAG visualization to PipelineDetail** - Current timeline is linear, does not show parallel branches.
18. **Add condition expression UI in PipelineEditor** - Only `==` supported in backend.
19. **Implement build cache service** - Model and UI exist, no backend.
20. **Implement artifact storage service** - Model and UI exist, no backend.
21. **Add secret/credential management** - No Vault integration.
22. **Add concurrency control for pipeline runs** - No run limits.
