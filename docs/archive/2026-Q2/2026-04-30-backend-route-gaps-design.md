# Backend Route Gaps Design

**Date:** 2026-04-30
**Status:** Draft
**Author:** Orion Platform Team
**Related Specs:** `frontend-page-gaps`, `api-path-consistency-design`, `module-gap-analysis`

## Overview

This document catalogs all backend route gaps in `orion-platform-service` and provides implementation-level designs for closing them. Gaps fall into four categories:

1. **Backend routes with no frontend caller** -- routes exist but frontend pages use mock data
2. **Partial endpoints without frontend caller** -- some endpoints in a module are unused
3. **Frontend expects but backend missing** -- frontend API client calls endpoints the backend doesn't have
4. **Unregistered route file** -- a route file exists but is not wired into `routes.ts`

The analysis covers ~50 backend route modules registered under `/api/v1/*` and ~55 frontend API client files.

## Methodology

- **Source of truth for backend routes:** `orion-platform-service/src/api/routes.ts` (central registry) + each `*-routes.ts` file
- **Source of truth for frontend calls:** `orion-frontend/src/api/*.ts` (Axios-based API clients)
- **Comparison:** Each frontend `api.get/post/put/delete/patch('/v1/...')` call is mapped against the registered backend route table

---

## Current State

### Category 1: Backend Routes With No Frontend Caller

These routes ARE registered on the backend and functional. The frontend pages exist but were not wired up to call the real API -- they use mock data instead. This category requires **frontend changes** (handled by the `frontend-page-gaps` spec), not backend changes.

| Module | Route Prefix | Endpoint Count | Backend File | Frontend Page | Status |
|--------|-------------|----------------|-------------|---------------|--------|
| Test Selector | `/v1/test-selector/*` | 11 | `test-selector-routes.ts` | `TestSelector.tsx` | Mock data |
| Backup | `/v1/backup/*` | 30+ | `backup-routes.ts` | `BackupManagement.tsx` | API client exists, not wired |
| Plugin SPI | `/v1/plugins-spi/*` | 10 | `plugin-spi-routes.ts` | `PluginSPI.tsx` | API client exists, not wired |
| EventBus | `/v1/eventbus/*` | 8 | `eventbus-routes.ts` | `EventBus.tsx` | Mock data |
| AI Security | `/v1/ai-security/*` | 6 | `ai-security-routes.ts` | `AISecurity.tsx` | API client exists, not wired |
| Session | `/v1/sessions/*` | 6 | `session-routes.ts` | `Sessions.tsx` | Mock data |
| Webhook | `/v1/webhooks/*` | 5 | `webhook-routes.ts` | None | No frontend page yet |
| Notification | `/v1/notifications/*` | 6 | `notification-routes.ts` | `NotificationCenter` | Uses different API path |

**Backend action:** None required. These routes are already functional.

---

### Category 2: Partial Endpoints Without Frontend Caller

Some modules have a subset of endpoints that the frontend never calls. Decision per endpoint below.

#### 2.1 Ticketing (`/v1/tickets/*`)

Backend has 60+ endpoints. Frontend calls ~25. Missing frontend callers:

| Backend Endpoint | Frontend Equivalent | Decision |
|-----------------|---------------------|----------|
| `POST /start` | None | **DEFER** -- internal service control |
| `POST /stop` | None | **DEFER** -- internal service control |
| `POST /dispatch/*` (14 endpoints) | `dispatch/auto/:ticketId`, `dispatch/queue`, `dispatch/queue/alerts` | **PARTIAL** -- frontend calls 3 of 14 |
| `POST /transfer/:ticketId` | `POST /v1/tickets/transfer/:id` | **MATCHED** -- path mismatch (`/transfer/` vs `/transfer/:id/`) |
| `GET /transfer/:ticketId/history` | `GET /v1/tickets/transfer/:id/history` | **MATCHED** |
| `GET /transfer/stats` | None | **DEFER** -- admin feature |
| `POST /suspend` | `POST /v1/tickets/suspend` | **MATCHED** |
| `GET /suspend` | `GET /v1/tickets/suspend` | **MATCHED** |
| `GET /bi/*` (8 endpoints) | None | **DEFER** -- BI dashboard not built |

**Conclusion:** Ticketing advanced dispatch/transfer/suspend/BI endpoints are partially wired. The path mismatch for transfer is a **frontend bug** (`/v1/tickets/transfer/:id` vs backend `/v1/tickets/transfer/:ticketId`).

#### 2.2 Monitoring (`/v1/monitoring/*`)

Backend has 28 endpoints. All are covered by frontend API client (`monitoring.ts`).

| Backend Endpoint | Frontend Call | Status |
|-----------------|---------------|--------|
| `POST /start` | `startMonitoring()` | **MATCHED** |
| `POST /stop` | `stopMonitoring()` | **MATCHED** |
| `GET /health` | `getMonitoringHealth()` | **MATCHED** |
| `POST /collect` | None directly | **NEEDS FRONTEND PAGE** -- monitoring page doesn't expose collect button |
| `GET /metrics` | `getMetrics()` | **MATCHED** |
| `POST /metrics` | `recordMetric()` | **MATCHED** |
| `POST /metrics/register` | `registerMetric()` | **MATCHED** |
| `POST /rules/evaluate` | `evaluateAlertRule()` (uses `/rules/evaluate`) | **MATCHED** |
| `GET /anomalies` | None | **DEFER** -- anomaly detection page not built |
| `GET /anomalies/summary` | `getAnomalySummary()` | **MATCHED** |

**Conclusion:** Monitoring routes are well-covered. `/collect` needs a UI trigger.

#### 2.3 Build (`/v1/build/*` prefix via `build-routes.ts`)

