# Pipeline Engine Production Readiness Gap Report

- **Date**: 2026-05-08
- **Author**: SRE Review
- **Scope**: `src/engine/`, `src/services/pipeline/`, `src/saga/`, `src/events/`, `src/services/plugin-executor-service.ts`, `src/services/guardian/`, `src/services/plugin/`
- **Purpose**: Evaluate the pipeline execution engine for production readiness across 8 dimensions

---

## Executive Summary

The pipeline engine has substantial scaffolding (retry logic, error classification, budget tracking, sandbox isolation, Saga compensation). However, **the core engine (`PipelineEngine.ts`) is fundamentally not production-ready** for the following reasons:

1. All in-flight execution state is held in a plain `Map<string, PipelineExecution>` (line 39 of PipelineEngine.ts). A server restart loses all running pipelines with no recovery mechanism.
2. There is no global execution queue -- concurrent pipelines run uncontrolled, bounded only by the Node.js event loop.
3. The `TaskRunner.ts` mock-implements git/npm/k8s/shell tasks (sleep + stub return). Only `plugin/` and `inline-script/` types have real execution paths.
4. The Saga subsystem uses `InMemoryTransactionLogStorage` by default -- not durable.

Below is the detailed finding-by-finding breakdown.

---

## 1. Scalability

### GAP-S-01: No Global Concurrency Queue

| Field | Value |
|---|---|
| **Severity** | **CRITICAL** |
| **File** | `src/engine/PipelineEngine.ts:39` |
| **Description** | `PipelineEngine.execute()` immediately launches stages without any queue or back-pressure. 1000 concurrent pipeline runs will each consume memory for their `PipelineExecution` object (stages, tasks, state sets) plus any Docker/child_process they spawn. There is no mechanism to throttle, prioritize, or reject incoming runs. |
| **Recommended Fix** | Introduce a global `ExecutionQueue` backed by PostgreSQL (persistent) or Redis (fast). Implement configurable `maxConcurrentRuns` (global), `maxConcurrentRunsPerTenant`, and a priority field. Use a worker-pool pattern with `bullmq` or similar. |
| **Effort** | 5-8 days |

### GAP-S-02: In-Memory Execution State

| Field | Value |
|---|---|
| **Severity** | **CRITICAL** |
| **File** | `src/engine/PipelineEngine.ts:39` |
| **Description** | `private executions = new Map<string, PipelineExecution>()` holds all live pipeline state in process memory. At 100 concurrent runs, each with 5 stages and 10 tasks, the Map alone is manageable. But there is no persistence layer -- if the process crashes, all running state is lost and orphaned external resources (Docker containers, spawned processes) are never cleaned up. |
| **Recommended Fix** | Serialize execution state to PostgreSQL on every state transition. On startup, recover `RUNNING` runs from DB. Consider a dedicated `pipeline_executions` table with JSONB for the in-memory data structures. |
| **Effort** | 8-12 days |

### GAP-S-03: Event Bus Not Wired (NATS)

| Field | Value |
|---|---|
| **File** | `src/events/PipelineEventPublisher.ts:41` / `src/events/EventBusAdapter.ts:91` |
| **Severity** | **HIGH** |
| **Description** | `EventBusAdapter` constructor accepts `eventBus ?? null`. If NATS is not connected, events are silently dropped (returns `{ success: false, deliveryMode: 'disabled' }`). Downstream consumers (FinOps, monitoring, audit) get no pipeline events. The CLAUDE.md confirms: "No real EventBus integration: Event publishers exist but are not wired to NATS." |
| **Recommended Fix** | Ensure NATS JetStream is a startup dependency (health check at boot). Add circuit breaker pattern for event publishing with a local write-ahead log as fallback. Alert when event delivery rate drops below threshold. |
| **Effort** | 3-5 days |

### GAP-S-04: Plugin Resource Manager Global Quota Only

| Field | Value |
|---|---|
| **File** | `src/services/plugin/PluginResourceManager.ts:61-66` |
| **Severity** | **MEDIUM** |
| **Description** | Global quota is hardcoded to 8 CPU cores, 16GB memory, maxConcurrent 50. Per-tenant quota exists (defaultTenantQuota: 2 CPU, 4GB, maxConcurrent 10) but is not enforced in the main `allocateQuota` path -- it is only enforced via the separate `allocateQuotaForTenant` method which is not called by the `PluginExecutorService`. |
| **Recommended Fix** | Wire tenant context through `PluginExecutorService.executeTask` to call `allocateQuotaForTenant` instead of `allocateQuota`. Add dynamic quota adjustment based on system load. |
| **Effort** | 2-3 days |

