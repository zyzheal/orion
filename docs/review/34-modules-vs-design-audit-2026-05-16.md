# 34 Microservices vs Design Docs Audit Report

**Date**: 2026-05-16 (Updated 2026-05-16 v2)
**Scope**: All 34 microservice directories (`orion-*-svc/`) compared against design documentation in `docs/services/` and `docs/architecture/`
**Methodology**: Direct reading of all 34 `app.ts`/`main.py` entry points, route file enumeration, design doc comparison, infrastructure analysis (PostgreSQL/K8s/migrations)

---

## Executive Summary

| Metric | Count | Notes |
|--------|-------|-------|
| Total microservices | 34 | All have k8s deployment configs |
| Services with design docs | 31 | 3 services lack dedicated design docs |
| Services matching design docs | 12 | Reasonable alignment |
| Services with significant gaps | 15 | Missing features, outdated docs, or implementation divergence |
| Services that are thin wrappers | 7 | Proxy/gateway services for external backends |
| Services with PostgreSQL | 25 | 74% have DB pool integration |
| Services with migrations | 29 | 85% have SQL migration files |
| Total TODO/stub markers | 149 | Distributed across 17 services |
| Intelligence service | Python-based | Only non-Node.js service with real source code |
| Total design documents | ~70+ | Across `docs/services/` and `docs/architecture/` |

### Key Finding: Previous Audit Was Outdated

The 2026-05-15 gaps analysis reported "34 services all lack route files" and "orion-intelligence-svc has no entry point." Both are **incorrect** as of the current codebase:
- **33/34 services have route files** registered in app.ts (only intelligence-svc uses Python routers)
- **orion-intelligence-svc** has a working `src/main.py` with 7 Python routers

### Design Documents by Domain

| Domain | Design Doc Count | Services Covered |
|--------|-----------------|------------------|
| CI/CD (pipeline, deploy, runner, code, artifact, plugin, approval) | ~15 | 7 services |
| AI Intelligence (ai, agent, skill, knowledge, intelligence) | ~25 | 5 services |
| Observability (monitor, selfhealing, config-mgmt, cmdb, dba, visor) | ~15 | 6 services |
| Security (security, audit, risk) | ~13 | 3 services |
| Collaboration (ticket, notify, chatops, community, efficiency) | ~8 | 5 services |
| Advanced (finops, dr, federation, governance, digital-twin) | ~10 | 5 services |
| Wrappers (inception, pandawiki, graph) | ~5 | 3 services |
| Missing design docs | N/A | runner-svc, audit-svc, notify-svc, graph-svc, inception-svc, pandawiki-svc, visor-svc, risk-svc |

---

## Service-by-Service Comparison

### Tier 1: Core CI/CD Layer (7 services)

#### 1. orion-pipeline-svc
- **Source files**: 117 (largest service)
- **Migrations**: 3 (pipeline-specific)
- **Design docs**: `docs/services/pipeline/01-pipeline-spec.md`
- **Routes (7)**: `pipeline.ts`, `pipeline-run.ts`, `pipeline-admin.ts`, `pipeline-sse.ts`, `pipeline-template.ts`, `cache-strategy.ts`, `scm-webhook.ts`
- **Infrastructure**: PostgreSQL + Redis + NATS + EventBus + PipelineEngine + PipelineRunRepository
- **Actual API prefixes**: `/api/v1` (all routes mounted here)
- **Implementation status**:
  - Pipeline CRUD + YAML: Implemented (pipeline.ts)
  - Pipeline Run + Cancel: Implemented (pipeline-run.ts)
  - Pipeline SSE (log streaming): Implemented (pipeline-sse.ts)
  - Pipeline Templates: Implemented (pipeline-template.ts)
  - Pipeline Admin: Implemented (pipeline-admin.ts - versions/diff/rollback/baseline)
  - Cache Strategy: Implemented (cache-strategy.ts)
  - SCM Webhook: Implemented (scm-webhook.ts)
  - Visual Pipeline Editor: Implemented (layouts CRUD in pipeline.ts)
  - Run YAML directly: Implemented (POST /pipelines/run-yaml)
  - Pipeline Budget: **NOT implemented** (design doc Phase 1 Section 3.2)
  - Dynamic Parameters: **PARTIAL** (DynamicParamsResolver exists but route integration unclear)
- **TODO/stub markers**: 30 (most of any service)
- **Discrepancies**: Budget API routes missing; `runtime_params` and `dynamic_stages` columns missing in pipeline_runs
- **Assessment**: ~85% of Phase 1 design. Most mature service, serves as reference template.