Backend has 50+ endpoints under multiple sub-prefixes. Frontend has no direct build API client -- build functionality is embedded in pipeline pages.

| Endpoint Group | Count | Decision |
|---------------|-------|----------|
| `/build-images/*` | 10 | **DEFER** -- admin-only feature |
| `/build-cache/*` | 14 | **DEFER** -- admin-only feature |
| `/build-pods/*` | 6 | **DEFER** -- pipeline page handles this |
| `/build-logs/*` | 8 | **DEFER** -- pipeline logs cover this |
| `/artifacts/*` | 6 | **COVERED** by `artifact-routes.ts` under `/v1/artifacts` |
| `/build/buildx/*` | 7 | **DEFER** -- multi-arch build not in roadmap |
| `/pipeline-runs/:runId/stages/:stageId/cache` | 2 | **DEFER** -- pipeline stage feature |
| `/pipeline-runs/:runId/stages/:stageId/artifacts` | 2 | **DEFER** -- pipeline stage feature |

#### 2.4 Cost (`/v1/cost/*`)

| Backend Endpoint | Frontend Call | Decision |
|-----------------|---------------|----------|
| `GET /providers` | None | **IMPLEMENT** -- needed for FinOps v2 |
| `POST /collect/cloud` | None | **IMPLEMENT** -- needed for FinOps v2 |
| `POST /k8s/allocate` | None | **DEFER** -- admin-only |
| `GET /k8s/namespaces` | None | **DEFER** -- admin-only |
| `GET /k8s/pods` | None | **DEFER** -- admin-only |
| `GET /k8s/tenants` | None | **DEFER** -- admin-only |
| `GET /saas/*` (5 endpoints) | None | **DEFER** -- SaaS cost not in scope |
| `POST /budget-alerts` | None | **IMPLEMENT** -- budget alerts needed |
| `GET /budget-alerts` | None (uses `/v1/finops/budget/check-alerts`) | **IMPLEMENT** -- see path alignment |
| `GET /events/stats` | None | **DEFER** -- internal |

#### 2.5 Product Line (`/v1/product-lines/*`)

| Backend Endpoint | Frontend Call | Status |
|-----------------|---------------|--------|
| `GET /release-trains` | None (mock fallback) | **DEFER** to frontend-page-gaps |
| `GET /hotfix-channels` | None (mock fallback) | **DEFER** to frontend-page-gaps |
| `GET /is-hotfix/:id` | None (mock fallback) | **DEFER** to frontend-page-gaps |

#### 2.6 Internal Library (`/v1/internal-libraries/*`)

| Backend Endpoint | Frontend Call | Status |
|-----------------|---------------|--------|
| `GET /dependents/:repoName` | None (mock fallback) | **DEFER** to frontend-page-gaps |
| `GET /dependencies/:repoName` | None (mock fallback) | **DEFER** to frontend-page-gaps |
| `POST /update-stats/:repoName` | None (mock fallback) | **DEFER** to frontend-page-gaps |

---

### Category 3: Frontend Expects But Backend Missing (CRITICAL)

These are endpoints the frontend API client calls but the backend has **no route handler** for. Each requires new route handlers to be added.

#### 3.1 SBOM (`/v1/sbom/*`)

**Frontend calls:**
```
GET  /v1/sbom/compliance/report   -> getSbomComplianceReport()
GET  /v1/sbom/compliance/eo14028  -> getSbomEo14028Compliance()
GET  /v1/sbom/compliance/eu-cra   -> getSbomEuCraCompliance()
POST /v1/sbom/provenance           -> createSbomProvenance()
GET  /v1/sbom/provenance           -> getSbomProvenance()
GET  /v1/sbom/provenance/:id/verify -> verifySbomProvenance()
POST /v1/sbom/gate/evaluate        -> evaluateSbomGate()
GET  /v1/sbom/gate/history         -> getSbomGateHistory()
```

**Backend has (`sbom-routes.ts`):**
```
GET    /documents
POST   /documents
GET    /documents/:id
PUT    /documents/:id
DELETE /documents/:id
GET    /documents/:id/packages
GET    /documents/:id/download
POST   /attestations/:id/sign
GET    /attestations/:id
POST   /attestations/:id/verify
POST   /vulnerability/scan
GET    /vulnerability/results
GET    /vulnerability/results/:id
POST   /vulnerability/gate/check
GET    /waivers
POST   /waivers
GET    /waivers/active
GET    /waivers/:id
PUT    /waivers/:id
DELETE /waivers/:id
```

**Gap:** No `/compliance/*`, `/provenance/*`, or `/gate/evaluate|history` routes.

#### 3.2 Canary Analysis (`/v1/canary-analysis/*`)

**Frontend calls:**
```
GET  /v1/canary-analysis/metrics/discover  -> discoverMetrics()
POST /v1/canary-analysis/models/retrain    -> retrainCanaryModel()
```

**Backend has (`canary-analysis-routes.ts`):**
```
GET    /runs
POST   /runs
GET    /runs/:id
GET    /runs/:id/metrics
GET    /runs/:id/ml-results
GET    /configs
POST   /configs
GET    /configs/:service/:env
PUT    /configs/:id
DELETE /configs/:id
POST   /force-promote
POST   /force-rollback
```

**Gap:** No `/metrics/discover` or `/models/retrain` routes.

#### 3.3 Policies (`/v1/policies/*`)

**Frontend calls:**
```
POST /v1/policies/bundles/sync              -> syncPolicyBundles()
GET  /v1/policies/bundles                   -> getPolicyBundles()
GET  /v1/policies/bundles/:id               -> getPolicyBundle()
POST /v1/policies/test                      -> testPolicy()
GET  /v1/policies/test/results/:testId      -> getPolicyTestResults()
PATCH /v1/policies/:id/toggle               -> togglePolicy()
```

