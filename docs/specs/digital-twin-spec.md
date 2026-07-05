# Spec: 数字孪生 (Digital Twin)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 数字孪生
> **目标成熟度**: L1 → L2
> **关键交付**: 生产快照、流量录制回放、变更沙箱、状态对比、影响分析

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现：
- Pipeline 执行历史与状态追踪（PostgreSQL）
- 基础设施配置管理（Terraform 状态存储）
- 基础监控集成（Prometheus 查询）
- 部署记录（DeploymentRepository）
- 服务拓扑基础

**不足**：
- 无生产环境镜像/快照能力
- 无流量录制与回放机制
- 变更无法在隔离沙箱中预验证
- 无生产配置副本用于安全测试
- 无变更影响分析能力

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 生产快照 | 对生产环境状态生成快照 | L2 |
| 流量录制 | 录制生产流量、脱敏存储 | L2 |
| 流量回放 | 在测试环境脱敏回放、结果对比 | L2 |
| 变更沙箱 | 基于快照创建隔离沙箱 | L1.5 |
| 影响分析 | 变更前评估影响范围 | L1.5 |

## 二、验收标准

### 2.1 生产快照

| # | 标准 | 验证方式 |
|---|------|----------|
| DT1 | 支持对指定租户/项目/环境生成生产快照 | API 测试 |
| DT2 | 快照包含：配置、服务拓扑、依赖版本、环境变量（脱敏） | API 测试 |
| DT3 | 快照可导出为 YAML 包，含版本签名和校验 | 集成测试 |
| DT4 | 快照恢复后环境拓扑与原始一致（服务数量/连接关系） | 集成测试 |
| DT5 | 快照创建异步执行，支持进度查看 | 前端验证 |
| DT6 | 快照按保留策略自动清理（默认保留 30 天） | 单元测试 |

### 2.2 流量录制

| # | 标准 | 验证方式 |
|---|------|----------|
| DT7 | 支持配置流量录制规则（路径前缀、时间窗口、采样率） | API 测试 |
| DT8 | 录制流量自动脱敏（PII、Token、密码、证书字段） | 单元测试 |
| DT9 | 录制流量持久化存储，支持检索 | API 测试 |
| DT10 | 录制状态可视化（请求数、速率、数据量） | 前端验证 |

### 2.3 流量回放

| # | 标准 | 验证方式 |
|---|------|----------|
| DT11 | 支持在测试环境按录制倍速回放（0.5x/1x/2x/5x） | 集成测试 |
| DT12 | 回放结果对比（预期 vs 实际：状态码、响应结构、延迟） | 前端验证 |
| DT13 | 回放差异自动归类（新增/缺失/修改字段） | 前端验证 |
| DT14 | 回放报告下载（JSON/HTML 格式） | API 测试 |

### 2.4 变更沙箱

| # | 标准 | 验证方式 |
|---|------|----------|
| DT15 | 基于生产快照创建隔离 K8s Namespace 沙箱 | 集成测试 |
| DT16 | 沙箱网络与生产完全隔离（NetworkPolicy） | 安全审查 |
| DT17 | 沙箱自动销毁 TTL（默认 24 小时，可延长） | API 测试 |
| DT18 | 沙箱资源配额限制（CPU/内存/存储，不超过生产 50%） | 集成测试 |
| DT19 | 沙箱中执行变更后可一键销毁并生成报告 | 前端验证 |

### 2.5 影响分析

| # | 标准 | 验证方式 |
|---|------|----------|
| DT20 | 变更前自动分析影响范围（下游服务、依赖、配置） | API 测试 |
| DT21 | 影响分析报告含受影响服务列表、风险等级、回退建议 | 前端验证 |
| DT22 | 高风险变更自动触发审批流程 | 集成测试 |

## 三、API 设计

```
Base: /api/v1/digital-twin
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/snapshots` | 创建生产快照 |
| GET | `/snapshots` | 快照列表 |
| GET | `/snapshots/:id` | 快照详情 |
| GET | `/snapshots/:id/export` | 导出快照包 |
| DELETE | `/snapshots/:id` | 删除快照 |
| POST | `/traffic/recordings` | 开始流量录制 |
| GET | `/traffic/recordings` | 录制历史 |
| POST | `/traffic/recordings/:id/stop` | 停止录制 |
| POST | `/traffic/replays` | 发起流量回放 |
| GET | `/traffic/replays/:id` | 回放状态 |
| GET | `/traffic/replays/:id/report` | 回放报告 |
| POST | `/sandboxes` | 创建变更沙箱 |
| GET | `/sandboxes` | 沙箱列表 |
| DELETE | `/sandboxes/:id` | 销毁沙箱 |
| POST | `/impact-analysis` | 变更影响分析 |

## 四、数据模型

```sql
-- 生产快照
CREATE TABLE IF NOT EXISTS twin_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  environment     VARCHAR(50) NOT NULL,
  status          VARCHAR(20) DEFAULT 'creating',
  components      JSONB NOT NULL DEFAULT '[]',
  topology        JSONB NOT NULL DEFAULT '{}',
  size_bytes      BIGINT DEFAULT 0,
  storage_path    VARCHAR(500),
  created_by      UUID REFERENCES users(id),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 流量录制
CREATE TABLE IF NOT EXISTS traffic_recordings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id),
  source_env            VARCHAR(50) NOT NULL,
  status                VARCHAR(20) DEFAULT 'recording',
  path_prefixes         TEXT[] DEFAULT '{}',
  desensitization_rules TEXT[] DEFAULT '{}',
  request_count         INT DEFAULT 0,
  size_bytes            BIGINT DEFAULT 0,
  storage_path          VARCHAR(500),
  started_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

-- 变更沙箱
CREATE TABLE IF NOT EXISTS twin_sandboxes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id),
  snapshot_id     UUID REFERENCES twin_snapshots(id),
  namespace       VARCHAR(200),
  status          VARCHAR(20) DEFAULT 'creating',
  resource_quota  JSONB,
  ttl_hours       INT DEFAULT 24,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ
);
```

## 五、前端设计

**路由**: `/digital-twin`

主要页面：
- 快照管理页：创建/列表/详情/导出/删除快照
- 流量录制页：录制规则配置、状态监控
- 流量回放页：发起回放、结果对比、报告查看
- 沙箱管理页：沙箱创建/列表/销毁
- 影响分析页：变更影响评估、风险报告

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 22 | SnapshotService、TrafficRecorder、TrafficReplayer、SandboxManager |
| 集成测试 | 6 | 快照完整生命周期、录制→回放→报告、沙箱创建→销毁 |
| 安全测试 | 3 | 流量脱敏验证、沙箱隔离验证、快照权限验证 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
