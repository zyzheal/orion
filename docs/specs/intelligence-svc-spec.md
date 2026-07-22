# Spec: 智能洞察服务 (Intelligence)

> **日期**: 2026-07-04
> **状态**: 编写中
> **能力域**: AI 智能洞察 / 异常检测
> **目标成熟度**: L2
> **关键交付**: 智能任务管理、洞察生成、置信度评估

## 1. 模块概述

### 1.1 功能描述

Orion 当前已实现（Go 微服务 `orion-intelligence-svc-go`）：
- 智能任务 CRUD（IntelligenceTask）
- 洞察类型管理（insight_type）
- 数据源追踪（source）
- 置信度评估（confidence）
- 任务状态管理（status）
- 数据存储（data JSONB）
- 多租户隔离（tenant_id）
- OpenTelemetry 追踪

### 1.2 架构

- **框架**: Gin HTTP
- **分层**: handler → service → repository → PostgreSQL
- **认证**: RequirePermission("intelligence", "write") / RequirePermission("intelligence", "delete")
- **多租户**: 所有查询通过 tenant_id 过滤

### 1.3 与 TypeScript 实现的差异

N/A（无 TS 实现）

## 2. API 端点

```
Base: /api/v1/intelligence
```

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/` | 创建智能任务 | intelligence:write |
| GET | `/` | 任务列表 | - |
| GET | `/:id` | 任务详情 | - |
| DELETE | `/:id` | 删除任务 | intelligence:delete |
| GET | `/count` | 任务总数 | - |

## 3. 数据模型

### 3.1 IntelligenceTask（智能任务）

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| tenant_id | string | 租户 ID |
| name | string | 任务名称 |
| created_at | time.Time | 创建时间 |
| insight_type | string | 洞察类型 |
| source | string | 数据源 |
| confidence | float64 | 置信度 |
| data | JSONB | 任务数据 |
| status | string | 状态 |

### 3.2 CreateIntelligenceTaskRequest（创建输入）

| 字段 | 类型 | 描述 |
|------|------|------|
| name | string | 任务名称（必填） |
| insight_type | string | 洞察类型（必填） |
| source | string | 数据源（必填） |
| data | JSONB | 任务数据 |

## 4. 验收标准

| 编号 | 标准 | 验证方式 |
|------|------|----------|
| INT-01 | 支持创建智能任务（name/insight_type/source） | API 测试 |
| INT-02 | 支持查询任务列表（ tenant_id 隔离） | API 测试 |
| INT-03 | 支持查询任务详情 | API 测试 |
| INT-04 | 支持删除任务 | API 测试 |
| INT-05 | 任务总数统计（Count） | API 测试 |
| INT-06 | 多租户隔离 | 集成测试 |
| INT-07 | 任务含置信度（confidence）字段 | API 测试 |
| INT-08 | 任务数据以 JSONB 存储 | API 测试 |
| INT-09 | 列表分页（page/page_size） | API 测试 |

## 5. 测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 8 | IntelligenceService、IntelligenceRepository |
| 集成测试 | 3 | 创建→查询→删除闭环 |
| 前端测试 | 2 | 任务列表、详情 |