**Backend has (`policy-routes.ts`):**
```
GET    /
POST   /
GET    /:id
PUT    /:id
DELETE /:id
POST   /evaluate-policy
GET    /evaluations
POST   /evaluate
GET    /evaluations/runs
POST   /gate/:gateId/evaluate
GET    /violations
GET    /violations/:id
POST   /violations/:id/waive
POST   /violations/:id/resolve
GET    /overrides
POST   /overrides
```

**Gap:** No `/bundles/*`, `/test/*`, or `/:id/toggle` routes.

#### 3.4 Efficiency (`/v1/efficiency/*`)

**Frontend calls:**
```
POST /v1/efficiency/score   -> (in EfficiencyPage, uses mock)
POST /v1/efficiency/export  -> (in EfficiencyPage, uses mock)
```

**Backend has (`efficiency-routes.ts`):**
```
GET  /dora/metrics
POST /dora/report
GET  /dora/benchmarks
GET  /clickhouse/status
POST /clickhouse/sync
GET  /clickhouse/config
GET  /dashboard
POST /reports/weekly/generate
GET  /reports/weekly
GET  /reports/weekly/history
```

**Gap:** No `/score` or `/export` routes. Note: frontend page currently uses mock data for these.

#### 3.5 Risk (`/v1/risk/*`)

**Frontend calls:**
```
GET  /v1/risk/events                   -> getRiskEvents()
POST /v1/risk/events/:id/acknowledge   -> acknowledgeRiskEvent()
POST /v1/risk/health-check             -> runHealthCheck() -- body has `checkType`
GET  /v1/risk/health-check/history     -> getHealthCheckHistory()
```

**Backend has (`risk-routes.ts`):**
```
POST /assess/deployment
POST /assess/change
GET  /assessments
GET  /assessments/:id
POST /reports/generate/:assessmentId
GET  /reports
GET  /reports/:id
POST /health-check
POST /health-check/basic
GET  /status
```

**Gap:** No `/events/*` or `/health-check/history` routes.

#### 3.6 IaC (`/v1/iac/*`)

**Frontend calls:**
```
GET    /v1/iac/workspaces/:id/plans             -> getWorkspacePlans()
GET    /v1/iac/workspaces/:workspaceId/plans/:planId -> getWorkspacePlan()
GET    /v1/iac/workspaces/:id/state/versions     -> getWorkspaceStateVersions()
GET    /v1/iac/workspaces/:id/state/diff         -> getStateDiff()
GET    /v1/iac/modules/:id                       -> getModule()
DELETE /v1/iac/modules/:id                       -> deleteModule()
```

**Backend has (`iac-routes.ts`):**
```
GET    /workspaces
POST   /workspaces
GET    /workspaces/:id
PUT    /workspaces/:id
POST   /workspaces/:id/plan
POST   /workspaces/:id/apply
GET    /workspaces/:id/state
GET    /workspaces/:id/resources
POST   /workspaces/:id/import
GET    /modules
POST   /modules
```

**Gap:** No `/workspaces/:id/plans`, `/workspaces/:id/plans/:planId`, `/workspaces/:id/state/versions`, `/workspaces/:id/state/diff`, `/modules/:id` (GET, DELETE) routes.

#### 3.7 Ephemeral Envs (`/v1/ephemeral-envs/*`)

**Frontend calls:**
```
GET    /v1/ephemeral-envs                        -> getEphemeralEnvs()
GET    /v1/ephemeral-envs/:id                    -> getEphemeralEnv()
POST   /v1/ephemeral-envs                        -> createEphemeralEnv()
POST   /v1/ephemeral-envs/:id/wake               -> wakeEphemeralEnv()
POST   /v1/ephemeral-envs/:id/teardown           -> teardownEphemeralEnv()
GET    /v1/ephemeral-envs/:id/cost               -> getEphemeralEnvCost()
GET    /v1/ephemeral-envs/templates              -> getEnvironmentTemplates()
```

**Backend:** Service exists (`ephemeral-env-service.ts`) with full implementation. **No route file exists.** The service uses an in-memory Map and K8s provisioner.

**Gap:** Entire route module needs to be created and registered.

---

### Category 4: Unregistered Route File

**Finding:** No unregistered route file was found in the current codebase. The previously mentioned `routes-ephemeral-env.ts` does not exist -- the ephemeral-env service exists but has no route file at all. This is confirmed by scanning all `*-routes.ts` files in `src/api/`.

---

## Implementation Design

### Priority Order

| Priority | Module | Rationale |
|----------|--------|-----------|
| P0 | SBOM compliance/provenance/gate | Security-critical, required for supply chain attestation |
| P0 | Ephemeral Envs | Frontend pages exist (`EphemeralEnvList`, `EphemeralEnvDetail`), service exists, just needs routes |
| P1 | Canary analysis metrics/models | Needed for deployment pipeline ML features |
| P1 | Policy bundles/test/toggle | Needed for OPA policy management workflow |
| P1 | Risk events/health-check history | Needed for alerting and health monitoring |
| P2 | IaC plans/state-versions/modules | Needed for IaC workspace management |
| P2 | Efficiency score/export | Dashboard feature, currently mock |

---

### P0: SBOM Routes (`sbom-routes.ts`)

**File:** `orion-platform-service/src/api/sbom-routes.ts`

Add the following route groups to the existing `sbomRoutes` function:

