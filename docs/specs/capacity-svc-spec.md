# Spec: 容量规划服务 (Capacity)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 基础设施容量管理
> **目标成熟度**: L2 → L2.5
> **关键交付**: 资源池管理、容量预测、扩缩容策略、容量告警、瓶颈分析

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现（Go 微服务 `orion-capacity-svc-go`）：
- 资源池 CRUD（CapacityService + PoolRepository）
- 容量预测（CapacityForecast：当前用量/预测/阈值/建议）
- 扩缩容策略（ScalingPolicy：min/max replicas/上下线阈值/冷却时间）
- 容量指标采集（CapacityMetric：resource_type/resource_id/metric_name/current_value/utilization）
- 容量告警（CapacityAlert：severity/message/threshold）
- 容量报告（CapacityReport：total/healthy/warning/critical/score/alerts_snapshot）
- 瓶颈分析（Bottleneck：resource/metric/impact/recommendation）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无自动扩缩容执行（仅策略定义，无自动执行）
- 无历史指标保留策略（TTL/归档）
- 无容量规划审批流程
- 无容量趋势预测（时间序列预测模型）
- 无多维度报表（按团队/项目/环境）
- 无容量优化建议（基于历史数据）
- 无容量 SLA 管理

### 1.2 Phase 1 目标 (L2.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 自动扩缩容 | 根据指标自动执行扩缩容 | L3 |
| 指标保留策略 | 指标 TTL/归档到冷存储 | L2 |
| 容量报表 | 按团队/项目/环境多维度 | L2.5 |
| 趋势预测 | 时间序列预测模型 | L2.5 |
| 优化建议 | 基于历史数据的优化建议 | L2 |
| SLA 管理 | 容量 SLA 定义与告警 | L2.5 |

## 二、验收标准

### 2.1 资源池管理

| # | 标准 | 验证方式 |
|---|------|----------|
| CP1 | 支持创建资源池（name/resource_type/total_cpu/total_memory/node_count） | API 测试 |
| CP2 | 资源池类型：k8s/cloud/onprem | API 测试 |
| CP3 | 资源池状态追踪（active/inactive） | API 测试 |
| CP4 | 资源池标签管理（labels JSONB） | API 测试 |
| CP5 | 多租户隔离 | 集成测试 |
| CP6 | 资源池 CRUD 完整 | API 测试 |

### 2.2 容量指标

| # | 标准 | 验证方式 |
|---|------|----------|
| CP7 | 支持记录容量指标（resource_type/resource_id/metric_name/current_value/max_value/unit） | API 测试 |
| CP8 | 指标按资源类型筛选（compute/storage/network/database） | API 测试 |
| CP9 | 利用率自动计算（utilization_percent） | 单元测试 |
| CP10 | 指标时间戳记录（recorded_at） | API 测试 |

### 2.3 容量预测

| # | 标准 | 验证方式 |
|---|------|----------|
| CP11 | 支持生成容量预测（resource_type/current_usage/predicted/threshold/days_until_full） | API 测试 |
| CP12 | 预测含推荐建议（recommendation） | API 测试 |
| CP13 | 预测日期记录（forecast_date） | API 测试 |
| CP14 | 预测列表分页查询 | API 测试 |

### 2.4 扩缩容策略

| # | 标准 | 验证方式 |
|---|------|----------|
| CP15 | 支持创建扩缩容策略（name/resource_type/min/max/scale_up/scale_down/cooldown） | API 测试 |
| CP16 | 策略可启用/禁用 | API 测试 |
| CP17 | 策略按资源类型筛选 | API 测试 |
| CP18 | 冷却时间可配置（cooldown_sec） | API 测试 |

### 2.5 容量告警

| # | 标准 | 验证方式 |
|---|------|----------|
| CP19 | 支持列出容量告警（按 severity 筛选） | API 测试 |
| CP20 | 告警严重级别：info/warning/critical | API 测试 |
| CP21 | 告警含资源标识/指标/当前利用率/阈值 | API 测试 |
| CP22 | 支持删除告警 | API 测试 |

### 2.6 容量报告与瓶颈分析

| # | 标准 | 验证方式 |
|---|------|----------|
| CP23 | 支持生成容量报告（total/healthy/warning/critical/score） | API 测试 |
| CP24 | 报告含告警快照和预测快照（JSONB） | API 测试 |
| CP25 | 报告列表分页查询 | API 测试 |
| CP26 | 支持瓶颈分析（返回 Bottleneck 列表） | API 测试 |
| CP27 | 瓶颈分析含影响和建议 | API 测试 |

## 三、API 设计

