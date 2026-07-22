# Inspection 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service/src/services/inspection/InspectionService.ts` + `src/api/inspection-routes.ts`  
**路由前缀**: `/api/inspection`（实际注册路径见 routes.ts: `/inspection`）

---

## 一、现状概述

### 模块定位

智能巡检服务（Intelligent Inspection），Phase 4 的核心组件之一。通过可配置的检查规则（Rule），自动对系统资源（CPU、内存、磁盘、网络、服务）执行健康检查，生成巡检任务和报告，提供整体健康评分。

### 文件结构

```
services/inspection/
├── __tests__/
│   └── InspectionService.test.ts
├── index.ts                       # 导出 InspectionService
└── InspectionService.ts           # 核心服务 (~496 行)

api/inspection-routes.ts          # 路由定义 (~133 行)
```

### 核心数据模型

| 实体 | 关键字段 | 说明 |
|------|---------|------|
| `InspectionRule` | id, tenantId, name, target, checkType, threshold, operator, enabled, schedule | 检查规则 |
| `InspectionTask` | id, ruleId, status, result, startedAt, completedAt | 检查任务实例 |
| `InspectionResult` | id, taskId, passed, actualValue, expectedValue, message | 检查结果 |
| `InspectionReport` | id, title, summary, results[] | 巡检报告 |

**检查类型**: `cpu` | `memory` | `disk` | `network` | `service` | `custom`  
**比较运算符**: `gt` | `lt` | `eq` | `gte` | `lte`

### 持久化方式

通过 `InspectionRepository`（含 4 个 Repository）实现 PostgreSQL 持久化，同时保留内存 `Map` 作为降级方案。

| Repository | 用途 |
|-----------|------|
| `InspectionRuleRepository` | 规则数据 |
| `InspectionTaskRepository` | 任务数据 |
| `InspectionResultRepository` | 结果数据 |
| `InspectionReportRepository` | 报告数据 |

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 规则 CRUD（创建） | ✅ 完整 | 支持所有检查类型和运算符 |
| 规则列表示 | ✅ 完整 | 支持按 target/enabled 过滤 |
| 规则详情 | ✅ 完整 | 单条规则查询 |
| 规则更新 | ✅ 完整 | 部分字段更新 |
| 规则删除 | ✅ 完整 | 从数据库/内存中移除 |
| 创建检查任务 | ✅ 完整 | 随机生成检查值，触发检查评估 |
| 任务列表 | ✅ 完整 | 支持按 ruleId/status 过滤 |
| 任务详情 | ✅ 完整 | 含执行结果 |
| 生成巡检报告 | ✅ 完整 | 对所有启用规则执行检查并汇总 |
| 报告列表/详情 | ✅ 完整 | 含 summary 统计 |
| 健康评分计算 | ✅ 完整 | 基于近期任务通过的百分比 + 按目标分类 |
| DB 降级模式 | ✅ 完整 | 无 DB 时使用内存 Map |

---

## 三、API 端点

| 方法 | 路径 | 说明 | ACL |
|------|------|------|-----|
| POST | `/api/inspection/rules` | 创建检查规则 | inspection:write |
| GET | `/api/inspection/rules` | 规则列表 | inspection:read |
| GET | `/api/inspection/rules/:id` | 规则详情 | inspection:read |
| PUT | `/api/inspection/rules/:id` | 更新规则 | inspection:write |
| DELETE | `/api/inspection/rules/:id` | 删除规则 | inspection:write |
| POST | `/api/inspection/tasks` | 创建检查任务 | inspection:write |
| GET | `/api/inspection/tasks` | 任务列表 | inspection:read |
| GET | `/api/inspection/tasks/:id` | 任务详情 | inspection:read |
| POST | `/api/inspection/reports` | 生成报告 | inspection:write |
| GET | `/api/inspection/reports` | 报告列表 | inspection:read |
| GET | `/api/inspection/reports/:id` | 报告详情 | inspection:read |
| GET | `/api/inspection/health-score` | 健康评分 | inspection:read |

---

## 四、依赖关系

| 依赖 | 类型 | 说明 |
|------|------|------|
| `InspectionRuleRepository` | 内部依赖 | 规则持久化 |
| `InspectionTaskRepository` | 内部依赖 | 任务持久化 |
| `InspectionResultRepository` | 内部依赖 | 结果持久化 |
| `InspectionReportRepository` | 内部依赖 | 报告持久化 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **`inspection-routes.ts` 中 4 处路由处理器在 `return` 后仍有死代码** | **P0** | 第 46、56、65、93、120 行 `return handleError(...)` 后跟随 `return reply.send(...)`，导致正常路径永远无法到达。这是严重的逻辑 bug，`PUT`/`GET /:id`/`DELETE` 均无法返回正确响应 |
| **检查结果为随机值**（`Math.random() * 100`），非真实系统指标 | P1 | 接入真实的系统监控数据源（Prometheus/node_exporter/OS APIs） |
| **报告结果未持久化到 DB 的 results**（report 不含详细结果） | P1 | 报告的 `results` 字段在持久化后丢失，仅返回空数组 |
| **`createTask` 内模拟实际评估**，但无真实的检查执行引擎 | P1 | 需集成实际的资源检查逻辑（如调用 OS 命令或 Prometheus 查询） |
| **`schedule` 字段存在但未被调度器使用** | P2 | 可从 `schedule`（cron 表达式）自动触发定期任务 |
| **无任务调度器**，需要手动创建任务 | P2 | 添加基于 cron 的定时调度器，支持规则自动执行 |
| **`generateReport` 对所有规则串行创建任务** | P2 | 当规则数量多时串行执行耗时较长，建议并发执行 |

---

## 六、总结

Inspection 模块是 Phase 4 智能巡检的基础框架，实现了检查规则管理、任务执行、结果汇总和报告生成的完整流程。架构上采用了成熟的 Repository 模式 + 内存降级双轨策略。

**亮点**：
1. 5 种检查类型 + 5 种比较运算符覆盖常见巡检需求
2. 健康评分支持按 target 分类统计
3. 统一的 Repository 模式 + 优雅的降级方案

**严重问题**：
巡检模块在路由层存在 **4 处严重逻辑错误**——`return handleError()` 后的死代码导致 `GET /rules/:id`、`PUT /rules/:id`、`DELETE /rules/:id`、`GET /tasks/:id`、`GET /reports/:id` 这 5 个端点永远不能正常工作。这是开发过程中未完整重构路由处理器的遗留问题。

另外核心功能（实际检查执行、定时调度、真实数据源）处于"骨架"状态。

**评分**: 3/10 — 架构设计合理（7分），但路由层的严重 bug 导致半数 API 不可用（0分），加上检查逻辑为随机值（3分）。