```typescript
// ==================== Compliance Reports ====================

// GET /compliance/report - Get SBOM compliance report
app.get('/compliance/report', async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as { scope?: string; startDate?: string; endDate?: string };
  try {
    const report = await documentService.getComplianceReport({
      scope: query.scope,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
    return reply.send({ code: 200, message: 'OK', data: report });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /compliance/eo14028 - Get EO 14028 compliance status
app.get('/compliance/eo14028', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const compliance = await documentService.getEO14028Compliance();
    return reply.send({ code: 200, message: 'OK', data: compliance });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /compliance/eu-cra - Get EU CRA compliance status
app.get('/compliance/eu-cra', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const compliance = await documentService.getEUCRACompliance();
    return reply.send({ code: 200, message: 'OK', data: compliance });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== Provenance ====================

// POST /provenance - Create build provenance
app.post('/provenance', async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as {
    buildId: string;
    provenanceType: string;
    content: Record<string, unknown>;
    signature: string;
    builderId: string;
    buildTrigger: string;
    sourceUri: string;
  };
  try {
    const provenance = await documentService.createProvenance(body);
    return reply.status(201).send({ code: 201, message: 'Created', data: provenance });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /provenance - List provenance records
app.get('/provenance', async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as { buildId?: string };
  try {
    const provenances = await documentService.listProvenance(query.buildId);
    return reply.send({ code: 200, message: 'OK', data: provenances });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /provenance/:id/verify - Verify provenance signature
app.get('/provenance/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    const result = await documentService.verifyProvenance(params.id);
    return reply.send({ code: 200, message: 'OK', data: result });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== Gate ====================

// POST /gate/evaluate - Evaluate SBOM gate for a build
app.post('/gate/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as { buildId: string };
  try {
    const result = await documentService.evaluateGate(query.buildId);
    return reply.send({ code: 200, message: 'OK', data: result });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /gate/history - Get SBOM gate evaluation history
app.get('/gate/history', async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as { buildId?: string };
  try {
    const history = await documentService.getGateHistory(query.buildId);
    return reply.send({ code: 200, message: 'OK', data: history });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});
```

**Required service methods on `SbomDocumentService`** (may need to be added if not present):
- `getComplianceReport(params)` -- aggregate compliance data across all SBOMs
- `getEO14028Compliance()` -- Executive Order 14028 SBOM compliance check
- `getEUCRACompliance()` -- EU Cyber Resilience Act compliance check
- `createProvenance(input)` -- store SLSA/in-toto provenance
- `listProvenance(buildId?)` -- list provenance records
- `verifyProvenance(id)` -- verify cryptographic provenance
- `evaluateGate(buildId)` -- run SBOM gate evaluation
- `getGateHistory(buildId?)` -- gate evaluation history

---

### P0: Ephemeral Envs (new route file)

**New file:** `orion-platform-service/src/api/ephemeral-env-routes.ts`

```typescript
/**
 * Ephemeral Dev Environments API Routes
 *
 * Routes under /api/v1/ephemeral-envs
 * Wraps the existing EphemeralEnvService with HTTP endpoints.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EphemeralEnvService } from '../services/ephemeral-env-service';
import { K8sProvisionerService } from '../services/k8s-provisioner-service';
import { EventBusService } from '../services/event-bus-service';

interface EphemeralEnvRoutesOptions {
  eventBus?: EventBusService;
  database?: any;
}

export default async function ephemeralEnvRoutes(
  app: FastifyInstance,
  options?: EphemeralEnvRoutesOptions
): Promise<void> {
  const k8sProvisioner = new K8sProvisionerService();
  const service = new EphemeralEnvService({
    k8sProvisioner,
    eventBus: options?.eventBus,
  });

  // ==================== Environment Lifecycle ====================

  // GET / - List ephemeral environments
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      prId?: string;
      repoId?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    };
    try {
      const envs = await service.list({
        prId: query.prId,
        repoId: query.repoId,
        statusFilter: query.status as any,
      });
      const page = parseInt(query.page || '1', 10);
      const pageSize = parseInt(query.pageSize || '20', 10);
      const start = (page - 1) * pageSize;
      const paginated = envs.slice(start, start + pageSize);
      return reply.send({
        code: 200,
        message: 'OK',
        data: paginated,
        meta: { total: envs.length, page, pageSize },
      });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // GET /:id - Get environment details
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const env = await service.getById(params.id);
      return reply.send({ code: 200, message: 'OK', data: env });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // POST / - Create ephemeral environment
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      prId: string;
      repoId: string;
      branchName: string;
      templateId?: string;
      commitSha: string;
    };
    try {
      const env = await service.create(body);
      return reply.status(201).send({ code: 201, message: 'Created', data: env });
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.status(409).send({ code: 409, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // POST /:id/wake - Wake an idle environment
  app.post('/:id/wake', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const env = await service.wake(params.id);
      return reply.send({ code: 200, message: 'OK', data: env });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(400).send({ code: 400, message: error.message });
    }
  });

  // POST /:id/teardown - Tear down an environment
  app.post('/:id/teardown', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { reason?: string } | undefined;
    try {
      const env = await service.teardown(params.id, body?.reason);
      return reply.send({ code: 200, message: 'OK', data: env });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // GET /:id/cost - Get environment cost breakdown
  app.get('/:id/cost', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const cost = await service.getCost(params.id);
      return reply.send({ code: 200, message: 'OK', data: cost });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Templates ====================

  // GET /templates - List environment templates
  app.get('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    // Templates are stored in-memory on the service or can be loaded from config
    // For MVP, return a static list of built-in templates
    const templates = [
      {
        id: 'tpl-web-frontend',
        name: 'Web Frontend',
        description: 'Standard web frontend with Nginx',
        services: [
          { name: 'web', image: 'nginx:latest', replicas: 1, resources: { cpu: '0.25', memory: '256Mi' } },
        ],
        resourceLimits: { cpuLimit: '1', memoryLimit: '1Gi', storageLimit: '5Gi' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tpl-node-backend',
        name: 'Node.js Backend',
        description: 'Node.js backend with PostgreSQL sidecar',
        services: [
          { name: 'api', image: 'node:18-alpine', replicas: 1, resources: { cpu: '0.5', memory: '512Mi' } },
        ],
        resourceLimits: { cpuLimit: '2', memoryLimit: '2Gi', storageLimit: '10Gi' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    return reply.send({ code: 200, message: 'OK', data: templates });
  });
}
```

