# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orion is an AI-driven DevOps platform for R&D efficiency. Core主张: "不替代现有工具链，而是让现有工具链变聪明" — it integrates Tekton, Knative, Prometheus, and K8s rather than replacing them.

**44+ modules, 170+ design docs, 5 sub-projects.** Design docs live in `docs/`, code in multiple service directories.

## Repository Structure

```
orion-platform-service/     # Core backend (Node.js + TypeScript + Fastify) — main workhorse
orion-api-gateway/          # API Gateway (Node.js + Fastify + http-proxy)
orion-frontend/             # Frontend (React + Vite + Ant Design + wujie micro-frontend)
orion-ai-service/           # AI microservice (Python)
orion-visor/                # Ops visualization (Java/Spring)
orion-knowledge/            # AI knowledge base (PandaWiki fork)
orion-dba/                  # DB management platform
docs/                       # 260+ design docs organized by domain
```

### Backend Service Architecture (`orion-platform-service/src/`)

- `api/` — Route definitions. `routes.ts` is the central registry (~48 route modules). Each `-routes.ts` file mounts under a prefix.
- `api/controllers/` — Request handlers
- `services/` — 70+ service modules (tenant, pipeline, finops, alert, diagnostic, self-healing, skill, etc.). 30+ migrated to PostgreSQL Repository pattern.
- `engine/` — Pipeline engine: `PipelineEngine` → `StageExecutor` → `TaskRunner`
- `saga/` — Saga orchestration: `SagaCoordinator`, `PipelineSaga`, `TransactionLog`
- `events/` — Event publishers: Pipeline/Code/Config/Deployment/Incident event types
- `models/` — Data models (TypeScript classes)
- `repositories/` — Data access layer
- `db/migrations/` — SQL migration files (001-049, 68 files)

## Key Commands

### Platform Service
```bash
cd orion-platform-service
npm install
npm run dev          # tsx watch (hot reload)
npm run build        # tsc compile
npm run start        # node dist/index.js
npm run test         # jest
npm run test:coverage
npm run lint
npm run type-check   # tsc --noEmit
```

### API Gateway
```bash
cd orion-api-gateway
npm install
npm run dev
npm run test
```

### Frontend
```bash
cd orion-frontend
npm install
npm run dev          # vite
npm run build
npm run test         # vitest
npm run test:e2e     # playwright
```

### Run a single test
```bash
# Jest (backend)
npx jest -- -t "test name" path/to/test.ts
npx jest path/to/file.test.ts

# Vitest (frontend)
npx vitest run path/to/test.ts
```

## Key Architecture Numbers (2026-05-15)

| Dimension | Count | Notes |
|-----------|-------|-------|
| **Backend services** | 101 dirs in `src/services/` | 553 source .ts files, 273 test files |
| **Substantial services (3+ files)** | 73 | Services with real implementation |
| **Frontend pages** | 149 | `orion-frontend/src/pages/` |
| **Frontend API clients** | 101 | `orion-frontend/src/api/` |
| **Backend routes** | 104 | `api/*-routes.ts` files |
| **DB migrations** | 207 | SQL migration files (001+) |
| **Design docs** | ~466 | Across 27 category directories |
| **ADR decisions** | 7 | `docs/adr/` |
| **Microservice dirs** | 34 | `orion-*-svc/` (planned, not deployed separately) |
| **Test suites** | 305+ | Backend Jest tests |

## Important Context

### Current Implementation State (2026-05-15)
- **Backend**: ~80% (73 substantial services, 30+ migrated to PostgreSQL Repository pattern)
- **Frontend**: ~88% (149 pages, 57+ main pages + dashboard variants)
- **API consistency**: ~95% (~30 frontend-backend path mismatches fixed)
- **Database**: 207 migration files; most services use PostgreSQL Repository pattern
- **TypeScript**: All critical errors fixed; ongoing cleanup of edge-case type issues

### Known Issues to Be Aware Of
1. **Dual ArtifactService confusion**: `services/artifact/` and build-related services have overlapping responsibilities
2. **orion-platform-service is the monolith**: All 34 microservice directories have substantial code but are currently deployed as a single process

### Recent Milestones
- **M25 Persistence Migration**: 30+ services migrated from `Map()` mock storage to PostgreSQL Repository pattern
- **M6/M29/M30 Frontend**: ProductLine, ArtifactManagement, InternalLibrary frontend pages implemented
- **API Path Consistency**: ~30 frontend-backend path mismatches resolved (~95% consistent)
- **80 Outdated Docs Removed**: Cleanup of cache/review/sprint/task files
- **Pipeline SSE Integration**: Real-time log streaming via SSE (Bridge → Service → Routes → Frontend Hook)
- **TypeScript Error Resolution**: ~55+ compilation errors fixed across services

### Service Ports
- API Gateway: `localhost:3000` (healthz)
- Platform Service: `localhost:3001` (healthz)

## Design Documentation

- **INDEX.md** — Master document index (44 modules, 251 features)
- **docs/architecture/** — Architecture designs (40 files)
- **docs/adr/** — Architecture Decision Records (13 files)
- **docs/review/full-review-2026-04-23.md** — Latest full-system review
- **API-QUICK-REFERENCE.md** — API endpoint quick reference

## Current Branch

`feat/frontend-gap-implementation` — Focused on closing frontend-backend gaps and Design Token migration.

## Frontend Gap Implementation Progress (2026-05-18)

### 完成修复 (8项)

| 模块 | 修复内容 | 涉及文件 |
|------|---------|---------|
| 工作台 (DashboardNew) | 对接 pipelines, runs, monitoring API | `orion-frontend/src/pages/DashboardNew/index.tsx` |
| 控制台 (Console) | 对接 plugins, feature-flags, users API | `orion-frontend/src/pages/Console/index.tsx` |
| 子系统 (SubApps) | 从 menuConfigStore 动态获取 | `orion-frontend/src/pages/SubApps/index.tsx` |
| 监控中心路由 | 修复路由 + 菜单路径 | `orion-frontend/src/router/routes.tsx`, `pages/monitor-svc/Monitoring/index.tsx` |
| 诊断中心路由 | 修复路由 + 菜单路径 | `orion-frontend/src/router/routes.tsx`, `pages/security-svc/Diagnostic/index.tsx` |
| 工单详情 (TicketDetail) | 对接 relations, transfer history API | `orion-frontend/src/pages/TicketDetail/index.tsx` |
| 测试管理 (test-selector) | 适配后端 /cases, /suites 端点 | `orion-frontend/src/api/test-selector.ts` |
| 制品版本 API | 完整版本列表、溯源、对比 API | `orion-platform-service/src/api/artifact-version-routes.ts`, `routes.ts` |

### 最终统计
- **完整实现**: 100+ 模块 (100%)
- **分析报告**: `docs/frontend-gap-analysis/页面功能缺失分析报告.md`