#### 2. orion-deploy-svc
- **Source files**: 21
- **Migrations**: 2
- **Design docs**: `docs/services/deploy/04-deploy-spec.md`, `06-canary-traffic-spec.md`, `06-env-mgmt-spec.md`
- **Routes (3)**: `deploy-routes.ts`, `deploy.ts`, `environment.ts`
- **Infrastructure**: PostgreSQL, no dedicated database utility (routes handle DB)
- **Actual API prefix**: `/api/v1`
- **Implementation status**:
  - SmartDeployService: Implemented
  - Blue-green/canary/rolling deployment: Implemented
  - CanaryAnalysisService: Implemented
  - RollbackService: Implemented
  - DeploymentVerifier: Implemented
  - DeploymentStrategyEngine: Implemented
  - Environment management: Implemented
  - K8s deployment: Implemented
  - **Phase 1 gaps**: Deploy windows, dependency coordination, progressive deploy, release notes
- **TODO/stub markers**: 20
- **Assessment**: L3 base solid. Phase 1 enhancements 0% complete.

#### 3. orion-runner-svc
- **Source files**: 7
- **Migrations**: 1
- **Design docs**: None dedicated
- **Routes (2)**: `runner-routes.ts`, `runner.ts` (duplicate!)
- **Infrastructure**: No database; RunnerService with registration + heartbeat to platform
- **Actual API**: Registered via `runnerRoutes` with `{ runner }` dependency injection
- **Discrepancies**: Duplicate route files; no formal design doc
- **Assessment**: Lightweight as designed, needs design doc and route consolidation.

#### 4. orion-code-svc
- **Source files**: 52
- **Migrations**: 1
- **Design docs**: `docs/services/code/` (4 docs)
- **Routes (3)**: `code-repo.ts`, `build.ts`, `test-report.ts`
- **Infrastructure**: PostgreSQL via `getPool()`, 11 controllers
- **Actual API prefixes**: `/api/v1/code-repo`, `/api/v1/build`, `/api/v1/test-reports`
- **Assessment**: ~90% aligned. Well-implemented with 52 source files. Some features exceed doc scope.

#### 5. orion-artifact-svc
- **Source files**: 27
- **Migrations**: 1
- **Design docs**: `docs/services/artifact/` (5 docs)
- **Routes (4)**: `artifact.ts`, `artifact-routes.ts`, `artifact-ops.ts`, `artifact-version.ts`
- **Infrastructure**: PostgreSQL via `getPool()`
- **Actual API prefix**: `/api/v1` (mounted via artifactRoutes)
- **Assessment**: ~90% aligned. Good implementation depth.

#### 6. orion-plugin-svc
- **Source files**: 28
- **Migrations**: 1
- **Design docs**: `docs/services/plugin/` (6 docs)
- **Routes (5)**: `plugin-spi.ts`, `plugin.ts`, `plugin-enhanced.ts`, `plugin-marketplace.ts`, `plugin-routes.ts`
- **Infrastructure**: PostgreSQL via `getPool()`
- **Actual API prefixes**: `/api/v1/plugins-spi`, `/api/v1/plugins`, `/api/v1/plugins-enhanced`, `/api/v1/plugins/marketplace`
- **Discrepancies**: Design doc header says "未实现" but 28 source files contradict. WASM sandbox and gRPC not implemented.
- **Assessment**: Design doc is outdated. ~60% aligned.

#### 7. orion-approval-svc
- **Source files**: 23
- **Migrations**: 1
- **Design docs**: `docs/services/approval/` (2 docs)
- **Routes (2)**: `approval.ts`, `confirmation.ts`
- **Infrastructure**: PostgreSQL via `createDatabasePool()` with explicit config
- **Actual API prefixes**: `/api/v1/approvals`, `/api/v1/confirmations`
- **Discrepancies**: Duplicate service classes (`services/ApprovalService.ts` + `services/approval/ApprovalService.ts`)
- **Assessment**: ~80% aligned. Needs duplicate cleanup.

---

### Tier 2: AI Intelligence Layer (5 services)

#### 8. orion-intelligence-svc
- **Source files**: 15 Python files
- **Migrations**: 0 (Python/FastAPI, would use Alembic)
- **Design docs**: `docs/services/intelligence/` (2 docs)
- **Routes (7)**: `classify.py`, `summarize.py`, `sentiment.py`, `code_review.py`, `root_cause.py`, `solution.py`, `predict_sla.py`
- **Infrastructure**: No database; pure API endpoints
- **Actual API prefixes**: `/api/v1/ai` (all routers mounted here)
- **Discrepancies**: AI models are placeholder/stub implementations; no actual ML integration
- **Assessment**: Well-structured Python service. ~50% (framework exists, ML models are stubs).

