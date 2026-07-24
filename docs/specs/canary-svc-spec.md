# Spec: 灰度分析服务 (Canary)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 灰度发布 / 金丝雀分析
> **目标成熟度**: L2 → L3
> **关键交付**: 灰度部署、ML 指标分析、流量配置、自动决策

## 一、功能描述

### 1.1 现状评估 (L2)

Orion 当前已实现（Go 微服务 `orion-canary-svc-go`）：
- 灰度部署 CRUD（CanaryService + CanaryRepository）
- 灰度状态追踪（pending/running/success/failed/rolled_back/promoted/deploying）
- 灰度指标采集（CanaryMetric：延迟/错误率/吞吐量/饱和度）
- ML 分析运行（CanaryAnalysisRun：流量分割/置信度/决策）
- 指标统计结果（CanaryMetricResult：Mann-Whitney/KS/CliffDelta/判决）
- ML 预测结果（CanaryMLResult：SHAP/聚类）
- 分析配置（CanaryAnalysisConfig：分析间隔/轮数/预热/阈值/指标权重）
- 决策审计记录（CanaryDecisionRecord）
- 模型重训任务（CanaryRetrainJob）
- 流量配置（TrafficConfig：权重/策略/主机/命名空间）
- 流量变更历史（TrafficHistory）
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无灰度自动 promotion（达到条件自动全量）
- 无自动回滚（健康检查失败自动回滚）
- 无灰度审批流程
- 无灰度可视化（流量变化曲线）
- 无 SLO 阈值自动判定
- 无灰度报告生成
- 无多集群流量配置

### 1.2 Phase 1 目标 (L3)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 自动 Promotion | 分析通过自动全量发布 | L3 |
| 自动回滚 | 指标超阈值自动回滚 | L3 |
| 灰度审批 | 生产灰度需审批 | L2.5 |
| 灰度报告 | 分析报告/对比图表 | L2.5 |
| SLO 判定 | 自动对比 SLO 阈值 | L3 |
| 多集群 | 多集群流量配置 | L2.5 |

## 二、验收标准

### 2.1 灰度部署基础

| # | 标准 | 验证方式 |
|---|------|----------|
| CN1 | 支持创建灰度部署（deployment_id/service_name/version/weight） | API 测试 |
| CN2 | 灰度状态流转：pending → running → deploying → promoted/rolled_back/failed | API 测试 |
| CN3 | 支持 promote 全量发布 | API 测试 |
| CN4 | 支持 rollback 回滚 | API 测试 |
| CN5 | 多租户隔离 | 集成测试 |
| CN6 | 灰度删除需确认（防止误删进行中灰度） | API 测试 |

### 2.2 指标采集

| # | 标准 | 验证方式 |
|---|------|----------|
| CN7 | 支持添加灰度指标（metric_name/value/source） | API 测试 |
| CN8 | 支持查询灰度指标列表 | API 测试 |
| CN9 | 指标按时间序列存储 | API 测试 |
| CN10 | 指标来源追踪（prometheus/自定义） | API 测试 |

### 2.3 ML 分析运行

| # | 标准 | 验证方式 |
|---|------|----------|
| CN11 | 支持创建分析运行（traffic_split/run_number） | API 测试 |
| CN12 | 分析状态：running → promote/rollback/inconclusive | API 测试 |
| CN13 | 支持记录指标统计结果（baseline/canary/p值/KS/CliffDelta/判决） | API 测试 |
| CN14 | 支持记录 ML 预测结果（model/confidence/SHAP/cluster） | API 测试 |
| CN15 | 分析置信度可配置阈值 | API 测试 |

### 2.4 分析配置

| # | 标准 | 验证方式 |
|---|------|----------|
| CN16 | 支持创建分析配置（service_name/environment/interval/rounds/warmup） | API 测试 |
| CN17 | 配置含 promotion/rollback 阈值 | API 测试 |
| CN18 | 配置含流量步进（traffic_step） | API 测试 |
| CN19 | 配置含指标权重（metric_weights JSONB） | API 测试 |
| CN20 | 配置含排除指标（excluded_metrics）和 SLO 指标（slo_metrics） | API 测试 |
| CN21 | service_name + environment 唯一约束 | API 测试 |

### 2.5 决策与审计

| # | 标准 | 验证方式 |
|---|------|----------|
| CN22 | 支持记录决策（decision/reason/overridden_by） | API 测试 |
| CN23 | 决策含审计时间戳 | API 测试 |
| CN24 | 支持模型重训任务提交 | API 测试 |
| CN25 | 重训任务状态追踪（queued/running/completed/failed） | API 测试 |

### 2.6 流量配置

| # | 标准 | 验证方式 |
|---|------|----------|
| CN26 | 支持创建/更新流量配置（strategy/host/namespace/upstream/weights） | API 测试 |
| CN27 | 流量配置支持 baseline/canary destination 和 subset | API 测试 |
| CN28 | 支持记录流量变更历史（success/result/error） | API 测试 |
| CN29 | 流量变更可审计 | API 测试 |

## 三、API 设计

```
Base: /api/v1/canaries
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/` | 创建灰度部署 |
| GET | `/` | 灰度列表 |
| GET | `/count` | 灰度数量 |
| GET | `/:id` | 灰度详情 |
| DELETE | `/:id` | 删除灰度 |
| POST | `/:id/promote` | 全量发布 |
| POST | `/:id/rollback` | 回滚 |
| POST | `/:id/metrics` | 添加指标 |
| GET | `/:id/metrics` | 查询指标 |