---

## 2. Resilience (Server Restart Recovery)

### GAP-R-01: No Run Recovery on Restart

| Field | Value |
|---|---|
| **Severity** | **CRITICAL** |
| **File** | `src/engine/PipelineEngine.ts` (entire file), `src/saga/TransactionLog.ts:77` |
| **Description** | On process restart, `executions` Map is empty. All `RUNNING` pipeline_runs in PostgreSQL are left in a zombie state. There is no startup recovery routine to detect in-progress runs, determine which stages/tasks were running, and either resume or mark them as FAILED. The `TransactionLog` uses `InMemoryTransactionLogStorage` by default -- saga state is also lost. |
| **Recommended Fix** | 1. Implement `recoverRunningRuns()` method in `PipelineEngine` that queries `pipeline_runs WHERE status = 'running'` on startup. 2. For each recovered run, reconstruct stage/task state from DB. 3. Make `SagaCoordinator` use `DatabaseTransactionLogStorage` (implement it) instead of in-memory. 4. Add a `startupRecovery` lifecycle hook to the application bootstrap. |
| **Effort** | 8-12 days |

### GAP-R-02: Orphaned Docker Containers/Processes on Crash

| Field | Value |
|---|---|
| **File** | `src/services/plugin-executor-service.ts:766-791`, `src/services/guardian/ProcessKiller.ts` |
| **Severity** | **HIGH** |
| **Description** | When the process is killed (SIGKILL, OOM), `ExecutionGuardian.stop()` and `PluginExecutorService.shutdown()` are never called. Docker containers created with `--rm` will be cleaned up only if the Docker daemon detects the parent death, but containers created via `spawn(..., detached: true)` will orphan. The `ProcessKiller` tracks PIDs in memory -- they are lost on crash. |
| **Recommended Fix** | 1. Use Docker `--label orion-run-id=X` on all containers, add a startup cleanup routine that removes orphaned containers by label. 2. Use `pgid` process groups and register them with a PID file for crash recovery. 3. Ensure SIGTERM handler calls `shutdownAllExecutors()` with sufficient grace period. |
| **Effort** | 3-5 days |

### GAP-R-03: Saga Compensation is In-Memory

| Field | Value |
|---|---|
| **File** | `src/saga/SagaCompensationService.ts:96-97` |
| **Severity** | **HIGH** |
| **Description** | `SagaCompensationService` stores all compensation records in `Map<string, CompensationRecord>`. If the process crashes mid-compensation (during `executeFullCompensation`), the compensation state is lost and no further compensations will be executed. This can leave partial state (e.g., resources reserved but never released). |
| **Recommended Fix** | Persist compensation state to PostgreSQL. Implement a recovery routine on startup that finds incomplete compensations and re-executes them. |
| **Effort** | 5-7 days |

---

## 3. Resource Management

### GAP-Q-01: No Global Queue or Priority System

| Field | Value |
|---|---|
| **Severity** | **CRITICAL** |
| **File** | `src/engine/PipelineEngine.ts:56-119` |
| **Description** | `PipelineEngine.execute()` is called synchronously and immediately launches all eligible stages. There is no concept of queue, priority, fair scheduling, or rate limiting. A burst of 1000 triggered pipelines (e.g., webhook storm) will all start simultaneously, potentially overwhelming the system. |
| **Recommended Fix** | Implement a `PipelineQueue` service with: (a) configurable global concurrency limit, (b) per-tenant concurrency limits, (c) priority levels (critical > high > normal > low), (d) fair-share scheduling to prevent starvation, (e) back-pressure on the API layer when queue depth exceeds threshold. |
| **Effort** | 8-10 days |

### GAP-Q-02: Tenant Quota Not Enforced in Main Execution Path

| Field | Value |
|---|---|
| **File** | `src/services/plugin-executor-service.ts:305-341` |
| **Severity** | **MEDIUM** |
| **Description** | The `PluginExecutorService` calls `resourceManager.allocateQuota()` which checks only global quota. It does NOT check tenant quota. The tenant-aware `allocateQuotaForTenant()` exists but is never called from the execution path. The hardcoded `tenant_id` in `PipelineRunService.mapCreateInput` (line 74) is `'00000000-0000-0000-0000-000000000000'` -- a placeholder, not a real tenant. |
| **Recommended Fix** | 1. Thread real tenant context from API request through `PipelineEngine` to `PluginExecutorService`. 2. Replace `allocateQuota` with `allocateQuotaForTenant`. 3. Remove hardcoded default tenant ID. |
| **Effort** | 2-3 days |

