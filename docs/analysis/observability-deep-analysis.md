# Observability 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service` 中 observability 相关服务与路由  
**涵盖**: Distributed Tracing / Execution Timeline / SLO Tracking  
**服务路径**: `src/services/observability/`  
**路由文件**: `observability-routes.ts`, `tracing-routes.ts`, `slo-routes.ts`

---

## 一、现状概述

### 模块定位

Observability 模块是 Orion 可观测性体系的核心，提供分布式链路追踪（Distributed Tracing）、执行时间线（Execution Timeline）、SLO/SLI 追踪三大能力。该模块整合了 OpenTelemetry 采集器配置管理、Span 存储与检索、金丝雀/流水线执行时间线可视化，以及基于错误预算的 SLO 管理。

**当前状态**: 三大子能力均已实现 PostgreSQL Repository 持久化，功能基本完整。但代码组织较为分散——三个子能力分布在三个独立路由文件中，而服务文件集中在同一目录下。

### 文件结构

```
src/services/observability/
├── __tests__/
│   ├── ExecutionTimelineService.test.ts    (20,231 字节)
│   ├── PostgresTimelineRepository.test.ts  (13,582 字节)
│   └── index.test.ts                       (342 字节)
├── DistributedTracingService.ts            (7,005 字节)
├── ExecutionTimelineService.ts             (6,550 字节)
├── SLOTrackingService.ts                   (7,438 字节)
└── index.ts                                (151 字节)  — 仅导出 ExecutionTimelineService

src/api/
├── observability-routes.ts                 — Execution Timeline API
├── tracing-routes.ts                       — Distributed Tracing API
└── slo-routes.ts                           — SLO/SLI API
```

### 核心数据模型

| 领域 | 实体 | Repository | 数据库 |
|------|------|-----------|--------|
| Tracing | TraceSpan | TraceSpanRepository | PostgreSQL |
| Tracing | TraceSamplingConfig | TraceSamplingConfigRepository | PostgreSQL |
| Tracing | OtelCollectorConfig | OtelCollectorConfigRepository | PostgreSQL |
| Timeline | TimelineEntry / TimelineEvent | ExecutionTimelineRepository | PostgreSQL |
| SLO | SLODefinition | SLODefinitionRepository | PostgreSQL |
| SLO | SLIMeasurement | SLIMeasurementRepository | PostgreSQL |
| SLO | ErrorBudget | ErrorBudgetRepository | PostgreSQL |

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| Span 创建与存储 | ✅ 完整 | PostgreSQL 持久化，支持 attributes/events JSONB |
| Trace 详情查询 | ✅ 完整 | 按 traceId 聚合 spans，计算 duration/serviceCount/errorCount |
| Trace 搜索 | ✅ 完整 | 支持 serviceName/operationName/statusCode/duration 过滤 |
| Trace 列表 | ✅ 完整 | 支持分页和 serviceName 过滤 |
| Trace 删除与清理 | ✅ 完整 | 按 traceId 删除，按 retention days 批量清理 |
| 采样率配置 CRUD | ✅ 完整 | 按服务名配置采样率和限流 |
| OTel Collector 配置 CRUD | ✅ 完整 | YAML 配置管理，按类型过滤 |
| 执行时间线创建 | ✅ 完整 | 记录 run/task/plugin 级别时间线 |
| 时间线事件追加 | ✅ 完整 | 支持 start/heartbeat/log/error/complete/timeout 事件 |
| 时间线状态更新 | ✅ 完整 | 自动计算 durationMs |
| 执行回放数据 | ✅ 完整 | 批量获取时间线 + 关联事件 |
| SLO 定义 CRUD | ✅ 完整 | 支持多种 SLO 类型、PromQL 查询、告警阈值 |
| SLI 记录与查询 | ✅ 完整 | 按 SLO ID 查询历史，支持最新值获取 |
| 错误预算计算 | ✅ 完整 | 基于 SLO targetValue 和 SLI 历史自动计算消耗 |
| 错误预算历史 | ✅ 完整 | 持久化每次计算结果到 ErrorBudget 表 |
| SLO Dashboard | ✅ 完整 | 聚合所有启用的 SLO，展示当前 SLI + 错误预算 + 健康状态 |
| 执行列表 / 详情 | ⚠️ 部分实现 | observability-routes.ts 中 `/executions` 和 `/executions/:id` 端点存在，但 `/executions` 返回空数组 |
| 链路追踪可视化前端 | ❌ 缺失 | 无前端页面消费 tracing API |
| SLO 管理前端 | ❌ 缺失 | 无前端页面消费 SLO API |

---

## 三、API 端点

