# 新增模块数据结构分析与迁移设计

> **日期**: 2026-05-22
> **目的**: 分析 3 个完全缺失模块 + 15 个能力增强模块的数据库表结构需求 + 现有表结构审计
> **依据**: 现有 202 个正向迁移文件 + 490 张表 + 114 个 Repository + 37 个 Model

---

## 一、现有数据库架构概览

| 指标 | 数量 | 说明 |
|------|------|------|
| 正向迁移文件 | 202 个（不含 rollback） | 编号 001-182，含 055b/055c 等后缀编号 |
| 数据库表总数 | ~490 张 | `CREATE TABLE` 语句总数 |
| Repository | 114 个 | PostgreSQL Repository 模式 |
| Model | 37 个 | TypeScript 数据模型类 |
| 设计模式 | 租户隔离 RLS | ~63 张表有 RLS 策略（覆盖率 ~25%） |
| 主键策略 | `UUID DEFAULT gen_random_uuid()` | 部分旧表用 `SERIAL` |
| JSON 字段 | 大量使用 `JSONB` | 灵活配置/元数据存储 |

### 现有设计规范

| 规范项 | 标准值 | 实际一致率 |
|--------|--------|-----------|
| 租户隔离 | `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` | ~75%（52 张表后期追加） |
| RLS 策略 | `tenant_isolation_{table_name}` | ~25%（63/250+ 张表） |
| 索引命名 | `idx_{table_name}_{column}` | ~85% |
| 审计字段 | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` | ~60%（3 种格式混用） |
| 创建人字段 | `created_by VARCHAR(100)` | ~40%（5 种命名变体） |
| 更新字段 | `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` | ~50% |
| 状态枚举 | `VARCHAR(30)` + 注释说明可选值 | ~90% |
| 软删除 | 部分表有 `deleted_at` 字段 | ~10% |
| Rollback | 每个迁移有对应的 rollback SQL 文件 | ~85%（175+ 缺失） |

---

## 二、3 个完全缺失模块 — 需要新建表结构

### 2.1 智能巡检（Smart Inspection）— 需新建 ~4 张表

**现有相关表**：
- `monitoring_configs`（012）— 监控配置，但无巡检计划能力
- `risk_assessments`（018）— 风险评估，但无定期巡检调度
- `cron_jobs`（036）— 定时任务，但无巡检结果关联

**结论**：**需要新建表结构**，现有表无法支撑智能巡检的"计划→执行→报告→整改跟踪"闭环。

**建议表结构**：

```sql
-- 巡检计划表
CREATE TABLE IF NOT EXISTS inspection_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  target_type       VARCHAR(50) NOT NULL,          -- cluster, namespace, service, host, database
  target_ids        UUID[] NOT NULL DEFAULT '{}',   -- 目标资源 ID 列表
  schedule          VARCHAR(50) NOT NULL,           -- cron 表达式
  inspection_items  JSONB NOT NULL DEFAULT '[]',    -- 巡检项目清单 [{item, threshold, severity}]
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspection_plans_tenant ON inspection_plans(tenant_id);
CREATE INDEX idx_inspection_plans_enabled ON inspection_plans(enabled);

-- 巡检执行记录表
CREATE TABLE IF NOT EXISTS inspection_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id           UUID REFERENCES inspection_plans(id) ON DELETE SET NULL,
  trigger_type      VARCHAR(30) NOT NULL DEFAULT 'scheduled', -- scheduled, manual
  status            VARCHAR(30) NOT NULL DEFAULT 'running',   -- running, completed, failed, cancelled
  total_items       INT NOT NULL DEFAULT 0,
  passed_items      INT NOT NULL DEFAULT 0,
  failed_items      INT NOT NULL DEFAULT 0,
  warning_items     INT NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  error_message     TEXT
);
CREATE INDEX idx_inspection_runs_tenant ON inspection_runs(tenant_id);
CREATE INDEX idx_inspection_runs_plan ON inspection_runs(plan_id);
CREATE INDEX idx_inspection_runs_status ON inspection_runs(status);

-- 巡检结果详情表
CREATE TABLE IF NOT EXISTS inspection_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id            UUID REFERENCES inspection_runs(id) ON DELETE CASCADE,
  item_name         VARCHAR(200) NOT NULL,
  target_id         UUID,
  result            VARCHAR(30) NOT NULL,            -- pass, fail, warning
  actual_value      TEXT,
  expected_value    TEXT,
  severity          VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, critical
  details           JSONB NOT NULL DEFAULT '{}',
  recommendation    TEXT,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspection_results_run ON inspection_results(run_id);