### GAP-Q-03: No Priority-Based Stage Execution

| Field | Value |
|---|---|
| **File** | `src/engine/PipelineEngine.ts:159-187` |
| **Severity** | **LOW** |
| **Description** | `executePendingStages()` iterates through `pendingStages` in arbitrary Set iteration order. There is no priority mechanism for stages within a pipeline (e.g., critical security scan should run before long-running tests). |
| **Recommended Fix** | Add `priority` field to Stage model. Sort pending stages by priority before execution. |
| **Effort** | 1-2 days |

---

## 4. Error Handling

### GAP-E-01: Unhandled Promise Rejection in executeStage

| Field | Value |
|---|---|
| **Severity** | **HIGH** |
| **File** | `src/engine/PipelineEngine.ts:184` |
| **Description** | `this.executeStage(execution, stage).catch(error => { logger.error(...) })` catches the error but only logs it. The stage's running state is never cleaned up -- `runningStages` Set still contains the stage ID, `checkRunCompletion` will never consider this stage as completed, and the pipeline will hang indefinitely. |
| **Recommended Fix** | In the `.catch` handler, also: (1) remove stage from `runningStages`, (2) add to `completedStages`, (3) update stage status to FAILED in DB, (4) call `checkRunCompletion`. |
| **Effort** | 1 day |

### GAP-E-02: TaskRunner Mock Tasks Return Success

| Field | Value |
|---|---|
| **File** | `src/engine/TaskRunner.ts:101-172` |
| **Severity** | **CRITICAL** |
| **Description** | `executeGitTask`, `executeNpmTask`, `executeK8sTask`, `executeShellTask`, and `executeMockTask` all simulate execution with `this.sleep()` and return `{ exitCode: 0 }`. They do NOT actually run git commands, npm scripts, kubectl, or shell scripts. Unknown task types also succeed via `executeMockTask`. This means any pipeline using these task types will always appear to succeed. |
| **Recommended Fix** | Implement real execution for each task type using `child_process.spawn` (similar to how `executeProcessPlugin` works in `PluginExecutorService`). For K8s tasks, use the Kubernetes client. For git tasks, use `simple-git`. Add proper error handling for non-zero exit codes. |
| **Effort** | 8-12 days |

### GAP-E-03: Condition Expression Evaluation is Trivial

| Field | Value |
|---|---|
| **File** | `src/engine/PipelineEngine.ts:375-407` |
| **Severity** | **MEDIUM** |
| **Description** | `evaluateCondition()` only supports simple `==` comparisons with hardcoded context (`github.ref`). It cannot handle logical operators (`&&`, `||`), negation (`!`), variable interpolation, or arbitrary expressions. Complex conditions like `if: branch == 'main' && env.PROD == 'true'` will silently evaluate to `true` (default). |
| **Recommended Fix** | Use a proper expression parser (e.g., `expr-eval` or `jexl`) instead of regex matching. Sanitize expressions to prevent arbitrary code execution. |
| **Effort** | 2-3 days |

### GAP-E-04: ErrorClassifier Writes to DB but Fails Silently

| Field | Value |
|---|---|
| **File** | `src/services/pipeline/ErrorClassifier.ts:288-308` |
| **Severity** | **LOW** |
| **Description** | `saveClassification` catches DB errors and logs with `console.warn`, which does not propagate to the structured logger. If the `pipeline_error_classifications` table does not exist (no migration), all classifications silently fail. |
| **Recommended Fix** | Use `pino` logger instead of `console.warn`. Add table existence check or migration for the classification table. |
| **Effort** | 0.5 day |

---

## 5. Observability

### GAP-O-01: No Pipeline Metrics

| Field | Value |
|---|---|
| **Severity** | **HIGH** |
| **File** | N/A (missing entirely) |
| **Description** | There are no Prometheus/OpenTelemetry metrics for: pipeline throughput (runs/min), p50/p95/p99 duration, failure rate, concurrent run count, queue depth, resource utilization, error classification distribution. The `AutoRetryService.getRetryStats()` and `AdaptiveTimeoutService.getBaselineStats()` query the DB on-demand but do not export metrics to a monitoring system. |
| **Recommended Fix** | Integrate `prom-client` or OpenTelemetry. Export: `pipeline_runs_total` (counter), `pipeline_duration_seconds` (histogram), `pipeline_concurrent_runs` (gauge), `pipeline_failures_total` (counter, labeled by error_type), `pipeline_queue_depth` (gauge), `plugin_resource_usage` (gauge). Set up Grafana dashboards. |
| **Effort** | 3-5 days |

