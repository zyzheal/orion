# Pipeline Engine Capability Gap Analysis

**Date**: 2026-05-08
**Scope**: `/Users/heal/orion-design/orion-platform-service` — Pipeline execution engine
**Evaluated against**: GitHub Actions, Tekton, Jenkins, Argo Workflows

---

## Executive Summary

The pipeline engine has a solid foundation with YAML definitions, DAG-based stage execution, retry/error classification, SSE logging, plugin sandboxing, version management, and template support. However, several critical production-grade capabilities are missing or incomplete. The gaps below are ordered by category with evidence, impact, and priority.

---

## 1. Pipeline Definition & Configuration

### GAP 1.1: No Matrix Builds
- **Gap**: No ability to run the same stage/task with multiple input combinations (e.g., test on Node 18/20/22, Linux/Windows/macOS).
- **Evidence**: `PipelineStage` interface in `src/models/Pipeline.ts` has no `matrix` or `strategy` field. YAML parser `parsePipelineYaml()` does not handle matrix syntax. `PipelineEngine.executePendingStages()` has no matrix expansion logic.
- **Impact**: Teams must manually duplicate stages for each combination, leading to verbose, error-prone pipeline definitions. Industry standard feature present in GitHub Actions, GitLab CI, Azure Pipelines.
- **Priority**: P1
- **Complexity**: Medium

### GAP 1.2: No Pipeline Composition (Reusable Workflows / Composite Actions)
- **Gap**: Cannot call/reference other pipelines as sub-pipelines or reusable workflow units.
- **Evidence**: `PipelineTemplateService` supports parameterized template instantiation (`instantiateTemplate()`), but this is a one-time copy operation — it does not support runtime invocation of another pipeline as a callable unit. No `uses:` directive for pipeline-to-pipeline references in the YAML spec.
- **Impact**: Cannot build reusable CI/CD libraries (e.g., "standard deploy workflow", "security scan workflow"). Organizations end up copy-pasting pipeline definitions across repos.
- **Priority**: P1
- **Complexity**: High

### GAP 1.3: Conditional Expression Engine is Overly Simplistic
- **Gap**: Only supports `==` string equality checks. No `!=`, `contains()`, `startsWith()`, `&&`, `||`, `!` operators.
- **Evidence**: `PipelineEngine.evaluateCondition()` at line 390 only parses `/^(\S+)\s*==\s*'([^']+)'$/`. `DynamicParamsResolver.evaluateCondition()` supports `==` and `!=` but is only used for dynamic stage inclusion, not for runtime task conditions.
- **Impact**: Real-world pipelines need complex conditions like `github.ref == 'refs/heads/main' && github.event_name == 'push' && contains(files, 'package.json')`. Current implementation blocks these patterns.
- **Priority**: P1
- **Complexity**: Medium

### GAP 1.4: No Pipeline-Level Variables / Environment Blocks
- **Gap**: No `env:` block at pipeline or stage level for defining variables accessible to all downstream tasks.
- **Evidence**: `PipelineRunContext` exists but is only populated by trigger context (git ref, sha). No mechanism for users to define custom variables in YAML that propagate to all stages/tasks. `DynamicParamsResolver` handles `${params.*}` but only for template parameters, not arbitrary environment variables.
- **Impact**: Users cannot define shared configuration (e.g., `REGISTRY_URL`, `DEPLOY_ENV`) that all stages consume. Each task must re-specify values.
- **Priority**: P2
- **Complexity**: Low

---

## 2. Execution Engine

### GAP 2.1: No Parallel Stage Execution
- **Gap**: All stages execute sequentially regardless of dependency graph. Stages with no dependencies or independent dependency sets should run in parallel.
- **Evidence**: `PipelineEngine.executePendingStages()` (line 159) iterates stages one by one with `for...of` and calls `executeStage()` sequentially. Even though `checkNextStages()` unlocks stages after dependencies complete, the initial execution is strictly serial.
- **Impact**: Pipeline execution time is the sum of all stage durations instead of the critical path. For a pipeline with 5 independent 2-minute stages, total time is 10 minutes instead of 2 minutes. Critical for CI/CD performance.
- **Priority**: P0
- **Complexity**: Medium