```
Base: /api/v1/capacity
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/pools` | 创建资源池 |
| GET | `/pools` | 资源池列表 |
| GET | `/pools/:id` | 资源池详情 |
| PUT | `/pools/:id` | 更新资源池 |
| DELETE | `/pools/:id` | 删除资源池 |
| GET | `/pools-count` | 资源池数量 |
| POST | `/metrics` | 记录容量指标 |
| GET | `/metrics` | 指标列表 |
| POST | `/forecasts/generate` | 生成容量预测 |
| GET | `/forecasts` | 预测列表 |
| POST | `/policies` | 创建扩缩容策略 |
| GET | `/policies` | 策略列表 |
| GET | `/alerts` | 告警列表 |
| DELETE | `/alerts/:id` | 删除告警 |
| POST | `/reports/generate` | 生成容量报告 |
| GET | `/reports` | 报告列表 |
| GET | `/reports/:id` | 报告详情 |
| GET | `/bottlenecks` | 瓶颈分析 |

## 四、数据模型

```sql
-- 资源池
CREATE TABLE IF NOT EXISTS resource_pools (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL DEFAULT 'k8s',
    total_cpu DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_memory DOUBLE PRECISION NOT NULL DEFAULT 0,
    used_cpu DOUBLE PRECISION NOT NULL DEFAULT 0,
    used_memory DOUBLE PRECISION NOT NULL DEFAULT 0,
    node_count INT NOT NULL DEFAULT 0,
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_resource_pools_tenant ON resource_pools(tenant_id);

-- 容量预测
CREATE TABLE IF NOT EXISTS capacity_forecasts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    current_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    predicted DOUBLE PRECISION NOT NULL DEFAULT 0,
    threshold DOUBLE PRECISION NOT NULL DEFAULT 80,
    days_until_full INT NOT NULL DEFAULT 0,
    recommendation TEXT,
    forecast_date DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX idx_capacity_forecasts_tenant ON capacity_forecasts(tenant_id);

-- 扩缩容策略
CREATE TABLE IF NOT EXISTS scaling_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    min_replicas INT NOT NULL DEFAULT 1,
    max_replicas INT NOT NULL DEFAULT 10,
    scale_up_threshold DOUBLE PRECISION NOT NULL DEFAULT 80,
    scale_down_threshold DOUBLE PRECISION NOT NULL DEFAULT 30,
    cooldown_sec INT NOT NULL DEFAULT 300,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scaling_policies_tenant ON scaling_policies(tenant_id);

-- 容量指标
CREATE TABLE IF NOT EXISTS capacity_metrics (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    metric_name VARCHAR(64) NOT NULL,
    current_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit VARCHAR(32) NOT NULL DEFAULT '',
    utilization_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_capacity_metrics_tenant ON capacity_metrics(tenant_id);
CREATE INDEX idx_capacity_metrics_resource ON capacity_metrics(tenant_id, resource_type, resource_id);

-- 容量告警
CREATE TABLE IF NOT EXISTS capacity_alerts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    metric_name VARCHAR(64) NOT NULL,
    current_utilization DOUBLE PRECISION NOT NULL DEFAULT 0,
    threshold DOUBLE PRECISION NOT NULL DEFAULT 80,
    severity VARCHAR(16) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_capacity_alerts_tenant ON capacity_alerts(tenant_id);
CREATE INDEX idx_capacity_alerts_severity ON capacity_alerts(tenant_id, severity);

-- 容量报告
CREATE TABLE IF NOT EXISTS capacity_reports (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    total_resources INT NOT NULL DEFAULT 0,
    healthy_count INT NOT NULL DEFAULT 0,
    warning_count INT NOT NULL DEFAULT 0,
    critical_count INT NOT NULL DEFAULT 0,
    overall_score INT NOT NULL DEFAULT 100,
    alerts_snapshot JSONB DEFAULT '[]',
    forecasts_snapshot JSONB DEFAULT '[]',
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_capacity_reports_tenant ON capacity_reports(tenant_id);
```

## 五、前端设计

**路由**: `/capacity`

主要页面：
- 资源池列表页：池列表/CPU内存使用率/节点数
- 资源池详情页：指标趋势/扩缩容策略
- 指标查询页：按资源类型/名称筛选
- 预测页：容量预测趋势/天数预警
- 告警页：告警列表/严重级别/处理
- 报告页：容量报告/健康评分
- 瓶颈分析页：瓶颈列表/影响评估/建议

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | CapacityService、PoolService、ForecastService、AlertService |
| 集成测试 | 6 | 创建池→记录指标→生成预测→告警→报告→瓶颈分析闭环 |
| 前端测试 | 4 | 资源池、指标、预测、告警 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