### GAP-O-02: No Distributed Tracing

| Field | Value |
|---|---|
| **File** | `src/events/types.ts:119-130` |
| **Severity** | **MEDIUM** |
| **Description** | `PipelineEventExtensions` includes `traceId` but it is never populated. There is no trace context propagation across pipeline stages, tasks, or external service calls (Docker, K8s, AI service). |
| **Recommended Fix** | Add OpenTelemetry tracing. Propagate `traceparent` header through all external calls. Add span for each stage/task execution. |
| **Effort** | 3-5 days |

### GAP-O-03: Structured Logging Inconsistent

| Field | Value |
|---|---|
| **File** | Multiple (across all files) |
| **Severity** | **LOW** |
| **Description** | Some files use `pino` (structured), others use `console.warn`/`console.error` (unstructured). `ErrorClassifier.ts` and `AdaptiveTimeoutService.ts` use `console.warn`/`console.error`. This breaks log aggregation and alerting. |
| **Recommended Fix** | Replace all `console.*` calls with `pino` logger instances. Standardize log format across all pipeline services. |
| **Effort** | 1-2 days |

---

## 6. Degradation (Dependency Failures)

### GAP-D-01: No Circuit Breaker for External Dependencies

| Field | Value |
|---|---|
| **Severity** | **HIGH** |
| **File** | `src/services/plugin-executor-service.ts:607-708`, `src/engine/TaskRunner.ts` |
| **Description** | When Docker daemon is down, `spawnDocker` calls fail with errors that are thrown but not differentiated from other errors. There is no circuit breaker, no health check, no fallback. A Docker outage will cause all container-based tasks to fail one by one without any bulkhead isolation. Same for K8s, AI service, and database connections. |
| **Recommended Fix** | Implement circuit breaker pattern (e.g., `opossum` library) for each external dependency. Add health check endpoints for Docker, K8s, DB, NATS. Fail fast when circuit is open. Add degradation mode: when Docker is down, reject container tasks at queue admission time rather than failing mid-execution. |
| **Effort** | 3-5 days |

### GAP-D-02: Database Failure During Pipeline Execution

| Field | Value |
|---|---|
| **File** | `src/services/pipeline/PipelineRunService.ts` (all methods) |
| **Severity** | **HIGH** |
| **Description** | Every state transition (stage start, stage complete, task update) writes to PostgreSQL. If the DB becomes unavailable mid-pipeline, the in-memory `executions` Map continues executing but cannot persist results. When DB recovers, there is no mechanism to replay the lost state transitions. The `PipelineRunService` silently returns `null` when `repository` methods fail (no retry, no circuit breaker). |
| **Recommended Fix** | 1. Add connection pool health monitoring. 2. Implement a write-ahead log (local file or Redis) as fallback storage. 3. Add state reconciliation on DB reconnection. 4. Add alerting on DB connection failures. |
| **Effort** | 5-7 days |

### GAP-D-03: NATS Unavailable - Events Lost Without Fallback

| Field | Value |
|---|---|
| **File** | `src/events/EventBusAdapter.ts:114-121` |
| **Severity** | **MEDIUM** |
| **Description** | When EventBus is not available, `publish()` returns `{ success: false, deliveryMode: 'disabled' }` without any retry or local buffering. Pipeline events (run started, stage completed, run failed) are silently lost. |
| **Recommended Fix** | Add local disk-based event buffer when NATS is down. Replay buffered events when connection is restored. Add `events.publish.failures_total` metric for alerting. |
| **Effort** | 2-3 days |

---

## 7. Capacity Planning

### GAP-C-01: No Per-Tenant Pipeline Run Rate Limiting

| Field | Value |
|---|---|
| **Severity** | **HIGH** |
| **File** | `src/engine/PipelineEngine.ts:56` (entry point) |
| **Description** | Any tenant can trigger unlimited pipeline runs. A single tenant with a misconfigured webhook (e.g., Git push to a branch that triggers on every commit) can flood the system. There is no rate limiting at the API layer or engine layer. |
| **Recommended Fix** | Add token-bucket rate limiter per tenant (e.g., max 50 runs/minute per tenant). Add configurable limits per pipeline. Add alerting when a tenant approaches their limit. |
| **Effort** | 2-3 days |

