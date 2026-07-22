# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orion is an AI-driven DevOps platform for R&D efficiency. Core主张: "不替代现有工具链，而是让现有工具链变聪明" — it integrates Tekton, Knative, Prometheus, and K8s rather than replacing them.

**44+ modules, 170+ design docs, 5 sub-projects.** Design docs live in `docs/`, code in multiple service directories.

## Repository Structure

```
orion-platform-service/     # Core backend (Node.js + TypeScript + Fastify) — main workhorse
orion-api-gateway/          # API Gateway (Node.js + Fastify + http-proxy)
orion-frontend/             # Frontend (React + Vite + Ant Design + Orion-MF 自研微前端)
orion-ai-service/           # AI microservice (Python) — 权威实现
orion-ai-svc/               # AI microservice (TS) — 微服务蓝图，与 orion-ai-service 功能重叠
orion-ai-agents-svc/        # AI Agents 专项服务（Python 蓝图）
orion-visor/                # Ops visualization (Java/Spring)
orion-knowledge/            # AI knowledge base (PandaWiki fork)
orion-dba/                  # DB management platform
docs/                       # 260+ design docs organized by domain
```

### orion-*-svc 独立微服务目录

项目有 **87 个** `orion-*-svc*` 独立服务目录（37 TS + 47 Go + 2 Python + 1 Rust），**全部有真实实现代码**（非占位）。当前生产部署以 `orion-platform-service` 单体为主，这些目录是为未来微服务拆分准备的蓝图。

**命名约定**：
- `orion-<domain>-service` = Python 权威服务（如 `orion-ai-service`）
- `orion-<domain>-svc` = TS 微服务蓝图
- `orion-<domain>-svc-go` = Go 微服务蓝图
- `orion-<domain>-svc-py` = Python 微服务蓝图
- `orion-cmdb-service` = 唯一已部署的 Go 服务（例外命名）
- 完整映射见项目根目录 `MICROSERVICES.md`

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

## Key Environment Variables (Skills CLI Reference)

> 以下环境变量被 4 个 AI 技能（design-constraint / design-doc-reviewer / code-design-analyzer / task-decomposer）的 CLI 命令引用。所有 `${...}` 变量在此统一定义，技能文件中不再重复赋值。

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `CLI_CHECK_PATH` | `docs/design-constraints/framework/core/cli-check.ts` | AST 检测引擎 CLI 入口 |
| `FRONTEND_SRC` | `orion-frontend/src` | 前端源码根目录 |
| `BACKEND_SRC` | `orion-platform-service/src` | 后端核心服务源码 |
| `BACKEND_SVC_ROOT` | `.` (项目根目录) | `orion-*-svc` 微服务目录所在 |
| `GATEWAY_ROOT` | `orion-api-gateway` | API 网关源码 |
| `PROJECT_ROOT` | `.` (项目根目录) | 项目根目录 |
| `PROJECT_NORMS` | `docs/规范汇总/Orion统一规范汇总.md` | Orion 规范汇总文档 |
| `NORMS_DOC_NAME` | `Orion统一规范汇总.md` | 规范文档简称 |
| `PROJECT_DESIGN_CONSTRAINTS_ROOT` | `.design-constraints` | 设计约束结果输出目录（baseline、false-positives） |

**使用方式**：Agent 在执行 CLI 命令前，先读取本章节获取变量值。例如：
```bash
npx tsx docs/design-constraints/framework/core/cli-check.ts --scan orion-frontend/src/pages/ --max-files 200
```

## Key Architecture Numbers (2026-07-01)

| Dimension | Count | Notes |
|-----------|-------|-------|
| **Backend services** | 139 dirs in `src/services/` | 100 有 index.ts barrel 导出, 38 有源码无导出 |
| **Substantial services (3+ files)** | 73 | Services with real implementation |
| **Frontend pages** | 202 | `orion-frontend/src/pages/` |
| **Frontend API clients** | 239 | `orion-frontend/src/api/` |
| **Frontend .tsx/.ts files** | 739/.tsx + 345/.ts | Frontend source files |
| **Backend routes** | 175 | `api/*-routes.ts` files |
| **DB migrations** | 643 | SQL migration files (001+) |
| **Design docs** | ~466 | Across 27 category directories |
| **ADR decisions** | 7 | `docs/adr/` |
| **Microservice dirs** | 87 | 37 TS + 47 Go + 2 Python + 1 Rust (全部蓝图, 非独立部署) |
| **Test suites** | 305+ | Backend Jest tests |
| **CodeGraph 索引** | 9407 文件, 113487 节点 | AST 级代码知识图谱 |