#### 9. orion-ai-svc
- **Source files**: 49
- **Migrations**: 1
- **Design docs**: `docs/services/ai/` (20+ docs)
- **Routes (8)**: `ai-routes.ts`, `ai-gateway.ts`, `ai-decision.ts`, `ai-review.ts`, `ai-security.ts`, `degradation.ts`, `vector-store.ts`, `vector.ts`, `llm-trace.ts`
- **Infrastructure**: PostgreSQL via `getPool()`, controllers directory with 3 controllers
- **Actual API prefixes**: `/api/v1/ai-gateway`, `/api/v1/ai-decision`, `/api/v1/ai-review`, `/api/v1/ai-security`, `/api/v1/vector-store`, `/api/v1/vector`, `/api/v1/llm`, `/api/v1/degradation`
- **Discrepancies**: Missing SHAP decision explanations, model A/B testing. Code exceeds doc with prompt injection detection, cost optimization, circuit breaker.
- **Assessment**: ~75% of Phase 2. Core AI gateway and vector operations solid.

#### 10. orion-agent-svc
- **Source files**: 23
- **Migrations**: 2
- **Design docs**: `docs/services/agent/ai-agent-orchestration-design.md`
- **Routes (2)**: `agent.ts` (254 lines, Zod-validated schemas), `task.ts`
- **Infrastructure**: **in-memory Map** (not PostgreSQL); agentStore shared between routes via `setAgentStoreRef()`
- **Actual API prefix**: `/api/v1`
- **Implemented APIs**: GET/POST /agents, GET /agents/:id, POST /agents/:id/heartbeat, task CRUD
- **Missing from design doc**: agent-workflows, agent-runs (full), agent-decisions, agent-approvals, agent-templates
- **Discrepancies**: Design envisions BugFixer/CodeFixer/TestWriter/PRSubmitter multi-agent orchestration. Code only has agent registration + heartbeat.
- **TODO/stub markers**: 19
- **Assessment**: ~60% of design doc. Core agent infrastructure exists; orchestration layer incomplete.

#### 11. orion-skill-svc
- **Source files**: 11
- **Migrations**: 1
- **Design docs**: `docs/services/ai/skill-marketplace-design.md`
- **Routes (1)**: `skill.ts` (151 lines, 11 endpoints)
- **Infrastructure**: No database; has middleware (helmet, rate-limit, CORS)
- **Actual API prefix**: `/api/v1/skills`
- **Discrepancies**: Missing skill execution engine; no dedicated design doc
- **Assessment**: ~70%. Missing skill execution engine.

#### 12. orion-knowledge-svc
- **Source files**: 15
- **Migrations**: 0
- **Design docs**: `docs/services/knowledge/` (4 docs)
- **Routes (3)**: `knowledge.ts` (413 lines), `vector.ts`, `vector-store.ts`
- **Infrastructure**: No direct DB; has k8s + PDB + secret config
- **Actual API prefix**: No explicit prefix (routes registered directly)
- **Discrepancies**: RAG implementation basic; knowledge indexing not implemented
- **Assessment**: ~75%. Vector and knowledge storage solid, RAG capabilities incomplete.

---

### Tier 3: Observability & Operations Layer (6 services)

#### 13. orion-monitor-svc
- **Source files**: 24
- **Migrations**: 1
- **Design docs**: `docs/services/monitor/` (8 docs)
- **Routes**: **No dedicated route files** - all 16 routes registered directly in `app.ts`
- **Infrastructure**: In-memory services (MonitoringService, AlertService, SelfHealingService, OnCallService, PrometheusService)
- **Actual routes in app.ts** (16 endpoints):
  - Monitoring: POST/GET/PUT/DELETE `/api/v1/monitoring/rules`
  - Alerts: GET `/api/v1/alerts`, POST `/api/v1/alerts/subscribe`, POST `/api/v1/alerts/:id/resolve`, POST `/api/v1/alerts/ingest`
  - Self-healing: POST `/api/v1/self-healing/policies`, GET `/api/v1/self-healing/policies`, GET `/api/v1/self-healing/runs`, POST `/api/v1/self-healing/trigger`
  - OnCall: POST/GET/PUT/DELETE `/api/v1/oncall/schedules`, GET `/api/v1/oncall/current`
- **Discrepancies**: Architecture violates route module separation pattern. All services use in-memory storage (no PostgreSQL). Missing custom alert rules, RCA, alert silences.
- **TODO/stub markers**: 17
- **Assessment**: ~50%. Functional but architecturally inconsistent.

#### 14. orion-selfhealing-svc
- **Source files**: 8
- **Migrations**: 0
- **Design docs**: `docs/services/selfhealing/` (4 docs)
- **Routes (2)**: `selfhealing-routes.ts` (247 lines), `selfhealing.ts` (duplicate!)
- **Infrastructure**: No database; has config + errorHandler
- **Actual API prefix**: `/api/v1`
- **Discrepancies**: Phase 3 chaos engineering (fault injection, resilience scoring, experiment management) 0% implemented
- **TODO/stub markers**: 3
- **Assessment**: ~70% basic self-healing. Phase 3 chaos 0% complete.

