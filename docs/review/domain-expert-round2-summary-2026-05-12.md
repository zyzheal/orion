# 34 Microservices Domain Expert Review - Round 2

**Date**: 2026-05-12
**Method**: 4 domain expert agent teams (platform, CI/CD, ops-governance, AI-knowledge)
**Reports**: 4 detailed reports in `docs/review/`

---

## Findings Summary by Domain

### 1. Platform Core (orion-api-gateway, platform-service, frontend)
**Readiness**: ~78%
- **P0**: 4 (gateway routing to non-existent ports, auth proxy header loss, Redis leak, RLS pool exhaustion)
- **P1**: 17 (ServiceClient underutilized, EventBus silent failures, approval routes TODO, tenant isolation fake)
- **Security**: 4 (tenant header not cross-validated, JWT no rotation, RBAC not synced)

### 2. CI/CD Pipeline (pipeline, deploy, code, artifact, runner, agent)
**Readiness**: ~45%
- **P0**: 6 (SCM webhook 501, SSE 501, runner RCE, TaskExecutor stubs, deploy routes 501, environment service TODO)
- **P1**: 10 (Engine simulates execution, memory Maps vs PostgreSQL, fake security scans)
- **Security**: 4 (RCE, no container isolation, fake scans, webhook bypass)

### 3. Ops & Governance (15 services)
**Readiness**: ~55%
- **P0**: 4 (cmdb stubs, config-mgmt stubs, selfhealing stubs with dangerous defaults, monitor 501)
- **P1**: 6 (policy always passes, notify no DDL, ticket 65 TODOs, audit hash chain break)
- **Good shape**: audit, risk, governance, dr, approval, chatops, skill (7/15 have PostgreSQL)

### 4. AI & Knowledge (13 services)
**Readiness**: ~40%
- **P0**: 7 (intelligence all stubs, ai-svc import crash, digital-twin stubs, inception credential exposure, visor no auth, federation stubs, graph Cypher injection)
- **P1**: 13 (SSRF in proxies, RAG falls back to string, hardcoded FinOps)

---

## Fixes Applied (Round 2)

| # | Fix | Service | Impact |
|---|-----|---------|--------|
| 1 | Pipeline routes → port 3001 (platform-service) | api-gateway | Pipeline APIs now routable |
| 2 | Auth proxy propagates X-Request-ID, X-Forwarded-For | api-gateway | Tracing restored |
| 3 | Redis disconnect on graceful shutdown | api-gateway | Connection leak fixed |
| 4 | Created LLMTraceService/CostCalculator stubs | ai-svc | Startup crash prevented |

---

## Remaining Critical Issues

### Must Fix Before Production
1. **SCM Webhook routes return 501** (pipeline-svc) — CI cannot be triggered
2. **SSE log routes return 501** (pipeline-svc) — No real-time pipeline logs
3. **Deploy routes return 501** (deploy-svc) — Deployment completely unavailable
4. **TaskExecutor all stubs** (agent-svc) — Agent cannot execute tasks
5. **Self-healing returns autoExecute: true** with hardcoded confidence — dangerous
6. **CMDB/config-mgmt/monitor are pure stubs** — 3 services completely non-functional
7. **Intelligence service all stubs** — AI decision engine non-functional

### Architecture Gaps
- **State management**: Pipeline execution, deployments, approvals use memory Maps (lost on restart)
- **Event bus**: NATS not connected, events silently lost
- **Security**: Runner executes arbitrary commands, no container isolation
- **Auth**: 25+ services lack JWT middleware (rely on gateway-only auth)

---

## Overall Readiness by Service Tier

| Tier | Services | Avg Readiness |
|------|----------|---------------|
| Core (gateway, platform, frontend) | 3 | 78% |
| CI/CD (pipeline, deploy, code, artifact, runner, agent) | 6 | 45% |
| Ops (audit, security, risk, monitor, notify, etc.) | 15 | 55% |
| AI/Knowledge (intelligence, ai, graph, finops, etc.) | 13 | 40% |
| **Overall** | **37** | **~52%** |
