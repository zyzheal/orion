# 后端路由断裂检测与 Mock 逻辑清理分析报告

**生成日期**: 2026-05-22
**分析范围**:
- `orion-platform-service/src/api/routes.ts` (全部路由注册)
- `orion-platform-service/src/api/` 下全部 `-routes.ts` 文件
- `orion-api-gateway/src/routes/api.ts` + `src/config/index.ts`
- `orion-frontend/src/api/` 全部 API 客户端 (101 个文件)

---

## 执行摘要

| 类别 | 数量 | 说明 |
|------|------|------|
| A 类 (前端调用无后端路由) | 8 | 前端调用端点，后端未注册 |
| B 类 (路由空实现) | 3 | 路由存在但返回空/假数据 |
| C 类 (路径不匹配) | 2 | 前端路径与后端不一致 |
| D 类 (Gateway 未代理) | 5 | 微服务 Gateway 配置与实际部署不符 |
| E 类 (路由被注释/未注册) | 3 | 导入但未注册的路由 |
| Mock 逻辑 (前端) | 15 | Promise.resolve 假返回 + mock fallback |

---

## 1. A 类断裂：前端调用但后端无路由 (P0)

### A-1: Agent Approvals API

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/agents.ts:145-158` |
| **调用端点** | `GET /v1/agent-approvals`, `POST /v1/agent-approvals/:id/respond` |
| **后端状态** | 后端 `ai-agent-routes.ts` 无 `/agent-approvals` 路由 |
| **前端行为** | `Promise.resolve([])` + `Promise.resolve({})` 假返回 |
| **影响** | Agent 审批页面永远显示空列表，审批操作无效果 |
| **修复建议** | 在 `orion-platform-service/src/api/ai-agent-routes.ts` 中实现 `/agent-approvals` 路由，或在前端移除调用 |
| **优先级** | P0 |

### A-2: Alert CRUD 缺失端点

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/alerts.ts:78-87` |
| **调用端点** | `DELETE /v1/alert/:id`, `POST /v1/alert/:id/acknowledge`, `POST /v1/alert/:id/resolve` |
| **后端状态** | `alert-routes.ts` 无 delete/acknowledge/resolve 端点 |
| **前端行为** | `deleteAlert` 返回 `Promise.resolve()`，acknowledge/resolve 使用 workaround 端点 |
| **影响** | 告警列表无法删除、确认、解决告警 |
| **修复建议** | 在 `alert-routes.ts` 中实现 `DELETE /:id`、`POST /:id/acknowledge`、`POST /:id/resolve` |
| **优先级** | P0 |

### A-3: Pipeline Cache 管理端点

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/pipelines.ts:174-183` |
| **调用端点** | `DELETE /v1/caches/:key`, `GET /v1/caches` |
| **后端状态** | 后端使用 `/build-cache` 前缀而非 `/caches` |
| **前端行为** | 返回 `Promise.resolve()` 和 `Promise.resolve({ data: [] })` |
| **影响** | Pipeline 缓存管理功能不可用 |
| **修复建议** | 前端改用 `/v1/build-cache/entries/:id` 和 `/v1/build-cache/configs` |
| **优先级** | P1 |

### A-4: Workflow Terminate 端点

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/workflow.ts:195-198` |
| **调用端点** | `POST /v1/workflows/:id/terminate` |
| **后端状态** | `workflow-routes.ts` 无 terminate 端点 |
| **前端行为** | `console.warn` + 空函数 |
| **影响** | 无法终止运行中的工作流 |
| **修复建议** | 在 `workflow-routes.ts` 添加 `POST /:id/terminate` |
| **优先级** | P1 |