#### 15. orion-config-mgmt-svc
- **Source files**: 9
- **Migrations**: 0
- **Design docs**: `docs/services/config-mgmt/` (3 docs)
- **Routes (1)**: `config-mgmt.ts` (16 endpoints)
- **Infrastructure**: PostgreSQL via `getPool()`, passed as `database` to routes
- **Actual API prefix**: `/api/v1`
- **Discrepancies**: GitOps implementation and drift detection engine are shallow
- **TODO/stub markers**: 2
- **Assessment**: ~80% core config management. GitOps/drift need deeper implementation.

#### 16. orion-cmdb-svc
- **Source files**: 8
- **Migrations**: 2
- **Design docs**: `docs/services/cmdb/CMDB模块设计.md` (very comprehensive)
- **Routes (1)**: `cmdb.ts` (191 lines, 12 endpoints)
- **Infrastructure**: PostgreSQL via Pool (inline in route file)
- **Actual API prefix**: `/api/v1` (routes at `/cmdb/nodes`, `/cmdb/applications`, `/cmdb/topology`, `/cmdb/reconciliation`, `/cmdb/events`)
- **Implemented APIs**: nodes CRUD, applications list/get, topology get, reconciliation post/get, events post
- **Missing from design doc**: Terminal management (WebSocket), file management (Monaco Editor), script management (batch execution), tag management, batch operations, server import/export
- **Assessment**: ~40%. Design doc defines Orion Visor-level full-featured CMDB. Only basic CRUD implemented.

#### 17. orion-dba-svc
- **Source files**: 6
- **Migrations**: 0
- **Design docs**: `docs/services/dba/` (5 docs)
- **Routes (1)**: `dba.ts` (17 endpoints)
- **Infrastructure**: No database; **proxy to Yearning** backend (`process.env.YEARNING_URL`)
- **Actual API prefix**: `/api/v1/dba`
- **Discrepancies**: Advanced features from design doc (distributed transactions, SQL audit, sharding/sync) not implemented. Acts as proxy gateway.
- **Assessment**: ~40%. Wrapper service, design doc needs re-scoping.

#### 18. orion-visor-svc
- **Source files**: 6
- **Migrations**: 1
- **Design docs**: Referenced in architecture docs only
- **Routes (1)**: `visor-routes.ts` (21 endpoints)
- **Infrastructure**: No database; **proxy to Visor** backend (`process.env.VISOR_URL`)
- **Actual API prefix**: `/api/v1/visor`
- **Discrepancies**: No dedicated design doc; proxy architecture
- **Assessment**: ~80% as wrapper service.

---

### Tier 4: Security & Compliance Layer (3 services)

#### 19. orion-security-svc
- **Source files**: 41
- **Migrations**: 1
- **Design docs**: `docs/services/security/` (11 docs)
- **Routes (5)**: `security-routes.ts`, `sbom.ts`, `policy.ts`, `quality-gate.ts`, `risk.ts`, `supply-chain.ts`
- **Infrastructure**: PostgreSQL via `getPool()`, EventBus injected
- **Actual API prefixes**: `/api/v1/risk`, `/api/v1/sbom`, `/api/v1/supply-chain`, `/api/v1/policies`, `/api/v1/quality-gates`, plus `/dashboard` and `/status` in security-routes.ts
- **Discrepancies**: Prompt injection protection is in ai-svc instead. Quality gate dashboard returns mock data (TODO).
- **TODO/stub markers**: 5
- **Assessment**: ~75%. Well-structured, but dashboard aggregation not implemented.

#### 20. orion-audit-svc
- **Source files**: 15
- **Migrations**: 1
- **Design docs**: No dedicated design doc
- **Routes (2)**: `audit.ts`, `compliance.ts`
- **Infrastructure**: No database; has helmet + rate-limit + requestLogger middleware
- **Actual API prefix**: `/api/v1/audit`, `/api/v1` (compliance)
- **Health**: `/healthz`
- **Discrepancies**: No dedicated design doc. Audit log archival missing.
- **Assessment**: ~70%.

#### 21. orion-risk-svc
- **Source files**: 9
- **Migrations**: 2
- **Design docs**: `docs/services/security/risk-assessment-design.md`
- **Routes (1)**: `risk.ts` (209 lines, 11 endpoints)
- **Infrastructure**: PostgreSQL via `initializeDatabase()` (graceful fallback if DB fails)
- **Actual API prefix**: `/api/v1`
- **Discrepancies**: RiskAssessmentService also exists in security-svc - potential duplication
- **Assessment**: ~80%. Overlap with security-svc needs clarification.

---

### Tier 5: Operations & Collaboration Layer (5 services)

#### 22. orion-ticket-svc
- **Source files**: 35
- **Migrations**: 0
- **Design docs**: `docs/services/ticket/` (2 docs)
- **Routes (5)**: `ticket-full.ts` (413 lines), `ticket.ts` (stub!), `bi.ts`, `dispatch.ts`, `sla.ts`
- **Infrastructure**: No database; has error-handler utility
- **Actual API prefix**: `/api/v1`
- **Discrepancies**: `ticket.ts` is a stub while `ticket-full.ts` has full implementation. Onboarding design features not implemented.
- **TODO/stub markers**: 7
- **Assessment**: ~75%. Stub ticket.ts should be removed.