## Important Context

### Current Implementation State (2026-07-01)
- **Backend**: ~85% (139 services, 73 substantial, 30+ migrated to PostgreSQL Repository pattern)
- **Frontend**: ~88% (202 pages, 57+ main pages + dashboard variants, 239 API clients)
- **API consistency**: ~20% 精确匹配（35/175 routes 有对应前端页面，命名/微前端模式导致大量"假 Gap"）
- **Database**: 643 migration files; most services use PostgreSQL Repository pattern
- **TypeScript**: All critical errors fixed; ongoing cleanup of edge-case type issues
- **微服务**: 87 个 orion-*-svc* 目录，全部为蓝图（非独立部署），47 个 Go 微服务仅有 go.mod 无 main.go

### Known Issues to Be Aware Of
1. **Dual ArtifactService confusion**: `services/artifact/` and build-related services have overlapping responsibilities
2. **orion-platform-service is the monolith**: All 87 microservice directories have substantial code but are currently deployed as a single process
3. **Go 微服务不可独立部署**: 47 个 Go 微服务目录均有 `go.mod` 但无 `main.go`，仅为编译单元
4. **前端-后端命名不一致**: 35/175 routes 有精确匹配的前端页面（20%），大量页面通过 Orion-MF 微前端模式加载
5. **38 个服务缺少 barrel 导出**: 有源码但无 `index.ts`，影响模块化引用

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

### 前端交互完整性审查规则（强制）

> **核心原则：不写模糊评价，只写具体事实。**
> 每次编写或修改前端组件后，必须通过以下审查：

#### 1. 逐元素交互链审查

对页面上每个可操作元素，确认完整交互链：

| 检查项 | 要求 | 反例 |
|--------|------|------|
| 可操作元素有无交互？ | 每个按钮/列表项必须有 onClick/onChange | 只渲染无点击事件 |
| 操作后有无反馈？ | 成功 `message.success`，失败 `message.error` | 操作后无提示 |
| 有无 loading 状态？ | 异步操作必须有 loading/disabled | 点击后无状态变化 |
| 有无空状态引导？ | 列表为空时 Empty + 引导按钮 | 空白区域 |

#### 2. 逐字段读写状态审查

对每个表单/详情面板中的字段：

| 检查项 | 要求 | 反例 |
|--------|------|------|
| 字段是可编辑还是只读？ | 明确标注，可编辑字段必须有 Input/Select 等 | 用 `<Text>` 展示本应可编辑的字段 |
| 有无校验规则？ | 必填项有 `rules`，格式字段有 validator | 无校验直接提交 |
| 修改后如何保存？ | 必须有保存按钮，调用对应 update API | 改了但没有保存入口 |
| 保存失败如何提示？ | catch 错误并 `message.error` | 静默失败 |

#### 3. CRUD 完整性审查

每个数据实体必须支持完整 CRUD 操作：

| 操作 | 必须有 | 常见缺失 |
|------|--------|---------|
| Create | 创建入口（按钮/弹窗） | 只有列表无创建 |
| Read | 列表 + 详情查看 | 列表无详情入口 |
| Update | 编辑入口 + 编辑表单 + 保存按钮 | **只有查看无编辑**（本次遗漏根因） |
| Delete | 删除按钮 + 二次确认 | 删除无确认 |

#### 4. 场景逆向验证

编写完成后，选一个真实场景走一遍：

```
场景示例："把审批节点的审批人从张三改成李四"
1. 找到节点 → 有编辑入口吗？
2. 打开编辑 → 有审批人输入框吗？
3. 修改值 → 有保存按钮吗？
4. 点击保存 → 调了 updateWorkflow 吗？
5. 保存成功 → 有 success 提示吗？界面刷新了吗？
6. 保存失败 → 有 error 提示吗？表单值保留了吗？

卡在哪一步就修哪一步。
```