CREATE INDEX idx_inspection_results_result ON inspection_results(result);
CREATE INDEX idx_inspection_results_severity ON inspection_results(severity);

-- 巡检整改跟踪表
CREATE TABLE IF NOT EXISTS inspection_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  result_id         UUID REFERENCES inspection_results(id) ON DELETE SET NULL,
  action_type       VARCHAR(50) NOT NULL,            -- auto_fix, manual_fix, ignore, escalate
  status            VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, rejected
  assigned_to       VARCHAR(100),
  description       TEXT,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspection_actions_tenant ON inspection_actions(tenant_id);
CREATE INDEX idx_inspection_actions_status ON inspection_actions(status);
```

**预估迁移编号**：`183_create_inspection_tables.sql`

---

### 2.2 容量规划（Capacity Planning）— 需新建 ~3 张表

**现有相关表**：
- `cost_records`（031/094）— 成本记录，但无资源容量数据
- `namespace_pools`（042）— 命名空间池，但无容量预测
- `resource_abstraction`（120）— 资源抽象层，但无趋势分析

**结论**：**需要新建表结构**，现有表缺少"历史用量→趋势预测→容量预警→扩容建议"的数据模型。

**建议表结构**：

```sql
-- 容量基线表（历史用量聚合）
CREATE TABLE IF NOT EXISTS capacity_baselines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type     VARCHAR(50) NOT NULL,            -- cpu, memory, storage, network, pod_count
  resource_id       VARCHAR(200) NOT NULL,
  period            VARCHAR(20) NOT NULL,            -- daily, weekly, monthly
  avg_usage         DECIMAL(10,2) NOT NULL,
  p50_usage         DECIMAL(10,2),
  p95_usage         DECIMAL(10,2),
  p99_usage         DECIMAL(10,2),
  max_usage         DECIMAL(10,2) NOT NULL,
  total_capacity    DECIMAL(10,2) NOT NULL,          -- 总容量
  utilization_pct   DECIMAL(5,2),                    -- 使用率 %
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_capacity_baselines_tenant ON capacity_baselines(tenant_id);
CREATE INDEX idx_capacity_baselines_resource ON capacity_baselines(resource_type, resource_id);

-- 容量预测表
CREATE TABLE IF NOT EXISTS capacity_forecasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  baseline_id       UUID REFERENCES capacity_baselines(id) ON DELETE SET NULL,
  forecast_date     TIMESTAMPTZ NOT NULL,
  predicted_usage   DECIMAL(10,2) NOT NULL,
  confidence_lower  DECIMAL(10,2),
  confidence_upper  DECIMAL(10,2),
  model_type        VARCHAR(50) NOT NULL DEFAULT 'linear', -- linear, exponential, seasonal
  accuracy_score    DECIMAL(5,3),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_capacity_forecasts_tenant ON capacity_forecasts(tenant_id);
CREATE INDEX idx_capacity_forecasts_date ON capacity_forecasts(forecast_date DESC);

-- 容量预警与扩容建议表
CREATE TABLE IF NOT EXISTS capacity_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  baseline_id       UUID REFERENCES capacity_baselines(id) ON DELETE SET NULL,
  alert_type        VARCHAR(30) NOT NULL,            -- threshold_exceeded, forecast_exhaust, trend_anomaly
  severity          VARCHAR(20) NOT NULL DEFAULT 'warning',
  current_usage     DECIMAL(10,2),
  predicted_exhaust_date TIMESTAMPTZ,
  recommendation    JSONB NOT NULL DEFAULT '{}',     -- {action, target, estimated_cost}
  status            VARCHAR(30) NOT NULL DEFAULT 'open', -- open, acknowledged, resolved, ignored
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX idx_capacity_alerts_tenant ON capacity_alerts(tenant_id);
CREATE INDEX idx_capacity_alerts_severity ON capacity_alerts(severity);
CREATE INDEX idx_capacity_alerts_status ON capacity_alerts(status);
```

**预估迁移编号**：`184_create_capacity_tables.sql`

---

### 2.3 中间件运维（Middleware Operations）— 需新建 ~4 张表

**现有相关表**：
- `monitoring_configs`（012）— 通用监控，但无中间件特有指标
- `runner_pool`（141）— Runner 池，但仅覆盖 CI Runner
- `environments`（008）— 环境管理，但无中间件实例管理

**结论**：**需要新建表结构**，中间件（Redis/MySQL/Kafka/RabbitMQ/Elasticsearch）有独特的配置、健康检查、性能指标和运维操作模型。

**建议表结构**：

```sql
-- 中间件实例表
CREATE TABLE IF NOT EXISTS middleware_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  middleware_type   VARCHAR(30) NOT NULL,            -- redis, mysql, kafka, rabbitmq, elasticsearch, mongodb
  cluster_name      VARCHAR(200),
  instance_name     VARCHAR(200) NOT NULL,
  version           VARCHAR(50),
  host              VARCHAR(200) NOT NULL,
  port              INT NOT NULL,
  credential_ref    VARCHAR(500),                    -- 引用 secret store
  config            JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'active', -- active, degraded, maintenance, retired
  health_status     VARCHAR(30) DEFAULT 'unknown',   -- healthy, warning, critical, unknown
  environment       VARCHAR(50) NOT NULL DEFAULT 'production',
  tags              JSONB NOT NULL DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_middleware_instances_tenant ON middleware_instances(tenant_id);