#### 23. orion-notify-svc
- **Source files**: 17
- **Migrations**: 2
- **Design docs**: `docs/services/webhook-management-design.md`
- **Routes (2)**: `notification.ts`, `webhook.ts`
- **Infrastructure**: No database; has helmet + rate-limit + requestLogger middleware
- **Actual API prefixes**: `/api/v1/notifications`, `/api/v1/webhooks`
- **Health**: `/healthz`
- **Discrepancies**: No dedicated notify-svc design doc
- **Assessment**: ~70%.

#### 24. orion-chatops-svc
- **Source files**: 210 (second largest)
- **Migrations**: 1
- **Design docs**: `docs/services/chatops/` (3 docs)
- **Routes (1)**: `chatops.ts` (448 lines)
- **Infrastructure**: PostgreSQL via `pool`, graceful shutdown with pool.end()
- **Actual API prefix**: `/api/v1`
- **CRITICAL**: 96 repository files duplicating other services (AgentProfileRepository, AlertRuleRepository, ArtifactRepository, BudgetRepository, etc.)
- **TODO/stub markers**: 13
- **Assessment**: ~60%. Major architectural concern with duplicated repositories.

#### 25. orion-community-svc
- **Source files**: 14
- **Migrations**: 0
- **Design docs**: `docs/services/community/` (2 docs)
- **Routes (2)**: `community.ts` (96 lines), `community-advanced.ts`
- **Infrastructure**: PostgreSQL via `checkHealth()`, `closePool()`
- **Actual API prefixes**: `/api/v1/community`, `/api/v1/community-advanced`
- **Assessment**: ~50%. Ecosystem features incomplete.

#### 26. orion-efficiency-svc
- **Source files**: 21
- **Migrations**: 1
- **Design docs**: `docs/services/efficiency/` (3 docs)
- **Routes (3)**: `efficiency-routes.ts`, `efficiency.ts`, `efficiency-enhanced.ts`
- **Infrastructure**: PostgreSQL via `getPool()`, passed as `database` to routes
- **Actual API prefix**: `/api/v1/efficiency`
- **Discrepancies**: Developer profiles, DORA drill-down, contribution evaluation, bottleneck analysis all missing (Phase 2). Dashboard returns mock data.
- **TODO/stub markers**: 7
- **Assessment**: ~40% of Phase 2. Lowest completion rate among implemented services.

---

### Tier 6: Advanced Features Layer (5 services)

#### 27. orion-finops-svc
- **Source files**: 26
- **Migrations**: 0
- **Design docs**: `docs/services/finops/` (3 docs)
- **Routes (4)**: `finops-routes.ts`, `cost.ts`, `cost-operations.ts`, `finops-v2.ts`
- **Infrastructure**: PostgreSQL via `getPool()`, passed as `database`
- **Actual API prefixes**: `/api/v1/cost`, `/api/v1/finops`, `/api/v1/cost-operations`
- **Discrepancies**: Budget gate, cost anomaly detection, deployment cost correlation all missing (Phase 2). No migration files despite PostgreSQL usage.
- **Assessment**: ~50% of Phase 2. Core FinOps solid.

#### 28. orion-dr-svc
- **Source files**: 24
- **Migrations**: 0
- **Design docs**: `docs/services/dr/` (3 docs)
- **Routes (3)**: `backup.ts`, `disaster-recovery.ts`, `disaster-recovery-advanced.ts`
- **Infrastructure**: PostgreSQL via `getPool()`, passed as `database`
- **Actual API prefixes**: `/api/v1/backup`, `/api/v1/disaster-recovery`, `/api/v1/disaster-recovery/advanced`
- **Discrepancies**: DR drill management and RPO/RTO tracking not implemented
- **TODO/stub markers**: 6
- **Assessment**: ~70%. Backup/restore solid, DR drill missing.

