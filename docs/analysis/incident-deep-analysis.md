# Incident 模块深度分析

**生成日期**: 2026-07-03  
**分析范围**: `orion-platform-service` 中 incident 服务与路由  
**服务路径**: `src/services/incident/`  
**路由文件**: `incident-routes.ts`

---

## 一、现状概述

### 模块定位

Incident 模块实现 ITIL 对齐的事故生命周期管理，是 Orion 可观测性体系中"响应与恢复"环节的核心。遵循业界最佳实践的 Incident 全生命周期：open → acknowledged → investigating → on_hold → resolved → closed，并集成事故指挥官（ICS）分配、升级（Escalation）管理、SLA 违约检测、事后分析（Post-mortem/RCA）、问题与变更关联等高级功能。

**当前状态**: 后端功能相当完善，34KB 的 Service 代码实现了完整的 ITIL 流程。PostgreSQL 持久化，有独立的 Repository 层。

### 文件结构

```
src/services/incident/
├── __tests__/
│   ├── IncidentRepository.test.ts   (13,769 字节)
│   └── IncidentService.test.ts      (22,257 字节)
├── IncidentRepository.ts            (8,346 字节)  — 数据库 CRUD + MTTR 统计
├── IncidentService.ts               (34,081 字节)  — 完整生命周期管理
└── index.ts                         (113 字节)    — 导出所有

src/api/
└── incident-routes.ts               — 19 个端点
```

### 核心数据模型

**Incident 表**（通过 `IncidentService.createIncident` 直接 SQL 插入）:
```sql
incidents 表关键字段:
- id, tenant_id, title, description, type, severity
- status (open/acknowledged/investigating/on_hold/resolved/closed)
- priority (p1/p2/p3/p4) — 由 impact × urgency 矩阵自动计算
- impact, urgency — 输入维度
- service, environment, error_message
- detected_by, assigned_team, commander_id
- affected_services (JSONB), tags (TEXT[])
- deployment_id, pipeline_run_id, commit_sha — 关联 CI/CD
- detected_at, acknowledged_at, resolved_at, closed_at
- recovery_time_ms — 自动计算
- escalation_level (0-5)
- sla_breach, sla_breach_at
- postmortem_required, postmortem_url, postmortem_summary
- related_problem_id, linked_problem_id, linked_change_id
```

**辅助表**:
- `incident_escalations` — 升级历史
- `incident_timeline_events` — 时间线事件（通过 IncidentTimelineRepository）
- `incident_postmortems` — 事后分析记录（通过 IncidentPostmortemRepository）

### 状态机规则

```
open → [acknowledged, resolved, closed]
acknowledged → [investigating, resolved, closed]
investigating → [on_hold, resolved, closed]
on_hold → [investigating, resolved, closed]
resolved → [closed, open]              ← 允许 reopen
closed → [open]                        ← 允许 reopen
```

### 优先级矩阵 (impact × urgency)

| impact \\ urgency | critical | high | medium | low |
|-------------------|----------|------|--------|-----|
| critical | p1 | p1 | p2 | p3 |
| high | p1 | p2 | p2 | p3 |
| medium | p2 | p2 | p3 | p4 |
| low | p3 | p3 | p4 | p4 |

### SLA 阈值

| severity | 阈值（分钟） |
|----------|-------------|
| critical | 15 |
| high | 60 |
| medium | 240 |
| low | 1440 |

---

## 二、功能矩阵

| 功能点 | 状态 | 说明 |
|--------|------|------|
| 事故创建 | ✅ 完整 | 带优先级自动计算、时间线事件记录 |
| 事故列表 | ✅ 完整 | 支持 status/severity/priority 过滤 + 分页 |
| 事故详情 | ✅ 完整 | 按 ID 和租户查询 |
| 事故更新 | ✅ 完整 | 支持所有字段更新，优先级重算 |
| 事故删除 | ✅ 完整 | 租户隔离 |
| 状态变更 | ✅ 完整 | 含状态转换校验 + 时间线记录 + 自动 timestamp 设置 |
| 事故指挥官分配 | ✅ 完整 | ICS 角色分配 + 时间线记录 |
| 升级管理 | ✅ 完整 | 0-5 级升级 + 级别校验 + 历史查询 |
| SLA 检查 | ✅ 完整 | 按 severity 阈值计算是否违约 |
| SLA 违约标记 | ✅ 完整 | 自动/手动标记 + 时间线记录 |
| 时间线事件 | ✅ 完整 | 7 种事件类型 + 元数据 + 分页 |
| 事后分析（Post-mortem） | ✅ 完整 | 创建/查看/更新/发布/归档 — 完整生命周期 |
| 问题关联 | ✅ 完整 | 关联 Problem ID |
| 变更关联 | ✅ 完整 | 关联 Change ID |
| 统计 Dashboard | ✅ 完整 | 按状态/severity/priority 分布 + MTTR（avg/median/p90/p99）+ 7天趋势 |
| Critical 事故自动要求事后分析 | ✅ 完整 | resolved 时自动设置 postmortem_required = true |
| 认证与权限 | ⚠️ 部分实现 | 路由层未统一配置 requirePermission 中间件 |
| 前端页面 | ❌ 缺失 | 无事故管理前端页面 |

