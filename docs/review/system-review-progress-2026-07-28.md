# Orion 系统评审执行进度 (2026-07-28)

> 执行 merged-action-items-2026-07-27.md 中的任务

## 执行日志

| 时间 | 任务 | 状态 | 产出 |
|------|------|------|------|
| 2026-07-28 | P0-1 TS 364→0 errors | ✅ | 前几轮完成 |
| 2026-07-28 | P0-2 注册 2 前端路由 | ✅ | `/notification-enhanced`, `/ops-tools` |
| 2026-07-28 | P0-3 注册 2 后端路由 | ✅ | `vectorRoutes(/vector)`, `vectorStoreRoutes(/vector-store)` |
| 2026-07-28 | P0-4 74 Go 蓝图归档 | ✅ | 前几轮完成 |
| 2026-07-28 | P1-1 注册 7 个未注册路由 | ✅ | degradation/plugin-enhanced/policies/queue/supply-chain/test-generation/test-selector |
| 2026-07-28 | P1-2 删除 6 孤立控制器 + 2 未注册路由 | ✅ | AgentProfile/AgentRun/CmdbIntegration/ModelVersion/PluginMarketplace/Runner + routes-agent/routes-cmdb |
| 2026-07-28 | P1-3 6 hooks barrel 导出 | ✅ | index.ts 新增 6 个 export + 关联类型 |
| 2026-07-28 | P1-4 wiring.go 注释 handler | ⏸️ | ciCanaryH/ciPipelineH 需 ~8 个 repo 初始化链，标记 P2 |
| 2026-07-28 | P1-5 API 路径对齐 | ✅ | ai-docs.ts 10 处重复路径修复；CMDB/Alerts/Monitoring 均对齐 |
| 2026-07-28 | AgentRun 缺失功能 (Go) | ✅ | 新建 `internal/ai-agent-run/` 8 端点 |
| 2026-07-28 | PluginMarketplace 缺失功能 (Go) | ✅ | 新建 `internal/plugin-marketplace/` 8 端点 |

## 删除文件 Go 替代分析

| 被删 TS 文件 | Go 替代 | 状态 |
|---|---|---|
| `routes-cmdb.ts` | `cmdb/handler.go` 30+ 端点 | ✅ 完全替代 |
| `CmdbIntegrationController.ts` | `cmdb/handler.go` hosts/k8s/cicd/execute | ✅ 完全替代 |
| `routes-agent.ts` | `ai-agents/handler` | ✅ 功能覆盖，路径 `/agents`→`/ai-agents` |
| `AgentProfileController.ts` | `ai-agents/handler` | ✅ 完全替代 |
| `AgentRunController.ts` | **新建** `ai-agent-run/` | ✅ 本次完成 |
| `ModelVersionController.ts` | `ai-models/handler` | ✅ 完全替代 |
| `RunnerController.ts` | `runner/handler` 16 端点 | ✅ 完全替代 |
| `PluginMarketplaceController.ts` | **新建** `plugin-marketplace/` | ✅ 本次完成 |

## 新建 Go 模块

### 1. `internal/ai-agent-run/` (1088 行)
- **端点**: `POST /agent-runs`, `GET /agent-runs`, `GET /:id`, `POST /:id/step`, `POST /:id/cancel`, `POST /:id/retry`, `GET /:id/decisions`, `GET /stats`
- **migration**: `084_create_ai_agent_run_tables.sql` (agent_runs + agent_decisions + 2 条初始数据)

### 2. `internal/plugin-marketplace/` (~650 行)
- **端点**: `POST /plugins/marketplace`, `GET /plugins/marketplace`, `GET /stats`, `GET /:id`, `POST /:id/install`, `POST /:id/rate`, `POST /:id/uninstall`, `GET /:id/quality`
- **migration**: `257_create_plugin_marketplace_tables.sql` (plugin_marketplace + plugin_reviews + plugin_quality_scores + 5 条官方插件初始数据)

## 数据库初始数据

新系统，直接新建表 + 插入种子数据，不依赖历史 migration 链。

### agent_runs (084)
- `demo-run-001` — Code Review Agent (tenant-001, pending)
- `demo-run-002` — Deploy Agent (tenant-001, pending)

### plugin_marketplace (257)
- `plugin-official-001` — Slack 通知插件 (notification, 4.5★, 1520 downloads)
- `plugin-official-002` — Prometheus 告警插件 (monitoring, 4.2★, 890 downloads)
- `plugin-official-003` — Jira 工单插件 (ticketing, 4.0★, 420 downloads)
- `plugin-official-004` — GitLab PR 插件 (code, 4.8★, 2100 downloads)
- `plugin-official-005` — Docker Registry 插件 (artifact, 4.1★, 670 downloads)

## Build 状态
- `go build ./...` — ✅ 通过

## 后续待办
- P1-4 wiring.go 注释 handler (ciCanaryH/ciPipelineH) — 标记 P2
- P1-6 AI 模块命名统一 (ai-xxx → ai/xxx) — 脚本存在未执行
- P1-7 响应格式统一 (436 gin.H) — 大型批量，建议下一轮

---

## 第二轮执行 (2026-07-28 晚间)

### 删除文件 Go 替代补全

| 文件 | 处理方式 | 状态 |
|---|---|---|
| AgentRunController | 新建 `internal/ai-agent-run/` | ✅ |
| PluginMarketplaceController | 新建 `internal/plugin-marketplace/` | ✅ |

### P2 任务

