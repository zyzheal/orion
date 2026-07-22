# Spec: 联邦调度 (Federated Scheduling)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 联邦调度
> **目标成熟度**: L1.5 → L2.5
> **关键交付**: 集群管理、调度策略、跨集群编排、资源视图、故障迁移

## 一、功能描述

### 1.1 现状评估 (L1.5)

Orion 当前已实现：
- 基础联邦集群管理（FederationService）
- 多云配置管理（MultiCloudService）
- 跨域编排基础（CrossDomainService）
- 集群健康检查基础

**不足**：
- 无统一调度策略引擎（调度逻辑硬编码）
- 跨集群资源视图缺失（无法统一查看多集群资源）
- 无负载感知调度（调度时未考虑集群负载）
- 无故障迁移策略（集群故障时任务悬挂）
- 无调度审计日志

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 集群管理 | 集群注册、健康监控、标签管理 | L2.5 |
| 调度策略 | 支持多种调度策略（轮询/负载/亲和性/自定义） | L2.5 |
| 资源视图 | 跨集群统一资源视图、容量规划 | L2.5 |
| 故障迁移 | 集群故障自动迁移、任务恢复 | L2.5 |
| 跨域编排 | 跨集群/区域工作流部署 | L2.5 |

## 二、验收标准

### 2.1 集群管理

| # | 标准 | 验证方式 |
|---|------|----------|
| FS1 | 支持集群注册（名称、API Server 地址、认证信息） | API 测试 |
| FS2 | 集群健康状态自动检测（每 30 秒心跳） | 集成测试 |
| FS3 | 集群支持标签分组（region/az/env/team） | API 测试 |
| FS4 | 集群列表展示状态、版本、节点数、资源使用率 | 前端验证 |
| FS5 | 集群移除时自动迁移存量任务 | 集成测试 |

### 2.2 调度策略

| # | 标准 | 验证方式 |
|---|------|----------|
| FS6 | 支持轮询（Round-Robin）调度策略 | 集成测试 |
| FS7 | 支持负载感知调度（选择 CPU/内存使用率最低的集群） | 集成测试 |
| FS8 | 支持亲和性调度（优先调度到指定标签的集群） | 集成测试 |
| FS9 | 支持自定义调度策略（通过表达式配置调度条件） | API 测试 |
| FS10 | 调度策略可预览（dry-run 模式，显示目标集群） | API 测试 |
| FS11 | 调度决策记录审计日志（任务、源集群、目标集群、策略、时间） | 单元测试 |

### 2.3 资源视图

| # | 标准 | 验证方式 |
|---|------|----------|
| FS12 | 跨集群资源聚合视图（总 CPU/总内存/总存储） | 前端验证 |
| FS13 | 按集群/区域/标签维度下钻资源详情 | 前端验证 |
| FS14 | 资源使用趋势图（最近 7/30 天） | 前端验证 |
| FS15 | 资源超分告警：集群资源使用率超过 85% 时预警 | 集成测试 |

### 2.4 故障迁移

| # | 标准 | 验证方式 |
|---|------|----------|
| FS16 | 集群失联超过 60 秒自动标记为不健康 | 集成测试 |
| FS17 | 不健康集群上的任务自动迁移到健康集群 | 集成测试 |
| FS18 | 迁移时保留任务状态和进度 | 集成测试 |
| FS19 | 迁移完成后自动验证任务运行正常 | 集成测试 |
| FS20 | 故障迁移记录完整审计日志（原因、源/目标集群、影响任务数） | 单元测试 |

### 2.5 跨域编排

| # | 标准 | 验证方式 |
|---|------|----------|
| FS21 | 支持跨集群部署工作流（Stage A 在集群 1，Stage B 在集群 2） | 集成测试 |
| FS22 | 跨区域部署支持区域间延迟检测，自动选择低延迟路径 | 集成测试 |
| FS23 | 跨域工作流执行状态统一视图 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/federation
```

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/clusters` | 集群列表 |
| POST | `/clusters` | 注册集群 |
| PUT | `/clusters/:id` | 更新集群信息 |
| DELETE | `/clusters/:id` | 移除集群 |
| GET | `/clusters/:id/health` | 集群健康状态 |
| GET | `/clusters/:id/resources` | 集群资源详情 |
| GET | `/scheduling/policies` | 调度策略列表 |
| POST | `/scheduling/policies` | 创建调度策略 |
| POST | `/scheduling/dry-run` | 调度策略预览 |
| GET | `/resources/overview` | 跨集群资源总览 |
| GET | `/resources/trend` | 资源使用趋势 |
| GET | `/migrations` | 故障迁移记录 |
| POST | `/workflows` | 跨域工作流部署 |

## 四、数据模型

```sql
-- 联邦集群注册表
CREATE TABLE IF NOT EXISTS federation_clusters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL UNIQUE,
  api_server      VARCHAR(500) NOT NULL,
  auth_type       VARCHAR(50) NOT NULL,
  auth_config     JSONB NOT NULL,
  labels          JSONB DEFAULT '{}',
  region          VARCHAR(100),
  zone            VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'unknown',
  version         VARCHAR(50),
  node_count      INT DEFAULT 0,
  cpu_total       DECIMAL(10,2) DEFAULT 0,
  memory_total    DECIMAL(10,2) DEFAULT 0,
  cpu_usage       DECIMAL(5,2) DEFAULT 0,
  memory_usage    DECIMAL(5,2) DEFAULT 0,
  last_heartbeat  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 调度策略
CREATE TABLE IF NOT EXISTS federation_scheduling_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  strategy        VARCHAR(50) NOT NULL,
  config          JSONB NOT NULL,
  enabled         BOOLEAN DEFAULT true
);

-- 故障迁移记录
CREATE TABLE IF NOT EXISTS federation_migrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_cluster  UUID REFERENCES federation_clusters(id),
  target_cluster  UUID REFERENCES federation_clusters(id),
  task_count      INT DEFAULT 0,
  reason          TEXT,
  status          VARCHAR(20) DEFAULT 'completed',
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
```

## 五、前端设计

**路由**: `/federation`

主要页面：
- 集群管理页：集群列表、注册、健康监控
- 调度策略页：策略创建、配置、预览
- 资源总览页：跨集群资源聚合视图、趋势图
- 故障迁移页：迁移记录、状态跟踪
- 跨域编排页：跨集群工作流定义和监控

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 22 | ClusterManager、SchedulingEngine、MigrationService |
| 集成测试 | 8 | 集群注册→健康检测、策略调度→dry-run、故障迁移→恢复 |
| 性能测试 | 3 | 调度决策延迟、资源聚合查询性能、批量迁移 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
