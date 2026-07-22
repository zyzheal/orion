# 数据流水线详细规格 (Phase 3)

> **日期**: 2026-05-05
> **状态**: 实施中
> **能力域**: 9. 数据流水线
> **目标成熟度**: L1 → L1.5
> **关键交付**: 数据模型版本化

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前数据处理能力：
- 数据库迁移管理（`db/migrations/` 68 个迁移文件）
- Pipeline 数据模型（Pipeline、Stage、Task、Run）
- Repository 模式数据访问层

**不足**：
- 数据模型版本化仅依赖 SQL 迁移文件，无自动化管理
- 无数据流水线定义/执行引擎（ETL/ELT）
- 无数据质量检查
- 无数据血缘追踪

### 1.2 Phase 3 目标 (L1.5)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 数据模型版本化 | 迁移文件版本追踪、兼容性检查、回滚 | L1.5 |
| 数据流水线 | 定义/执行/监控 ETL 数据流水线 | L1.5 |
| 数据质量检查 | 数据完整性、一致性、准确性验证 | L1.5 |

## 二、验收标准

| # | 标准 | 验证方式 |
|---|------|----------|
| DL1 | 数据模型版本化：每个迁移文件含版本号、兼容性标记 | API 测试 |
| DL2 | 迁移前兼容性检查（破坏性变更需确认） | 单元测试 |
| DL3 | 支持迁移回滚（down migration） | 集成测试 |
| DL4 | 数据流水线支持：source → transform → sink | API 测试 |
| DL5 | 数据质量规则：NOT NULL、UNIQUE、范围、格式 | 单元测试 |
| DL6 | 流水线执行历史记录、成功/失败状态 | 前端验证 |

## 三、API 设计

```
Base: /api/v1/data-pipeline
```

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/migrations` | 获取迁移列表 | - | `{ data: DataMigration[], applied, pending }` |
| POST | `/migrations/apply` | 应用待执行迁移 | - | `{ applied: string[], durationMs }` |
| POST | `/migrations/:version/rollback` | 回滚迁移 | `{ force?: boolean }` | `{ success }` |
| GET | `/pipelines` | 获取数据流水线列表 | - | `{ data: DataPipeline[] }` |
| POST | `/pipelines` | 创建数据流水线 | `CreateDataPipeline` | `{ id, name }` |
| POST | `/pipelines/:id/run` | 执行数据流水线 | `{ params? }` | `{ runId, status }` |
| GET | `/pipelines/:id/runs/:runId` | 获取执行结果 | - | `DataPipelineRun` |
| GET | `/quality-rules` | 获取数据质量规则 | query: table | `{ data: QualityRule[] }` |
| POST | `/quality-check` | 执行数据质量检查 | `{ table, rules }` | `{ results, passed }` |

```typescript
interface DataMigration {
  version: string;          // '001', '002', ...
  name: string;
  description: string;
  compatibility: 'backward' | 'forward' | 'breaking';
  upSql: string;
  downSql: string;
  appliedAt?: Date;
  appliedBy?: string;
  checksum: string;
}

interface DataPipeline {
  id: string;
  name: string;
  description: string;
  source: DataSource;
  transforms: DataTransform[];
  sink: DataSink;
  schedule?: string;
  enabled: boolean;
  lastRunAt?: Date;
  lastRunStatus?: string;
}

interface DataSource {
  type: 'postgresql' | 'kafka' | 'api' | 'file';
  config: Record<string, unknown>;
  query?: string;
}

interface DataTransform {
  type: 'filter' | 'map' | 'aggregate' | 'join' | 'custom';
  name: string;
  config: Record<string, unknown>;
}

interface DataSink {
  type: 'postgresql' | 's3' | 'elasticsearch' | 'webhook';
  config: Record<string, unknown>;
  table?: string;
}

interface DataPipelineRun {
  id: string;
  pipelineId: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  qualityCheckResults?: QualityCheckResult[];
}

interface QualityRule {
  id: string;
  table: string;
  column?: string;
  ruleType: 'not_null' | 'unique' | 'range' | 'format' | 'referential' | 'custom';
  config: Record<string, unknown>;
  enabled: boolean;
}

interface QualityCheckResult {
  ruleId: string;
  ruleType: string;
  passed: boolean;
  failedRecords: number;
  totalRecords: number;
  details?: string;
}
```

## 四、数据库变更

```sql
-- Migration 109: Data Pipeline
CREATE TABLE IF NOT EXISTS data_pipeline_definitions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  source                JSONB NOT NULL,
  transforms            JSONB DEFAULT '[]',
  sink                  JSONB NOT NULL,
  schedule              VARCHAR(50),
  enabled               BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_data_pipeline_definitions_tenant ON data_pipeline_definitions(tenant_id);

CREATE TABLE IF NOT EXISTS data_pipeline_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id           UUID NOT NULL REFERENCES data_pipeline_definitions(id) ON DELETE CASCADE,
  status                VARCHAR(20) DEFAULT 'running',
  records_processed     INT DEFAULT 0,
  records_failed        INT DEFAULT 0,
  quality_results       JSONB DEFAULT '[]',
  error                 TEXT,
  started_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ
);
CREATE INDEX idx_data_pipeline_runs_pipeline ON data_pipeline_runs(pipeline_id, started_at DESC);

CREATE TABLE IF NOT EXISTS data_quality_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  table_name            VARCHAR(100) NOT NULL,
  column_name           VARCHAR(100),
  rule_type             VARCHAR(50) NOT NULL,
  config                JSONB NOT NULL,
  enabled               BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_data_quality_rules_table ON data_quality_rules(table_name);
```

## 五、前端设计

**路由**: `/data-pipelines`

```
┌─────────────────────────────────────────────┐
│  数据流水线                      [创建流水线] │
├─────────────────────────────────────────────┤
│  迁移状态: 109/109 已应用 ✅                │
├─────────────────────────────────────────────┤
│  流水线列表                                  │
│  ┌────────────────────────────────────────┐  │
│  │ 用户行为分析  daily  ✅ 最后: 2h前      │  │
│  │   PostgreSQL → Transform → S3          │  │
│  ├────────────────────────────────────────┤  │
│  │ 日志聚合  hourly  ⚠️ 最后: 6h前 (慢)   │  │
│  │   Kafka → Aggregate → Elasticsearch    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/pages/DataPipelines/index.tsx` | 新建 | 数据流水线主页面 |
| `src/pages/MigrationManagement/index.tsx` | 新建 | 迁移管理页面 |
| `src/components/DataPipelineEditor/index.tsx` | 新建 | 流水线编辑器 |
| `src/api/data-pipeline.ts` | 新建 | 数据流水线 API |

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 15 | MigrationManager、PipelineExecutor、QualityChecker |
| 集成测试 | 4 | 迁移应用→回滚、流水线执行完整流程 |

## 七、非功能性要求

| 指标 | 目标 |
|------|------|
| 迁移执行 | 事务性，失败自动回滚 |
| 流水线吞吐量 | > 10k records/min |
| 质量检查 | < 30s（100 万行） |

## 八、实施计划

| 模块 | 后端 (天) | 前端 (天) | 测试 (天) |
|------|:---------:|:---------:|:---------:|
| 迁移管理 | 3 | 1 | 1 |
| 流水线引擎 | 3 | 1 | 2 |
| 数据质量 | 2 | 1 | 1 |
| **合计** | **8** | **3** | **4** |

---

_文档版本: v1.0 | 创建日期: 2026-05-05_