CREATE INDEX idx_middleware_instances_type ON middleware_instances(middleware_type);
CREATE INDEX idx_middleware_instances_status ON middleware_instances(status);
CREATE INDEX idx_middleware_instances_health ON middleware_instances(health_status);

-- 中间件健康检查记录表
CREATE TABLE IF NOT EXISTS middleware_health_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id       UUID REFERENCES middleware_instances(id) ON DELETE CASCADE,
  check_type        VARCHAR(50) NOT NULL,            -- connectivity, replication, cluster, performance
  status            VARCHAR(30) NOT NULL,            -- healthy, warning, critical
  metrics           JSONB NOT NULL DEFAULT '{}',     -- {latency, throughput, connections, queue_depth, etc.}
  details           TEXT,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_middleware_health_tenant ON middleware_health_checks(tenant_id);
CREATE INDEX idx_middleware_health_instance ON middleware_health_checks(instance_id);
CREATE INDEX idx_middleware_health_status ON middleware_health_checks(status);
CREATE INDEX idx_middleware_health_time ON middleware_health_checks(checked_at DESC);

-- 中间件性能指标表
CREATE TABLE IF NOT EXISTS middleware_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id       UUID REFERENCES middleware_instances(id) ON DELETE CASCADE,
  metric_name       VARCHAR(100) NOT NULL,           -- cpu_usage, memory_usage, qps, latency, connections, disk_usage
  metric_value      DECIMAL(10,2) NOT NULL,
  metric_unit       VARCHAR(20),                     -- percent, ms, count, bytes
  collected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_middleware_metrics_tenant ON middleware_metrics(tenant_id);
CREATE INDEX idx_middleware_metrics_instance ON middleware_metrics(instance_id);
CREATE INDEX idx_middleware_metrics_name ON middleware_metrics(metric_name);
CREATE INDEX idx_middleware_metrics_time ON middleware_metrics(collected_at DESC);

-- 中间件运维操作表
CREATE TABLE IF NOT EXISTS middleware_operations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id       UUID REFERENCES middleware_instances(id) ON DELETE SET NULL,
  operation_type    VARCHAR(50) NOT NULL,            -- restart, scale, backup, restore, upgrade, config_change, failover
  status            VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, executing, completed, failed, rollback
  operator          VARCHAR(100) NOT NULL,
  params            JSONB NOT NULL DEFAULT '{}',
  result            JSONB,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);
