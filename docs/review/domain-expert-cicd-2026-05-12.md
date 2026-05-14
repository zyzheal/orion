# Domain Expert Review: CI/CD Pipeline Services

**Date**: 2026-05-12
**Scope**: orion-pipeline-svc, orion-deploy-svc, orion-code-svc, orion-artifact-svc, orion-runner-svc, orion-agent-svc

## Executive Summary
Overall readiness: ~45%. Pipeline CRUD is complete (55%), but Deploy Service routes are all 501 (25%). Agent TaskExecutor is all stubs (35%).

## P0 Findings (6)
| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| P0-1 | pipeline-svc | SCM Webhook route returns 501 (SCMWebhookService exists but not wired) | CI cannot be triggered by Git events |
| P0-2 | pipeline-svc | SSE log route returns 501 (SSEConnectionManager import broken) | No real-time pipeline logs |
| P0-3 | runner-svc | `spawn()` executes arbitrary commands via `/bin/sh -c` with no sandbox | RCE vulnerability |
| P0-4 | agent-svc | TaskExecutor all methods are stubs (dispatch, executeInSandbox, getTask, cancelTask) | Agent cannot execute any tasks |
| P0-5 | deploy-svc | All deploy routes return 501 (DeploymentWorkflow exists but not wired) | Deployment completely unavailable |
| P0-6 | deploy-svc | EnvironmentService all methods throw TODO errors, route not registered | Environment CRUD all fail |

## P1 Findings (10)
- P1-1: PipelineEngine simulates execution (setTimeout) instead of dispatching to runner/Tekton
- P1-2: PipelineEngine uses memory Maps (runStore, extendedStore) vs PostgreSQL
- P1-3: ApprovalGateService uses in-memory Map (lost on restart)
- P1-4: DeployService uses in-memory Map (lost on restart)
- P1-5: CanaryAnalysisService core methods throw "TODO: Implement"
- P1-6: ArtifactScanService generates fake CVE data (hash % 7)
- P1-7: Deploy environment routes not registered in app.ts
- P1-8: PipelineAdmin routes return 501 but services exist
- P1-9: PipelineRun detail routes return 501 but service implemented
- P1-10: RunnerManager auto-scaling always returns no_op

## P2 Findings (10)
- P2-1: PipelineTriggerService uses setTimeout for cron (lost on restart)
- P2-2: database.ts runMigrations() is no-op
- P2-3: EventBus uses EventEmitter, not NATS
- P2-4: BuildService simulates Docker build
- P2-6: Runner has no concurrent limit enforcement
- P2-8: SSEConnectionManager imports non-existent module

## Security Analysis
1. **RCE**: User input directly passed to `/bin/sh -c` (runner-svc)
2. **Fake security scans**: ArtifactScanService returns simulated data
3. **In-memory state loss**: Pipeline execution, deployments, approvals all lost on restart

## State Management Risk Matrix
| Component | Storage | Survives Restart? | Risk |
|-----------|---------|-------------------|------|
| Pipeline CRUD | PostgreSQL | Yes | Low |
| Pipeline Execution State | Memory Map | No | HIGH |
| Agent Tasks | Memory Map | No | HIGH |
| Deployments | Memory Map | No | HIGH |
| Approval Gates | Memory Map | No | Medium |