### GAP-C-02: No Storage Quota for Pipeline Logs

| Field | Value |
|---|---|
| **File** | `src/models/Task.ts` (log field) |
| **Severity** | **MEDIUM** |
| **Description** | Task logs are stored as strings in the domain model and persisted as TEXT in PostgreSQL. Long-running pipelines with verbose logging can produce gigabytes of log data per run. There is no log size limit, rotation, or retention policy. |
| **Recommended Fix** | 1. Add max log size per task (e.g., 10MB). 2. Implement log truncation when limit is reached. 3. Store logs in object storage (S3) for long-term retention. 4. Add configurable log retention period (e.g., 30 days). |
| **Effort** | 3-5 days |

### GAP-C-03: Budget Service Not Integrated into Execution

| Field | Value |
|---|---|
| **File** | `src/services/pipeline/PipelineBudgetService.ts` |
| **Severity** | **MEDIUM** |
| **Description** | `PipelineBudgetService` provides budget configuration, estimation, and usage tracking. However, `checkBudgetExceeded()` is never called by the pipeline engine during execution. Budget limits are not enforced -- a pipeline can exceed its time/cost/resource budget without being blocked or rolled back. |
| **Recommended Fix** | Integrate budget checks into the stage execution loop. Before starting each stage, call `checkBudgetExceeded()`. If exceeded with `policy: 'block'`, skip remaining stages. If `policy: 'rollback'`, trigger compensation. |
| **Recommended Fix** | Wire budget checks into stage execution. Add periodic budget polling during long-running stages. |
| **Effort** | 2-3 days |

---

## 8. Backup/Restore

### GAP-B-01: No Pipeline State Backup/Restore Procedure

| Field | Value |
|---|---|
| **Severity** | **HIGH** |
| **File** | N/A (missing entirely) |
| **Description** | There is no documented or automated backup/restore procedure for pipeline state. While PostgreSQL handles the database backup, the in-memory state (`executions` Map, `SagaCompensationService` maps, `PluginResourceManager` allocations) has no backup. After a restore, all in-flight pipelines would be lost. |
| **Recommended Fix** | 1. Persist all execution state to PostgreSQL (address GAP-S-02 and GAP-R-01). 2. Document disaster recovery runbook: backup DB, restore DB, recover in-flight runs. 3. Implement `pg_dump`/`pg_restore` integration for pipeline data. 4. Test restore procedure regularly. |
| **Effort** | 3-5 days (documentation + implementation of GAP-R-01) |

### GAP-B-02: No Data Export for Pipeline Run History

| Field | Value |
|---|---|
| **Severity** | **LOW** |
| **File** | `src/services/pipeline/PipelineRunRepository.ts:93-148` |
| **Description** | `findAll()` supports basic filtering but has no export capability (CSV, JSON, Parquet). Compliance or audit requirements may need bulk export of pipeline run history. |
| **Recommended Fix** | Add export endpoint with format selection (JSON, CSV). Add pagination for large exports. Consider async export for large datasets. |
| **Effort** | 2-3 days |

---

## Summary

### Severity Distribution

| Severity | Count |
|---|---|
| **CRITICAL** | 5 |
| **HIGH** | 11 |
| **MEDIUM** | 8 |
| **LOW** | 3 |
| **Total** | **27** |

### Recommended Priority Order

1. **Phase 1 (Weeks 1-2)**: Fix GAP-E-01 (unhandled rejection hang), GAP-R-01 (run recovery), GAP-S-02 (persist execution state), GAP-E-02 (real task execution)
2. **Phase 2 (Weeks 3-4)**: GAP-Q-01 (global queue), GAP-D-01 (circuit breakers), GAP-O-01 (metrics), GAP-C-01 (rate limiting)
3. **Phase 3 (Weeks 5-6)**: GAP-R-02 (orphan cleanup), GAP-R-03 (Saga persistence), GAP-D-02 (DB resilience), GAP-C-03 (budget enforcement)
4. **Phase 4 (Weeks 7-8)**: GAP-O-02 (tracing), GAP-B-01 (backup/restore), remaining MEDIUM/LOW gaps

### Overall Assessment

**NOT READY FOR PRODUCTION** at current state. The pipeline engine works as a demo/prototype for sequential pipeline execution with mock tasks. For production use (especially at 100+ concurrent runs), the critical gaps around resilience (no crash recovery), scalability (no queue), and correctness (mock task implementations) must be addressed first.
