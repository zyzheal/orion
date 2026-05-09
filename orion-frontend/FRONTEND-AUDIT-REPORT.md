# Frontend Visual Completeness Audit Report

**Date**: 2026-05-08
**Branch**: feat/frontend-gap-implementation
**Scope**: Pipeline feature set and all registered routes vs page directories

---

## 1. Feature Audit Table (Pipeline Features)

| # | Feature | Page Exists | Route Registered | Status | Notes |
|---|---------|:-----------:|:----------------:|--------|-------|
| 1 | Matrix builds (MatrixConfigurator) | Yes | N/A (part of PipelineEditor) | PASS | StageModal.tsx has full MatrixConfigurator component with dimensions + exclusions |
| 2 | Variable propagation (task outputs display) | No | N/A | GAP | PipelineDetail shows stages/steps/logs but no task output / variable propagation section |
| 3 | Stage re-run (retry-from-stage button) | Partial | N/A | GAP | PipelineDetail has full-pipeline re-run button only. No per-stage retry button on individual stages |
| 4 | Deployment strategies (canary/blue-green) | Yes | Yes (`/deployments/:id`) | PASS | DeploymentDetail/index.tsx has strategy labels for blue-green and canary |
| 5 | Quality gates | Yes (`quality-gate/QualityGatePage.tsx`) | **No** | GAP | Page exists at `src/pages/quality-gate/QualityGatePage.tsx` (5KB) but NO route in routes.ts |
| 6 | Sub-pipeline / reusable workflows | No | N/A | GAP | PipelineEditor/StageModal.tsx STAGE_TYPES does not include "sub-pipeline" or "reusable workflow" type |
| 7 | Runner pool management | Yes (`RunnerManagement/`) | Yes (`/console/runners`) | PASS | RunnerManagement/index.tsx (20KB) registered at `/console/runners` |
| 8 | Artifact version browser | Yes (`ArtifactBrowser/`) | Yes (`/artifacts/browser`) | PASS | ArtifactBrowser/index.tsx (13KB) with DeployVersionModal, TraceabilityChainView, VersionCompareDrawer, VersionTable |
| 9 | Secrets management | Yes (`SecretsManagement/`) | Yes (`/secrets`) | PASS | SecretsManagement/index.tsx (14KB) registered at `/secrets` |
| 10 | Notification rules | Yes (`NotificationRules/`) | Yes (`/console/notification-rules`) | PASS | NotificationRules/index.tsx (12KB) registered at `/console/notification-rules` |
| 11 | Pipeline runs list | Yes (`PipelineRunList/`) | Yes (`/pipeline-runs`) | PASS | PipelineRunList/index.tsx (14KB) registered at `/pipeline-runs` |
| 12 | Pipeline run live view | Yes (`PipelineRunLive/`) | Yes (`/pipelines/:id/runs/:runId`) | PASS | PipelineRunLive/index.tsx (23KB) registered |
| 13 | Pipeline version history | Yes (`PipelineVersionHistory/`) | **No** | GAP | PipelineVersionHistory/index.tsx (18KB) exists but NOT registered in routes.ts |
| 14 | Pipeline budget | Yes (`PipelineBudget/`) | **No** | GAP | PipelineBudget/index.tsx (15KB) exists but NOT registered in routes.ts |
| 15 | Trigger management | Yes (`trigger/TriggerPage.tsx`) | Yes (`/triggers`) | PASS | trigger/TriggerPage.tsx (14KB) registered at `/triggers` |
| 16 | Webhook management | Yes (`WebhookManagement/`) | Yes (`/console/webhooks`) | PASS | WebhookManagement/index.tsx (10KB) registered at `/console/webhooks` |
| 17 | Plugin management (G1-G6) | Yes (`PluginManagement/`) | Yes (`/console/plugins`, `/console/plugins/:id`) | PASS | PluginManagement with PluginList, PluginDetail, PluginCreateModal, PluginLifecycle |

**Summary**: 11 of 17 features are fully complete. 6 features have gaps (items 2, 3, 5, 6, 13, 14).

---

## 2. Dead Pages (Exist in `src/pages/` but NOT Registered in Routes)

The following page directories exist but have NO corresponding route registration in `src/router/routes.ts`:

| Directory | Description | Notes |
|-----------|-------------|-------|
| `ai-decision/` | AI Decision page | 96 bytes, likely placeholder/stub |
| `ai-decision-explanation/` | AI Decision Explanation | 96 bytes, likely placeholder/stub |
| `approval/` | Approval (lowercase) | Distinct from `Approvals/` which IS routed at `/approvals` |
| `artifact/` | Artifact (lowercase) | Distinct from `Artifacts/` which IS routed at `/artifacts` |
| `autonomous-pipeline/` | Autonomous Pipeline | 96 bytes, likely placeholder/stub |
| `chaos/` | Chaos (lowercase) | Distinct from `ChaosEngineering/` (also unrouted). `chaos/ChaosExperimentPage.tsx` IS routed at `/chaos-experiments` |
| `config-mgmt/` | Config Management (alt) | 96 bytes, likely placeholder/stub |
| `cost/` | Cost (lowercase) | Contains `BudgetGuardPage.tsx` which IS routed at `/console/cost/budget-guard`, but the index is unused |
| `cost-operations/` | Cost Operations | 96 bytes, likely placeholder/stub |
| `deploy/` | Deploy page | 96 bytes, likely placeholder/stub |
| `digital-twin/` | Digital Twin (lowercase) | `DigitalTwin/DigitalTwinPage.tsx` IS routed at `/digital-twin`; this lowercase dir is unused |
| `efficiency/` | Efficiency page | 96 bytes, likely placeholder/stub |
| `env/` | Environment page | 96 bytes, likely placeholder/stub |
| **`pipeline/`** | **Pipeline page** | 160 bytes, likely placeholder/stub. PipelineList IS routed at `/pipelines` |
| `plugin-marketplace/` | Plugin Marketplace | 96 bytes, likely placeholder/stub |
| **`quality-gate/`** | **Quality Gate page** | QualityGatePage.tsx (5KB) - FULL implementation but NO route |
| **`PipelineBudget/`** | **Pipeline Budget page** | index.tsx (15KB) - FULL implementation but NO route |
| **`PipelineVersionHistory/`** | **Pipeline Version History** | index.tsx (18KB) - FULL implementation but NO route |

