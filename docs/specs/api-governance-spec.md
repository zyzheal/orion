# Spec: API 治理 (API Governance)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: API 治理
> **目标成熟度**: L1.5 → L2.5
> **关键交付**: API 注册、版本管理、访问控制、文档生成、审计监控

## 一、功能描述

### 1.1 现状评估 (L1.5)

Orion 当前已实现：
- 路由集中注册（`api/routes.ts`，175+ 路由）
- 基础认证和角色权限（JWT + RBAC）
- OpenAPI schema 定义（部分路由）
- API Key 管理（api-key-routes）
- 审计日志基础

**不足**：
- 无统一的 API 注册表（路由分布在各文件中）
- 无 API 版本管理策略
- 无 API 访问统计和流量监控
- 无 API 文档自动生成（OpenAPI 仅覆盖部分）
- 无 API 废弃管理（deprecation 策略）
- 无 API 变更通知机制

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| API 注册表 | 统一的 API 元数据存储，自动发现路由 | L2.5 |
| 版本管理 | API 版本策略、废弃管理、迁移指引 | L2.5 |
| 访问控制 | 细粒度 API 权限、限流、配额 | L2.5 |
| 文档生成 | OpenAPI 自动生成、交互式文档 | L2.5 |
| 审计监控 | API 调用统计、SLA 监控、异常告警 | L2.5 |

## 二、验收标准

### 2.1 API 注册表

| # | 标准 | 验证方式 |
|---|------|----------|
| AG1 | 统一的 API 注册表存储所有路由元数据（路径/方法/描述/标签） | API 测试 |
| AG2 | 启动时自动发现并注册路由 | 集成测试 |
| AG3 | API 注册项含标签分组（auth/pipeline/deploy/monitor 等） | API 测试 |
| AG4 | 支持按标签、状态、方法筛选 API 列表 | API 测试 |
| AG5 | API 注册表支持手动注册外部服务 API | API 测试 |

### 2.2 版本管理

| # | 标准 | 验证方式 |
|---|------|----------|
| AG6 | API 版本标识通过 URL 路径（/v1/、/v2/） | 前端验证 |
| AG7 | 同一 API 的不同版本可共存 | API 测试 |
| AG8 | 支持标记 API 为废弃（deprecated），含迁移指引 | API 测试 |
| AG9 | 废弃 API 在调用时返回 Warning 头 | 集成测试 |
| AG10 | 废弃超过 N 个版本的 API 自动返回 410 Gone | 集成测试 |

### 2.3 访问控制

| # | 标准 | 验证方式 |
|---|------|----------|
| AG11 | 每个 API 可配置独立访问权限（public/authenticated/role-based） | API 测试 |
| AG12 | API 级限流：每 API 每用户每分钟最大请求数 | 集成测试 |
| AG13 | API 配额管理：每 API 每月最大调用次数 | 集成测试 |
| AG14 | 超限时返回 429 和 Retry-After 头 | 集成测试 |

### 2.4 文档生成

| # | 标准 | 验证方式 |
|---|------|----------|
| AG15 | 从 Route schema 自动生成 OpenAPI 3.0 规范 | API 测试 |
| AG16 | OpenAPI 文档含请求/响应示例 | 前端验证 |
| AG17 | 提供 Swagger UI 交互式文档页面 | 前端验证 |
| AG18 | 文档随 API 变更自动更新（构建时生成） | 集成测试 |

### 2.5 审计监控

| # | 标准 | 验证方式 |
|---|------|----------|
| AG19 | 记录每个 API 调用（客户端 IP、User-Agent、耗时、状态码） | 单元测试 |
| AG20 | API 调用统计：按 API/客户端/时间维度聚合 | 前端验证 |
| AG21 | API 错误率超过阈值自动告警（5% 错误率） | 集成测试 |
| AG22 | API 响应时间 P99 超过 500ms 自动告警 | 集成测试 |
| AG23 | API 治理仪表盘：总调用量、错误率、延迟、Top N 调用 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/api-governance
```

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/apis` | API 注册表列表 |
| GET | `/apis/:id` | API 详情 |
| PUT | `/apis/:id` | 更新 API 元数据 |
| POST | `/apis/:id/deprecate` | 标记废弃 |
| GET | `/apis/versions` | 版本概览 |
| GET | `/statistics` | 调用统计 |
| GET | `/statistics/top` | Top N 调用 API |
| GET | `/alerts` | API 告警列表 |
| GET | `/openapi.json` | OpenAPI 规范 |
| GET | `/docs` | Swagger UI 重定向 |

## 四、数据模型

```sql
-- API 注册表
CREATE TABLE IF NOT EXISTS api_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path            VARCHAR(500) NOT NULL,
  method          VARCHAR(10) NOT NULL,
  summary         VARCHAR(200),
  description     TEXT,
  tags            TEXT[] DEFAULT '{}',
  version         VARCHAR(10) DEFAULT 'v1',
  status          VARCHAR(20) DEFAULT 'active',
  deprecation_note TEXT,
  migration_guide TEXT,
  auth_required   BOOLEAN DEFAULT true,
  rate_limit      INT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(path, method)
);

-- API 调用记录
CREATE TABLE IF NOT EXISTS api_call_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id          UUID REFERENCES api_registry(id),
  client_ip       VARCHAR(45),
  user_agent      TEXT,
  user_id         UUID,
  status_code     INT,
  duration_ms     INT,
  called_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_api_call_logs_api ON api_call_logs(api_id, called_at DESC);
CREATE INDEX idx_api_call_logs_time ON api_call_logs(called_at);
```

## 五、前端设计

**路由**: `/api-governance`

主要页面：
- API 注册表：所有 API 列表、搜索、筛选
- API 详情页：元数据、调用统计、限流配置
- 版本管理页：API 版本树、废弃状态
- 调用统计页：图表展示调用趋势
- 文档页：Swagger UI 交互式文档

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | ApiRegistryService、StatsService、OpenApiGenerator |
| 集成测试 | 6 | 注册表自动发现、版本管理、限流、配额控制 |
| 前端测试 | 3 | 注册表列表、统计图表、Swagger UI |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