### 执行时间线 (`/api/v1/observability`)

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/timeline` | 内联 handler | 按 runId 列出时间线条目 |
| GET | `/timeline/:id/events` | 内联 handler | 获取指定时间线的所有事件 |
| GET | `/executions` | 内联 handler | ⚠️ 返回空数组，待接入 PipelineRunService |
| GET | `/executions/:id` | 内联 handler | 获取执行回放数据（时间线 + 事件） |

### 分布式追踪 (`/api/v1/tracing`)

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| GET | `/traces` | 内联 handler | 列出 traces，支持 serviceName 过滤和分页 |
| GET | `/traces/:traceId` | 内联 handler | 获取 trace 详情 + spans |
| GET | `/traces/:traceId/spans` | 内联 handler | 获取 trace 的所有 spans |
| POST | `/traces/search` | 内联 handler | 高级搜索 trace |
| GET | `/config` | 内联 handler | 获取所有采样配置 |
| PUT | `/config` | 内联 handler | 更新/创建采样配置 |
| GET | `/otel/configs` | 内联 handler | 获取 OTel 采集器配置 |
| POST | `/otel/configs` | 内联 handler | 创建 OTel 采集器配置 |
| PUT | `/otel/configs/:id` | 内联 handler | 更新 OTel 采集器配置 |
| DELETE | `/otel/configs/:id` | 内联 handler | 删除 OTel 采集器配置 |

### SLO 管理 (`/api/v1/slo`)

| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/definitions` | 内联 handler | 创建 SLO 定义 |
| GET | `/definitions` | 内联 handler | 列出 SLO 定义 |
| GET | `/definitions/:id` | 内联 handler | 获取 SLO 详情 + 当前 SLI + 错误预算 |
| PUT | `/definitions/:id` | 内联 handler | 更新 SLO 定义 |
| DELETE | `/definitions/:id` | 内联 handler | 删除 SLO 定义 |
| POST | `/:id/measurements` | 内联 handler | 记录 SLI 测量值 |
| GET | `/:id/measurements` | 内联 handler | 获取 SLI 历史 |
| GET | `/:id/error-budget` | 内联 handler | 计算并获取错误预算 |
| GET | `/:id/error-budget/history` | 内联 handler | 获取错误预算历史 |
| GET | `/dashboard` | 内联 handler | SLO Dashboard 聚合数据 |

### 路由注册状态

- `observability-routes.ts` → 注册于 `/api/v1/observability`（routes.ts:1297）
- `tracing-routes.ts` → 注册于 `/api/v1/tracing`（routes.ts:1395）
- `slo-routes.ts` → 注册于 `/api/v1/slo`（routes.ts:1392）

---

## 四、依赖关系

### 内部依赖

| 服务 | 依赖项 | 用途 |
|------|--------|------|
| DistributedTracingService | TraceSpanRepository, TraceSamplingConfigRepository, OtelCollectorConfigRepository | 数据持久化 |
| ExecutionTimelineService | ExecutionTimelineRepository | 数据持久化 |
| SLOTrackingService | SLODefinitionRepository, SLIMeasurementRepository, ErrorBudgetRepository | 数据持久化 |

### 外部依赖

| 依赖 | 用途 | 备注 |
|------|------|------|
| PostgreSQL | 所有数据持久化 | 所有 Repository 均通过 DatabasePool |
| OpenTelemetry Collector | 外部采集器配置管理 | 仅配置下发，无直接集成 |
| Prometheus | PromQL 查询（SLO 定义中引用） | SLO 的 promqlQuery 字段，但实际查询不在本模块 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **代码组织分散**：三个子能力三个路由文件，但服务在同一目录 | P2 | 按子能力拆分子目录（`tracing/`、`timeline/`、`slo/`），或统一为单一 observability 路由文件 |
| **index.ts 导出不完整**：只导出了 ExecutionTimelineService，遗漏 DistributedTracingService 和 SLOTrackingService | P1 | 补全 index.ts 导出所有服务 |
| **`/executions` 端点返回空**：ObservabilityRoutes 中 `/executions` 和 `/executions/:id` 存在但 executions 端点返回空数组 | P1 | 接入 PipelineRunService 真实数据 |
| **无 Tracing 前端页面**：`/api/v1/tracing` 有 10 个端点，但无前端页面消费 | P1 | 创建分布式追踪查看页面（Trace 列表 + Trace 详情 + Span 火焰图） |
| **无 SLO 前端页面**：`/api/v1/slo` 有 10 个端点，但无前端页面消费 | P1 | 创建 SLO 管理页面（定义管理 + SLI 趋势 + 错误预算仪表盘） |
| **SLOTrackingService 缺少 tenant_id 过滤**：listSLOs 仅在 sloType/enabled 过滤时传 tenantId，但 `sloRepo.findByTenant` 返回 `{ entities }` 结构不一致 | P2 | 统一所有查询方法的 tenant 过滤逻辑 |
| **错误预算计算为内存计算**：`calculateErrorBudget` 每次从数据库读取所有 SLI 值后内存计算，大数据量下性能差 | P2 | 改为 SQL 聚合查询或定时计算 + 缓存 |
| **缺少 DistributedTracingService 和 SLOTrackingService 的单元测试** | P1 | 为两个服务补充测试，当前测试仅覆盖 Timeline |

---

## 六、总结

Observability 模块实现了三大核心可观测能力（分布式追踪、执行时间线、SLO/SLI），后端功能较为完整：37 个 API 端点、7 个 Repository、全部 PostgreSQL 持久化。然而存在三个主要问题：

1. **代码组织分散**：三个路由文件对应三个独立 API 前缀，但服务文件混放在同一目录，模块导出不完整
2. **前端缺失**：Tracing 和 SLO 共 20 个 API 端点无前端页面消费，API 利用率低
3. **部分功能未接入**：observability-routes 的 `/executions` 端点返回空数据

建议优先完成前端的 Tracing 详情页和 SLO Dashboard，补全服务导出和测试覆盖率，并将 `/executions` 接入真实 PipelineRun 数据。
