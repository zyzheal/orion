# ML-Based Canary Analysis - 设计文档

## 1. 概述

### 1.1 愿景
在金丝雀部署期间，使用 ML 同时比对数百个指标，检测基于阈值的分析会遗漏的细微回归，自动决定升级或回滚。

### 1.2 核心价值
- **全指标面对比** — 不仅看黄金信号，而是分析所有可用指标的统计分布差异
- **ML 异常检测** — XGBoost 分类 + DBSCAN 聚类识别异常模式
- **可解释决策** — SHAP 解释每个指标对决策的贡献
- **自适应** — 模型随部署历史自动进化

### 1.3 用户角色
- **SRE** — 配置分析策略、强制升级/回滚
- **研发工程师** — 查看分析结果、调试回归原因
- **Tech Lead** — 查看发布质量趋势

## 2. 架构设计

### 2.1 组件分解

```
┌─────────────────────────────────────────────────────────────┐
│                    ML Canary Analysis                         │
│                                                               │
│  Argo Rollouts ──▶ Analysis Run Trigger                       │
│                          │                                    │
│              ┌───────────▼───────────┐                        │
│              │   Metric Discovery     │                        │
│              │   (Prometheus query)   │                        │
│              └───────────┬───────────┘                        │
│                          │                                    │
│              ┌───────────▼───────────┐                        │
│              │  Statistical Tests     │                        │
│              │  - Mann-Whitney U      │                        │
│              │  - KS Test             │                        │
│              │  - Cliff's Delta       │                        │
│              └───────────┬───────────┘                        │
│                          │                                    │
│          ┌───────────────┼───────────────┐                    │
│          ▼               ▼               ▼                    │
│  ┌──────────────┐ ┌───────────┐ ┌───────────────┐           │
│  │ XGBoost      │ │ DBSCAN    │ │ Decision      │           │
│  │ Classifier   │ │ Cluster   │ │ Aggregator    │           │
│  └──────────────┘ └───────────┘ └───────┬───────┘           │
│                                          │                    │
│                              ┌───────────▼───────────┐       │
│                              │ PROMOTE | ROLLBACK    │       │
│                              │ | PENDING              │       │
│                              └───────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 集成点
- **AI 算法库 (M17)** — XGBoost、DBSCAN、SHAP
- **智能部署 (M16)** — 金丝雀编排、流量控制
- **可观测性 (M26)** — Prometheus 指标采集
- **事件总线 (M19)** — 分析事件发布

## 3. 数据模型

```sql
-- 金丝雀分析运行
CREATE TABLE canary_analysis_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL,
  run_number      INT NOT NULL,
  traffic_split   JSONB NOT NULL,              -- {canary: 10, baseline: 90}
  status          VARCHAR(20) NOT NULL,         -- running | promote | rollback | inconclusive
  confidence      DECIMAL(3,3),                 -- 0.000 - 1.000
  decision        VARCHAR(20),                  -- promote | rollback | continue
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT
);

-- 指标结果
CREATE TABLE canary_metric_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
  metric_name     VARCHAR(100) NOT NULL,
  baseline_value  DECIMAL(15,6),
  canary_value    DECIMAL(15,6),
  mann_whitney_p  DECIMAL(5,4),
  ks_statistic    DECIMAL(5,4),
  cliff_delta     DECIMAL(5,4),
  verdict         VARCHAR(20),                  -- pass | warn | fail
  category        VARCHAR(50)                   -- latency | error_rate | throughput | saturation
);

-- ML 结果
CREATE TABLE canary_ml_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
  model_name      VARCHAR(50) NOT NULL,          -- xgboost | dbscan
  prediction      VARCHAR(20),                   -- healthy | degraded
  confidence      DECIMAL(3,3),
  shap_explanation JSONB,                        -- Feature contributions
  cluster_id      INT                            -- DBSCAN cluster assignment
);

-- 分析配置
CREATE TABLE canary_analysis_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name    VARCHAR(100) NOT NULL,
  environment     VARCHAR(50) NOT NULL,
  analysis_interval_sec INT DEFAULT 300,         -- 5min default
  max_rounds      INT DEFAULT 5,
  warmup_period_sec INT DEFAULT 600,             -- 10min warmup
  promote_threshold DECIMAL(3,3) DEFAULT 0.75,
  rollback_threshold DECIMAL(3,3) DEFAULT 0.60,
  traffic_step    INT DEFAULT 20,                -- 20% per step
  metric_weights  JSONB,                         -- Category weights
  excluded_metrics TEXT[],                       -- Metrics to skip
  slo_metrics     TEXT[],                        -- SLO-critical metrics
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 决策历史
CREATE TABLE canary_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES canary_analysis_runs(id),
  decision        VARCHAR(20) NOT NULL,
  reason          TEXT,
  overridden_by   UUID REFERENCES users(id),     -- If manually overridden
  override_reason TEXT,
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 ClickHouse 时序存储
```sql
-- 指标时序数据（ClickHouse，大量写入/时序查询场景）
CREATE TABLE canary_metric_timeseries (
  run_id          UUID,
  metric_name     LowCardinality(String),
  timestamp       DateTime64(3),
  value           Float64,
  variant         LowCardinality(String)          -- canary | baseline
) ENGINE = MergeTree()
ORDER BY (run_id, metric_name, timestamp);
```