### GAP 2.2: No Fan-Out/Fan-In Patterns
- **Gap**: Cannot express "run N stages in parallel, then wait for all to complete before proceeding."
- **Evidence**: Stage model supports `dependsOn: string[]`, which creates a basic DAG, but `PipelineEngine.executePendingStages()` does not parallelize stages that are all ready. `PipelineStage` in `PipelineRepository.ts` has a `parallel: boolean` field that is never used by the engine.
- **Impact**: Cannot express common CI patterns like "build on multiple platforms in parallel, then run integration tests after all complete."
- **Priority**: P1
- **Complexity**: Medium

### GAP 2.3: No Manual Approval Gates
- **Gap**: No ability to pause pipeline execution and wait for human approval before proceeding to a specific stage (e.g., deploy to production).
- **Evidence**: Stage model has no `approval` or `manual_gate` field. `PipelineEngine` has no `PAUSED_FOR_APPROVAL` state. `DebugController` supports pause/resume but is a developer debugging tool, not a production approval gate with user/role-based authorization.
- **Impact**: Production deployments cannot require human sign-off within the pipeline workflow. Teams must use external processes, breaking the pipeline's atomicity.
- **Priority**: P0
- **Complexity**: Medium

### GAP 2.4: No Rerun from Specific Stage
- **Gap**: Cannot re-execute a pipeline starting from an intermediate stage, skipping already-completed stages.
- **Evidence**: `PipelineService.retryRun()` (line 482) triggers a completely new run from stage 0. No API endpoint or engine method accepts `fromStage` parameter.
- **Impact**: After a late-stage failure (e.g., deploy stage fails after 10-minute build+test), the entire pipeline must re-run from scratch. Wastes time and resources. GitHub Actions and Jenkins both support this.
- **Priority**: P1
- **Complexity**: Medium

### GAP 2.5: No Pipeline Dry-Run / Validation Mode
- **Gap**: Cannot validate a pipeline definition without executing it.
- **Evidence**: `PipelineService.validate()` (line 508) performs basic YAML structure validation (apiVersion, kind, metadata, stages exist) and dependency name checking. It does NOT validate task types, parameter schemas, resource availability, or simulate execution flow.
- **Impact**: Errors are only discovered at runtime. Users cannot verify pipeline correctness before merging changes. Tekton has `tkn pipeline validate`, GitHub Actions has `actionlint`.
- **Priority**: P2
- **Complexity**: Medium

### GAP 2.6: Stage-Level Retry Uses Simple Retry, Not Error-Aware Retry
- **Gap**: `PipelineEngine.retryStage()` (line 331) increments retry count and resets to PENDING. It does NOT use the sophisticated `AutoRetryService` with error classification (transient vs permanent) during normal engine execution.
- **Evidence**: `PipelineEngine.shouldRetry()` (line 324) only checks `retryCount < maxRetries`. The `AutoRetryService` and `ErrorClassifier` exist as separate services but are NOT wired into the `PipelineEngine` execution path.
- **Impact**: Permanent errors (syntax errors, permission denied) are retried wastefully, consuming quota and time. The error classification infrastructure is built but unused in the hot path.
- **Priority**: P1
- **Complexity**: Low

### GAP 2.7: Cancellation Uses SKIPPED Instead of CANCELLED Status
- **Gap**: `PipelineEngine.cancelExecution()` (line 420) marks running and pending stages as `SKIPPED` rather than `CANCELLED`, making it impossible to distinguish user-cancelled runs from conditionally-skipped stages.
- **Evidence**: Line 430-432 in `PipelineEngine.ts` sets `status: StageStatus.SKIPPED` for cancelled stages. `StageStatus` enum has no `CANCELLED` value.
- **Impact**: Analytics, reporting, and user UI cannot distinguish between "user cancelled" and "condition not met". Misleading run history.
- **Priority**: P2
- **Complexity**: Low

---

## 3. State & Persistence

