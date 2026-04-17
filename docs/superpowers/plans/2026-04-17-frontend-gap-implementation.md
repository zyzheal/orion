### Task 4: AI Review, Self-Healing, Monitoring, Diagnostic Modules

These 4 modules follow the same established pattern. Each requires:
1. API client file in `orion-frontend/src/api/`
2. Page components in `orion-frontend/src/pages/<ModuleName>/`
3. Router registration

**API Client Files to Create:**
- `orion-frontend/src/api/ai-review.ts` — ~14 functions (review trigger, history, rules CRUD, config)
- `orion-frontend/src/api/self-healing.ts` — ~13 functions (incidents, history, strategies, approvals, effectiveness)
- `orion-frontend/src/api/monitoring.ts` — ~25 functions (metrics, alerts, rules, channels, escalation, notifications)
- `orion-frontend/src/api/diagnostic.ts` — ~15 functions (trigger, sessions, reports, knowledge, status)

**Pages to Create:**

| Module | Pages | Key Components |
|--------|-------|----------------|
| **AI Review** | `/ai-review/dashboard`, `/ai-review/history`, `/ai-review/history/:id`, `/ai-review/rules`, `/ai-review/config` | ReviewDashboard, ReviewHistoryList, ReviewDetail (split diff+comments), RuleList+Modal, ReviewConfigForm |
| **Self-Healing** | `/self-healing/incidents`, `/self-healing/incidents/:id`, `/self-healing/history`, `/self-healing/strategies`, `/self-healing/approvals`, `/self-healing/effectiveness` | IncidentList, IncidentTimeline, StrategyModal, ApprovalQueue, EffectivenessDashboard |
| **Monitoring** | `/monitoring/dashboard`, `/monitoring/metrics`, `/monitoring/alerts`, `/monitoring/rules`, `/monitoring/channels`, `/monitoring/escalation` | MonitoringDashboard, MetricChart, AlertList, AlertRuleModal, ChannelModal, EscalationPolicyModal |
| **Diagnostic** | `/diagnostic/sessions`, `/diagnostic/sessions/:id`, `/diagnostic/reports`, `/diagnostic/knowledge`, `/diagnostic/trigger` | DiagnosticTrigger, SessionDetail, ReportViewer, KnowledgeBase, PatternModal |

**Implementation approach for each module:**
1. Create API client following `build-env.ts` pattern — types + axios functions grouped by resource
2. Create Layout component following `BuildEnv/index.tsx` pattern — Sider + Menu + Outlet
3. Create list pages following `BuilderImageList.tsx` pattern — Table + SearchFilterBar + Modal CRUD
4. Create detail pages following `BuildPodDetail.tsx` pattern — Descriptions + child components
5. Register routes following existing pattern in `routes.ts`

**Route registration (add to `orion-frontend/src/router/routes.ts`):**

```typescript
// AI Review routes
{
  path: '/console/ai-review',
  element: React.lazy(() => import('@/pages/AIGateway')), // Reuse or create new
  protected: true,
},
// Self-Healing routes (create new layout + pages)
{
  path: '/console/self-healing',
  element: React.lazy(() => import('@/pages/SelfHealing')),
  protected: true,
  children: [
    { path: '/console/self-healing/incidents', element: React.lazy(() => import('@/pages/SelfHealing/IncidentList')), protected: true },
    { path: '/console/self-healing/incidents/:id', element: React.lazy(() => import('@/pages/SelfHealing/IncidentDetail')), protected: true },
    { path: '/console/self-healing/history', element: React.lazy(() => import('@/pages/SelfHealing/History')), protected: true },
    { path: '/console/self-healing/strategies', element: React.lazy(() => import('@/pages/SelfHealing/StrategyList')), protected: true },
    { path: '/console/self-healing/approvals', element: React.lazy(() => import('@/pages/SelfHealing/ApprovalQueue')), protected: true },
    { path: '/console/self-healing/effectiveness', element: React.lazy(() => import('@/pages/SelfHealing/EffectivenessDashboard')), protected: true },
  ],
},
// Monitoring routes
{
  path: '/console/monitoring',
  element: React.lazy(() => import('@/pages/Monitoring')),
  protected: true,
  children: [
    { path: '/console/monitoring/dashboard', element: React.lazy(() => import('@/pages/Monitoring/Dashboard')), protected: true },
    { path: '/console/monitoring/metrics', element: React.lazy(() => import('@/pages/Monitoring/Metrics')), protected: true },
    { path: '/console/monitoring/alerts', element: React.lazy(() => import('@/pages/Monitoring/Alerts')), protected: true },
    { path: '/console/monitoring/rules', element: React.lazy(() => import('@/pages/Monitoring/Rules')), protected: true },
    { path: '/console/monitoring/channels', element: React.lazy(() => import('@/pages/Monitoring/Channels')), protected: true },
  ],
},
// Diagnostic routes
{
  path: '/console/diagnostic',
  element: React.lazy(() => import('@/pages/Diagnostic')),
  protected: true,
  children: [
    { path: '/console/diagnostic/sessions', element: React.lazy(() => import('@/pages/Diagnostic/Sessions')), protected: true },
    { path: '/console/diagnostic/sessions/:id', element: React.lazy(() => import('@/pages/Diagnostic/SessionDetail')), protected: true },
    { path: '/console/diagnostic/reports', element: React.lazy(() => import('@/pages/Diagnostic/Reports')), protected: true },
    { path: '/console/diagnostic/knowledge', element: React.lazy(() => import('@/pages/Diagnostic/KnowledgeBase')), protected: true },
    { path: '/console/diagnostic/trigger', element: React.lazy(() => import('@/pages/Diagnostic/Trigger')), protected: true },
  ],
},
```