#### 5. 反模式清单（禁止出现）

以下模式视为交互缺失，必须在编码时避免：

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| Drawer/Modal 内全部 Descriptions 只读 | 用户无法编辑 | 可编辑字段用 Form.Item + Input |
| 只有查看操作无编辑按钮 | 改不了 | 增加编辑按钮 + 编辑模式 |
| 操作后无 message 提示 | 用户不知道成功/失败 | 每个异步操作加 success/error |
| 按钮无 loading/disabled | 可重复点击 | 异步操作时 disabled + loading |
| 空数据只写 Empty 无引导 | 用户不知道怎么开始 | Empty + 引导按钮 |
| 表单无提交按钮 | 改了无法保存 | 底部固定保存按钮 |

### 页面标题规范 (2026-05-21)

> 所有页面主标题需保持统一的视觉风格，8大菜单模块（工作台、控制台、交付、可观测性、AI平台、基础设施、治理、生态）共用此规范。

#### 主标题样式

| 属性 | 规范值 | Token |
|------|--------|-------|
| 标题级别 | `level={2}` | - |
| 字体大小 | `20px` | - |
| 字体粗细 | `600` | `fontWeight.semibold` |
| 字体颜色 | `#1f1f1f` | `colors.neutral[900]` |
| 底部间距 | `8px` (有副标题) / `16px` (无副标题) | `spacing.sm` / `spacing.md` |

**代码示例**：

```jsx
import { Title } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';

// 有副标题
<Title level={2} style={{ marginBottom: 8 }}>
  <DashboardOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
  页面主标题
</Title>

// 无副标题
<Title level={2} style={{ marginBottom: 16 }}>
  页面主标题
</Title>
```

#### 副标题/描述样式 (可选)

| 属性 | 规范值 | 说明 |
|------|--------|------|
| 组件 | `Typography.Text` | 使用 Ant Design 组件 |
| 字号 | `14px` | 较主标题小 |
| 颜色 | `#8c8c8c` | `colors.neutral[500]` |
| 底部间距 | `16px` | 与内容区分 |

#### 图标规范

| 属性 | 规范值 |
|------|--------|
| 位置 | 标题文字左侧 |
| 间距 | `marginRight: 12px` |
| 颜色 | `colors.primary[500]` (可按模块调整) |

**8大菜单图标映射**：

| 模块 | 图标 |
|------|------|
| 工作台 | `DashboardOutlined` |
| 控制台 | `SettingOutlined` |
| 交付 | `CloudUploadOutlined` |
| 可观测性 | `RadarChartOutlined` |
| AI 平台 | `RobotOutlined` |
| 基础设施 | `ClusterOutlined` |
| 治理 | `SafetyCertificateOutlined` |
| 生态 | `AppstoreOutlined` |

#### 特殊情况处理

- **Section 标题**：使用 `level={3}`，底部间距 `12px`
- **卡片内标题**：使用 `level={4}`
- **居中场景**：使用 `textAlign: 'center'`
- **暗色模式**：标题 `rgba(255,255,255,0.85)`，副标题 `rgba(255,255,255,0.45)`

#### 响应式适配

| 屏幕宽度 | 主标题字号 |
|----------|------------|
| ≥1200px | `level={2}` (20px) |
| 768-1199px | `level={3}` (18px) |
| <768px | `level={3}` (16px) |

## 能力边界约束（防止过度设计）

> 以下 4 项能力已被明确拒绝，**任何 Agent 不得在后续会话中尝试实现**。

| 编号 | 被拒绝能力 | 拒绝理由 | 正确做法 |
|------|-----------|---------|---------|
| RC-01 | 实现 200 项 AST detector | 当前 37 项 AST detector + 128 项 Review 覆盖 213 项检查项（AST 40% = 85 项, Review 60% = 128 项），不再追求 100% AST 覆盖 | 未覆盖维度由 design-doc-reviewer 文档评审 + code-design-analyzer 架构分析补充 |
| RC-02 | 重复检测同一问题 | design-constraint 是 AST 检测唯一权威，其他技能消费结果不做重复检测 | code-design-analyzer 能力四已改为消费 AST 结果，不自行 grep 检测 |
| RC-03 | 自动编写生产代码 | 技能只负责检测/评审/拆分，不直接修改生产代码 | task-decomposer 生成子任务 + 验收标准，由用户确认后执行 |
| RC-04 | CICD 实时监控集成 | CICD 属于运维层，应由运维文档 + design-doc-reviewer 评审覆盖，非 AST 可检测范围 | 在 CI pipeline 中调用 `cli-check.ts` 作为静态检查步骤 |