### GAP 3.1: In-Memory Execution State — Not Crash-Resilient
- **Gap**: Active pipeline executions are stored in `Map<string, PipelineExecution>` in `PipelineEngine`. If the process restarts, all in-progress runs are lost.
- **Evidence**: `PipelineEngine` line 39: `private executions = new Map<string, PipelineExecution>()`. No periodic state flush to database. No startup recovery logic.
- **Impact**: Server restart/deployment kills all running pipelines silently. Running builds, deployments, and data migrations are lost with no recovery path. Tekton and Argo Workflows store execution state in K8s CRDs, surviving pod restarts.
- **Priority**: P0
- **Complexity**: High

### GAP 3.2: No Artifact Passing Between Stages
- **Gap**: Stage outputs cannot be passed as inputs to downstream stages. No artifact upload/download mechanism.
- **Evidence**: `PipelineStage` model in `src/models/Pipeline.ts` has `artifacts?: { upload?: string[]; expiry?: number }` defined but never used. No `ArtifactService` integration in `PipelineEngine` or `StageExecutor`. No artifact storage backend.
- **Impact**: Cannot implement "build artifact in stage A, deploy artifact in stage B" or "generate test report in stage A, publish in stage B". Critical CI/CD pattern.
- **Priority**: P0
- **Complexity**: High

### GAP 3.3: No Workspace / Shared Directory Between Stages
- **Gap**: Each stage runs in isolation with no shared filesystem. Cannot build in one stage and use the output in another.
- **Evidence**: `TaskRunner` receives `workspace: { rootPath: '/tmp' }` as a hardcoded default. No workspace mounting or volume sharing between stages. `StageExecutor` does not pass any workspace context between stages.
- **Impact**: Each stage must re-checkout code, re-install dependencies, etc. Wastes time and bandwidth. GitHub Actions uses `actions/checkout` + workspace persistence. Tekton uses Workspaces.
- **Priority**: P0
- **Complexity**: High

### GAP 3.4: No State Recovery / Resume After Crash
- **Gap**: No mechanism to detect interrupted runs and resume from the last completed stage.
- **Evidence**: `TransactionLog.getRecoverableTransactions()` (line 361) can find RUNNING/COMPENSATING sagas, but there is no automated recovery process that runs on startup. `PipelineEngine` has no `recover()` method.
- **Impact**: After any outage, operators must manually identify and re-trigger failed runs. Long-running pipelines (data processing, multi-environment deploys) are especially vulnerable.
- **Priority**: P1
- **Complexity**: High

### GAP 3.5: Variable/Context Propagation is Limited
- **Gap**: Task outputs are not captured and made available to subsequent tasks/stages via variable substitution.
- **Evidence**: `TaskRunner.run()` returns a result object, but `StageExecutor.executeTask()` stores it in the task record without exposing it to the pipeline context. No `${tasks.<name>.outputs.*}` pattern in `DynamicParamsResolver`.
- **Impact**: Cannot implement patterns like "build produces version string, deploy uses version string". Forces hardcoding or external storage.
- **Priority**: P1
- **Complexity**: Medium

---

## 4. Observability

### GAP 4.1: No Metrics Export (Prometheus / OpenTelemetry)
- **Gap**: No pipeline execution metrics exported for monitoring dashboards and alerting.
- **Evidence**: No Prometheus client, no OpenTelemetry SDK integration. `PipelineService.getPipelineStats()` returns basic run counts/averages via SQL query, but these are not exported to any monitoring system. No custom metrics for stage duration, failure rates, queue depth, etc.
- **Impact**: Cannot set up alerts for pipeline failure rate spikes, long-running builds, or resource exhaustion. SRE teams cannot build dashboards for pipeline health.
- **Priority**: P1
- **Complexity**: Medium

### GAP 4.2: No Pipeline Duration Analytics / Bottleneck Detection
- **Gap**: No analysis of which stages are the slowest, how execution times trend over runs, or where to optimize.
- **Evidence**: `AdaptiveTimeoutService` tracks per-stage duration baselines for timeout calculation, but no analytics API for "top 10 slowest stages", "duration trend over last 30 days", or "bottleneck identification."
- **Impact**: Teams cannot identify pipeline performance regressions or optimize slow stages. CI/CD velocity improvement relies on guesswork.
- **Priority**: P2
- **Complexity**: Medium

