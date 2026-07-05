# Spec: 混沌工程服务 (Chaos)

> **日期**: 2026-07-04
> **状态**: 编写中
> **能力域**: 混沌工程 / 故障注入
> **目标成熟度**: L2
> **关键交付**: 混沌实验 CRUD、故障注入、状态管理、运行记录

## 1. 模块概述

### 1.1 功能描述

Orion 当前已实现（Go 微服务 `orion-chaos-svc-go`）：
- 混沌实验 CRUD（ChaosService + ChaosRepository）
- 实验状态管理（draft/active/completed/archived）
- 故障类型定义（network_latency/service_down/cpu_stress/memory_stress/disk_full）
- 故障注入配置（ChaosFault：target/config/duration_ms/delay_ms）
- 实验范围定义（ChaosScope：tenant_id/service_id/environment）
- 稳态假设（SteadyStateHypothesis）
- 自动回滚（AutoRollback）
- 实验运行记录（ChaosRun：status/triggered_by/affected_services/error_count/recovered）
- 多租户隔离（tenant_id）
- OpenTelemetry 追踪

### 1.2 架构

- **框架**: Gin HTTP
- **分层**: handler → service → repository → PostgreSQL
- **认证**: RequirePermission("chaos", "write") / RequirePermission("chaos", "execute") / RequirePermission("chaos", "delete")
- **多租户**: 所有查询通过 tenant_id 过滤

### 1.3 与 TypeScript 实现的差异

N/A（无 TS 实现）

## 2. API 端点

```
Base: /api/v1/experiments
```

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 创建混沌实验 | chaos:write |
| GET | `/` | 实验列表 | - |
| GET | `/:id` | 实验详情 | - |
| POST | `/:id/status` | 更新实验状态 | chaos:execute |
| DELETE | `/:id` | 删除实验 | chaos:delete |

## 3. 数据模型

### 3.1 ChaosExperiment（混沌实验）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| tenant_id | string | 租户 ID |
| name | string | 实验名称 |
| description | sql.NullString | 实验描述 |
| scope | ChaosScope (JSONB) | 实验范围（tenant_id/service_id/environment） |
| faults | []ChaosFault (JSONB) | 故障注入列表 |
| steady_state_hypothesis | sql.NullString | 稳态假设 |
| auto_rollback | bool | 自动回滚 |
| status | ExperimentStatus | 状态（draft/active/completed/archived） |
| created_by | sql.NullString | 创建人 |
| created_at | time.Time | 创建时间 |
| updated_at | time.Time | 更新时间 |

### 3.2 ChaosRun（实验运行）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| experiment_id | string | 关联实验 ID |
| tenant_id | string | 租户 ID |
| status | string | 运行状态 |
| triggered_by | string | 触发人 |
| started_at | *time.Time | 开始时间 |
| completed_at | *time.Time | 完成时间 |
| affected_services | []string | 受影响服务 |
| error_count | int | 错误数 |
| recovered | bool | 是否恢复 |
| created_at | time.Time | 创建时间 |

### 3.3 CreateExperimentInput（创建输入）

| 字段 | 类型 | 描述 |
|------|------|------|
| name | string | 实验名称（必填） |
| description | *string | 实验描述 |
| scope | ChaosScope | 实验范围（必填） |
| faults | []ChaosFault | 故障列表（必填） |
| steady_state_hypothesis | *string | 稳态假设 |
| auto_rollback | *bool | 自动回滚 |
| created_by | *string | 创建人 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|----------|
| CHAOS-01 | 支持创建混沌实验（name/scope/faults） | API 测试 |
| CHAOS-02 | 支持查询实验列表（ tenant_id 隔离） | API 测试 |
| CHAOS-03 | 支持查询实验详情 | API 测试 |
| CHAOS-04 | 支持更新实验状态（draft→active→completed/archived） | API 测试 |
| CHAOS-05 | 支持删除实验 | API 测试 |
| CHAOS-06 | 多租户隔离（tenant_id 过滤） | 集成测试 |
| CHAOS-07 | 支持故障类型：network_latency/service_down/cpu_stress/memory_stress/disk_full | API 测试 |
| CHAOS-08 | 实验运行记录可追踪（ChaosRun） | API 测试 |
| CHAOS-09 | 自动回滚配置可设置 | API 测试 |

## 5. 测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 10 | ChaosService、ChaosRepository |
| 集成测试 | 4 | 创建→状态更新→运行记录→删除闭环 |
| 前端测试 | 2 | 实验列表、详情 |
