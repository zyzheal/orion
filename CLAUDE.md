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

## Important Context

### Current Implementation State (~72% overall)
- **Backend**: ~78% (30+ services migrated from Map() to PostgreSQL Repository pattern, M25 persistence complete)
- **Frontend**: ~85% (M6/M29/M30 frontend pages added, 57+ pages total)
- **API consistency**: ~95% (~30 path mismatches between frontend and backend fixed)
- **Database**: 68 migration files (001-049); most services now use PostgreSQL Repository pattern

### Known Issues to Be Aware Of
1. **No real EventBus integration**: Event publishers exist but are not wired to NATS
2. **Dual ArtifactService confusion**: `services/artifact/` and build-related services have overlapping responsibilities
3. **orion-platform-service is the monolith**: All services run in one process; service separation is designed but not implemented

### Recent Milestones (2026-04)
- **M25 Persistence Migration**: 30+ services migrated from `Map()` mock storage to PostgreSQL Repository pattern (SessionService, RoleService, TenantService, ChatOps, SelfHealing, etc.)
- **M6/M29/M30 Frontend**: ProductLine, ArtifactManagement, InternalLibrary frontend pages implemented
- **API Path Consistency**: ~30 frontend-backend path mismatches resolved (~95% consistent)
- **80 Outdated Docs Removed**: Cleanup of cache/review/sprint/task files

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