### GAP 4.3: No Audit Trail for Pipeline Configuration Changes
- **Gap**: No audit log of who changed pipeline definitions, when, and what changed.
- **Evidence**: `PipelineVersionService` tracks versions with `createdBy` and `changeSummary`, but there is no dedicated audit table or audit API. No logging of pipeline CRUD operations for compliance purposes.
- **Impact**: Cannot meet compliance requirements (SOC2, ISO27001) that require audit trails for CI/CD configuration changes. Cannot answer "who changed the deploy pipeline last week?"
- **Priority**: P2
- **Complexity**: Low

---

## 5. Integration

### GAP 5.1: Trigger Service is In-Memory Only — Not Persisted
- **Gap**: `PipelineTriggerService` stores triggers in `Map<string, Trigger>` and execution history in `Map<string, TriggerExecutionRecord[]>`. Triggers are lost on restart.
- **Evidence**: `PipelineTriggerService` line 76-77: `private triggers: Map<string, Trigger>` and `private executionHistory: Map<string, TriggerExecutionRecord[]>`. No repository or database integration.
- **Impact**: All configured triggers (git webhooks, cron schedules) disappear on restart. Must be reconfigured after every deployment.
- **Priority**: P0
- **Complexity**: Medium

### GAP 5.2: No Actual Cron Scheduler
- **Gap**: `schedule` trigger type exists in config (`cronExpression`, `timezone`) but no cron daemon evaluates and fires scheduled triggers.
- **Evidence**: `PipelineTriggerService.evaluateTrigger()` handles `git` and `webhook` event matching. There is no `setInterval` or `node-cron` loop that evaluates `cronExpression` fields. No scheduled trigger execution path.
- **Impact**: Scheduled pipelines (nightly builds, weekly reports, periodic cleanup) do not work at all.
- **Priority**: P0
- **Complexity**: Low

### GAP 5.3: No SCM Integration (GitHub/GitLab/Bitbucket Webhook Receiver)
- **Gap**: No webhook endpoint that receives push/PR/tag events from SCM providers and translates them into trigger events.
- **Evidence**: `PipelineTriggerService` can evaluate trigger events (`TriggerEvent` with `branch`, `changedFiles` payload), but there is no API route that accepts incoming webhooks from GitHub/GitLab. No webhook secret validation, no event normalization.
- **Impact**: Git-triggered pipelines cannot actually receive events from SCM systems. The trigger engine exists but has no input source.
- **Priority**: P0
- **Complexity**: Medium

### GAP 5.4: EventBus Not Wired to NATS in Practice
- **Gap**: Event publishers exist but NATS JetStream integration is optional/fallback. In production without NATS, events are silently dropped.
- **Evidence**: `PipelineEventPublisher` uses `EventBusAdapter` which checks `eventBus.isJetStreamAvailable()`. If NATS is not available, `PublishResult.deliveryMode` is `'disabled'` and events are not published. `CLAUDE.md` confirms: "No real EventBus integration: Event publishers exist but are not wired to NATS."
- **Impact**: External systems cannot react to pipeline events. No event-driven integrations (Slack notifications, external dashboards, downstream pipelines).
- **Priority**: P1
- **Complexity**: Medium

### GAP 5.5: No External System Callback / Notification Webhooks
- **Gap**: No ability to configure outgoing webhooks that fire on pipeline events (e.g., notify Slack, trigger downstream system).
- **Evidence**: `PipelineEventPublisher` publishes to internal EventBus only. No outgoing webhook delivery mechanism. No notification service integration for pipeline events.
- **Impact**: Cannot integrate pipeline status with external tools (Slack, Teams, PagerDuty, custom dashboards). Users must poll the API or use SSE.
- **Priority**: P1
- **Complexity**: Low

---

## 6. Security

### GAP 6.1: No Pipeline-Level RBAC
- **Gap**: Pipeline execution, configuration, and management do not have granular role-based access control per pipeline or per operation.
- **Evidence**: `pipeline-routes-registrar.ts` applies `authenticateUser` middleware globally, which validates the user is logged in but does not check roles or permissions per pipeline. No `canExecute`, `canEdit`, `canView` checks.
- **Impact**: Any authenticated user can trigger, modify, or delete any pipeline in the tenant. Cannot restrict production deploy pipelines to specific roles or teams.
- **Priority**: P0
- **Complexity**: Medium