```
Base: /api/v1/analysis
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/runs` | 创建分析运行 |
| GET | `/runs` | 分析运行列表 |
| POST | `/runs/:runId/results` | 记录指标结果 |
| POST | `/runs/:runId/ml-results` | 记录 ML 结果 |
| POST | `/decisions` | 记录决策 |
| POST | `/retrain-jobs` | 提交重训任务 |
| GET | `/configs` | 分析配置列表 |
| POST | `/configs` | 创建分析配置 |
| PUT | `/configs/:id` | 更新分析配置 |

```
Base: /api/v1/traffic
```

| 方法 | 路径 | 描述 |
|------|------|------|
| PUT | `/configs/:id` |  upsert 流量配置 |
| POST | `/history` | 记录流量变更历史 |
| GET | `/configs` | 流量配置列表 |

## 四、数据模型

```sql
-- 灰度部署
CREATE TABLE IF NOT EXISTS canaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    weight INT NOT NULL DEFAULT 10,
    target_weight INT NOT NULL DEFAULT 100,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canaries_tenant_id ON canaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_canaries_status ON canaries(status);
CREATE INDEX IF NOT EXISTS idx_canaries_service ON canaries(service_name);

-- 灰度指标
CREATE TABLE IF NOT EXISTS canary_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canary_id UUID NOT NULL REFERENCES canaries(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canary_metrics_canary_id ON canary_metrics(canary_id);

-- 分析运行
CREATE TABLE IF NOT EXISTS canary_analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(255) NOT NULL,
    run_number INT NOT NULL DEFAULT 1,
    traffic_split JSONB NOT NULL DEFAULT '{"canary": 10, "baseline": 90}',
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    confidence DOUBLE PRECISION,
    decision VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_canary_analysis_runs_deployment ON canary_analysis_runs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_canary_analysis_runs_status ON canary_analysis_runs(status);

-- 指标统计结果
CREATE TABLE IF NOT EXISTS canary_metric_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    baseline_value DOUBLE PRECISION,
    canary_value DOUBLE PRECISION,
    mann_whitney_p DOUBLE PRECISION,
    ks_statistic DOUBLE PRECISION,
    cliff_delta DOUBLE PRECISION,
    verdict VARCHAR(50),
    category VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_canary_metric_results_run ON canary_metric_results(run_id);

-- ML 预测结果
CREATE TABLE IF NOT EXISTS canary_ml_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    prediction VARCHAR(50),
    confidence DOUBLE PRECISION,
    shap_explanation JSONB,
    cluster_id INT
);

CREATE INDEX IF NOT EXISTS idx_canary_ml_results_run ON canary_ml_results(run_id);

-- 分析配置
CREATE TABLE IF NOT EXISTS canary_analysis_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(255) NOT NULL,
    environment VARCHAR(100) NOT NULL,
    analysis_interval_sec INT NOT NULL DEFAULT 300,
    max_rounds INT NOT NULL DEFAULT 5,
    warmup_period_sec INT NOT NULL DEFAULT 600,
    promote_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    rollback_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.60,
    traffic_step INT NOT NULL DEFAULT 20,
    metric_weights JSONB,
    excluded_metrics TEXT[] DEFAULT '{}',
    slo_metrics TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(service_name, environment)
);

CREATE INDEX IF NOT EXISTS idx_canary_analysis_configs_service ON canary_analysis_configs(service_name, environment);

-- 决策审计
CREATE TABLE IF NOT EXISTS canary_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
    decision VARCHAR(50) NOT NULL,
    reason TEXT,
    overridden_by VARCHAR(100),
    override_reason TEXT,
    decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_decisions_run ON canary_decisions(run_id);

-- 重训任务
CREATE TABLE IF NOT EXISTS canary_retrain_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 流量配置
CREATE TABLE IF NOT EXISTS canary_traffic_configs (
    id VARCHAR(255) PRIMARY KEY,
    canary_id VARCHAR(255) NOT NULL,
    strategy VARCHAR(50) NOT NULL DEFAULT 'weighted',
    host VARCHAR(255),
    namespace VARCHAR(100) DEFAULT 'default',
    upstream_name VARCHAR(255),
    phase VARCHAR(50) DEFAULT 'initial',
    baseline_weight INT,
    canary_weight INT,
    baseline_destination VARCHAR(500),
    baseline_subset VARCHAR(100),
    canary_destination VARCHAR(500),
    canary_subset VARCHAR(100),
    servers JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_traffic_configs_canary ON canary_traffic_configs(canary_id);

-- 流量历史
CREATE TABLE IF NOT EXISTS canary_traffic_history (
    id VARCHAR(255) PRIMARY KEY,
    canary_id VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    result TEXT NOT NULL,
    error TEXT,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_traffic_history_canary ON canary_traffic_history(canary_id);

-- 灰度分析（简易结果）
CREATE TABLE IF NOT EXISTS canary_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canary_id UUID NOT NULL REFERENCES canaries(id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL DEFAULT 0,
    verdict VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_analysis_canary ON canary_analysis(canary_id);
```

## 五、前端设计

**路由**: `/canary`

主要页面：
- 灰度列表页：进行中/已完成/已回滚，支持筛选
- 灰度详情页：指标曲线/分析结果/操作按钮
- 分析运行页：ML 结果/判决/指标统计
- 流量配置页：权重调整/策略切换
- 分析配置页：阈值/间隔/指标权重设置
- 重训任务页：模型重训状态

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | CanaryService、AnalysisRunService、TrafficConfigService |
| 集成测试 | 6 | 创建→指标采集→分析→决策→promote/rollback 闭环 |
| 前端测试 | 4 | 灰度列表、详情、分析、流量配置 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