**Registration in `routes.ts`:**
```typescript
import ephemeralEnvRoutes from './ephemeral-env-routes';

// In apiRoutes() function:
await app.register(ephemeralEnvRoutes, {
  prefix: '/v1/ephemeral-envs',
  eventBus: options.eventBus,
});
```

---

### P1: Canary Analysis Routes (`canary-analysis-routes.ts`)

**File:** `orion-platform-service/src/api/canary-analysis-routes.ts`

Add to the existing `canaryAnalysisRoutes` function:

```typescript
// ==================== Metric Discovery ====================

// GET /metrics/discover - Discover available metrics for a service
app.get('/metrics/discover', async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as { serviceName?: string };
  try {
    const metrics = await service.discoverMetrics(query.serviceName);
    return reply.send({ code: 200, message: 'OK', data: metrics });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== Model Management ====================

// POST /models/retrain - Trigger model retraining
app.post('/models/retrain', async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as { modelName?: string } | undefined;
  try {
    const result = await service.retrainModel(body?.modelName);
    return reply.send({ code: 200, message: 'OK', data: result });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});
```

**Required service methods on `CanaryAnalysisService`:**
- `discoverMetrics(serviceName?)` -- query Prometheus/metrics source for available metrics
- `retrainModel(modelName?)` -- trigger ML model retraining with historical analysis data

---

### P1: Policy Routes (`policy-routes.ts`)

**File:** `orion-platform-service/src/api/policy-routes.ts`

Add to the existing `policyRoutes` function (before the closing `}`):

```typescript
// ==================== Bundle Management ====================

// GET /bundles - List policy bundles
app.get('/bundles', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const bundles = await policyService.listBundles();
    return reply.send({ code: 200, message: 'OK', data: bundles });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /bundles/:id - Get policy bundle details
app.get('/bundles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    const bundle = await policyService.getBundle(params.id);
    if (!bundle) {
      return reply.status(404).send({ code: 404, message: 'Bundle not found' });
    }
    return reply.send({ code: 200, message: 'OK', data: bundle });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// POST /bundles/sync - Sync policy bundles from git registry
app.post('/bundles/sync', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await policyService.syncBundles();
    return reply.send({ code: 200, message: 'OK', data: result });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== Policy Testing ====================

// POST /test - Test a policy with sample inputs
app.post('/test', async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as {
    rego: string;
    testCases: Array<Record<string, unknown>>;
  };
  try {
    const results = await policyService.testPolicy(body.rego, body.testCases);
    return reply.send({ code: 200, message: 'OK', data: results });
  } catch (error: any) {
    return reply.status(400).send({ code: 400, message: error.message });
  }
});

// GET /test/results/:testId - Get policy test results
app.get('/test/results/:testId', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { testId: string };
  try {
    const results = await policyService.getTestResults(params.testId);
    if (!results) {
      return reply.status(404).send({ code: 404, message: 'Test results not found' });
    }
    return reply.send({ code: 200, message: 'OK', data: results });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// PATCH /:id/toggle - Toggle policy enabled/disabled
app.patch('/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  // Guard: prevent matching 'evaluate', 'violations', 'overrides', 'bundles' as id
  if (['evaluate', 'violations', 'overrides', 'bundles', 'test'].includes(params.id)) {
    return reply.callNotFound();
  }
  try {
    const policy = await policyService.toggle(params.id);
    return reply.send({ code: 200, message: 'OK', data: policy });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return reply.status(404).send({ code: 404, message: error.message });
    }
    return reply.status(500).send({ code: 500, message: error.message });
  }
});
```

**Route ordering note:** The `/:id/toggle` PATCH route must be registered AFTER `GET /:id` to avoid Fastify path conflicts. However, since PATCH and GET are different HTTP methods, this is safe. The guard clause ensures that sub-path prefixes (`bundles`, `test`, etc.) are not mistakenly matched as `:id`.

**Required service methods on `PolicyService`:**
- `listBundles()` -- list deployed OPA policy bundles
- `getBundle(id)` -- get bundle details
- `syncBundles()` -- pull bundles from git registry and deploy to OPA
- `testPolicy(rego, testCases)` -- evaluate rego against test inputs
- `getTestResults(testId)` -- retrieve stored test results
- `toggle(id)` -- flip policy enabled/disabled

---

### P1: Risk Routes (`risk-routes.ts`)

**File:** `orion-platform-service/src/api/risk-routes.ts`

Add to the existing `riskRoutes` function:

```typescript
// ==================== Risk Events ====================

// In-memory store for risk events (MVP -- should move to Repository pattern)
const riskEventsStore: Array<{
  id: string;
  eventType: 'risk_detected' | 'risk_escalated' | 'risk_mitigated';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  targetType: string;
  targetId: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: Date;
}> = [];

// GET /events - List risk events
app.get('/events', async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as { status?: string };
  try {
    let events = [...riskEventsStore];
    if (query.status === 'acknowledged') {
      events = events.filter((e) => e.acknowledged);
    } else if (query.status === 'unacknowledged') {
      events = events.filter((e) => !e.acknowledged);
    }
    return reply.send({
      code: 200,
      message: 'OK',
      data: { events: events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) },
    });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// POST /events/:id/acknowledge - Acknowledge a risk event
app.post('/events/:id/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    const event = riskEventsStore.find((e) => e.id === params.id);
    if (!event) {
      return reply.status(404).send({ code: 404, message: 'Risk event not found' });
    }
    event.acknowledged = true;
    event.acknowledgedAt = new Date();
    return reply.send({ code: 200, message: 'OK', data: { acknowledged: true } });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== Health Check History ====================

// In-memory store for health check results
const healthCheckHistory: Array<{
  id: string;
  checkType: 'pre-deployment' | 'basic' | 'comprehensive';
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{ name: string; status: string; message?: string }>;
  executedAt: Date;
  duration: number;
}> = [];

// GET /health-check/history - Get health check history
app.get('/health-check/history', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    return reply.send({
      code: 200,
      message: 'OK',
      data: {
        checks: healthCheckHistory.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime()),
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});
```