### GAP 6.2: No Secrets Management Integration
- **Gap**: No integration with vault/secret managers for injecting secrets into pipeline tasks. Environment variable handling explicitly BLOCKS secrets.
- **Evidence**: `PluginExecutorService.buildCleanEnvironment()` (line 1039) explicitly filters out any env var containing `SECRET`, `PASSWORD`, `TOKEN`, `KEY`, or cloud provider prefixes. No secret reference syntax (e.g., `${secrets.DEPLOY_KEY}`) in the YAML spec.
- **Impact**: Pipelines cannot securely access API keys, deploy credentials, or database passwords. The current approach is overly restrictive — it blocks ALL secrets rather than providing a secure injection mechanism.
- **Priority**: P0
- **Complexity**: Medium

### GAP 6.3: Task-Level Resource Quotas Defined but Not Enforced
- **Gap**: `Task` model has `resourceQuota?: { cpu, memory, timeout }` but the engine does not enforce these quotas during execution.
- **Evidence**: `createTask()` in `src/models/Task.ts` accepts `resourceQuota` but `StageExecutor.executeTask()` and `TaskRunner.run()` do not read or enforce these values. `PluginExecutorService` has its own quota system but it applies to plugin tasks only, not to generic task types (git, npm, shell, k8s).
- **Impact**: A single task can consume unlimited CPU/memory, affecting other tasks on the same host. No protection against resource exhaustion attacks or misconfigured pipelines.
- **Priority**: P1
- **Complexity**: Medium

---

## Summary by Priority

| Priority | Count | Key Items |
|----------|-------|-----------|
| P0 | 8 | Parallel execution, manual approval gates, crash resilience, artifact passing, workspace sharing, trigger persistence, cron scheduler, SCM webhook receiver, pipeline RBAC, secrets management |
| P1 | 11 | Matrix builds, pipeline composition, condition engine, fan-out/fan-in, rerun from stage, error-aware retry, state recovery, variable propagation, metrics export, EventBus wiring, outgoing webhooks, resource quota enforcement |
| P2 | 5 | Pipeline-level variables, dry-run validation, cancelled vs skipped status, duration analytics, audit trail |

## Summary by Complexity

| Complexity | Count | Notable Items |
|------------|-------|---------------|
| High | 6 | Pipeline composition, crash resilience (in-memory -> persistent), artifact passing, workspace sharing, state recovery |
| Medium | 15 | Parallel execution, fan-out/fan-in, manual approval gates, metrics export, SCM integration, RBAC, secrets management, matrix builds |
| Low | 5 | Cron scheduler, condition engine improvement, error-aware retry wiring, outgoing webhooks, audit trail |

---

## Recommendations

### Immediate (P0)
1. **Parallel stage execution** — Highest ROI. Use `Promise.all()` for stages with satisfied dependencies.
2. **Persist trigger state** — Move `PipelineTriggerService` from Map to PostgreSQL.
3. **Implement cron scheduler** — Add `node-cron` or `cron` package to evaluate `cronExpression` fields.
4. **Add SCM webhook receiver** — Create API routes for GitHub/GitLab webhook events.
5. **Add manual approval gates** — Extend YAML spec and engine with `approval` stage type.

### Near-term (P1)
6. **Crash-resilient execution** — Persist execution checkpoints to PostgreSQL; implement startup recovery.
7. **Artifact/workspace passing** — Integrate with S3 or local filesystem for stage-to-stage data passing.
8. **Wire AutoRetryService into PipelineEngine** — Replace simple retry count check with error-aware retry.
9. **Add pipeline RBAC** — Extend auth middleware with per-pipeline permission checks.
10. **Secrets management** — Integrate with HashiCorp Vault or implement encrypted secret store with `${secrets.*}` syntax.

### Longer-term (P2)
11. **Metrics export** — Add Prometheus metrics for pipeline execution observability.
12. **Pipeline-level variables** — Add `env:` block support to YAML spec.
13. **Dry-run validation** — Implement pipeline simulation without execution.
