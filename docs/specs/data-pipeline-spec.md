# Spec: 数据流水线 (Data Pipeline)

> **日期**: 2026-07-03
> **状态**: 已验证
> **能力域**: 数据平台
> **目标成熟度**: L1 → L2
> **关键交付**: 流水线定义、执行引擎、数据质量、迁移管理、血缘追踪

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前数据处理能力：
- 数据库迁移管理（`db/migrations/` 目录）
- Pipeline 数据模型（Pipeline、Stage、Task、Run）
- Repository 模式数据访问层
- 基础查询执行能力

**不足**：
- 数据模型版本化仅依赖 SQL 迁移文件，无自动化管理
- 无数据流水线定义/执行引擎（ETL/ELT）
- 无数据质量检查框架
- 无数据血缘追踪
- 无调度编排能力

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 数据流水线定义 | 可视化定义 source → transform → sink 流水线 | L2 |
| 执行引擎 | 支持定时/事件触发执行、重试、告警 | L2 |
| 数据质量 | 数据完整性/一致性/准确性规则引擎 | L2 |
| 迁移管理 | 自动化版本管理、兼容性检查、回滚 | L2 |
| 血缘追踪 | 字段级数据流向追踪 | L2 |

## 二、验收标准

### 2.1 数据流水线定义

| # | 标准 | 验证方式 |
|---|------|----------|
| DP1 | 支持创建数据流水线定义（source → transform[] → sink） | API 测试 |
| DP2 | Source 支持 PostgreSQL、Kafka、API、文件四种类型 | API 测试 |
| DP3 | Transform 支持 filter/map/aggregate/join/custom 五种类型 | API 测试 |
| DP4 | Sink 支持 PostgreSQL、S3、Elasticsearch、Webhook 四种类型 | API 测试 |
| DP5 | 流水线定义支持 JSON/YAML 导入导出 | API 测试 |

### 2.2 执行引擎

| # | 标准 | 验证方式 |
|---|------|----------|
| DP6 | 支持手动触发流水线执行 | API 测试 |
| DP7 | 支持定时执行（cron 表达式调度） | 集成测试 |
| DP8 | 支持事件触发执行（数据变更 Webhook） | 集成测试 |
| DP9 | 执行失败自动重试（最多 3 次，指数退避） | 集成测试 |
| DP10 | 执行记录持久化，含开始/结束时间、状态、行数统计 | API 测试 |
| DP11 | 执行中可查看实时进度（已处理行数/总行数） | 前端验证 |
| DP12 | 并发执行控制：同一时间只允许一个活跃执行 | 单元测试 |

### 2.3 数据质量

| # | 标准 | 验证方式 |
|---|------|----------|
| DP13 | 支持 NOT NULL、UNIQUE、范围、格式四种内置规则 | 单元测试 |
| DP14 | 支持自定义 SQL 规则（返回不满足条件的行数） | API 测试 |
| DP15 | 数据质量检查可作为流水线中的一个 Transform 步骤 | 集成测试 |
| DP16 | 质量检查结果报告含通过率、失败记录明细 | 前端验证 |
| DP17 | 质量告警：失败率超过阈值时自动通知 | 集成测试 |

### 2.4 迁移管理

| # | 标准 | 验证方式 |
|---|------|----------|
| DP18 | 每个迁移文件含版本号、兼容性标记（backward/forward/breaking） | 单元测试 |
| DP19 | 迁移前执行兼容性检查，breaking 变更需人工确认 | API 测试 |
| DP20 | 支持迁移回滚（down migration），事务性执行 | 集成测试 |
| DP21 | 迁移历史记录可视化，含执行时间、操作人 | 前端验证 |

### 2.5 血缘追踪

| # | 标准 | 验证方式 |
|---|------|----------|
| DP22 | 记录每个字段的数据来源（表名、列名、转换函数） | 单元测试 |
| DP23 | 血缘图可视化：字段级数据流向展示 | 前端验证 |
| DP24 | 影响分析：修改某字段时显示所有下游依赖 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/data-pipelines
```

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | 流水线列表 |
| POST | `/` | 创建流水线定义 |
| PUT | `/:id` | 更新流水线定义 |
| DELETE | `/:id` | 删除流水线定义 |
| POST | `/:id/run` | 手动执行流水线 |
| GET | `/:id/runs` | 执行历史 |
| GET | `/runs/:runId` | 执行详情 |
| POST | `/runs/:runId/cancel` | 取消执行 |
| GET | `/quality-rules` | 质量规则列表 |
| POST | `/quality-checks` | 执行质量检查 |
| GET | `/migrations` | 迁移列表 |
| POST | `/migrations/apply` | 应用迁移 |
| POST | `/migrations/:version/rollback` | 回滚迁移 |
| GET | `/lineage/:table/:column` | 字段血缘 |

## 四、数据模型

```sql
-- 数据流水线定义
CREATE TABLE IF NOT EXISTS data_pipeline_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  source          JSONB NOT NULL,
  transforms      JSONB DEFAULT '[]',
  sink            JSONB NOT NULL,
  schedule        VARCHAR(50),
  event_trigger   JSONB,
  enabled         BOOLEAN DEFAULT true,
  retry_config    JSONB DEFAULT '{"maxRetries": 3, "backoffMs": 1000}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 流水线执行记录
CREATE TABLE IF NOT EXISTS data_pipeline_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       UUID REFERENCES data_pipeline_definitions(id),
  status            VARCHAR(20) DEFAULT 'pending',
  trigger_type      VARCHAR(20),
  records_processed INT DEFAULT 0,
  records_failed    INT DEFAULT 0,
  error             TEXT,
  started_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

-- 数据质量规则
CREATE TABLE IF NOT EXISTS data_quality_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  name        VARCHAR(200) NOT NULL,
  table_name  VARCHAR(100) NOT NULL,
  column_name VARCHAR(100),
  rule_type   VARCHAR(50) NOT NULL,
  config      JSONB NOT NULL,
  severity    VARCHAR(20) DEFAULT 'error',
  enabled     BOOLEAN DEFAULT true
);

-- 血缘追踪记录
CREATE TABLE IF NOT EXISTS data_lineage_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table      VARCHAR(100) NOT NULL,
  source_column     VARCHAR(100) NOT NULL,
  target_table      VARCHAR(100) NOT NULL,
  target_column     VARCHAR(100) NOT NULL,
  transform_expr    TEXT,
  pipeline_id       UUID REFERENCES data_pipeline_definitions(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

## 五、前端设计

**路由**: `/data-pipelines`

主要页面：
- 流水线列表页：展示所有数据流水线，含最近执行状态
- 流水线编辑器：可视化 Source → Transform → Sink 编排
- 执行历史页：执行记录列表、详情、日志
- 数据质量页：规则管理、检查结果
- 迁移管理页：迁移文件列表、应用/回滚
- 血缘追踪页：字段级数据流向拓扑图

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | PipelineDefinitionService、Executor、QualityChecker、LineageTracker |
| 集成测试 | 6 | 流水线完整执行、质量检查、迁移回滚、血缘追踪 |
| 前端测试 | 4 | 流水线编辑器、执行监控、血缘可视化 |

---

_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 已验证_