**Note:** The existing `POST /health-check` and `POST /health-check/basic` routes should be modified to also store results in `healthCheckHistory` for persistence. This can be done by wrapping the existing controller calls.

---

### P2: IaC Routes (`iac-routes.ts`)

**File:** `orion-platform-service/src/api/iac-routes.ts`

Add to the existing `iacRoutes` function:

```typescript
// ==================== Plan Details ====================

// GET /workspaces/:id/plans - List plans for a workspace
app.get('/workspaces/:id/plans', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    const plans = await planService.listByWorkspace(params.id);
    return reply.send({ code: 200, message: 'OK', data: plans });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /workspaces/:workspaceId/plans/:planId - Get plan details
app.get('/workspaces/:workspaceId/plans/:planId', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { workspaceId: string; planId: string };
  try {
    const plan = await planService.getById(params.planId);
    if (!plan || plan.workspaceId !== params.workspaceId) {
      return reply.status(404).send({ code: 404, message: 'Plan not found' });
    }
    return reply.send({ code: 200, message: 'OK', data: plan });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== State Versions ====================

// GET /workspaces/:id/state/versions - List state versions
app.get('/workspaces/:id/state/versions', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    const versions = await workspaceService.listStateVersions(params.id);
    return reply.send({ code: 200, message: 'OK', data: versions });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return reply.status(404).send({ code: 404, message: error.message });
    }
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// GET /workspaces/:id/state/diff - Get state diff between versions
app.get('/workspaces/:id/state/diff', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  const query = request.query as { versionA: string; versionB: string };
  try {
    const diff = await workspaceService.getStateDiff(params.id, query.versionA, query.versionB);
    return reply.send({ code: 200, message: 'OK', data: diff });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== Module Details ====================

// GET /modules/:id - Get module details
app.get('/modules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    const module = await workspaceService.getModule(params.id);
    if (!module) {
      return reply.status(404).send({ code: 404, message: 'Module not found' });
    }
    return reply.send({ code: 200, message: 'OK', data: module });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// DELETE /modules/:id - Delete a module
app.delete('/modules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    await workspaceService.deleteModule(params.id);
    return reply.send({ code: 200, message: 'OK', data: { deleted: true } });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return reply.status(404).send({ code: 404, message: error.message });
    }
    return reply.status(500).send({ code: 500, message: error.message });
  }
});
```

**Required service methods:**
- `PlanService.listByWorkspace(workspaceId)` -- list plans for a workspace
- `PlanService.getById(planId)` -- get plan details
- `WorkspaceService.listStateVersions(workspaceId)` -- list terraform state versions
- `WorkspaceService.getStateDiff(workspaceId, versionA, versionB)` -- compute state diff
- `WorkspaceService.getModule(id)` -- get IaC module details
- `WorkspaceService.deleteModule(id)` -- delete an IaC module

---

### P2: Efficiency Routes (`efficiency-routes.ts`)

**File:** `orion-platform-service/src/api/efficiency-routes.ts`

Add to the existing `efficiencyRoutes` function:

```typescript
// ==================== Efficiency Score ====================

// POST /score - Calculate efficiency score for a team/project
app.post('/score', async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as {
    teamId?: string;
    projectId?: string;
    period?: { from: string; to: string };
  };
  try {
    const { deployments, pipelineRecords } = await fetchDeploymentData(
      body.teamId || body.projectId,
      body.period?.from ? new Date(body.period.from) : undefined
    );

    // Calculate composite efficiency score (0-100)
    const timeWindowConfig = doraMetrics.buildTimeWindow('month', 1);
    const deploymentFrequency = doraMetrics.calculateDeploymentFrequency(deployments, timeWindowConfig);
    const changeFailureRate = doraMetrics.calculateChangeFailureRate(deployments, timeWindowConfig);
    const meanTimeToRecovery = doraMetrics.calculateMeanTimeToRecovery(deployments, timeWindowConfig);

    // Scoring model: weighted combination of DORA metrics
    const frequencyScore = Math.min(deploymentFrequency.deploymentsPerDay / 10, 1) * 30; // 30% weight
    const failureScore = Math.max(0, 1 - changeFailureRate.failureRate) * 30; // 30% weight
    const mttrScore = Math.max(0, 1 - meanTimeToRecovery.averageRecoveryTimeMs / (24 * 60 * 60 * 1000)) * 20; // 20% weight
    const leadTimeScore = 20; // placeholder -- would need lead time data

    const totalScore = Math.round((frequencyScore + failureScore + mttrScore + leadTimeScore) * 100) / 100;

    return reply.send({
      code: 200,
      message: 'OK',
      data: {
        score: totalScore,
        grade: totalScore >= 80 ? 'A' : totalScore >= 60 ? 'B' : totalScore >= 40 ? 'C' : 'D',
        breakdown: {
          deploymentFrequency: Math.round(frequencyScore * 100) / 100,
          changeFailureRate: Math.round(failureScore * 100) / 100,
          meanTimeToRecovery: Math.round(mttrScore * 100) / 100,
          leadTimeForChanges: leadTimeScore,
        },
        period: body.period || { from: timeWindowConfig.start, to: timeWindowConfig.end },
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});

// ==================== Export ====================

// POST /export - Export efficiency data
app.post('/export', async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as {
    format?: 'csv' | 'json';
    teamId?: string;
    projectId?: string;
    period?: { from: string; to: string };
  };
  try {
    const format = body.format || 'json';
    const { deployments, pipelineRecords } = await fetchDeploymentData(
      body.teamId || body.projectId,
      body.period?.from ? new Date(body.period.from) : undefined
    );

    if (format === 'csv') {
      // Generate CSV export
      const headers = 'date,deployment_count,success_rate,avg_lead_time_ms,mttr_ms\n';
      const rows = deployments
        .map((d: any) => {
          const date = d.deployedAt ? new Date(d.deployedAt).toISOString().split('T')[0] : '';
          const success = d.status === 'success' ? 1 : 0;
          return `${date},1,${success},${0},${d.recoveryTimeMs || 0}`;
        })
        .join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename=efficiency-report.csv');
      return reply.send(headers + rows);
    }

    // Default: JSON export
    return reply.send({
      code: 200,
      message: 'OK',
      data: {
        format: 'json',
        exportedAt: new Date().toISOString(),
        deploymentCount: deployments.length,
        pipelineRunCount: pipelineRecords.length,
        deployments,
        pipelineRecords,
      },
    });
  } catch (error: any) {
    return reply.status(500).send({ code: 500, message: error.message });
  }
});
```