### A-5: Ephemeral Dev Environments 全部端点

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/ephemeral-envs.ts:69-113` |
| **调用端点** | `GET/POST /v1/ephemeral-envs`, `GET/POST /v1/ephemeral-envs/:id/*`, `GET /v1/ephemeral-envs/templates` |
| **后端状态** | `ephemeral-env-routes.ts` 存在并注册于 `/ephemeral-envs` 前缀 |
| **实际情况** | 前端 API 客户端**完全未对接**后端，全部函数直接返回 `Promise.resolve()` |
| **影响** | 临时开发环境功能完全不可用 |
| **修复建议** | 重写 `ephemeral-envs.ts`，将每个函数改为调用 `api.get/post/delete(...)` |
| **优先级** | P0 |

### A-6: Notifications Mock Fallback

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/notifications.ts` |
| **Mock 行为** | catch 块中 fallback 到 `mockNotifications` 数组 (来自 `@/pages/__mocks__/mockNotificationData`) |
| **具体位置** | L160-199: 列表空结果时 mock fallback; L209-213: 详情 fallback; L222-224: markAsRead fallback; L243-245: markAllAsRead fallback; L255-257: delete fallback; L289-301: stats fallback |
| **影响** | 当后端不可用时静默降级为 mock 数据，用户看到假通知 |
| **修复建议** | 去除 mock fallback，返回空数组 + 明确错误提示 |
| **优先级** | P2 |

### A-7: Alert Rule 路径混淆

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/alerts.ts:98-124` |
| **调用端点** | `GET/POST/PUT/DELETE /v1/monitoring/rules` |
| **后端状态** | 后端 `alert-routes.ts` 无 `/monitoring/rules` 路径，该路径属于 `monitoring-routes.ts` |
| **影响** | 告警规则管理可能路由到错误的后端服务 |
| **修复建议** | 确认 `/monitoring/rules` 由哪个服务提供，前端路径需与 Gateway 代理配置一致 |
| **优先级** | P1 |

### A-8: Agent Run/Decision 端点未验证

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/agents.ts:103-131` |
| **调用端点** | `GET /v1/agent-runs`, `POST /v1/agent-runs`, `GET /v1/agent-runs/:runId/decisions` 等 |
| **后端状态** | `ai-agent-routes.ts` 注册了 `/ai-agents` 前缀，非 `/agent-runs` |
| **影响** | Agent 运行和决策页面可能 404 |
| **修复建议** | 确认后端实际前缀，前端路径需匹配 |
| **优先级** | P0 |

---

## 2. B 类断裂：路由存在但空实现 (P1)

### B-1: Performance Controller Mock DB

| 项目 | 详情 |
|------|------|
| **文件** | `orion-platform-service/src/api/performance-routes.ts:28-32` |
| **问题** | 当 `options.database` 未传入时，使用 `mockDb = { query: async () => ({ rows: [], rowCount: 0 }) }` 代替 |
| **影响** | 性能分析页面始终返回空数据 |
| **修复建议** | 确保路由注册时传入 `database` 参数，或在无 DB 时返回明确错误而非空数据 |
| **优先级** | P1 |

### B-2: Pipeline Routes 注释说明

| 项目 | 详情 |
|------|------|
| **文件** | `orion-platform-service/src/api/routes.ts:776-777` |
| **注释** | `NOTE: Full pipeline execution routes require PipelineEngine + StageExecutor + TaskRunner which have deep dependency chains. Registering basic CRUD + placeholder for now.` |
| **实际情况** | Pipeline CRUD 和执行路由实际已注册 (L784-983)，但依赖 `options.database` 存在时才生效 |
| **影响** | 无 DB 连接时全部 Pipeline 功能不可用 |
| **修复建议** | 更新注释，确认当前实现状态 |
| **优先级** | P2 |

### B-3: Plugin System Placeholder

| 项目 | 详情 |
|------|------|
| **文件** | `orion-platform-service/src/api/plugin/index.ts:4` |
| **注释** | `// TODO: Implement plugin` |
| **影响** | Plugin 系统可能不完整 |
| **修复建议** | 检查该文件是否为残留文件，确认实际实现位置 |
| **优先级** | P2 |

---

## 3. C 类断裂：路径不匹配 (P1)

### C-1: Pipeline Versions 前缀不一致

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/pipelines.ts:131` → `GET /v1/pipelines/versions/:name` |
| **后端注册** | `orion-platform-service/src/api/routes.ts:1009` → `/pipelines/versions` |
| **Gateway 代理** | `orion-api-gateway/src/routes/api.ts:54` → `/api/v1/pipeline-versions` |
| **不匹配** | 前端用 `/pipelines/versions/:name`，后端注册 `/pipeline-versions`，Gateway 也用 `/pipeline-versions` |
| **修复建议** | 前端改为 `/v1/pipeline-versions?pipeline_name=:name` 或统一路径约定 |
| **优先级** | P1 |

### C-2: Agent Profile vs AI-Agent 前缀

| 项目 | 详情 |
|------|------|
| **前端调用** | `orion-frontend/src/api/agents.ts` → `/v1/agents`, `/v1/agent-runs` |
| **后端注册** | `ai-agent-routes.ts` 注册于 `/ai-agents` 前缀 |
| **不匹配** | 前端路径 `/v1/agents` 与后端 `/ai-agents` 不一致 |
| **修复建议** | 统一为 `/ai-agents` 或 `/agents` |
| **优先级** | P0 |

---

## 4. D 类断裂：Gateway 未代理 (P1)

Gateway (`orion-api-gateway/src/routes/api.ts`) 配置了 34 个微服务的代理路由，但这些服务**在当前部署架构中大部分不存在**：

| Gateway 配置前缀 | 目标服务 | 实际状态 | 优先级 |
|---|---|---|---|
| `/api/v1/pipelines` → `localhost:3002` | Pipeline Service | 未独立部署，功能在 platform-service (3001) 中 | P1 |
| `/api/v1/deploy` → `localhost:3003` | Deploy Service | 未独立部署 | P1 |
| `/api/v1/tickets` → `localhost:3004` | Ticket Service | 未独立部署 | P1 |
| `/api/v1/monitoring` → `localhost:3005` | Monitor Service | 未独立部署 | P1 |
| `/api/v1/agents` → `localhost:3007` | Agent Service | 未独立部署，功能在 platform-service 中 | P1 |
| `/api/v1/digital-twin` → `localhost:3008` | Digital Twin | 未独立部署 | P1 |
| `/api/v1/finops` → `localhost:3009` | FinOps Service | 未独立部署 | P1 |
| `/api/v1/code-repo` → `localhost:3010` | Code Service | 未独立部署 | P1 |
| `/api/v1/plugins` → `localhost:3011` | Plugin Service | 未独立部署，platform-service 有 `/plugins` | P1 |
| `/api/v1/ai` → `localhost:3012` | AI Service | 独立存在 `orion-ai-service/` | P1 |
| `/api/v1/security` → `localhost:3013` | Security Service | 未独立部署 | P1 |
| `/api/v1/artifacts` → `localhost:3014` | Artifact Service | 未独立部署，platform-service 有 `/artifacts` | P1 |
| `/api/v1/efficiency` → `localhost:3015` | Efficiency Service | 未独立部署 | P1 |
| `/api/v1/backup` → `localhost:3016` | DR Service | 未独立部署 | P1 |
| `/api/v1/federation` → `localhost:3017` | Federation Service | 未独立部署 | P1 |
| `/api/v1/approval` → `localhost:3018` | Approval Service | 未独立部署 | P1 |
| `/api/v1/governance` → `localhost:3022` | Governance Service | 未独立部署 | P1 |
| `/api/v1/skills` → `localhost:3023` | Skill Service | 未独立部署，platform-service 有 `/skills` | P1 |
| `/api/v1/self-healing` → `localhost:3024` | Self-Healing Service | 未独立部署 | P1 |
| `/api/v1/risks` → `localhost:3025` | Risk Service | 未独立部署 | P1 |
| `/api/v1/audit` → `localhost:3026` | Audit Service | 未独立部署 | P1 |
| `/api/v1/runner` → `localhost:3028` | Runner Service | 未独立部署 | P1 |
| `/api/v1/config` → `localhost:3029` | Config-Mgmt Service | 未独立部署 | P1 |
| `/api/v1/cmdb` → `localhost:3030` | CMDB Service | 未独立部署 | P1 |
| `/api/v1/inception` → `localhost:3031` | Inception Service | 未独立部署 | P1 |
| `/api/v1/dba` → `localhost:3032` | DBA Service | 未独立部署 | P1 |
| `/api/v1/community` → `localhost:3033` | Community Service | 未独立部署 | P1 |
| `/api/v1/visor` → `localhost:3034` | Visor Service | 未独立部署 | P1 |

**根因分析**：Gateway 配置文件预设了 34 个微服务独立部署，但当前实际以 `orion-platform-service` 单体部署为主。Gateway 的 `/api/v1` fallback 路由 (L674-679) 将所有未匹配请求转发到 `localhost:3001`，因此大多数请求仍能正确到达 platform-service。

**实际影响**：当前开发环境下 Gateway 不是必须的 (前端直连 platform-service)。但在生产部署 Gateway 时，需要确保：
1. 微服务实际启动，或
2. Gateway 代理配置与实际部署架构对齐

---

## 5. E 类断裂：路由导入但未注册 (P1)

以下路由模块在 `routes.ts` 中 `import`，但**从未调用 `app.register` 或类似注册**：

### E-1: vectorStoreRoutes

| 项目 | 详情 |
|------|------|
| **导入** | `routes.ts:27` → `import vectorStoreRoutes from './vector-store-routes'` |
| **注册状态** | 未注册 |
| **注释位置** | `routes.ts:563` → `// 注册 Vector Embedding & Semantic Search API 路由 (pgvector backed)` (纯注释，无代码) |
| **影响** | 向量存储 API 不可用 |
| **修复建议** | 取消注释并注册：`await registerWithRoleGuard(app, vectorStoreRoutes, '/vector-store', { database: options.database })` |
| **优先级** | P1 |

### E-2: vectorRoutes

| 项目 | 详情 |
|------|------|
| **导入** | `routes.ts:47` → `import { vectorRoutes } from './vector-routes'` |
| **注册状态** | 未注册 |
| **影响** | 向量搜索 API 不可用 |
| **修复建议** | 确认与 `vectorStoreRoutes` 的关系 (是否为同一功能的双路由)，注册或移除导入 |
| **优先级** | P1 |

### E-3: degradationRoutes

| 项目 | 详情 |
|------|------|
| **导入** | `routes.ts:50` → `import degradationRoutes from './degradation-routes'` |
| **注册状态** | 未注册 |
| **注释位置** | `routes.ts:572` → `// 注册 Degradation Management API 路由 - AI Provider自动恢复` (纯注释) |
| **影响** | AI Provider 自动恢复功能不可用 |
| **修复建议** | 注册：`await registerWithRoleGuard(app, degradationRoutes, '/degradation', { database: options.database })` |
| **优先级** | P1 |

---

## 6. Mock 逻辑清单 (前端)

### 6.1 Promise.resolve 假返回

| 文件 | 行号 | Mock 类型 | 函数 | 对应真实 API |
|------|------|----------|------|-------------|
| `ephemeral-envs.ts` | 71 | 空数组 | `getEphemeralEnvs()` | `GET /v1/ephemeral-envs` |
| `ephemeral-envs.ts` | 76 | 空对象 | `getEphemeralEnv(id)` | `GET /v1/ephemeral-envs/:id` |
| `ephemeral-envs.ts` | 89 | 空对象 | `createEphemeralEnv(data)` | `POST /v1/ephemeral-envs` |
| `ephemeral-envs.ts` | 94 | 空对象 | `wakeEphemeralEnv(id)` | `POST /v1/ephemeral-envs/:id/wake` |
| `ephemeral-envs.ts` | 99 | 空对象 | `teardownEphemeralEnv(id)` | `POST /v1/ephemeral-envs/:id/teardown` |
| `ephemeral-envs.ts` | 104 | 空对象 | `getEphemeralEnvCost(id)` | `GET /v1/ephemeral-envs/:id/cost` |
| `ephemeral-envs.ts` | 113 | 空数组 | `getEnvironmentTemplates()` | `GET /v1/ephemeral-envs/templates` |
| `agents.ts` | 147 | 空数组 | `getAgentApprovals()` | `GET /v1/agent-approvals` |
| `agents.ts` | 158 | 空对象 | `respondToApproval(id, data)` | `POST /v1/agent-approvals/:id/respond` |
| `alerts.ts` | 87 | 空值 | `deleteAlert(id)` | `DELETE /v1/alert/:id` |
| `pipelines.ts` | 177 | 空值 | `deleteCache(key)` | `DELETE /v1/build-cache/entries/:id` |
| `pipelines.ts` | 183 | 空数组 | `listCaches(params)` | `GET /v1/build-cache/configs` |
| `workflow.ts` | 197 | 空函数 | `terminateWorkflow(id)` | `POST /v1/workflows/:id/terminate` |

### 6.2 Mock Data Fallback

| 文件 | 行号 | Mock 类型 | 说明 |
|------|------|----------|------|
| `notifications.ts` | 7 | import mock 数据 | 从 `@/pages/__mocks__/mockNotificationData` 导入假数据 |
| `notifications.ts` | 160-199 | catch 块 fallback | 后端无响应时用 mock 数据填充列表 |
| `notifications.ts` | 209-213 | catch 块 fallback | 单个通知详情 fallback |
| `notifications.ts` | 222-224 | 吞错误 | markAsRead 失败时无提示 |
| `notifications.ts` | 243-245 | 吞错误 | markAllAsRead 失败时无提示 |
| `notifications.ts` | 255-257 | 吞错误 | delete 失败时无提示 |
| `notifications.ts` | 289-301 | catch 块 fallback | stats 计算 fallback |
| `alerts.ts` | 69-75 | workaround | acknowledge 用 suppression maintenance window 代替 |
| `alerts.ts` | 80-82 | workaround | resolve 用 correlate 端点代替 |

### 6.3 空 try/catch 吞错误

| 文件 | 行号 | 函数 | 行为 |
|------|------|------|------|
| `notifications.ts` | 222-224 | `markAsRead` | catch 只 console.warn，调用方不知道失败 |
| `notifications.ts` | 243-245 | `markAllAsRead` | 同上 |
| `notifications.ts` | 255-257 | `deleteNotification` | 同上 |

---

## 7. 服务层存在性验证

### 7.1 有 service 目录但路由未注册

| 服务目录 | 对应路由文件 | 路由注册状态 | 说明 |
|---------|------------|------------|------|
| `services/vector-store/` | `vector-store-routes.ts` | E 类 - 未注册 | pgvector 向量存储 |
| `services/degradation/` | `degradation-routes.ts` | E 类 - 未注册 | AI Provider 降级 |
| `services/sso-routes.ts` | `sso-routes.ts` | 有文件但未在 routes.ts 导入 | SSO 单点登录 |

### 7.2 后端路由已注册但前端无对应 API 客户端

以下后端路由已注册，但 `orion-frontend/src/api/` 中无对应调用文件：

| 后端路由前缀 | 路由文件 | 前端调用方 |
|-------------|---------|-----------|
| `/vector-store` | `vector-store-routes.ts` | 无 (E类未注册) |
| `/degradation` | `degradation-routes.ts` | 无 (E类未注册) |
| `/vector` | `vector-routes.ts` | 无 (E类未注册) |
| `/v1/test-selector` | `test-selector-routes.ts` | `test-selector.ts` ✓ |
| `/v1/test-generation` | `test-generation-routes.ts` | 无前端调用 |
| `/cache-cleanup` | `cache-cleanup-routes.ts` | 无前端调用 |
| `/task-timeouts` | `task-timeout-routes.ts` | 无前端调用 |
| `/workflow-dependencies` | `workflow-dependency-routes.ts` | 无前端调用 |
| `/multi-modal-trigger` → `/triggers` | `multi-modal-trigger-routes.ts` | 无前端调用 |
| `/event-registry` | `event-trigger-registry-routes.ts` | `event-registry.ts` ✓ |
| `/system/modules` | `module-routes.ts` | `module-manager.ts` ✓ |

---

## 8. Gateway 路由与 Backend 路径映射分析

Gateway 使用 prefix-based 代理，前端直连 platform-service 时不需要 Gateway。
但通过 Gateway 访问时，存在以下潜在问题：

| 前端路径 | Gateway 匹配前缀 | 目标服务 | Backend 实际注册 | 是否一致 |
|---------|----------------|---------|----------------|---------|
| `/api/v1/pipelines` | `/api/v1/pipelines` → 3002 | Pipeline Svc | platform:3001 `/pipelines` | 不一致 (目标端口) |
| `/api/v1/plugins` | `/api/v1/plugins` → 3011 | Plugin Svc | platform:3001 `/plugins` | 不一致 (目标端口) |
| `/api/v1/skills` | `/api/v1/skills` → 3023 | Skill Svc | platform:3001 `/skills` | 不一致 (目标端口) |
| `/api/v1/artifacts` | `/api/v1/artifacts` → 3014 | Artifact Svc | platform:3001 `/artifacts` | 不一致 (目标端口) |
| `/api/v1/notifications` | `/api/v1/notifications` → 3001 | Platform Svc | platform:3001 `/notifications` | 一致 |
| `/api/v1/self-healing` | `/api/v1/self-healing` → 3024 | Self-Healing Svc | platform:3001 `/self-healing` | 不一致 (目标端口) |

**注意**：Gateway 中 `/api/v1` fallback 路由 (L674-679) 将未匹配到特定前缀的请求转发到 `localhost:3001`，因此大部分路径能通过 fallback 到达 platform-service。

---

## 9. 修复优先级汇总

### P0 (阻断功能)

| ID | 问题 | 影响模块 | 修复工作量 |
|----|------|---------|-----------|
| A-1 | Agent Approvals 前端 mock | AI Agent | 小 |
| A-2 | Alert CRUD 缺 delete/acknowledge/resolve | 告警管理 | 小 |
| A-5 | Ephemeral Envs 全部 7 个 API mock | 临时环境 | 中 |
| A-6 | Notifications mock fallback 静默 | 通知中心 | 小 |
| A-8 | Agent Run 路径前缀不匹配 | AI Agent | 小 |
| C-2 | Agent Profile 路径不一致 | AI Agent | 小 |

### P1 (功能缺失)

| ID | 问题 | 影响模块 | 修复工作量 |
|----|------|---------|-----------|
| A-3 | Pipeline Cache 端点路径不一致 | Pipeline | 小 |
| A-4 | Workflow Terminate 未实现 | 工作流 | 小 |
| A-7 | Alert Rule 路径混淆 | 告警管理 | 小 |
| B-1 | Performance mock DB fallback | 性能分析 | 小 |
| C-1 | Pipeline Versions 路径不一致 | Pipeline | 小 |
| D-1~D-28 | Gateway 代理目标不匹配 | 全局 | 大 (需架构决策) |
| E-1 | vectorStoreRoutes 未注册 | AI 向量 | 小 |
| E-2 | vectorRoutes 未注册 | AI 向量 | 小 |
| E-3 | degradationRoutes 未注册 | AI 降级 | 小 |

### P2 (体验问题)

| ID | 问题 | 影响模块 | 修复工作量 |
|----|------|---------|-----------|
| B-2 | Pipeline placeholder 注释过时 | Pipeline | 极小 |
| B-3 | Plugin TODO placeholder | 插件系统 | 小 |
| Mock-6.2/6.3 | Notifications 吞错误 | 通知中心 | 小 |

---

## 10. 建议修复路径

### Phase 1: 修复 P0 断裂 (1-2 天)

1. **Agent Approvals**: 在 `ai-agent-routes.ts` 添加 `/agent-approvals` 路由，前端移除 mock
2. **Alert CRUD**: 在 `alert-routes.ts` 添加 `DELETE /:id`、`POST /:id/acknowledge`、`POST /:id/resolve`
3. **Ephemeral Envs**: 重写 `ephemeral-envs.ts`，全部 7 个函数改为真实 API 调用
4. **Agent 路径统一**: 将前端 `/v1/agents` 和 `/v1/agent-runs` 改为与后端一致的 `/v1/ai-agents`
5. **Notifications**: 去除 mock fallback，改为返回空数据 + 用户可见的错误提示

### Phase 2: 修复 E 类未注册路由 (半天)

1. 注册 `vectorStoreRoutes`、`vectorRoutes`、`degradationRoutes`
2. 确认是否有重复/合并必要

### Phase 3: 清理路径不一致 (1 天)

1. 统一 Pipeline Versions 路径
2. 统一 Alert Rules 路径归属
3. 统一 Pipeline Cache 路径

### Phase 4: Gateway 配置对齐 (需架构决策)

1. 明确当前部署模式：单体 vs 微服务
2. 如单体部署，将 Gateway 代理目标统一指向 `localhost:3001`
3. 如微服务部署，确保各服务实际启动并健康

---

*本报告由自动化工具分析生成，基于以下文件：*
- *`/Users/heal/orion-design/orion-platform-service/src/api/routes.ts` (1064 行)*
- *`/Users/heal/orion-design/orion-api-gateway/src/routes/api.ts` (800 行)*
- *`/Users/heal/orion-design/orion-api-gateway/src/config/index.ts` (445 行)*
- *`/Users/heal/orion-design/orion-frontend/src/api/*.ts` (101 个文件)*
- *`/Users/heal/orion-design/orion-platform-service/src/services/` (100+ 个服务目录)*