---

## 三、API 端点

所有端点注册于 `/api/v1/incidents`（routes.ts:1318）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建事故 |
| GET | `/` | 列表（过滤 + 分页） |
| GET | `/stats` | 统计 Dashboard |
| GET | `/:id` | 事故详情 |
| PUT | `/:id` | 更新事故字段 |
| DELETE | `/:id` | 删除事故 |
| PATCH | `/:id/status` | 状态变更（含转换校验） |
| PATCH | `/:id/assign` | 分配指挥官 |
| POST | `/:id/escalate` | 升级事故 |
| GET | `/:id/escalations` | 升级历史 |
| GET | `/:id/sla` | SLA 检查 |
| POST | `/:id/sla/breach` | 标记 SLA 违约 |
| POST | `/:id/timeline` | 添加时间线事件 |
| GET | `/:id/timeline` | 获取时间线 |
| POST | `/:id/postmortem` | 创建事后分析 |
| GET | `/:id/postmortem` | 获取事后分析 |
| PUT | `/:id/postmortem` | 更新事后分析（仅 draft 状态） |
| POST | `/:id/postmortem/publish` | 发布事后分析 |
| POST | `/:id/postmortem/archive` | 归档事后分析 |

### 路由注册

- 注册于 `/api/v1/incidents`（routes.ts:1318）

---

## 四、依赖关系

### 内部依赖

| 组件 | 依赖项 | 用途 |
|------|--------|------|
| IncidentService | IncidentRepository | 基础 CRUD |
| IncidentService | IncidentTimelineRepository | 时间线持久化 |
| IncidentService | IncidentPostmortemRepository | 事后分析持久化 |
| IncidentService | DatabasePool（直接 SQL） | 事故创建/更新/统计等核心操作 |

### 外部依赖

| 依赖 | 用途 | 备注 |
|------|------|------|
| PostgreSQL | 所有数据持久化 | 4 张表（incidents, incident_escalations, incident_timeline_events, incident_postmortems） |

### 被依赖关系

| 调用方 | 用途 |
|--------|------|
| 告警模块（Alert） | 可通过 API 创建事故 |
| 流水线模块（Pipeline） | 事故可关联 pipeline_run_id |
| CI/CD 集成 | deployment_id/commit_sha 关联 |

---

## 五、风险与改进建议

| 风险 | 级别 | 建议 |
|------|------|------|
| **缺少认证中间件**：所有 incident 路由未注册 `requirePermission` 和 `authenticateUser`，任何用户可操作 | **P0** | 为所有 incident 路由添加 `onRequest: [authenticateUser, requirePermission(...)]` |
| **无前端页面**：19 个 API 端点无前端页面消费 | **P1** | 创建事故管理页面（列表 + 详情 + 时间线 + 事后分析 + 统计仪表盘） |
| **重复 CRUD 逻辑**：IncidentRepository 和 IncidentService 各自实现了 create/find/update 方法，层级职责不清晰 | P2 | 明确分层：Repository 只做 SQL 操作，Service 做业务逻辑，删除 Repository 中 Service 已覆盖的方法 |
| **直接 SQL 与 Repository 混用**：IncidentService 的 create/list/update/status/delete 直接使用 `this.pool.query()`，而 timeline/postmortem 通过 Repository | P2 | 统一迁移到 Repository 模式 |
| **IncidentRepository 的 `acknowledge()`/`resolve()` 未在 Service 中使用**：Service 的 `updateStatus()` 自行实现状态变更逻辑，Repository 的同名方法已废弃 | P2 | 清理 IncidentRepository 中未使用的 acknowledge()/resolve()/update() 方法 |
| **MTTR 统计中的 SQL 兼容性问题**：`PERCENTILE_CONT` 是 PostgreSQL 特有函数，跨数据库兼容性差 | P2 | 保持现状（项目固定使用 PostgreSQL）或添加方言抽象 |
| **缺少 Webhook/通知集成**：事故创建/状态变更/升级/SLA 违约时无通知机制 | P1 | 集成 EventBus，事故状态变更时发布事件，由通知模块消费 |
| **无告警自动创建事故**：当前事故只能手动创建，缺少从告警自动派生事故的能力 | P2 | 集成 Prometheus Alertmanager webhook，自动创建事故 |

---

## 六、总结

Incident 模块是 Orion 中后端实现最完善的模块之一，具有以下优势：

- **ITIL 流程完整**：6 阶段状态机 + 转换校验 + 自动 timestamp
- **功能全面**：19 个 API 端点覆盖事故全生命周期（CRUD、状态、分配、升级、SLA、事后分析、统计）
- **数据模型成熟**：支持关联 CI/CD（deployment/pipeline/commit）、问题/变更管理
- **统计能力强**：MTTR 多维度分析（avg/median/p90/p99）+ 7 天趋势

主要问题：
1. **P0 - 缺少认证中间件**：这是严重的安全风险，需要立即修复
2. **P1 - 无前端页面**：后端功能完善但无用户界面
3. **P1 - 无通知集成**：事故生命周期事件需要通知相关干系人

建议优先添加认证中间件，然后补全前端页面和通知集成，最后统一持久化方式。