### 执行约束

1. **覆盖率目标**：保持 AST 40% (85 specs) + Review 60% (128 specs) = 100% (213 项规格)，不再追求 100% AST 覆盖
2. **单一职责**：每项检测只有一个技能负责，其他技能只消费不检测
3. **人工确认门控**：所有自动检测结果必须经用户确认后才能转化为生产代码修改
4. **AST 适用边界**：仅对代码级可静态检测的维度使用 AST（A1/A2/A3/B2/S 层），运维/体验/运行时维度由文档评审补充

## 四技能自动触发规则

当检测到以下场景时，**必须自动调用对应技能**，不得跳过或延迟执行：

### 自动触发规则表

| 触发场景 | 触发动作 | 技能 | 执行内容 |
|---------|---------|------|---------|
| 编写/修改 `.tsx` 或 `.ts` 前端代码 | 编码完成后自动执行交互链审查 | design-constraint | `cli-check.ts --verify <文件路径>` |
| 创建/修改 `docs/**/*.md` 设计文档 | 文档保存后自动评审 | design-doc-reviewer | 7 维度评审 + 代码验证 |
| 代码提交前（commit 前） | 自动执行回归检测 | design-constraint | `cli-check.ts --regression` |
| 用户说"完成了"/"做完了"/"开发完成" | 自动触发三轮评审 | task-decomposer | 拆分验证 → AST 验证 → 门控报告 |
| 用户说"评审 xxx.md" | 自动评审文档 | design-doc-reviewer | 7 维度 + 代码验证 |
| 用户说"分析代码"/"对比实现" | 自动代码分析 | code-design-analyzer | 架构评审 + 文档对比 |
| 用户说"拆分任务"/"生成计划" | 自动拆分任务 | task-decomposer | 子任务表 + 验收标准 + 验证用例 |
| 用户说"九维输出"/"九维方案"/"设计开发系统" | 自动触发九维方案设计 | task-decomposer 能力九 | 九维覆盖度 → 分表 → 子任务拆分 → 验证门控 |
| 用户说"修复"/"自动修复"/"帮我修"/"直接改代码" | 自动修复代码 + 生成测试 | task-decomposer 能力十 | 读取 AST 结果 → 按规则生成修复代码 → 写测试骨架 → --verify 验证 |
| 修改涉及微前端相关代码 | 自动验证 Orion-MF 规范 | design-constraint | CLI --scan microfront/ SubAppRoute/ |

### 技能协同自动执行

当单个技能执行完毕后，**必须自动触发下游技能**，不得等待用户再次触发：

```
design-constraint 扫描完成
    │
    ├── B1/B2/S 层问题 → 自动 → code-design-analyzer 架构分析
    ├── A1/A3/C/D 层问题 → 自动 → design-doc-reviewer 文档评审
    └── D1-D5 层问题 → 自动 → task-decomposer 任务拆分

评审文档 (design-doc-reviewer)
  ↓ 发现缺失项
  自动 → task-decomposer 拆分修复任务
    ↓ 任务拆分完成
    自动 → design-constraint 验证代码

分析代码 (code-design-analyzer)
  ↓ 发现架构违规
  自动 → task-decomposer 拆分修复任务

开发完成 (task-decomposer)
  ↓ 子任务标记完成
  自动 → design-constraint 回归检测

修复完成 (task-decomposer 能力十)
  ↓ 代码修改完成
  自动 → design-constraint --verify 验证修复

验证不通过
  ↓ 自动重新生成修复方案（最多 3 次）
  → 仍不通过 → 标记 P0 待人工
```

#### 协同输出格式规范