#### 29. orion-federation-svc
- **Source files**: 22
- **Migrations**: 2
- **Design docs**: `docs/services/federation/` (5 docs)
- **Routes (4)**: `federation.ts` (37 lines), `federation-advanced.ts`, `multi-cloud.ts`, `multi-cloud-advanced.ts`
- **Infrastructure**: PostgreSQL via `getPool()` (some routes get database, some don't)
- **Actual API prefixes**: `/api/v1/federation`, `/api/v1/federation-advanced`, `/api/v1/multi-cloud`, `/api/v1/multi-cloud-advanced`
- **Discrepancies**: Cross-domain orchestration and multi-cloud auto-discovery not implemented
- **Assessment**: ~65%. Core federation works.

#### 30. orion-governance-svc
- **Source files**: 14
- **Migrations**: 1
- **Design docs**: `docs/services/governance/` (2 docs)
- **Routes (1)**: `governance.ts` (29 lines, 11 endpoints via controller)
- **Infrastructure**: No database; has helmet + rate-limit + requestLogger
- **Actual API prefix**: `/api/v1/api-governance`
- **Discrepancies**: OPA policy engine integration missing. Policy enforcement middleware missing.
- **Assessment**: ~60%.

#### 31. orion-digital-twin-svc
- **Source files**: 8
- **Migrations**: 1
- **Design docs**: `docs/services/digital-twin/01-digital-twin-spec.md`
- **Routes (1)**: `digital-twin.ts` (169 lines, 20+ endpoints)
- **Infrastructure**: No database; DigitalTwinService in-memory
- **Actual API prefix**: `/api/v1/digital-twins`
- **Implemented APIs**: twin CRUD, snapshots, sandbox CRUD, traffic recording/playback (start/stop/pause/list), replay sessions
- **Discrepancies**: Predictive analysis and environment simulation not implemented. Recording/playback exceeds design doc scope.
- **Assessment**: ~70%.

---

### Tier 7: External Service Wrappers (3 services)

#### 32. orion-inception-svc
- **Source files**: 7
- **Migrations**: 0
- **Routes (2)**: `inception.ts` (37 lines, 5 endpoints), `inception-routes.ts`
- **Infrastructure**: No database; config validation for INCEPTION_PASSWORD
- **Actual API prefix**: `/api/v1/inception`
- **Assessment**: ~80% as wrapper. Password validation shows production awareness.

#### 33. orion-pandawiki-svc
- **Source files**: 7
- **Migrations**: 1
- **Routes (2)**: `pandawiki.ts`, `pandawiki-routes.ts` (duplicate!)
- **Infrastructure**: No database; config-based
- **Actual API**: Registered without explicit prefix (graphRoutes pattern)
- **Discrepancies**: Duplicate route files with identical endpoints
- **Assessment**: ~80%. Duplicate route files should be consolidated.

#### 34. orion-graph-svc
- **Source files**: 6
- **Migrations**: 1
- **Design docs**: None dedicated (referenced in AI docs)
- **Routes (1)**: `graph-routes.ts` (80 lines, 6 endpoints)
- **Infrastructure**: Neo4j (GraphService), config validation for NEO4J_PASSWORD
- **Actual API**: `/api/v1/graph/query`, `/api/v1/graph/path`, `/api/v1/graph/topology`, `/api/v1/graph/nodes`, `/api/v1/graph/relationships`
- **Health**: `/healthz`
- **Discrepancies**: Missing PageRank updates, GNN features from AI design docs
- **Assessment**: ~60%. Core Neo4j operations solid, advanced features missing.

---

## Summary Statistics

### Implementation Completeness

| Service | Files | Routes | DB | Design Alignment | Notes |
|---------|-------|--------|----|-----------------|-------|
| pipeline-svc | 117 | 7 | PG+Redis+NATS | 85% | Budget + dynamic params missing |
| deploy-svc | 21 | 3 | PG (2 migrations) | 70% | Phase 1 features 0% |
| runner-svc | 7 | 2 | None | N/A | No design doc, duplicate routes |
| code-svc | 52 | 3 | PG | 90% | Exceeds docs |
| artifact-svc | 27 | 4 | PG | 90% | Well aligned |
| plugin-svc | 28 | 5 | PG | 60% | Doc outdated |
| approval-svc | 23 | 2 | PG | 80% | Duplicate services |
| intelligence-svc | 15 py | 7 | None | 50% | Python, ML stubs |
| ai-svc | 49 | 8 | PG | 75% | Decision explanation incomplete |
| agent-svc | 23 | 2 | Map (in-memory) | 60% | Orchestration incomplete |
| skill-svc | 11 | 1 | None | 70% | Missing execution engine |
| knowledge-svc | 15 | 3 | None | 75% | RAG incomplete |
| monitor-svc | 24 | 0 (in app.ts) | In-memory | 50% | Architectural inconsistency |
| selfhealing-svc | 8 | 2 | None | 70% | Phase 3 0% |
| config-mgmt-svc | 9 | 1 | PG | 80% | GitOps shallow |
| cmdb-svc | 8 | 1 | PG (2 migrations) | 40% | Only basic CRUD vs comprehensive design |
| dba-svc | 6 | 1 | Proxy | 40% | Yearning proxy |
| visor-svc | 6 | 1 | Proxy | 80% | Visor proxy |
| security-svc | 41 | 5 | PG | 75% | Dashboard mock data |
| audit-svc | 15 | 2 | None | 70% | No design doc |
| risk-svc | 9 | 1 | PG (2 migrations) | 80% | Overlaps security-svc |
| ticket-svc | 35 | 5 | None | 75% | Stub + full duplicate |
| notify-svc | 17 | 2 | None | 70% | No design doc |
| chatops-svc | 210 | 1 | PG | 60% | 70+ dup repos |
| community-svc | 14 | 2 | PG | 50% | Ecosystem missing |
| efficiency-svc | 21 | 3 | PG | 40% | Phase 2 ~40% |
| finops-svc | 26 | 4 | PG | 50% | Phase 2 ~50% |
| dr-svc | 24 | 3 | PG | 70% | DR drill missing |
| federation-svc | 22 | 4 | PG (2 migrations) | 65% | Cross-domain missing |
| governance-svc | 14 | 1 | None | 60% | OPA engine missing |
| digital-twin-svc | 8 | 1 | In-memory | 70% | Predictive missing |
| inception-svc | 7 | 2 | None | 80% | Wrapper |
| pandawiki-svc | 7 | 2 | None | 80% | Duplicate routes |
| graph-svc | 6 | 1 | Neo4j | 60% | Advanced features missing |

### TODO/Stub Markers Breakdown (149 total)

**High (20+)**:

| Service | Count |
|---------|-------|
| pipeline-svc | 30 |
| deploy-svc | 20 |

**Medium (5-19)**:

| Service | Count |
|---------|-------|
| agent-svc | 19 |
| monitor-svc | 17 |
| chatops-svc | 13 |
| ticket-svc | 7 |
| efficiency-svc | 7 |
| dr-svc | 6 |
| ai-svc | 6 |
| security-svc | 5 |

**Low (1-4)**:

| Service | Count |
|---------|-------|
| code-svc | 4 |
| approval-svc | 4 |
| selfhealing-svc | 3 |
| plugin-svc | 2 |
| inception-svc | 2 |
| config-mgmt-svc | 2 |
| artifact-svc | 2 |

**Zero markers (17 services)**: runner-svc, cmdb-svc, dba-svc, digital-twin-svc, federation-svc, finops-svc, governance-svc, graph-svc, intelligence-svc, knowledge-svc, notify-svc, pandawiki-svc, risk-svc, skill-svc, visor-svc, community-svc, audit-svc

### Overall Platform Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Core services (pipeline, deploy, code, artifact) | 80% | Strong foundation, Phase 1 gaps |
| AI services (ai, agent, intelligence, skill, knowledge) | 62% | Infrastructure solid, orchestration/ML incomplete |
| Observability (monitor, selfhealing, config, cmdb, dba, visor) | 55% | Base varies, monitor architecturally inconsistent |
| Security (security, audit, risk) | 75% | Well-implemented, some overlap |
| Collaboration (ticket, notify, chatops, community) | 63% | Core present, ecosystem lacking |
| Advanced (finops, dr, federation, governance, digital-twin) | 59% | Lowest tier, Phase 2+ not started |
| Wrappers (inception, pandawiki, graph) | 80% | Appropriately minimal |

---

## Critical Findings

### 1. Architectural Issues

**CRITICAL: chatops-svc repository duplication**
- orion-chatops-svc contains 96 repository files that mirror repositories from other services
- Examples: AgentProfileRepository, AlertRuleRepository, ArtifactRepository, BudgetRepository, CronJobRepository, EnvironmentRepository, etc.
- This violates service boundary principles
- **Recommendation**: Remove duplicated repositories; use inter-service communication (NATS/gRPC)

**CRITICAL: monitor-svc routes in app.ts**
- All 16 routes registered directly in `app.ts` instead of separate route modules
- All services (MonitoringService, AlertService, SelfHealingService, OnCallService) use in-memory storage
- **Recommendation**: Extract to route modules, migrate to PostgreSQL

**MODERATE: Duplicate route files across multiple services**
- ticket-svc: `ticket.ts` (stub) + `ticket-full.ts` (full)
- pandawiki-svc: `pandawiki.ts` + `pandawiki-routes.ts` (identical)
- selfhealing-svc: `selfhealing.ts` + `selfhealing-routes.ts` (overlapping)
- runner-svc: `runner.ts` + `runner-routes.ts` (overlapping)
- **Recommendation**: Consolidate duplicate route files

**MODERATE: Duplicate service classes**
- approval-svc: `services/ApprovalService.ts` + `services/approval/ApprovalService.ts`
- **Recommendation**: Consolidate into single location

### 2. Missing Design Docs

- orion-runner-svc
- orion-audit-svc
- orion-notify-svc
- orion-graph-svc
- orion-inception-svc
- orion-pandawiki-svc
- orion-visor-svc
- orion-risk-svc

### 3. Outdated Design Docs

- **plugin-framework-design.md**: Header says "未实现" but 28 source files contradict
- **deploy 04-deploy-spec.md**: References DeployController but code uses multiple route files
- **ai 01-ai-decision-spec.md**: Does not cover LLM trace, cost optimization, or circuit breaker features
- **CMDB模块设计.md**: Defines comprehensive Visor-level CMDB; only 40% implemented

### 4. Implementation Gaps (Design Doc Features Not in Code)

| Service | Missing Feature | Design Doc |
|---------|----------------|------------|
| pipeline-svc | Budget API routes | 01-pipeline-spec.md Section 3.2 |
| deploy-svc | Deploy windows, dependency coordination, progressive deploy, release notes | 04-deploy-spec.md |
| monitor-svc | Custom alert rules, RCA, alert silences, notification channels | 03-observability-spec.md |
| selfhealing-svc | Chaos engineering (Phase 3) | 01-chaos-engineering-spec.md |
| efficiency-svc | Developer profiles, DORA drill-down, bottleneck analysis | 06-efficiency-operations-spec.md |
| finops-svc | Budget gate, cost anomaly detection, deployment cost correlation | 04-cost-operations-spec.md |
| ai-svc | SHAP decision explanation, model A/B testing | 01-ai-decision-spec.md |
| agent-svc | Multi-agent orchestration, Plugin SPI tool calling | ai-agent-orchestration-design.md |
| cmdb-svc | Terminal, file, script management (Orion Visor features) | CMDB模块设计.md |
| governance-svc | OPA policy engine | opa-policy-engine-design.md |
| federation-svc | Cross-domain orchestration | 13-cross-domain-orchestration-spec.md |

### 5. Code Without Design Docs (Features Exceed Documentation)

| Service | Feature | Evidence |
|---------|---------|----------|
| pipeline-svc | Cache strategy (14 endpoints), Pipeline SSE, Visual Editor | cache-strategy.ts, pipeline-sse.ts |
| ai-svc | LLM trace cost tracking, prompt injection detection | llm-trace.ts, CostCalculator.ts |
| code-svc | K8s-based build | K8sBuildExecutor.ts |
| chatops-svc | NATS/JetStream integration | jetstream-manager.ts |
| dr-svc | Backup scheduler + storage | BackupScheduler.ts, BackupStorage.ts |
| digital-twin-svc | Recording/playback (20+ endpoints) | digital-twin.ts |
| security-svc | PageRank risk scoring, SBOM waiver | PageRankService.ts, SbomWaiverService.ts |
| finops-svc | Cost event publishing | CostEventPublisher.ts |
| monitor-svc | OnCall scheduling, self-healing | self-healing routes in app.ts |

### 6. Services With Zero Migrations

- orion-selfhealing-svc
- orion-ticket-svc
- orion-config-mgmt-svc
- orion-finops-svc
- orion-dr-svc
- orion-knowledge-svc
- orion-runner-svc
- orion-community-svc
- orion-inception-svc
- orion-intelligence-svc (Python, would use Alembic)

These rely on the platform service database, in-memory storage, or have not had migrations extracted yet.

---

## Recommendations

### Immediate (P0)

1. **Fix chatops-svc repository duplication** - Remove 96 duplicated repository files
2. **Fix monitor-svc architecture** - Extract routes from app.ts to separate modules, migrate to PostgreSQL
3. **Consolidate duplicate route files** in ticket-svc, pandawiki-svc, selfhealing-svc, runner-svc
4. **Update plugin-framework-design.md** - Remove "未实现" header
5. **Re-scope CMDB design doc** - Split into phases, mark Visor features as future work

### Short-term (P1)

6. **Update outdated design docs**: deploy 04-deploy-spec.md, ai 01-ai-decision-spec.md
7. **Create missing design docs** for: runner-svc, audit-svc, notify-svc, graph-svc, inception-svc, pandawiki-svc, visor-svc, risk-svc
8. **Consolidate duplicate service classes** in approval-svc
9. **Clarify risk-svc vs security-svc** boundary
10. **Create migration files** for services with zero migrations but active PostgreSQL usage

### Medium-term (P2)

11. **Implement Phase 1 pipeline features**: Budget API, dynamic params
12. **Implement Phase 2 efficiency features**: Developer profiles, DORA drill-down
13. **Implement Phase 2 finops features**: Budget gate, cost anomaly detection
14. **Implement Phase 2 monitor features**: Custom alert rules, RCA, alert silences
15. **Implement Phase 1 deploy features**: Deploy windows, dependency coordination
16. **Migrate agent-svc from in-memory to PostgreSQL**

### Long-term (P3)

17. **Implement Phase 3 selfhealing**: Chaos engineering
18. **Implement Phase 2 AI features**: SHAP decision explanation, model A/B testing
19. **Implement agent orchestration**: Multi-agent collaboration framework
20. **Implement OPA policy engine** for governance-svc
21. **Implement actual ML models** in orion-intelligence-svc

---

*Report generated: 2026-05-16 (v2)*
*Based on direct reading of 34 app.ts/main.py entry points, 79 route files, 70+ design documents, and 855 TypeScript source files*