## 4. API 设计

```
GET    /api/v1/canary-analysis/runs?deploymentId=   # 分析历史
POST   /api/v1/canary-analysis/runs                  # 触发分析 (body: deploymentId, roundNumber, config)
GET    /api/v1/canary-analysis/runs/:id              # 运行详情
GET    /api/v1/canary-analysis/runs/:id/metrics      # 指标结果
GET    /api/v1/canary-analysis/runs/:id/ml-results   # ML 结果
GET/POST /api/v1/canary-analysis/configs              # 配置 CRUD
GET    /api/v1/canary-analysis/configs/:service/:env
PUT/DELETE /api/v1/canary-analysis/configs/:id
POST   /api/v1/canary-analysis/force-promote         # 强制升级 (body: runId, reason)
POST   /api/v1/canary-analysis/force-rollback        # 强制回滚 (body: runId, reason)
GET    /api/v1/canary-analysis/metrics/discover       # 发现可用指标
POST   /api/v1/canary-analysis/models/retrain        # 重新训练 ML 模型
```

## 5. Pipeline 集成

集成在 **Stage 6 (Deploy)** 金丝雀阶段：

```yaml
# Argo Rollouts AnalysisTemplate
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: ml-canary-analysis
spec:
  args:
    - name: deployment-id
    - name: round-number
  metrics:
    - name: ml-analysis
      interval: 5m
      provider:
        webhook:
          url: "http://orion-platform/api/v1/canary-analysis/runs"
          body: |
            {"deploymentId": "{{deployment-id}}", "round": {{round-number}}}
      successCondition: result.decision in ["promote", "continue"]
      failureCondition: result.decision == "rollback"
```

## 6. UI/UX 设计

### 6.1 分析仪表盘 (`/canary-analysis/:runId`)
- 状态横幅：当前决策（PROMOTE/ROLLBACK/PENDING）+ 置信度
- 流量分布图：canary vs baseline 的流量百分比 + 每轮进度
- 时间序列对比图：canary/baseline 指标叠加折线图
- 逐指标结果表格：指标名、统计检验结果、ML 判定、严重级别
- ML 分析详情：XGBoost 分类结果 + SHAP 解释 + DBSCAN 聚类结果
- 分析历史：每轮决策表格（轮次、流量、置信度、决策、耗时）

### 6.2 回滚视图
- 醒目红色横幅：ROLLBACK TRIGGERED + 原因
- Top 退化指标列表（effect size 排序）
- ML 诊断详情：XGBoost 失败判定、DBSCAN 异常簇
- 操作按钮：查看完整报告、确认回滚、AI 调试

### 6.3 配置页 (`/settings/canary-analysis`)
- 表单：分析间隔、最大轮数、预热期、阈值、流量步长
- 指标权重配置：按类别设置权重（延迟 40%、错误率 30%、吞吐量 20%、饱和度 10%）
- 排除指标列表、SLO 指标列表

## 7. 安全与权限

| 权限 | 角色 |
|------|------|
| `canary:read` | developer, tech_lead, sre, admin |
| `canary:trigger` | developer (dev/staging), sre, tech_lead, admin (all) |
| `canary:force-promote` | sre, tech_lead, admin |
| `canary:force-rollback` | sre, tech_lead, admin |
| `canary:config:manage` | sre, admin |
| `canary:model:retrain` | sre, admin |

## 8. 测试策略

- **L1 单元** — Mann-Whitney U 检验、KS 检验、Cliff's Delta、XGBoost 预测、DBSCAN 聚类
- **L2 集成** — Prometheus 查询、Argo Rollouts 集成、模型加载
- **L3 E2E** — 健康金丝雀（全轮通过）→ 退化金丝雀（1-2 轮回滚）
- **L4 性能** — 150 指标全轮分析 < 15s，10 并发 < 30s p99
- **L5 ML 准确性** — XGBoost 分类准确率 > 90%，假回滚率 < 2%
- **L6 降级** — Prometheus 不可用 → 使用缓存；ML 不可用 → 仅统计检验