- **design-constraint 扫描完成**：输出末尾必须包含 `Skill Handoff Checklist`，标注各下游技能的问题数和触发方式
- **design-doc-reviewer 评审完成**：输出末尾必须包含 `structured_missing_items` JSON 块，task-decomposer 读取此 JSON 直接拆分任务
- **task-decomposer 拆分任务**：读取 design-doc-reviewer 的 JSON 时，必须确认 `downstream_routing.task_decomposer.count` 与实际数组长度一致

#### 后端验证门控（补充）

前端使用 `--verify` 验证，后端修复使用以下门控：

| 后端修复类型 | 验证方式 | 通过标准 |
|------------|---------|---------|
| tenant_id 过滤 | grep `WHERE.*tenant_id` 或 Repository 基类 | 所有查询含 tenant_id |
| 结构化日志 | grep `logger\.(error\|warn)\({.*traceId}` | 异常处理用结构化日志 |
| 错误码统一 | grep `OrionError\|CLIENT\.\|SERVER\.` | 无 `throw new Error` |
| Repository 模式 | grep `@Inject\|repository\|createQueryBuilder` | 无直接 SQL 拼接 |
| API 路径一致 | 对比前端 `api/` vs 后端 `*-routes.ts` | 路径/方法/参数匹配 |
| ACL 权限守卫 | grep `aclMiddleware\|authGuard\|canAccess` | 路由有 ACL 拦截 |

#### 修复优先级规则

修复任务必须按依赖关系排序执行：
1. 先修**基础设施层**（Repository 基类、axios 拦截器、错误码常量）
2. 再修**业务逻辑层**（service 调用、controller 处理、组件交互）
3. 最后修**验证层**（测试用例、CLI 验证、回归检测）

### 违反规则的后果

- 编码后不执行 design-constraint 验证 → 代码评审不通过
- 文档修改不执行 design-doc-reviewer 评审 → 文档质量不达标
- 开发完成不执行三轮评审 → 任务不能标记完成

## 技能一致性契约（Skill Consistency Contract）

> 本节是 4 个 AI 技能的单一事实来源（Single Source of Truth）。所有技能文件中的数值、能力列表、评分公式必须与本节一致。当技能文件与本文冲突时，以本文为准。

### 技能概览

| 技能 | 版本 | 核心职责 | 能力数量 | 负责检测层 |
|------|------|---------|---------|-----------|
| design-constraint | v2.5+ | AST 静态检测引擎 | 1 项核心能力 | A1/A2/A3 + B2 + S1-S6（37 个 detector） |
| design-doc-reviewer | v2.4+ | 设计文档 7 维度评审 | 12 项能力 | A1/A3 + C + D 层（文档侧） |
| code-design-analyzer | v2.9+ | 代码架构分析与文档对比 | 13 项能力 | B1/B2/S 层（架构侧） |
| task-decomposer | v2.8+ | 功能拆分、Spec 执行、修复代码生成 | 10 项能力 | 消费所有技能的输出转化为子任务 |

### 覆盖率统一口径

| 指标 | 值 | 说明 |
|------|-----|------|
| AST detector 数量 | 37 | 27 个 AST + 6 个 regex + 4 个其他 |
| AST 覆盖规格数 | 85 项 | profiles/ 200 项规格中的 40% |
| Review 覆盖规格数 | 128 项 | 文档评审覆盖 60% |
| 总覆盖检查项 | 213 项 | 85 + 128 |
| 覆盖率公式 | AST 40% + Review 60% = 100% | 不再追求 100% AST 覆盖 |

### 评分公式分母统一

| 技能 | 能力 | 评分公式分母 | 对应维度数 |
|------|------|-------------|-----------|
| design-doc-reviewer | 能力一（操作链路） | /6 | 6 环节 |
| design-doc-reviewer | 能力二（页面交互） | /4 | 4 检查维度 |
| design-doc-reviewer | 能力三（跨系统串联） | /5 | 5 检查项 |
| design-doc-reviewer | 能力四（产品用户视角） | /3 | 3 子维度平均 |
| design-doc-reviewer | 能力五（开发者视角） | /3 | 3 子维度平均 |
| design-doc-reviewer | 能力七（页面级设计质量） | /9 | 9 评审维度 |
| design-doc-reviewer | 能力七扩展（全栈评审） | /23 | 23 技术栈维度 |
| code-design-analyzer | 能力五（全栈代码分析） | /11 | 11 技术栈维度 |
| code-design-analyzer | 能力九（系统级瓶颈诊断） | /N/A | 诊断型，不评分 |
| code-design-analyzer | 能力十（数据结构设计） | /8 | 8 检查项 |
| code-design-analyzer | 能力十一（框架选型） | /6 | 6 检查项 |
| code-design-analyzer | 能力十二（代码自主探索） | /N/A | 探索型，不评分 |
| code-design-analyzer | 能力十三（依赖影响分析） | /N/A | 分析型，不评分 |