**Critical dead pages** (full implementations, not stubs): `quality-gate/`, `PipelineBudget/`, `PipelineVersionHistory/`

**Stub dead pages** (96-byte placeholders): `ai-decision/`, `ai-decision-explanation/`, `autonomous-pipeline/`, `config-mgmt/`, `cost-operations/`, `deploy/`, `efficiency/`, `env/`, `plugin-marketplace/`

**Duplicate/unreferenced dirs**: `approval/`, `artifact/`, `chaos/`, `cost/`, `digital-twin/`, `pipeline/` -- these exist alongside properly routed equivalents

---

## 3. Broken Routes (Registered in Routes but Page Does Not Exist)

All route imports in `routes.ts` point to valid file paths. No broken routes were found. All sub-page imports (e.g., `PluginManagement/Marketplace`, `BuildEnv/BuilderImageList`, etc.) have been verified to exist.

**Result**: 0 broken routes found.

---

## 4. Missing UI for Completed Backend Features

The following backend features (from GAP-01 through GAP-CN-07 + Plugin G1-G6) have missing or incomplete frontend UI:

### 4.1 Route Registration Missing (Pages Exist, Not Routed)

| Backend Feature | Frontend Page | Route Needed |
|-----------------|---------------|-------------|
| Quality Gates | `quality-gate/QualityGatePage.tsx` | `/quality-gates` or `/console/quality-gates` |
| Pipeline Budget | `PipelineBudget/index.tsx` | `/pipelines/budget` or `/console/pipeline-budget` |
| Pipeline Version History | `PipelineVersionHistory/index.tsx` | `/pipelines/:id/versions` or `/pipeline-versions` |

### 4.2 UI Feature Gaps (Code Changes Needed)

| Backend Feature | Current State | What's Missing |
|-----------------|---------------|----------------|
| Variable propagation (task outputs) | PipelineDetail shows stages/steps/logs only | Section to display task outputs and propagated variables between stages |
| Stage re-run (retry from stage) | Only full pipeline re-run button exists | Per-stage retry button allowing "retry from this stage" without re-running completed stages |
| Sub-pipeline / reusable workflows | PipelineEditor has 6 stage types (build, test, scan, deploy, notify, custom) | Add "sub-pipeline" or "reusable workflow" stage type to STAGE_TYPES in StageModal.tsx |

### 4.3 Already Complete (No Gaps)

| Backend Feature | Frontend Status |
|-----------------|-----------------|
| GAP-01 Pipeline Editor | PipelineEditor with DAG, StageModal, MatrixConfigurator |
| GAP-02 Pipeline Runs | PipelineRunList + PipelineRunLive (full live log view) |
| GAP-03 Pipeline Templates | PipelineTemplate page at `/pipeline-templates` |
| GAP-04 Deployment Strategies | DeploymentDetail with canary/blue-green labels |
| GAP-05 Quality Gates | Page exists, needs route registration |
| GAP-06 Artifact Version Browser | ArtifactBrowser with version compare, traceability |
| GAP-07 Runner Pool | RunnerManagement at `/console/runners` |
| GAP-CN-01 Pipeline Budget | Page exists, needs route registration |
| GAP-CN-02 Notification Rules | NotificationRules at `/console/notification-rules` |
| GAP-CN-03 Webhook Management | WebhookManagement at `/console/webhooks` |
| GAP-CN-04 Secrets Management | SecretsManagement at `/secrets` |
| GAP-CN-05 Trigger Management | TriggerPage at `/triggers` |
| GAP-CN-06 Pipeline Version History | Page exists, needs route registration |
| GAP-CN-07 Pipeline Re-run | PipelineDetail has full re-run (missing per-stage retry) |
| Plugin G1-G6 | PluginManagement at `/console/plugins` with full lifecycle |

---

## 5. Route Statistics

| Metric | Count |
|--------|-------|
| Total routes in routes.ts | ~130 (including child routes) |
| Total page directories in src/pages/ | ~120 |
| Dead pages (not routed) | 18 |
| Broken routes | 0 |
| Pipeline features fully complete | 11 / 17 |
| Pipeline features with gaps | 6 / 17 |

---

## 6. Recommended Actions

### High Priority (Route Registration -- Minimal Effort)

1. Register `/console/quality-gates` -> `quality-gate/QualityGatePage.tsx`
2. Register `/console/pipeline-budget` -> `PipelineBudget/index.tsx`
3. Register `/pipeline-versions` or `/pipelines/:id/versions` -> `PipelineVersionHistory/index.tsx`

### Medium Priority (UI Enhancements)

4. Add task output / variable propagation section to PipelineDetail
5. Add per-stage retry button to PipelineDetail stage cards
6. Add "sub-pipeline" stage type to PipelineEditor STAGE_TYPES

### Low Priority (Cleanup)

7. Remove stub directories (ai-decision, ai-decision-explanation, autonomous-pipeline, etc.)
8. Clean up duplicate directories (approval vs Approvals, artifact vs Artifacts, etc.)
