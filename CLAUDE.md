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

### orion-*-svc 独立微服务目录

项目有 35 个 `orion-*-svc` 独立服务目录，**全部有真实实现代码**（非占位）。当前生产部署以 `orion-platform-service` 单体为主，这些目录是为未来微服务拆分准备的蓝图。

**开发规则**：
- **新功能开发**应优先在 `orion-platform-service` 中实现
- **修改已有功能**时，应先确认哪个是"权威实现"——通常 `orion-platform-service` 是当前实际使用的版本
- `orion-*-svc` 目录**不应随意删除或修改**，除非用户明确要求
- 很多功能存在双份实现（如通知服务），前端通常只调用 `orion-platform-service`

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

## Frontend Design Principles (2026-05-19)

> 以下设计原则供智能体在编写前端代码时遵循。所有数值引用 `orion-frontend/src/tokens/` 下的 Design Token 体系。

### 风格定位

- **Apple / 飞书风格**：圆润圆角、轻微阴影、充足留白、`wireframe: false`
- 非线框风格，使用组件的立体感和层次区分层级

### 色彩系统 (`src/tokens/colors.ts`)

| 用途 | 色值 | Token |
|------|------|-------|
| 主操作色 | `#3370E6` | `colors.primary[500]` |
| 成功 | `#52c41a` | `colors.success[500]` |
| 警告 | `#faad14` | `colors.warning[500]` |
| 错误 | `#f5222d` | `colors.error[500]` |
| 信息 | `#3a98f4` | `colors.info[500]` |
| 审批中（紫色） | `#7C5CFC` | `colors.purple[500]` |
| 中性灰文字 | `#8c8c8c` | `colors.neutral[500]` |
| 浅色模式背景 | `#ffffff` | `colors.light.bg.primary` |
| 浅色模式次要背景 | `#F5F5F7` | `colors.light.bg.secondary` |

### 圆角系统 (`src/tokens/radius.ts`)

| 组件 | 圆角值 | Token |
|------|--------|-------|
| Card 卡片 | `12px` | `componentRadius.card` |
| Modal 弹窗 | `16px` | `componentRadius.modal` |
| Button 按钮 | `6px` | `componentRadius.button.md` |
| Input 输入框 | `6px` | `componentRadius.input` |
| Tag 标签 | `6px` | `componentRadius.tag` |
| Dropdown 下拉菜单 | `10px` | `componentRadius.dropdown` |
| 基础小圆角 | `4px` | `radius.xs` |

### 阴影系统 (`src/tokens/shadows.ts`)

| 组件 | 阴影值 |
|------|--------|
| Card 卡片 | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` |
| Button 按钮 | `0 1px 2px rgba(0,0,0,0.04)` |
| Dropdown/Popover | `0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)` |
| Modal | `0 20px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.08)` |

### 间距系统 (`src/tokens/spacing.ts`)

| 场景 | 间距值 | Token |
|------|--------|-------|
| Card 之间 | `16px` | `spacing.md` |
| 表单元素间距 | `12px` | `componentSpacing.formItemGap.sm` |
| 按钮组间距 | `8px` | `spacing.sm` |
| Section 标题与内容 | `16px` | `spacing.md` |
| Card 内边距 | `24px` | `componentSpacing.cardPadding.lg` |

### 组件规范

| 属性 | 值 | 说明 |
|------|-----|------|
| 组件默认高度 | `36px` | `componentSize`，区别于传统 32px |
| 表单最大宽度 | `700px` | 表单内容居中 |
| 表格行高 | `48px` | 标准行高 |
| 表格悬停行背景 | `#EBF0FB` | `colors.primary[50]` |
| 输入框聚焦外发光 | `0 0 0 2px rgba(51,112,230,0.1)` | 蓝色光晕 |
| 卡片装饰线 | `3px solid #3370E6` | 左侧状态标识 |

### 动画规范 (`src/tokens/animation.ts`)

| 动画 | 时长 | 场景 |
|------|------|------|
| 淡入 | `200ms` | Tooltip、Modal 出现 |
| 滑入/切换 | `300ms` | Tab 内容切换 |
| 展开/折叠 | `300ms` | Collapse 面板 |
| 加载 | `400ms` | 页面首次加载 |

### 交互状态

| 状态 | 按钮背景 | 文字色 |
|------|---------|--------|
| Primary 默认 | `#3370E6` | `#fff` |
| Primary 悬停 | `#2B5DD6` | `#fff` |
| Primary 按下 | `#1F4BB5` | `#fff` |
| 禁用 | `#d9d9d9` | `#8c8c8c` |
| 加载中 | `#3370E6` (80% 透明度) | `rgba(255,255,255,0.6)` |

### 空状态

- 使用 Ant Design `Empty` 组件
- 配合引导文字或操作按钮
- 不使用纯空白占位

### 响应式断点

| 宽度 | 行为 |
|------|------|
| `>= 1200px` | 完整布局，表格显示所有列 |
| `>= 768px` | 隐藏次要列，表单宽度不变 |
| `< 768px` | Tab 切换为下拉，表格改为卡片列表 |

### 编写前端代码时

1. **优先使用 Design Token**，而非硬编码色值/间距/圆角
2. **使用语义化色彩**：状态用 `colors.success/warning/error/info`，不用自定义色
3. **遵循 4px 网格**：所有间距为 4 的倍数
4. **卡片用阴影而非边框**区分层次（除左侧装饰线外）
5. **保持组件高度为 36px** 默认值