### 九维责任归属

| 维度 | 负责技能 | 说明 |
|------|---------|------|
| 1. 数据结构 | code-design-analyzer | 数据模型/存储选型/一致性 |
| 2. 软件设计原则 | code-design-analyzer | 代码模式/设计模式 |
| 3. 架构设计 | code-design-analyzer | 五层架构/依赖方向 |
| 4. 框架选型 | code-design-analyzer | 技术栈/依赖分析 |
| 5. 容错与弹性 | code-design-analyzer | 异常处理/降级/熔断 |
| 6. 安全与隔离 | design-constraint（AST: S1-S6）+ code-design-analyzer（架构安全分析） | AST 检测归 design-constraint，架构分析归 code-design-analyzer |
| 7. 可观测性 | code-design-analyzer | 日志/指标/追踪 |
| 8. 前端/交互 | design-constraint（AST: A2/A3） | 交互链/五态/Token |
| 8a/8b/8c. 兼容性/扩展性/生态 | design-doc-reviewer | 文档侧评审 |

### 环境变量引用统一

所有技能使用的环境变量定义在 CLAUDE.md 的 "Key Environment Variables (Skills CLI Reference)" 章节。技能文件中禁止硬编码路径。

### 概念性设计标注规则

以下内容在技能文件中标注为"概念性"，当前不可执行，仅供架构参考：

- design-constraint: 自动协同管道（YAML 协议）
- task-decomposer: 并行开发支持（多 Agent 分发协议）
- design-doc-reviewer: 自动管道联动

**实际执行方式**：Agent 手动串行调用下游技能。

## 九维方案 Runbook

> 用户说"九维输出"/"九维方案"/"设计开发系统"时的完整执行流程。

### 执行步骤

```
用户请求"九维方案"
    │
    ├─ Step 1: 识别目标
    │   → 确定分析范围（整个项目 or 特定模块）
    │   → 确认目标文件/目录路径
    │
    ├─ Step 2: 九维扫描
    │   → 维度 1/2/3/4/5/7 → code-design-analyzer
    │   → 维度 6 → design-constraint (AST/grep)
    │   → 维度 8/9/8a/8b/8c → design-doc-reviewer
    │
    ├─ Step 3: 汇总报告
    │   → 合并各维度结果
    │   → 应用错误传播契约（失败维度标记降级状态）
    │   → 输出覆盖率 + 核心缺失项
    │
    ├─ Step 4: 子任务拆分（如用户要求）
    │   → task-decomposer 按维度拆分修复任务
    │   → 生成依赖 DAG + 验收标准
    │
    └─ Step 5: 验证门控
        → 每个子任务完成后执行三轮评审
        → AST 验证 + 规范合规 + 交互链 8 项
```

### 自检命令

| 检查项 | 命令 |
|--------|------|
| 九维完整性 | `grep "九维自检命令" .claude/skills/*/SKILL.md` |
| AST 引擎 | `npx tsx docs/design-constraints/framework/core/cli-check.ts --scan orion-frontend/src/pages/DashboardNew/ --max-files 5` |
| 版本一致性 | `grep "v2\." .claude/skills/design-constraint/SKILL.md .claude/skills/task-decomposer/SKILL.md .claude/skills/code-design-analyzer/SKILL.md .claude/skills/design-doc-reviewer/SKILL.md` |

### 回退策略

| 失败场景 | 处理方式 |
|---------|---------|
| CLI 不可用 | 降级为 grep，报告标注"⚠️ 降级模式" |
| 核心维度缺失（数据结构/架构/安全） | 标记 P0 阻塞项，输出"核心维度缺失"警告 |
| 代码样本不足 | 标记"跳过-开发中"，建议完成后复查 |