**Commit strategy:** One commit per module:
```bash
git add orion-frontend/src/api/ai-review.ts orion-frontend/src/pages/AIReview/
git commit -m "feat(frontend): add AI Review pages"

git add orion-frontend/src/api/self-healing.ts orion-frontend/src/pages/SelfHealing/
git commit -m "feat(frontend): add Self-Healing pages"

git add orion-frontend/src/api/monitoring.ts orion-frontend/src/pages/Monitoring/
git commit -m "feat(frontend): add Monitoring pages"

git add orion-frontend/src/api/diagnostic.ts orion-frontend/src/pages/Diagnostic/
git commit -m "feat(frontend): add Diagnostic pages"
```

---

### Task 5: Backend Route Registration for New Features

The P0 features (SBOM, OPA, AI Change Intelligence, ML Canary) need backend route registration. The backend already has the controller/service pattern established. Create route registration files and wire them into the main app.

**Files to Create:**
- `orion-platform-service/src/routes-sbom.ts` — SBOM routes wired to controllers/services
- `orion-platform-service/src/routes-opa.ts` — OPA policy routes
- `orion-platform-service/src/routes-change-intelligence.ts` — AI Change Intelligence routes
- `orion-platform-service/src/routes-canary-analysis.ts` — ML Canary Analysis routes

**Pattern to follow** (from `routes-plugin.ts`):

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function registerSbomRoutes(
  app: FastifyInstance,
  options: {}
): Promise<void> {
  // Initialize services
  // const sbomService = new SbomService();

  // GET /api/v1/sbom/documents
  app.get('/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    // controller.listDocuments(request, reply)
  });

  // ... additional routes
}
```

**Main app integration:**
Modify `orion-platform-service/src/app.ts` (or equivalent main entry) to register the new route modules:

```typescript
import registerSbomRoutes from './routes-sbom';
import registerOpaRoutes from './routes-opa';
import registerChangeIntelligenceRoutes from './routes-change-intelligence';
import registerCanaryAnalysisRoutes from './routes-canary-analysis';

// In the app setup function:
await app.register(registerSbomRoutes, { prefix: '/api/v1/sbom' });
await app.register(registerOpaRoutes, { prefix: '/api/v1/policies' });
await app.register(registerChangeIntelligenceRoutes, { prefix: '/api/v1/change-intelligence' });
await app.register(registerCanaryAnalysisRoutes, { prefix: '/api/v1/canary-analysis' });
```

**Commit:**
```bash
git add orion-platform-service/src/routes-sbom.ts orion-platform-service/src/routes-opa.ts orion-platform-service/src/routes-change-intelligence.ts orion-platform-service/src/routes-canary-analysis.ts orion-platform-service/src/app.ts
git commit -m "feat(backend): register SBOM, OPA, Change Intelligence, Canary Analysis routes"
```

---

### Task 6: Database Migrations for All New Features

Create migration files for all new database tables across the 6 new features.

**Files to Create:**
- `orion-platform-service/src/db/migrations/020_create_sbom_tables.sql` — 7 SBOM tables
- `orion-platform-service/src/db/migrations/021_create_opa_tables.sql` — 5 OPA tables
- `orion-platform-service/src/db/migrations/022_create_change_intelligence_tables.sql` — 4 CI tables
- `orion-platform-service/src/db/migrations/023_create_canary_analysis_tables.sql` — 5 CA tables + 1 ClickHouse table
- `orion-platform-service/src/db/migrations/024_create_agent_orchestration_tables.sql` — 5 Agent tables
- `orion-platform-service/src/db/migrations/025_create_ephemeral_env_tables.sql` — 4 Env tables

**Migration pattern:** Follow existing migration naming convention in `orion-platform-service/src/db/migrations/`

Each migration file should include:
- CREATE TABLE statements with proper constraints and indexes
- DROP TABLE IF EXISTS for rollback
- Comments describing each table's purpose

**Example (SBOM):**

```sql
-- Migration 020: SBOM Attestation & Supply Chain Provenance
-- Creates tables for SBOM document management, attestation, vulnerability scanning, and provenance tracking

CREATE TABLE IF NOT EXISTS sbom_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL REFERENCES builds(id),
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  format          VARCHAR(20) NOT NULL,
  spec_version    VARCHAR(10) NOT NULL,
  document_id     VARCHAR(255) NOT NULL UNIQUE,
  content         JSONB NOT NULL,
  package_count   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- ... remaining 6 tables from design doc

-- Rollback:
-- DROP TABLE IF EXISTS sbom_provenance, sbom_waivers, sbom_vulnerability_details,
--   sbom_vulnerability_results, sbom_attestations, sbom_packages, sbom_documents;
```

**Commit:**
```bash
git add orion-platform-service/src/db/migrations/02*.sql
git commit -m "feat(db): add migrations for SBOM, OPA, CI, Canary, Agent, Ephemeral Env"
```

---

## Summary

| Task | Deliverable | Estimated Effort |
|------|-------------|------------------|
| Task 1 | Build Env API client | 5 min |
| Task 2 | Build Env pages (7 files) | 30 min |
| Task 3 | Code Mgmt API + pages (7 files) | 25 min |
| Task 4 | AI Review, Self-Healing, Monitoring, Diagnostic | 45 min |
| Task 5 | Backend route registration (4 files) | 15 min |
| Task 6 | Database migrations (6 files) | 20 min |

**Total: ~140 minutes, 6 commits, ~30 new files**