CREATE INDEX idx_middleware_operations_tenant ON middleware_operations(tenant_id);
CREATE INDEX idx_middleware_operations_instance ON middleware_operations(instance_id);
CREATE INDEX idx_middleware_operations_type ON middleware_operations(operation_type);
CREATE INDEX idx_middleware_operations_status ON middleware_operations(status);
```

**预估迁移编号**：`185_create_middleware_tables.sql`

---

## 三、15 个能力增强模块 — 现有表结构分析

### 3.1 不需要新建表的模块（5 个）

| 模块 | 现有表 | 满足度 | 说明 |
|------|--------|--------|------|
| **FinOps** | `cost_records`(031/094), `budgets`(031), `alert_rules`(031), `cost_anomalies`(094), `cost_budget_guards`(094), `cost_optimization`(031) | **95%** | 表结构完整，仅需前端联调 + 增强分析查询 |
| **多云管理** | `cloud_providers`(102), `cloud_accounts`(102), `cloud_resources`(102) | **90%** | 核心表完整，可能需加 `cloud_cost_history` 表 |
| **开发者门户** | `portal_documents`(088) | **70%** | 文档表已有，缺 `portal_categories`, `portal_feedback` 表 |
| **问题管理** | `self_healing_incidents`(050), `tickets`(011), `ticket_workflow`(038) | **90%** | 工单+自愈表完整，问题类型可作为 ticket 的 subtype |
| **发布编排** | `pipelines`(004), `pipeline_runs`(005), `deployments`(007), `deployment_strategies`(139), `deployment_step_trackers`(140) | **95%** | 部署流水线表完整，编排逻辑在应用层 |

### 3.2 需要小幅扩展表的模块（6 个）

| 模块 | 现有表 | 缺失项 | 建议操作 |
|------|--------|--------|---------|
| **MLOps 平台** | `llm_traces`(080), `model_versions`(082), `cost_records`(031) | 缺模型训练记录、特征存储、模型注册表 | 新增 `ml_models`, `ml_training_jobs`, `ml_feature_stores` 3 张表 |
| **配额与计费** | `tenant_quotas`(020), `budgets`(031) | 缺计费账单、用量计量 | 新增 `billing_records`, `usage_metering` 2 张表 |
| **元数据管理** | `data_pipelines`(100), `data_lineage`(100) | 缺元数据采集、数据目录 | 新增 `metadata_catalog`, `metadata_crawls` 2 张表 |
| **AI 安全监控** | `llm_traces`(080), `security_scans`(079) | 缺 AI 特有安全规则、prompt 注入检测 | 新增 `ai_security_rules`, `ai_security_events` 2 张表 |
| **数据质量平台** | `data_pipelines`(100), `quality_gates`(086/138) | 缺质量规则、质量报告 | 新增 `data_quality_rules`, `data_quality_reports` 2 张表 |
| **数据血缘** | `data_lineage`(100) | 仅有管道级血缘，缺字段级 | 扩展现有 `data_lineage` 表加 `source_field`, `target_field`, `lineage_graph` 字段 |

### 3.3 需要中等扩展的模块（3 个）

| 模块 | 现有表 | 缺失项 | 建议操作 |
|------|--------|--------|---------|
| **APM/链路追踪** | `llm_traces`(080) 仅 LLM | 缺 HTTP/gRPC/DB 调用链 | 新增 `apm_traces`, `apm_spans`, `apm_services` 3 张表 |
| **变更影响分析** | `change_intelligence_reports`(028) | 缺代码变更→运行态影响关联 | 扩展 `change_intelligence_reports` 加 `runtime_impact`, `slo_impact` 字段 |
| **数据库 DevOps** | 无专用表 | 缺慢 SQL、索引分析、Schema 变更 | 新增 `dba_slow_queries`, `dba_index_analysis`, `dba_schema_changes` 3 张表 |

### 3.4 待确认模块（1 个）

| 模块 | 已知条件 | 不确定性 | 建议 |
|------|---------|---------|------|
| **Serverless** | Knative 已部署 | 缺 Serverless 抽象层 | 待架构确认后决定是否需要 `serverless_functions`, `serverless_invocations` 表 |

---

## 四、数据结构设计汇总

### 4.1 新建表统计

| 模块 | 新建表数 | 迁移文件 | 预估工作量 |
|------|---------|---------|-----------|
| 智能巡检 | 4 张 | `183_create_inspection_tables.sql` | 0.5 天 |
| 容量规划 | 3 张 | `184_create_capacity_tables.sql` | 0.5 天 |
| 中间件运维 | 4 张 | `185_create_middleware_tables.sql` | 0.5 天 |
| MLOps 平台 | 3 张 | `186_create_mlops_tables.sql` | 0.5 天 |
| 配额与计费 | 2 张 | `187_create_billing_tables.sql` | 0.5 天 |
| 元数据管理 | 2 张 | `188_create_metadata_tables.sql` | 0.5 天 |
| AI 安全监控 | 2 张 | `189_create_ai_security_tables.sql` | 0.5 天 |
| 数据质量平台 | 2 张 | `190_create_data_quality_tables.sql` | 0.5 天 |
| APM 链路追踪 | 3 张 | `191_create_apm_tables.sql` | 0.5 天 |
| 数据库 DevOps | 3 张 | `192_create_dba_tables.sql` | 0.5 天 |
| 开发者门户扩展 | 2 张 | `193_create_portal_ext_tables.sql` | 0.25 天 |
| **合计** | **30 张** | **11 个迁移文件** | **~5.5 天** |

### 4.2 扩展表现状

| 模块 | 扩展表 | 扩展内容 | 迁移文件 |
|------|--------|---------|---------|
| 数据血缘 | `data_lineage` (已有) | 加字段级血缘列 | `194_extend_data_lineage.sql` |
| 变更影响 | `change_intelligence_reports` (已有) | 加运行态影响列 | `195_extend_change_intelligence.sql` |

### 4.3 无需新建表的模块

| 模块 | 依赖现有表 | 工作内容 |
|------|-----------|---------|
| FinOps | `cost_records`, `budgets`, `alert_rules`, `cost_anomalies` | 前端联调 + 分析查询 |
| 多云管理 | `cloud_providers`, `cloud_accounts`, `cloud_resources` | 前端联调 |
| 问题管理 | `tickets`, `self_healing_incidents` | 前端联调 + 问题类型枚举 |
| 发布编排 | `pipelines`, `deployments`, `deployment_strategies` | 应用层逻辑 |
| Serverless | 待定 | 架构确认后决定 |

---

## 五、数据模型设计规范检查清单

### 5.1 必须遵循的规范

| 检查项 | 要求 | 验证方法 |
|--------|------|---------|
| 租户隔离 | 全部业务表有 `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` | grep `tenant_id` |
| RLS 策略 | 每张表有 `ENABLE ROW LEVEL SECURITY` + `tenant_isolation_{table}` | grep `RLS` |
| 主键策略 | `UUID PRIMARY KEY DEFAULT gen_random_uuid()`（优先）或 `SERIAL PRIMARY KEY` | grep `PRIMARY KEY` |
| 审计字段 | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` | grep `created_at` |
| 更新字段 | `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` | grep `updated_at` |
| 索引命名 | `idx_{table}_{column}` | grep `CREATE INDEX` |
| 外键约束 | `REFERENCES ... ON DELETE CASCADE` 或 `SET NULL` | grep `REFERENCES` |
| JSON 字段 | 使用 `JSONB` 而非 `JSON`，有 `DEFAULT '{}'` 或 `DEFAULT '[]'` | grep `JSONB` |
| 状态枚举 | `VARCHAR(30)` + 注释 `-- value1, value2, value3` | grep `VARCHAR(30)` |
| Rollback | 每个迁移有对应的 rollback SQL 文件 | 检查 `-rollback.sql` |