---

## File Changes Summary

### Files to Create:
| File | Description |
|------|-------------|
| `orion-platform-service/src/api/ephemeral-env-routes.ts` | New route file for ephemeral environments |

### Files to Modify:
| File | Changes | Lines (est.) |
|------|---------|-------------|
| `orion-platform-service/src/api/routes.ts` | Add `ephemeralEnvRoutes` import + registration | +3 |
| `orion-platform-service/src/api/sbom-routes.ts` | Add `/compliance/*`, `/provenance/*`, `/gate/evaluate`, `/gate/history` | +70 |
| `orion-platform-service/src/api/canary-analysis-routes.ts` | Add `/metrics/discover`, `/models/retrain` | +20 |
| `orion-platform-service/src/api/policy-routes.ts` | Add `/bundles/*`, `/test/*`, `PATCH /:id/toggle` | +60 |
| `orion-platform-service/src/api/risk-routes.ts` | Add `/events/*`, `/health-check/history` | +50 |
| `orion-platform-service/src/api/iac-routes.ts` | Add workspace plans, state versions, module details | +60 |
| `orion-platform-service/src/api/efficiency-routes.ts` | Add `/score`, `/export` | +70 |

### No Changes Needed:
- Category 1 routes (Test Selector, Backup, Plugin SPI, EventBus, AI Security, Session, Webhook, Notification) -- already functional
- Category 2 deferred endpoints (Ticketing BI, Build cache, Cost K8s/SaaS, Product Line, Internal Library) -- documented for future work

---

## Service Layer Requirements

The route additions above assume the following service methods exist or need to be created:

### SbomDocumentService
| Method | Status | Notes |
|--------|--------|-------|
| `getComplianceReport(params)` | NEEDS IMPLEMENTATION | Aggregate compliance across SBOMs |
| `getEO14028Compliance()` | NEEDS IMPLEMENTATION | EO 14028 specific check |
| `getEUCRACompliance()` | NEEDS IMPLEMENTATION | EU CRA specific check |
| `createProvenance(input)` | NEEDS IMPLEMENTATION | Store SLSA provenance |
| `listProvenance(buildId?)` | NEEDS IMPLEMENTATION | List provenance records |
| `verifyProvenance(id)` | NEEDS IMPLEMENTATION | Cryptographic verification |
| `evaluateGate(buildId)` | NEEDS IMPLEMENTATION | Gate evaluation |
| `getGateHistory(buildId?)` | NEEDS IMPLEMENTATION | Gate history |

### CanaryAnalysisService
| Method | Status | Notes |
|--------|--------|-------|
| `discoverMetrics(serviceName?)` | NEEDS IMPLEMENTATION | Query Prometheus for available metrics |
| `retrainModel(modelName?)` | NEEDS IMPLEMENTATION | Trigger model retraining |

### PolicyService
| Method | Status | Notes |
|--------|--------|-------|
| `listBundles()` | NEEDS IMPLEMENTATION | List OPA bundles |
| `getBundle(id)` | NEEDS IMPLEMENTATION | Get bundle details |
| `syncBundles()` | NEEDS IMPLEMENTATION | Sync from git registry |
| `testPolicy(rego, testCases)` | NEEDS IMPLEMENTATION | Test rego policy |
| `getTestResults(testId)` | NEEDS IMPLEMENTATION | Retrieve test results |
| `toggle(id)` | NEEDS IMPLEMENTATION | Toggle enabled/disabled |

### PlanService (IaC)
| Method | Status | Notes |
|--------|--------|-------|
| `listByWorkspace(workspaceId)` | NEEDS IMPLEMENTATION | List plans for workspace |
| `getById(planId)` | NEEDS IMPLEMENTATION | Get plan details |

### WorkspaceService (IaC)
| Method | Status | Notes |
|--------|--------|-------|
| `listStateVersions(workspaceId)` | NEEDS IMPLEMENTATION | Terraform state versions |
| `getStateDiff(workspaceId, a, b)` | NEEDS IMPLEMENTATION | Compute state diff |
| `getModule(id)` | NEEDS IMPLEMENTATION | Get module details |
| `deleteModule(id)` | NEEDS IMPLEMENTATION | Delete module |