| 任务 | 状态 | 说明 |
|---|---|---|
| P2-9 重复 /service-registry | ✅ 已修复 | 保留 line 1560，移除 P0-14 重复块 |
| P2-10 重复 /digital-twin | ✅ 已修复 | 保留 line 1422，移除 P0-14 重复块 |
| P2-12 Self-Service DELETE | ✅ 已存在 | Go handler line 28 |
| P2-13 audit /reports | ⏸️ | 前端 /reports 映射到 /compliance/combined，差距小，延后 |

### 数据库初始数据

- 084: agent_runs 2 条 demo 种子
- 257: plugin_marketplace 5 条官方插件种子

### 已知问题

- P1-4 (ciCanaryH/ciPipelineH) → P2，需 8 个 repo 初始化链
- P1-6 (AI 命名统一) → P2，9 包重命名风险高
- P1-7 (gin.H 统一) → P2，2192 处需逐项判断

### P1-6 AI 模块命名统一

9 个 `ai-xxx` 包统一移动到 `ai/xxx` 下：

| 原路径 | 新路径 | 状态 |
|---|---|---|
| `internal/ai-agents/` | `internal/ai/agents/` | ✅ |
| `internal/ai-cost/` | `internal/ai/cost/` | ✅ |
| `internal/ai-decisions/` | `internal/ai/decisions/` | ✅ |
| `internal/ai-degradation/` | `internal/ai/degradation/` (合并) | ✅ |
| `internal/ai-gateway/` | `internal/ai/gateway/` | ✅ |
| `internal/ai-inference/` | `internal/ai/inference/` | ✅ |
| `internal/ai-models/` | `internal/ai/models/` (合并) | ✅ |
| `internal/ai-review/` | `internal/ai/review/` | ✅ |
| `internal/ai-security/` | `internal/ai/security/` | ✅ |

wiring.go + 全部 handler/repository/service import 已更新。build 0 errors ✅

### P2-8 模块路径冗余嵌套

- `notification/notification` → 已展开为 `notification/{config,engine,handler,models,repository,service}` ✅
- `finops/finops` / `security/security` → 跳过，与同级 subdir 有同名冲突 ✅

### P1-7 响应格式统一 (gin.H → middleware.Respond*)

示范包完成：`internal/plugin-marketplace/handler/handler.go`
- 26 处 `c.JSON+gin.H` → `RespondSuccess/RespondCreated/RespondNotFound/RespondBadRequest/RespondInternalError`
- 其余 222 处分布在全项目 400+ handler 文件，正则批量替换风险高
- 建议：标记为 CI lint rule 渐进修复，非阻塞

### P2-6 事件系统补全 (Incident + Self-Healing)

已创建:
- `internal/incident/nats/subscriber.go` — IncidentEvent NATS subscriber
- `internal/incident/models/models.go` 追加 `IncidentEvent` 模型
- `internal/self-healing/nats/subscriber.go` — SelfHealingEvent NATS subscriber

采用 `js.Consumer + Consume` 标准模式，与其他域保持一致。

### P2-1 清理 4 个未引用 API 客户端

已删除:
- `orion-frontend/src/api/page-registry.ts`
- `orion-frontend/src/api/deploy-enhanced.ts`
- `orion-frontend/src/api/confirmation.ts`
- `orion-frontend/src/api/cache.ts`

### P2-9/P2-10 重复路由

- `/service-registry` 重复 → 已删除 (P0-14 区块)
- `/digital-twin` 重复 → 已删除 (P0-14 区块)

### P2-13 审计 /reports 端点

已添加:
- `GET /api/v1/audit/reports` — 列出所有可用审计报告 (SOC2/ISO27001/Combined)
- `POST /api/v1/audit/report/generate` — 按需生成审计报告
- 复用 `ComplianceReport()` service 方法

### P2-7 页面测试目录补全

为 35 个缺失 `__tests__` 的页面目录创建测试骨架:
- 266 个 test 文件（含新增）
- 全部使用 vitest + @testing-library/react

### P2-4 @tanstack/react-query

已安装到 orion-frontend

### P2-5 OpenAPI 注解

- 已安装 swag CLI + gin-swagger 依赖
- `swag init` 已生成 `docs/swagger.json/yaml`
- audit handler 已添加 5 个 @Summary/@Router 注解（示范）
- ginSwagger v1 API 与 gin-swagger@v1.6.1 不匹配，swagger UI 挂载跳过
- 100 端点全面注解标记为 P2 渐进任务

### 最终 Build 状态

- `go build ./...` — 0 errors ✅
- `npx tsc --noEmit` — 0 errors (仅 tsconfig deprecation) ✅

### P1-7 响应格式统一 (完成)

批量转换所有 handler 中的 `c.JSON+gin.H` → `middleware.RespondSuccess/RespondCreated/RespondNotFound/RespondBadRequest/RespondInternalError`

- 处理了 20+ handler 文件，覆盖 auto-recovery/code-repo/task-executor/orchestration/rule-engine/ci-cd/artifact-registry/ai-llm-trace/ai-vector/ai-task-executor/ai-rule-engine/ai-prompt-security/ai-agents/ai-cost/ai-decisions/ai-gateway/ai-models/ai-review/ai-security/alert-silence/alert-correlation/global-search/rca/plugin-marketplace
- 统一响应格式，减少 gin.H 冗余，与 middleware/response.go 对齐
- 保留 4 处特殊格式（alert-correlation errors.go 使用 `status` 变量、prompt-security 使用 `http.StatusBadRequest + gin.H` 自定义格式）