### 5.2 现有不一致问题（新建表时应避免）

| 问题 | 涉及迁移 | 建议 |
|------|---------|------|
| 部分表用 `SERIAL` 而非 `UUID` | 080, 031 | 新表统一用 `UUID` |
| 部分表缺 RLS 策略 | 012, 018 | 新表必须有 RLS |
| 部分表缺 `updated_at` | 018 | 新表必须有 |
| 部分索引命名不规范 | 多个 | 统一 `idx_{table}_{column}` |
| 部分表无 rollback 文件 | 175+ | 新表必须有 |

---

## 六、迁移执行顺序

```
Phase 1 (P0): 3 个完全缺失模块
  → 183_create_inspection_tables.sql
  → 184_create_capacity_tables.sql
  → 185_create_middleware_tables.sql

Phase 2 (P1): 能力增强需要新建表的模块
  → 186_create_mlops_tables.sql
  → 187_create_billing_tables.sql
  → 188_create_metadata_tables.sql
  → 189_create_ai_security_tables.sql
  → 190_create_data_quality_tables.sql
  → 191_create_apm_tables.sql
  → 192_create_dba_tables.sql
  → 193_create_portal_ext_tables.sql

Phase 3 (P2): 扩展表现状
  → 194_extend_data_lineage.sql
  → 195_extend_change_intelligence.sql
```

---

## 七、结论

| 维度 | 结论 |
|------|------|
| **是否需要重新设计数据结构** | **不需要重新设计**，现有 182 个迁移文件建立的规范完善，只需按规范扩展 |
| **是否需要新建表** | 10 个模块需要新建 **30 张表**（11 个迁移文件） |
| **是否需要扩展现有表** | 2 个模块需要扩展 **2 张表**（加列） |
| **是否需要重构现有表** | **不需要**，现有表结构设计合理，租户隔离/RLS/索引均到位 |
| **预估工作量** | ~5.5 天（11 个迁移文件编写 + 对应 Model/Repository 层） |
| **最大风险点** | APM 链路追踪表数据量大，需考虑分区表或时序数据库 |

---

*文档创建时间: 2026-05-22*
*分析依据: 182 个迁移文件 + 114 个 Repository + 37 个 Model*