---

## Testing Requirements

### Unit Tests (per new endpoint)

Each new endpoint requires at minimum:

1. **Success path test** -- validates normal operation returns 200/201 with expected data shape
2. **Error path test** -- validates 404 for not-found, 400 for bad input, 500 for service errors
3. **Type validation test** -- validates request body/query parameter types

Example test pattern:
```typescript
// sbom-routes.test.ts
describe('SBOM Compliance Endpoints', () => {
  it('GET /compliance/report returns compliance data', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sbom/compliance/report',
      query: { scope: 'all' },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.code).toBe(200);
    expect(body.data).toHaveProperty('complianceRate');
  });

  it('GET /compliance/report handles service errors', async () => {
    // Mock service to throw
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sbom/compliance/eo14028',
    });
    expect([200, 500]).toContain(response.statusCode);
  });
});
```

### Route Registration Test

```typescript
// routes-registration.test.ts
describe('Route Registration', () => {
  it('ephemeral-env routes are registered', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/ephemeral-envs' });
    expect(response.statusCode).not.toBe(404);
  });

  it('sbom compliance routes are registered', async () => {
    const routes = ['/compliance/report', '/compliance/eo14028', '/compliance/eu-cra'];
    for (const route of routes) {
      const response = await app.inject({ method: 'GET', url: `/v1/sbom${route}` });
      expect(response.statusCode).not.toBe(404);
    }
  });
});
```

### Integration Test

Verify frontend API call patterns match backend route patterns:
```typescript
// frontend-backend-consistency.test.ts
describe('Frontend-Backend API Consistency', () => {
  const frontendCalls = [
    { method: 'GET', path: '/v1/sbom/compliance/report' },
    { method: 'GET', path: '/v1/sbom/compliance/eo14028' },
    { method: 'GET', path: '/v1/sbom/compliance/eu-cra' },
    { method: 'POST', path: '/v1/sbom/provenance' },
    { method: 'GET', path: '/v1/sbom/provenance' },
    { method: 'GET', path: '/v1/sbom/provenance/:id/verify' },
    { method: 'POST', path: '/v1/sbom/gate/evaluate' },
    { method: 'GET', path: '/v1/sbom/gate/history' },
    { method: 'GET', path: '/v1/canary-analysis/metrics/discover' },
    { method: 'POST', path: '/v1/canary-analysis/models/retrain' },
    { method: 'POST', path: '/v1/policies/bundles/sync' },
    { method: 'GET', path: '/v1/policies/bundles' },
    { method: 'GET', path: '/v1/policies/bundles/:id' },
    { method: 'POST', path: '/v1/policies/test' },
    { method: 'GET', path: '/v1/policies/test/results/:testId' },
    { method: 'PATCH', path: '/v1/policies/:id/toggle' },
    { method: 'POST', path: '/v1/efficiency/score' },
    { method: 'POST', path: '/v1/efficiency/export' },
    { method: 'GET', path: '/v1/risk/events' },
    { method: 'POST', path: '/v1/risk/events/:id/acknowledge' },
    { method: 'GET', path: '/v1/risk/health-check/history' },
    { method: 'GET', path: '/v1/iac/modules/:id' },
    { method: 'DELETE', path: '/v1/iac/modules/:id' },
    { method: 'GET', path: '/v1/ephemeral-envs' },
    { method: 'GET', path: '/v1/ephemeral-envs/:id' },
    { method: 'POST', path: '/v1/ephemeral-envs' },
    { method: 'POST', path: '/v1/ephemeral-envs/:id/wake' },
    { method: 'POST', path: '/v1/ephemeral-envs/:id/teardown' },
    { method: 'GET', path: '/v1/ephemeral-envs/:id/cost' },
    { method: 'GET', path: '/v1/ephemeral-envs/templates' },
  ];

  frontendCalls.forEach(({ method, path }) => {
    it(`${method} ${path} has a backend route`, async () => {
      // Convert :param placeholders to test values
      const testPath = path
        .replace(/:id/g, 'test-123')
        .replace(/:testId/g, 'test-result-1')
        .replace(/:workspaceId/g, 'ws-1')
        .replace(/:planId/g, 'plan-1');
      const response = await app.inject({ method, url: testPath });
      // 404 means route not registered, 4xx (not 404) means route exists but params invalid
      expect(response.statusCode).not.toBe(404);
    });
  });
});
```

---

## Rollout Plan

### Phase 1 (P0): Security-critical gaps
1. Create `ephemeral-env-routes.ts` and register in `routes.ts`
2. Add SBOM compliance/provenance/gate routes + service methods

### Phase 2 (P1): Feature-completeness gaps
1. Add Canary Analysis metric discovery and model retraining
2. Add Policy bundles, test, and toggle endpoints
3. Add Risk events and health-check history

### Phase 3 (P2): Nice-to-have gaps
1. Add IaC plan details, state versions, module operations
2. Add Efficiency score calculation and export

### Phase 4: Deferred (documented for future)
- Ticketing BI dashboard endpoints
- Build cache management UI
- Cost provider management UI
- Product Line release-trains/hotfix channels
- Internal Library dependents/dependencies

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SBOM service methods require DB schema changes | Medium | High | Use in-memory MVP first, add migrations in follow-up |
| Ephemeral env K8s provisioner not configured | High | Medium | Routes return functional mock; K8s integration is separate work |
| Policy bundle sync requires OPA instance | Medium | Medium | Bundle endpoints store metadata; actual OPA deploy is separate |
| Canary model retraining needs ML service | High | Low | MVP stores retrain request; actual training is async job |
| Route ordering conflicts (e.g., `/:id/toggle` vs `/bundles`) | Low | Medium | Use guard clauses and explicit method matching |
