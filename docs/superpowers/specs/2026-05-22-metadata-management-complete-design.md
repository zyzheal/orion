# 元数据管理（Metadata Management）完整功能设计

> **日期**: 2026-05-22
> **状态**: 设计完成
> **模块优先级**: P1
> **基于模块**: CMDB（`services/cmdb/`）+ 数据血缘（`services/data-lineage/`）
> **目标成熟度**: 7/10 → 8.5/10
> **输出路径**: `docs/superpowers/specs/2026-05-22-metadata-management-complete-design.md`

---

## 一、业务概述与闭环设计

### 1.1 业务背景

Orion CMDB 已有完整的 CI（配置项）管理、拓扑关系、K8s 调和能力，但缺少**元数据增强**能力。数据管道已有（`data-pipeline-routes.ts` + `DataPipelineController`），可复用其血缘追踪基础设施。

### 1.2 业务闭环

元数据管理的完整业务闭环为 **5 个阶段**，形成数据从接入到发现再到治理的完整生命周期：

```
数据源注册 → 元数据采集 → 目录构建 → 搜索发现 → 血缘关联
     ↑                                              │
     └──────────── 治理反馈 ←────────────────────────┘
```

**每个阶段的详细说明**：

| 阶段 | 输入 | 输出 | 核心动作 |
|------|------|------|----------|
| **数据源注册** | 用户填写连接信息 | 数据源记录（加密存储） | 类型选择、连接配置填写、连接测试、状态标记 |
| **元数据采集** | 数据源 + 采集任务配置 | schema_info（表/字段/索引/约束） | 定时/手动触发、DDL 提取、样本数据采样 |
| **目录构建** | 采集结果 | 数据目录条目 | 自动分类、质量评分计算、标签提取、Owner 分配 |
| **搜索发现** | 用户查询 | 匹配的数据资产 | 全文搜索、过滤（域/类型/来源/标签）、质量排序 |
| **血缘关联** | 数据管道执行结果 + 采集结果 | 字段级血缘图 | 上游解析、下游解析、转换类型标记 |

**治理反馈环**：用户在搜索发现阶段发现数据质量问题后，可触发数据质量检查（关联 `data_quality` 模块），问题反馈回采集任务，驱动重新采集或数据源修复。

### 1.3 元数据类型体系

元数据分为三个层级，覆盖数据资产的全维度描述：

#### 1.3.1 技术元数据（Technical Metadata）

机器自动采集，描述数据资产的物理和技术属性：

| 属性 | 示例 | 采集方式 |
|------|------|----------|
| 数据库名、表名、字段名 | `orders`, `user_id`, `VARCHAR(36)` | DDL 解析 |
| 数据类型、精度、长度 | `DECIMAL(10,2)`, `INT` | DDL 解析 |
| 索引、约束、主外键关系 | `PK_orders`, `FK_user_id` | DDL 解析 |
| 存储引擎、分区策略 | `InnoDB`, `RANGE(date)` | 系统表查询 |
| 数据量、行数、大小 | `1,200,000 rows`, `450MB` | `COUNT(*)` / `pg_total_relation_size()` |
| 最后变更时间 | `2026-05-20 14:30:00` | 系统表查询 |

#### 1.3.2 业务元数据（Business Metadata）

人工维护或半自动生成，描述数据资产的业务含义：

| 属性 | 示例 | 维护方式 |
|------|------|----------|
| 业务描述 | "订单主表，记录用户下单的核心信息" | 人工填写 |
| 业务域分类 | `订单`, `用户`, `支付`, `物流` | 人工分类或自动映射 |
| 业务术语映射 | `user_id` → "客户编号" | 术语表关联 |
| 数据 Owner | `zhangsan@example.com` | 人工指定 |
| 敏感等级 | `L1-公开`, `L2-内部`, `L3-机密`, `L4-绝密` | 人工标注 |
| 合规标签 | `PII`, `GDPR`, `等保三级` | 人工标注 |
| 数据质量评分 | `0.87` | 基于完整性自动计算 |

#### 1.3.3 操作元数据（Operational Metadata）

系统运行时自动记录，描述数据资产的使用和运维状态：

| 属性 | 示例 | 采集方式 |
|------|------|----------|
| 最近访问时间 | `2026-05-22 09:15:00` | 审计日志分析 |
| 最近修改时间 | `2026-05-21 16:45:00` | 审计日志分析 |
| 访问频率 | `120 次/日` | 查询日志统计 |
| 关联 Pipeline | `pipeline:etl-order-sync` | 数据管道集成 |
| 采集任务状态 | `completed`, `lastRunAt: 2026-05-22` | 采集任务记录 |
| SLA 等级 | `黄金`, `白银`, `青铜` | 人工配置 |
| 变更历史 | `2026-05-20: 新增字段 email_verified` | 采集差异对比 |

### 1.4 采集器设计

#### 1.4.1 采集器架构

```
MetadataCrawler（抽象基类）
├── DatabaseCrawler        — 关系型数据库
├── DataWarehouseCrawler   — 数据仓库
├── FileCrawler            — 文件/对象存储
├── ApiCrawler             — REST/GraphQL API
└── KafkaCrawler           — 消息队列/Topic
```

#### 1.4.2 数据库元数据采集器（DatabaseCrawler）

**支持的数据源类型**：`mysql`, `postgresql`, `mongodb`, `redis`

**采集流程**：

```typescript
// 伪代码，描述采集流程
async crawl(dataSource: DataSource): Promise<CrawlResult> {
  const conn = await connect(dataSource);
  const databases = await conn.listDatabases();  // 1. 获取数据库列表
  const results: CrawlResult = { tables: [], fields: 0 };
  for (const db of databases) {
    const tables = await conn.listTables(db.name);  // 2. 获取表列表
    for (const table of tables) {
      const schema = await conn.describeTable(db.name, table.name);  // 3. DDL 解析
      const stats = await conn.getTableStats(db.name, table.name);   // 4. 统计信息
      const samples = config.extractSampleData
        ? await conn.sampleRows(db.name, table.name, 5)              // 5. 样本采样
        : [];
      results.tables.push({ name: table.name, schema, stats, samples });
      results.fields += schema.columns.length;
    }
  }
  return results;
}
```

**MySQL 采集 SQL 示例**：

```sql
-- 获取表列表
SELECT TABLE_NAME, TABLE_COMMENT, ENGINE, TABLE_ROWS, DATA_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'mydb' AND TABLE_TYPE = 'BASE TABLE';

-- 获取字段信息
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT, IS_NULLABLE, COLUMN_KEY,
       CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'mydb' AND TABLE_NAME = 'orders';

-- 获取索引信息
SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'mydb' AND TABLE_NAME = 'orders';
```

**PostgreSQL 采集 SQL 示例**：

```sql
-- 获取表列表
SELECT c.relname AS table_name, obj_description(c.oid) AS description,
       pg_total_relation_size(c.oid) AS total_size,
       (SELECT COUNT(*) FROM pg_stat_user_tables WHERE relname = c.relname) AS row_estimate
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

-- 获取字段信息
SELECT a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       col_description(a.attrelid, a.attnum) AS comment,
       a.attnotnull AS is_required,
       (SELECT i.indisprimary FROM pg_index i WHERE i.indrelid = a.attrelid AND i.indkey[0] = a.attnum) AS is_primary
FROM pg_attribute a
WHERE a.attrelid = 'orders'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
```

#### 1.4.3 数据仓库元数据采集器（DataWarehouseCrawler）

**支持的数据源类型**：`clickhouse`, `starrocks`, `doris`, `hive`, `presto`

**额外采集项**：

| 采集项 | 说明 | 来源 |
|--------|------|------|
| 物化视图定义 | 预计算聚合规则 | `SHOW MATERIALIZED VIEW` |
| 分区信息 | 分区键、分区范围 | 系统表 |
| 分桶/分布策略 | 数据分布规则 | `SHOW CREATE TABLE` |
| 统计信息 | 列级统计（NDV、NULL 率） | 优化器统计 |

#### 1.4.4 文件元数据采集器（FileCrawler）

**支持的数据源类型**：`file`（本地文件系统、NAS）+ `s3`（对象存储）

**采集内容**：

| 采集项 | 说明 |
|--------|------|
| 文件名、路径、大小、修改时间 | 基础文件属性 |
| 文件格式推断 | `.csv`, `.parquet`, `.json`, `.avro` |
| Schema 推断 | 对结构化文件（CSV/Parquet）解析列名和类型 |
| 行数统计 | 对结构化文件统计记录数 |
| 编码检测 | UTF-8, GBK, Latin1 等 |

#### 1.4.5 API 元数据采集器（ApiCrawler）

**支持的数据源类型**：`api`（REST、GraphQL）

**采集内容**：

| 采集项 | 说明 | 采集方式 |
|--------|------|----------|
| API 路径 | `GET /api/v1/orders` | OpenAPI/Swagger 解析 |
| 请求/响应 Schema | JSON Schema | OpenAPI 解析或采样 |
| 认证方式 | `Bearer`, `API Key` | 配置提取 |
| 限流策略 | `100 req/min` | 配置提取 |
| 响应样例 | 5 条示例数据 | 实际调用采样 |

#### 1.4.6 采集器通用配置

```typescript
interface CrawlerConfig {
  // 过滤规则
  includePatterns?: string[];    // 如 ['orders*', 'user*']
  excludePatterns?: string[];    // 如 ['*_bak', '_temp_*']
  // 提取选项
  extractDDL?: boolean;          // 是否提取 DDL 结构
  extractSampleData?: boolean;   // 是否采样样本数据
  extractLineage?: boolean;      // 是否分析血缘关系
  extractStats?: boolean;        // 是否提取统计信息
  // 采样配置
  sampleSize?: number;           // 采样行数，默认 5
  timeoutMs?: number;            // 超时时间，默认 60000
  // 增量采集
  incremental?: boolean;         // 增量模式，只采集变更
  lastCrawledAt?: Date;          // 上次采集时间
}
```

### 1.5 数据目录

#### 1.5.1 搜索与发现

数据目录提供**统一的数据资产视图**，搜索能力包括：

| 搜索维度 | 实现方式 | 示例 |
|----------|----------|------|
| 全文搜索 | PostgreSQL `tsvector` / `LIKE` | 搜索 "订单"，匹配表名、描述、字段注释 |
| 按域过滤 | `domain` 字段等值查询 | `domain = '订单'` |
| 按类型过滤 | `type` 字段等值查询 | `type IN ('table', 'view')` |
| 按来源过滤 | `data_source_id` 关联查询 | `data_source_id = 'xxx'` |
| 按标签过滤 | `tags @> ARRAY['PII']` | 按标签筛选 |
| 按质量评分排序 | `ORDER BY quality_score DESC` | 高质量数据优先 |
| 按 Owner 过滤 | 关联 Owner 表 | `owner_id = 'current_user'` |

#### 1.5.2 标签分类体系

标签分为**系统标签**和**用户标签**两类：

| 标签类型 | 生成方式 | 示例 |
|----------|----------|------|
| 系统标签 | 采集器自动生成 | `mysql`, `orders`, `has_pk`, `PII_candidate` |
| 用户标签 | 用户手动添加 | `核心资产`, `已审核`, `需清理` |
| 业务标签 | 术语表自动映射 | `客户编号`, `订单金额` |
| 合规标签 | 安全合规模块关联 | `GDPR`, `等保三级`, `PII` |

#### 1.5.3 数据字典

数据字典以**表→字段**两级结构组织：

```
数据库
└── 表/视图/Topic
    ├── 基本信息：名称、类型、描述、Owner、行数、大小
    ├── 字段列表：名称、类型、注释、主键/外键、是否必填、关联术语、敏感等级
    ├── 索引列表：名称、类型、字段组合
    ├── 约束列表：主键、外键、唯一、检查
    └── 样本数据：最近采集的 5 条示例
```

#### 1.5.4 数据 Owner 管理

每个数据资产可以指定 Owner 和 Steward：

| 角色 | 职责 | 权限 |
|------|------|------|
| Owner | 数据资产的最终责任人 | 编辑描述、指定 Steward、管理标签、审批访问 |
| Steward | 日常数据维护者 | 编辑描述、管理标签、维护术语映射 |
| Consumer | 数据消费者 | 只读、评论、申请访问 |

Owner/Steward 变更需要记录审计日志。

### 1.6 外部依赖

| 依赖模块 | 依赖内容 | 依赖方式 | 状态 |
|----------|----------|----------|------|
| CMDB `CmdbService` | CI 拓扑关系复用（数据源作为 CI） | Service 注入 | 已有 |
| CMDB `TopologyService` | 数据源→表→字段 拓扑图 | Service 注入 | 已有 |
| 数据血缘 `DataLineageService` | 字段血缘计算与存储 | Service 注入 | 已有 |
| 数据管道 `DataPipelineController` | 血缘来源（Pipeline 执行结果） | API 调用 / 事件订阅 | 已有 |
| 调度引擎 `SchedulerService` | 采集任务定时调度 | Service 注入 | 已有 (`services/scheduler/`) |
| K8s API Client `K8sWatchClient` | K8s 数据源元数据采集 | Service 注入 | 已有 |
| 权限系统 `requirePermission` | 接口级权限控制 | 中间件 | 已有 |
| 加密模块 | 连接配置加密存储 | `crypto` / 外部 KMS | 已有 |
| 租户中间件 | 多租户隔离 | 中间件 | 已有 |

### 1.7 权限模型

#### 1.7.1 RBAC 权限矩阵

| 角色 | 查看目录 | 管理数据源 | 管理采集任务 | 管理术语 | 管理 Owner | 删除资产 |
|------|:--------:|:----------:|:------------:|:--------:|:----------:|:--------:|
| Viewer | ✅ | - | - | - | - | - |
| Member | ✅ | ✅ (创建) | ✅ | ✅ (创建/编辑) | - | - |
| Data Owner | ✅ | ✅ | ✅ | ✅ | ✅ (自有资产) | - |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

#### 1.7.2 权限资源定义

```typescript
type MetadataPermission =
  | 'metadata:read'           // 查看目录、搜索、查看血缘
  | 'metadata:write'          // 创建/编辑数据源、采集任务、术语
  | 'metadata:admin'          // 删除、管理 Owner、系统配置
  | 'metadata:owner'          // 管理自有资产的描述/标签
```

权限中间件使用方式：

```typescript
app.post('/', {
  onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })]
}, handler);
```

---

## 二、数据模型设计

### 2.1 迁移脚本（188_create_metadata_tables.sql）

> 遵循 11.6 节设计规范：UUID 主键、租户隔离、RLS、TIMESTAMPTZ、软删除、触发器。

```sql
-- ============================================================
-- Migration 188: Metadata Management Tables
-- ============================================================

-- 数据源表
CREATE TABLE metadata_data_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(100) NOT NULL,
  type            VARCHAR(30) NOT NULL,  -- mysql, postgresql, mongodb, redis, kafka, elasticsearch, api, k8s, file, clickhouse, starrocks
  connection_config JSONB NOT NULL,      -- 加密存储: {host, port, username, password_encrypted, database, ssl, ...}
  status          VARCHAR(20) NOT NULL DEFAULT 'inactive',  -- inactive, active, error, testing
  description     TEXT,
  last_test_at    TIMESTAMPTZ,
  last_test_result JSONB,                -- {success: boolean, message: string, latencyMs: number}
  metadata        JSONB DEFAULT '{}',    -- {databaseCount, tableCount, lastCrawlAt, version}
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      VARCHAR(100),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(tenant_id, name)
);

-- 数据目录表
CREATE TABLE metadata_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  data_source_id  UUID NOT NULL REFERENCES metadata_data_sources(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,         -- 表名/Topic名/API路径/文件名
  type            VARCHAR(20) NOT NULL,           -- table, view, topic, api, file, materialized_view
  domain          VARCHAR(50),                    -- 业务域: 订单, 用户, 支付, 物流, ...
  description     TEXT,
  schema_info     JSONB DEFAULT '{}',             -- {columns, indexes, constraints, partitions}
  quality_score   DECIMAL(3,2) DEFAULT 0.00,      -- 0.00 ~ 1.00
  sample_count    INT DEFAULT 0,
  row_count       BIGINT,
  data_size_bytes BIGINT,
  tags            JSONB DEFAULT '[]',             -- 系统标签 + 用户标签
  owner_id        VARCHAR(100),                   -- 数据 Owner 用户 ID
  steward_ids     JSONB DEFAULT '[]',             -- 数据 Steward 列表
  sensitivity     VARCHAR(20),                    -- L1-公开, L2-内部, L3-机密, L4-绝密
  sla_level       VARCHAR(20),                    -- 黄金, 白银, 青铜
  metadata_type   VARCHAR(20) DEFAULT 'technical',-- technical, business, operational
  last_crawled_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      VARCHAR(100),
  deleted_at      TIMESTAMPTZ
);

-- 采集任务表
CREATE TABLE metadata_crawl_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  data_source_id  UUID NOT NULL REFERENCES metadata_data_sources(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  schedule        VARCHAR(50),                     -- cron 表达式, NULL = 手动执行
  status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',  -- scheduled, running, completed, failed, paused, cancelled
  last_run_at     TIMESTAMPTZ,
  last_run_result JSONB,                           -- {success, tablesFound, fieldsFound, durationMs, error}
  next_run_at     TIMESTAMPTZ,
  config          JSONB DEFAULT '{}',              -- CrawlerConfig
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      VARCHAR(100),
  deleted_at      TIMESTAMPTZ
);

-- 采集执行记录表
CREATE TABLE metadata_crawl_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  task_id         UUID NOT NULL REFERENCES metadata_crawl_tasks(id) ON DELETE CASCADE,
  data_source_id  UUID NOT NULL,
  status          VARCHAR(20) NOT NULL,            -- running, completed, failed, cancelled
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INT,
  tables_found    INT DEFAULT 0,
  fields_found    INT DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 业务术语表
CREATE TABLE business_terms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  term            VARCHAR(100) NOT NULL,
  definition      TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL,            -- entity, attribute, event, rule
  synonyms        JSONB DEFAULT '[]',
  root_word       VARCHAR(100),
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      VARCHAR(100),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(tenant_id, term)
);

-- 术语-字段映射表
CREATE TABLE term_field_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  term_id         UUID NOT NULL REFERENCES business_terms(id) ON DELETE CASCADE,
  catalog_id      UUID NOT NULL REFERENCES metadata_catalog(id) ON DELETE CASCADE,
  field_name      VARCHAR(100) NOT NULL,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 字段血缘表（复用 DataLineageService，此表为元数据视角的简化存储）
CREATE TABLE field_lineage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  source_catalog_id UUID NOT NULL REFERENCES metadata_catalog(id) ON DELETE CASCADE,
  source_field    VARCHAR(100) NOT NULL,
  target_catalog_id UUID NOT NULL REFERENCES metadata_catalog(id) ON DELETE CASCADE,
  target_field    VARCHAR(100) NOT NULL,
  transform_type  VARCHAR(30),                     -- direct, transform, aggregate, filter, join
  transform_desc  TEXT,                            -- 转换描述
  pipeline_id     VARCHAR(100),                    -- 关联的数据管道 ID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_data_sources_tenant ON metadata_data_sources(tenant_id, deleted_at);
CREATE INDEX idx_data_sources_type ON metadata_data_sources(type);
CREATE INDEX idx_data_sources_status ON metadata_data_sources(status);
CREATE INDEX idx_catalog_tenant ON metadata_catalog(tenant_id, deleted_at);
CREATE INDEX idx_catalog_domain ON metadata_catalog(domain);
CREATE INDEX idx_catalog_type ON metadata_catalog(type);
CREATE INDEX idx_catalog_owner ON metadata_catalog(owner_id);
CREATE INDEX idx_catalog_sensitivity ON metadata_catalog(sensitivity);
CREATE INDEX idx_catalog_source ON metadata_catalog(data_source_id);
CREATE INDEX idx_crawl_tasks_tenant ON metadata_crawl_tasks(tenant_id, deleted_at);
CREATE INDEX idx_crawl_tasks_status ON metadata_crawl_tasks(status);
CREATE INDEX idx_crawl_tasks_next_run ON metadata_crawl_tasks(next_run_at);
CREATE INDEX idx_crawl_execs_task ON metadata_crawl_executions(task_id);
CREATE INDEX idx_crawl_execs_tenant ON metadata_crawl_executions(tenant_id);
CREATE INDEX idx_terms_tenant ON business_terms(tenant_id, deleted_at);
CREATE INDEX idx_terms_category ON business_terms(category);
CREATE INDEX idx_term_mappings_term ON term_field_mappings(term_id);
CREATE INDEX idx_term_mappings_catalog ON term_field_mappings(catalog_id);
CREATE INDEX idx_lineage_tenant ON field_lineage(tenant_id);
CREATE INDEX idx_lineage_source ON field_lineage(source_catalog_id);
CREATE INDEX idx_lineage_target ON field_lineage(target_catalog_id);

-- RLS 策略
ALTER TABLE metadata_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_crawl_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_crawl_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE term_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_metadata_data_sources ON metadata_data_sources
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_isolation_metadata_catalog ON metadata_catalog
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_isolation_metadata_crawl_tasks ON metadata_crawl_tasks
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_isolation_metadata_crawl_executions ON metadata_crawl_executions
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_isolation_business_terms ON business_terms
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_isolation_term_field_mappings ON term_field_mappings
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
CREATE POLICY tenant_isolation_field_lineage ON field_lineage
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- 更新时间触发器
CREATE TRIGGER update_metadata_data_sources_updated_at
  BEFORE UPDATE ON metadata_data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_metadata_catalog_updated_at
  BEFORE UPDATE ON metadata_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_metadata_crawl_tasks_updated_at
  BEFORE UPDATE ON metadata_crawl_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_terms_updated_at
  BEFORE UPDATE ON business_terms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 TypeScript 类型定义

```typescript
// services/metadata/MetadataTypes.ts

// === 数据源 ===

type DataSourceType =
  | 'mysql' | 'postgresql' | 'mongodb' | 'redis'
  | 'kafka' | 'elasticsearch' | 'api' | 'k8s'
  | 'file' | 'clickhouse' | 'starrocks' | 'doris' | 'hive' | 'presto';

type DataSourceStatus = 'inactive' | 'active' | 'error' | 'testing';

interface DataSource {
  id: string;
  tenantId: string;
  name: string;
  type: DataSourceType;
  connectionConfig: Record<string, unknown>;
  status: DataSourceStatus;
  description?: string;
  lastTestAt?: Date;
  lastTestResult?: { success: boolean; message: string; latencyMs: number };
  metadata: { databaseCount?: number; tableCount?: number; lastCrawlAt?: Date; version?: string };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// === 数据目录 ===

type CatalogItemType = 'table' | 'view' | 'topic' | 'api' | 'file' | 'materialized_view';
type MetadataType = 'technical' | 'business' | 'operational';
type SensitivityLevel = 'L1-公开' | 'L2-内部' | 'L3-机密' | 'L4-绝密';
type SlaLevel = '黄金' | '白银' | '青铜';
type BusinessDomain = '订单' | '用户' | '支付' | '物流' | '营销' | '财务' | '人事' | '其他';

interface ColumnInfo {
  name: string;
  type: string;
  comment?: string;
  isPrimaryKey: boolean;
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  mappedTerm?: string;  // 关联的业务术语
  sensitivity?: SensitivityLevel;
}

interface SchemaInfo {
  columns: ColumnInfo[];
  indexes?: { name: string; type: string; columns: string[] }[];
  constraints?: { name: string; type: string; columns: string[] }[];
  partitions?: { key: string; values: string[] }[];
}

interface MetadataCatalog {
  id: string;
  tenantId: string;
  dataSourceId: string;
  name: string;
  type: CatalogItemType;
  domain?: BusinessDomain;
  description?: string;
  schemaInfo: SchemaInfo;
  qualityScore: number;
  sampleCount: number;
  rowCount?: number;
  dataSizeBytes?: number;
  tags: string[];
  ownerId?: string;
  stewardIds: string[];
  sensitivity?: SensitivityLevel;
  slaLevel?: SlaLevel;
  metadataType: MetadataType;
  lastCrawledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// === 采集任务 ===

type CrawlTaskStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

interface CrawlTaskConfig {
  includePatterns?: string[];
  excludePatterns?: string[];
  extractDDL?: boolean;
  extractSampleData?: boolean;
  extractLineage?: boolean;
  extractStats?: boolean;
  sampleSize?: number;
  timeoutMs?: number;
  incremental?: boolean;
}

interface CrawlTask {
  id: string;
  tenantId: string;
  dataSourceId: string;
  name: string;
  schedule?: string;  // cron 表达式
  status: CrawlTaskStatus;
  lastRunAt?: Date;
  lastRunResult?: { success: boolean; tablesFound: number; fieldsFound: number; durationMs: number; error?: string };
  nextRunAt?: Date;
  config: CrawlTaskConfig;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CrawlExecution {
  id: string;
  tenantId: string;
  taskId: string;
  dataSourceId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
  tablesFound: number;
  fieldsFound: number;
  errorMessage?: string;
}

// === 业务术语 ===

type TermCategory = 'entity' | 'attribute' | 'event' | 'rule';

interface BusinessTerm {
  id: string;
  tenantId: string;
  term: string;
  definition: string;
  category: TermCategory;
  synonyms: string[];
  rootWord?: string;
  mappedFields: { catalogId: string; catalogName: string; fieldName: string }[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// === 字段血缘 ===

type TransformType = 'direct' | 'transform' | 'aggregate' | 'filter' | 'join';

interface FieldLineage {
  id: string;
  tenantId: string;
  sourceCatalogId: string;
  sourceField: string;
  targetCatalogId: string;
  targetField: string;
  transformType?: TransformType;
  transformDesc?: string;
  pipelineId?: string;
}

// === API 请求/响应类型 ===

interface DataSourceCreate {
  name: string;
  type: DataSourceType;
  connectionConfig: Record<string, unknown>;
  description?: string;
}

interface DataSourceUpdate {
  name?: string;
  connectionConfig?: Record<string, unknown>;
  description?: string;
}

interface CrawlTaskCreate {
  dataSourceId: string;
  name: string;
  schedule?: string;
  config: CrawlTaskConfig;
}

interface TermCreate {
  term: string;
  definition: string;
  category: TermCategory;
  synonyms?: string[];
  rootWord?: string;
}

interface TermUpdate {
  definition?: string;
  category?: TermCategory;
  synonyms?: string[];
  rootWord?: string;
}

interface CatalogStats {
  total: number;
  byDomain: Record<string, number>;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  avgQualityScore: number;
  unownedCount: number;
}
```

---

## 三、API 设计

### 3.1 路由注册

新增 `orion-platform-service/src/api/metadata-routes.ts`，在 `routes.ts` 中注册：

```typescript
// routes.ts 中新增
app.register(metadataRoutes, { prefix: '/v1/metadata' });
```

### 3.2 端点清单

#### 3.2.1 数据源管理

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应体 |
|------|------|------|------|--------|--------|
| POST | `/v1/metadata/data-sources` | 注册数据源 | `metadata:write` | `DataSourceCreate` | `{ data: DataSource }` |
| GET | `/v1/metadata/data-sources` | 数据源列表 | `metadata:read` | query: `type`, `status`, `page`, `pageSize`, `search` | `{ data: DataSource[], total, page, pageSize }` |
| GET | `/v1/metadata/data-sources/:id` | 数据源详情 | `metadata:read` | - | `{ data: DataSource }` |
| PUT | `/v1/metadata/data-sources/:id` | 更新数据源 | `metadata:write` | `DataSourceUpdate` | `{ data: DataSource }` |
| DELETE | `/v1/metadata/data-sources/:id` | 删除数据源 | `metadata:admin` | - | `{ success: true }` |
| POST | `/v1/metadata/data-sources/:id/test` | 测试连接 | `metadata:write` | - | `{ data: { success, message, latencyMs } }` |

#### 3.2.2 数据目录

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应体 |
|------|------|------|------|--------|--------|
| GET | `/v1/metadata/catalog` | 数据目录列表 | `metadata:read` | query: `search`, `domain`, `type`, `dataSourceId`, `tag`, `ownerId`, `sensitivity`, `page`, `pageSize`, `orderBy`, `order` | `{ data: MetadataCatalog[], total, page, pageSize }` |
| GET | `/v1/metadata/catalog/:id` | 数据详情 | `metadata:read` | - | `{ data: MetadataCatalog }` |
| GET | `/v1/metadata/catalog/:id/lineage` | 字段血缘 | `metadata:read` | query: `direction` (upstream/downstream/both) | `{ data: { upstream: FieldLineage[], downstream: FieldLineage[] } }` |
| GET | `/v1/metadata/catalog/stats` | 目录统计 | `metadata:read` | query: `dataSourceId`, `domain` | `{ data: CatalogStats }` |
| PUT | `/v1/metadata/catalog/:id` | 更新目录信息 | `metadata:owner` | `{ description, domain, tags, ownerId, stewardIds, sensitivity, slaLevel }` | `{ data: MetadataCatalog }` |

#### 3.2.3 采集任务

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应体 |
|------|------|------|------|--------|--------|
| POST | `/v1/metadata/crawl-tasks` | 创建采集任务 | `metadata:write` | `CrawlTaskCreate` | `{ data: CrawlTask }` |
| GET | `/v1/metadata/crawl-tasks` | 任务列表 | `metadata:read` | query: `dataSourceId`, `status`, `page`, `pageSize` | `{ data: CrawlTask[], total, page, pageSize }` |
| GET | `/v1/metadata/crawl-tasks/:id` | 任务详情 | `metadata:read` | - | `{ data: CrawlTask }` |
| PUT | `/v1/metadata/crawl-tasks/:id` | 更新采集任务 | `metadata:write` | `{ name, schedule, config }` | `{ data: CrawlTask }` |
| POST | `/v1/metadata/crawl-tasks/:id/run` | 手动执行 | `metadata:write` | - | `{ data: { executionId, status } }` |
| POST | `/v1/metadata/crawl-tasks/:id/pause` | 暂停任务 | `metadata:write` | - | `{ data: { status } }` |
| POST | `/v1/metadata/crawl-tasks/:id/resume` | 恢复任务 | `metadata:write` | - | `{ data: { status } }` |
| DELETE | `/v1/metadata/crawl-tasks/:id` | 删除任务 | `metadata:admin` | - | `{ success: true }` |
| GET | `/v1/metadata/crawl-tasks/:id/executions` | 执行历史 | `metadata:read` | query: `page`, `pageSize` | `{ data: CrawlExecution[], total, page, pageSize }` |

#### 3.2.4 业务术语

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应体 |
|------|------|------|------|--------|--------|
| POST | `/v1/metadata/terms` | 创建术语 | `metadata:write` | `TermCreate` | `{ data: BusinessTerm }` |
| GET | `/v1/metadata/terms` | 术语列表 | `metadata:read` | query: `search`, `category`, `rootWord`, `page`, `pageSize` | `{ data: BusinessTerm[], total, page, pageSize }` |
| GET | `/v1/metadata/terms/:id` | 术语详情 | `metadata:read` | - | `{ data: BusinessTerm }` |
| PUT | `/v1/metadata/terms/:id` | 更新术语 | `metadata:write` | `TermUpdate` | `{ data: BusinessTerm }` |
| DELETE | `/v1/metadata/terms/:id` | 删除术语 | `metadata:admin` | - | `{ success: true }` |
| POST | `/v1/metadata/terms/:id/map-field` | 映射字段 | `metadata:write` | `{ catalogId, fieldName }` | `{ success: true }` |
| DELETE | `/v1/metadata/terms/:id/map-field/:mappingId` | 取消映射 | `metadata:write` | - | `{ success: true }` |

### 3.3 路由文件结构

```
orion-platform-service/
├── src/
│   ├── api/
│   │   ├── metadata-routes.ts          # 路由注册
│   │   └── controllers/
│   │       ├── MetadataDataSourceController.ts
│   │       ├── MetadataCatalogController.ts
│   │       ├── MetadataCrawlTaskController.ts
│   │       └── BusinessTermController.ts
│   ├── services/
│   │   ├── metadata/
│   │   │   ├── MetadataService.ts          # 核心服务
│   │   │   ├── MetadataTypes.ts            # 类型定义
│   │   │   ├── MetadataCrawler.ts          # 采集器抽象基类
│   │   │   ├── crawlers/
│   │   │   │   ├── DatabaseCrawler.ts
│   │   │   │   ├── DataWarehouseCrawler.ts
│   │   │   │   ├── FileCrawler.ts
│   │   │   │   └── ApiCrawler.ts
│   │   │   └── __tests__/
│   │   │       ├── MetadataService.test.ts
│   │   │       └── DatabaseCrawler.test.ts
│   │   └── ...
│   └── repositories/
│       ├── MetadataDataSourceRepository.ts
│       ├── MetadataCatalogRepository.ts
│       ├── MetadataCrawlTaskRepository.ts
│       ├── CrawlExecutionRepository.ts
│       └── BusinessTermRepository.ts
```

---

## 四、页面交互设计（前端）

### 4.1 页面清单

| 页面 | 路由 | 菜单归属 | 核心功能 | 文件路径 |
|------|------|----------|----------|----------|
| 数据目录 | `/governance/metadata-catalog` | 治理 | 搜索/过滤/分类浏览/质量评分 | `orion-frontend/src/pages/MetadataCatalog/index.tsx` |
| 数据源管理 | `/governance/data-sources` | 治理 | 注册/测试/监控数据源 | `orion-frontend/src/pages/DataSources/index.tsx` |
| 采集任务 | `/governance/crawl-tasks` | 治理 | 创建/执行/暂停/查看日志 | `orion-frontend/src/pages/CrawlTasks/index.tsx` |
| 数据详情 | `/governance/metadata-catalog/:id` | 治理 | 表结构/字段/血缘/样本 | `orion-frontend/src/pages/MetadataCatalog/Detail.tsx` |
| 业务术语表 | `/governance/business-terms` | 治理 | 术语 CRUD/映射字段 | `orion-frontend/src/pages/BusinessTerms/index.tsx` |

### 4.2 数据目录页（`/governance/metadata-catalog`）

**文件**: `orion-frontend/src/pages/MetadataCatalog/index.tsx`

```tsx
// 布局：左侧分类树 + 顶部搜索过滤 + 主体列表
// 标题：使用 SafetyCertificateOutlined 图标（治理模块）

import { useState, useEffect } from 'react';
import {
  Table, Input, Select, Button, Space, Tag, Tree, Card, Empty,
  message, Typography, Tooltip, Progress, Spin,
} from 'antd';
import { Title } from 'antd/es/typography';
import {
  SafetyCertificateOutlined, SearchOutlined, FilterOutlined,
  DatabaseOutlined, TableOutlined, ApiOutlined, FileOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { fetchMetadataCatalog, fetchCatalogStats } from '@/api/metadata';
import type { MetadataCatalog, CatalogStats } from '@/api/metadata/types';

const DOMAIN_OPTIONS = [
  { value: '', label: '全部业务域' },
  { value: '订单', label: '订单' },
  { value: '用户', label: '用户' },
  { value: '支付', label: '支付' },
  { value: '物流', label: '物流' },
  { value: '营销', label: '营销' },
  { value: '财务', label: '财务' },
];

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'table', label: '表' },
  { value: 'view', label: '视图' },
  { value: 'topic', label: 'Topic' },
  { value: 'api', label: 'API' },
  { value: 'file', label: '文件' },
];

const SENSITIVITY_OPTIONS = [
  { value: '', label: '全部敏感等级' },
  { value: 'L1-公开', label: 'L1-公开' },
  { value: 'L2-内部', label: 'L2-内部' },
  { value: 'L3-机密', label: 'L3-机密' },
  { value: 'L4-绝密', label: 'L4-绝密' },
];

const qualityColor = (score: number): string => {
  if (score >= 0.8) return colors.success[500];
  if (score >= 0.6) return colors.warning[500];
  return colors.error[500];
};

const typeIcon = (type: string) => {
  switch (type) {
    case 'table': return <TableOutlined />;
    case 'view': return <DatabaseOutlined />;
    case 'topic': return <DatabaseOutlined />;
    case 'api': return <ApiOutlined />;
    case 'file': return <FileOutlined />;
    default: return <DatabaseOutlined />;
  }
};

const MetadataCatalogPage: React.FC = () => {
  const [data, setData] = useState<MetadataCatalog[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sensitivityFilter, setSensitivityFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [catalogRes, statsRes] = await Promise.all([
        fetchMetadataCatalog({
          search: searchText,
          domain: domainFilter || undefined,
          type: typeFilter || undefined,
          sensitivity: sensitivityFilter || undefined,
          page, pageSize,
        }),
        fetchCatalogStats(),
      ]);
      setData(catalogRes.data);
      setTotal(catalogRes.total);
      setStats(statsRes.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载数据目录失败: ${error.message}`);
      } else {
        message.error('加载数据目录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, pageSize]);

  const handleSearch = () => { setPage(1); loadData(); };

  const categoryTreeData = stats ? [
    {
      title: `全部 (${stats.total})`,
      key: 'all',
      children: Object.entries(stats.byDomain).map(([domain, count]) => ({
        title: `${domain} (${count})`,
        key: domain,
        onSelect: () => { setDomainFilter(domain); setPage(1); loadData(); },
      })),
    },
    {
      title: '按类型',
      key: 'type',
      children: Object.entries(stats.byType).map(([type, count]) => ({
        title: `${type} (${count})`,
        key: `type:${type}`,
        onSelect: () => { setTypeFilter(type); setPage(1); loadData(); },
      })),
    },
  ] : [];

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: MetadataCatalog) => (
        <Space>
          {typeIcon(record.type)}
          <a
            href={`/governance/metadata-catalog/${record.id}`}
            style={{ color: colors.primary[500] }}
          >
            {name}
          </a>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => <Tag color={colors.primary[500]}>{type}</Tag>,
    },
    {
      title: '业务域',
      dataIndex: 'domain',
      key: 'domain',
      width: 100,
    },
    {
      title: '质量评分',
      dataIndex: 'qualityScore',
      key: 'qualityScore',
      width: 120,
      render: (score: number) => (
        <Tooltip title={`${(score * 100).toFixed(0)}%`}>
          <Progress
            percent={Math.round(score * 100)}
            size="small"
            strokeColor={qualityColor(score)}
            format={(p) => `${p}%`}
          />
        </Tooltip>
      ),
    },
    {
      title: '数据 Owner',
      dataIndex: 'ownerId',
      key: 'ownerId',
      width: 120,
      render: (v: string) => v || <Tag color={colors.neutral[400]}>未指定</Tag>,
    },
    {
      title: '敏感等级',
      dataIndex: 'sensitivity',
      key: 'sensitivity',
      width: 100,
      render: (v: string) =>
        v ? (
          <Tag
            color={
              v === 'L4-绝密' ? colors.error[500] :
              v === 'L3-机密' ? colors.warning[500] :
              v === 'L2-内部' ? colors.info[500] :
              colors.neutral[500]
            }
          >
            {v}
          </Tag>
        ) : '-',
    },
    {
      title: '最后采集',
      dataIndex: 'lastCrawledAt',
      key: 'lastCrawledAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '未采集',
    },
  ];

  return (
    <div style={{ padding: spacing.md }}>
      {/* 标题区 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据目录
      </Title>
      <Typography.Text
        type="secondary"
        style={{ color: colors.neutral[500], fontSize: 14, display: 'block', marginBottom: spacing.md }}
      >
        搜索和发现平台内的所有数据资产，按业务域和类型分类浏览
      </Typography.Text>

      <div style={{ display: 'flex', gap: spacing.md }}>
        {/* 左侧分类树 */}
        <Card
          title="分类浏览"
          style={{ width: 240, borderRadius: componentRadius.card }}
          bodyStyle={{ padding: spacing.sm }}
        >
          <Tree treeData={categoryTreeData} defaultExpandAll />
        </Card>

        {/* 主内容区 */}
        <div style={{ flex: 1 }}>
          {/* 搜索与过滤 */}
          <Card style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input.Search
                placeholder="搜索表名、字段名、描述、标签..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={handleSearch}
                prefix={<SearchOutlined />}
                allowClear
                enterButton="搜索"
                style={{ borderRadius: componentRadius.input }}
              />
              <Space>
                <Select
                  value={domainFilter}
                  onChange={setDomainFilter}
                  options={DOMAIN_OPTIONS}
                  style={{ width: 140 }}
                  placeholder="业务域"
                />
                <Select
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={TYPE_OPTIONS}
                  style={{ width: 120 }}
                  placeholder="类型"
                />
                <Select
                  value={sensitivityFilter}
                  onChange={setSensitivityFilter}
                  options={SENSITIVITY_OPTIONS}
                  style={{ width: 160 }}
                  placeholder="敏感等级"
                />
                <Button type="primary" onClick={handleSearch} loading={loading}>
                  应用筛选
                </Button>
              </Space>
            </Space>
          </Card>

          {/* 统计卡片 */}
          {stats && (
            <Space style={{ marginBottom: spacing.md }}>
              <Tag color={colors.primary[500]}>共 {stats.total} 个资产</Tag>
              <Tag>平均质量 {(stats.avgQualityScore * 100).toFixed(0)}%</Tag>
              <Tag color={colors.warning[500]}>未指定 Owner: {stats.unownedCount}</Tag>
            </Space>
          )}

          {/* 数据列表 */}
          <Card style={{ borderRadius: componentRadius.card }}>
            {loading && data.length === 0 ? (
              <Empty description="加载中..." />
            ) : data.length === 0 ? (
              <Empty
                description="暂无数据资产"
                extra={
                  <Button type="primary" href="/governance/data-sources">
                    前往注册数据源
                  </Button>
                }
              />
            ) : (
              <Spin spinning={loading}>
                <Table
                  columns={columns}
                  dataSource={data}
                  rowKey="id"
                  pagination={{
                    current: page, pageSize, total, showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: setPage, onShowSizeChange: (_p, s) => setPageSize(s),
                  }}
                  size="middle"
                />
              </Spin>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MetadataCatalogPage;
```

### 4.3 数据源管理页（`/governance/data-sources`）

**文件**: `orion-frontend/src/pages/DataSources/index.tsx`

```tsx
import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Tag, Card, Modal, Form, Input, Select,
  message, Typography, Empty, Popconfirm, Spin, Descriptions, Drawer,
} from 'antd';
import { Title } from 'antd/es/typography';
import {
  SafetyCertificateOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined, ThunderboltOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import {
  fetchDataSources, createDataSource, updateDataSource,
  deleteDataSource, testDataSource,
} from '@/api/metadata';
import type { DataSource, DataSourceType } from '@/api/metadata/types';

const SOURCE_TYPE_OPTIONS: { value: DataSourceType; label: string }[] = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'redis', label: 'Redis' },
  { value: 'kafka', label: 'Kafka' },
  { value: 'elasticsearch', label: 'Elasticsearch' },
  { value: 'api', label: 'REST API' },
  { value: 'file', label: '文件存储' },
  { value: 'clickhouse', label: 'ClickHouse' },
];

const statusConfig = {
  active: { color: colors.success[500], text: '活跃', icon: <CheckCircleOutlined /> },
  inactive: { color: colors.neutral[500], text: '未激活', icon: null },
  error: { color: colors.error[500], text: '异常', icon: <CloseCircleOutlined /> },
  testing: { color: colors.warning[500], text: '测试中', icon: <ThunderboltOutlined spin /> },
};

const DataSourcesPage: React.FC = () => {
  const [data, setData] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState<DataSource | null>(null);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchDataSources({ page, pageSize });
      setData(res.data);
      setTotal(res.total);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载数据源失败: ${error.message}`);
      } else {
        message.error('加载数据源失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, pageSize]);

  const handleOpenCreate = () => {
    setEditingSource(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleOpenEdit = (record: DataSource) => {
    setEditingSource(record);
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      description: record.description,
      host: record.connectionConfig?.host,
      port: record.connectionConfig?.port,
      database: record.connectionConfig?.database,
      username: record.connectionConfig?.username,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      if (editingSource) {
        await updateDataSource(editingSource.id, {
          name: values.name,
          description: values.description,
          connectionConfig: {
            host: values.host,
            port: values.port,
            database: values.database,
            username: values.username,
            password: values.password,
          },
        });
        message.success('数据源更新成功');
      } else {
        await createDataSource({
          name: values.name,
          type: values.type,
          description: values.description,
          connectionConfig: {
            host: values.host,
            port: values.port,
            database: values.database,
            username: values.username,
            password: values.password,
          },
        });
        message.success('数据源注册成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`保存失败: ${error.message}`);
      } else {
        message.error('保存失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTesting(id);
    try {
      const res = await testDataSource(id);
      if (res.data.success) {
        message.success(`连接测试成功 (延迟: ${res.data.latencyMs}ms)`);
      } else {
        message.error(`连接失败: ${res.data.message}`);
      }
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`连接测试异常: ${error.message}`);
      } else {
        message.error('连接测试异常，请稍后重试');
      }
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDataSource(id);
      message.success('数据源已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败: ${error.message}`);
      } else {
        message.error('删除失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: DataSource) => (
        <a
          onClick={() => setDetailDrawer(record)}
          style={{ color: colors.primary[500], cursor: 'pointer' }}
        >
          {name}
        </a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => <Tag color={colors.info[500]}>{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
        return (
          <Tag color={cfg.color}>
            {cfg.icon} {cfg.text}
          </Tag>
        );
      },
    },
    {
      title: '表数量',
      dataIndex: ['metadata', 'tableCount'],
      key: 'tableCount',
      width: 100,
      render: (v: number) => v ?? '-',
    },
    {
      title: '最后测试',
      dataIndex: 'lastTestAt',
      key: 'lastTestAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '未测试',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: DataSource) => (
        <Space>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            loading={testing === record.id}
            onClick={() => handleTestConnection(record.id)}
          >
            测试连接
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            description="删除后关联的采集任务也将被删除"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.md }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据源管理
      </Title>
      <Typography.Text
        type="secondary"
        style={{ color: colors.neutral[500], fontSize: 14, display: 'block', marginBottom: spacing.md }}
      >
        注册和管理数据源连接，支持 MySQL、PostgreSQL、MongoDB、Kafka 等多种类型
      </Typography.Text>

      <Card
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            style={{ borderRadius: componentRadius.button.md }}
          >
            注册数据源
          </Button>
        }
        style={{ borderRadius: componentRadius.card }}
      >
        {loading && data.length === 0 ? (
          <Empty description="加载中..." />
        ) : data.length === 0 ? (
          <Empty
            description="暂无数据源"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                注册第一个数据源
              </Button>
            }
          />
        ) : (
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="id"
              pagination={{
                current: page, pageSize, total, showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: setPage, onShowSizeChange: (_p, s) => setPageSize(s),
              }}
              size="middle"
            />
          </Spin>
        )}
      </Card>

      {/* 创建/编辑数据源弹窗 */}
      <Modal
        title={editingSource ? '编辑数据源' : '注册数据源'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingSource ? '保存' : '注册'}
        cancelText="取消"
        confirmLoading={loading}
        width={600}
        style={{ borderRadius: componentRadius.modal }}
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 700, margin: '0 auto' }}>
          <Form.Item name="name" label="数据源名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：生产 MySQL 主库" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="type" label="数据源类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={SOURCE_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="数据源用途描述" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Space style={{ width: '100%' }} size={spacing.md}>
            <Form.Item name="host" label="主机地址" rules={[{ required: true, message: '请输入主机地址' }]} style={{ flex: 1 }}>
              <Input placeholder="127.0.0.1" style={{ borderRadius: componentRadius.input }} />
            </Form.Item>
            <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]} style={{ width: 100 }}>
              <Input placeholder="3306" style={{ borderRadius: componentRadius.input }} />
            </Form.Item>
          </Space>
          <Form.Item name="database" label="数据库名">
            <Input placeholder="my_database" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Space style={{ width: '100%' }} size={spacing.md}>
            <Form.Item name="username" label="用户名" style={{ flex: 1 }}>
              <Input placeholder="root" style={{ borderRadius: componentRadius.input }} />
            </Form.Item>
            <Form.Item name="password" label="密码" style={{ flex: 1 }}>
              <Input.Password placeholder="密码" style={{ borderRadius: componentRadius.input }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 数据源详情 Drawer */}
      <Drawer
        title="数据源详情"
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={600}
      >
        {detailDrawer && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="名称">{detailDrawer.name}</Descriptions.Item>
            <Descriptions.Item label="类型">{detailDrawer.type}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusConfig[detailDrawer.status]?.color}>
                {statusConfig[detailDrawer.status]?.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="描述">{detailDrawer.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="主机">{(detailDrawer.connectionConfig as any)?.host || '-'}</Descriptions.Item>
            <Descriptions.Item label="端口">{(detailDrawer.connectionConfig as any)?.port || '-'}</Descriptions.Item>
            <Descriptions.Item label="数据库">{(detailDrawer.connectionConfig as any)?.database || '-'}</Descriptions.Item>
            <Descriptions.Item label="表数量">{detailDrawer.metadata?.tableCount ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="最后测试时间">
              {detailDrawer.lastTestAt ? new Date(detailDrawer.lastTestAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后测试结果">
              {detailDrawer.lastTestResult?.success ? '成功' : detailDrawer.lastTestResult?.message || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default DataSourcesPage;
```

### 4.4 采集任务页（`/governance/crawl-tasks`）

**文件**: `orion-frontend/src/pages/CrawlTasks/index.tsx`

```tsx
import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Tag, Card, Modal, Form, Input, Select,
  message, Typography, Empty, Popconfirm, Spin, Switch, Tooltip,
  DatePicker,
} from 'antd';
import { Title } from 'antd/es/typography';
import {
  SafetyCertificateOutlined, PlusOutlined, PlayCircleOutlined,
  PauseCircleOutlined, DeleteOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import {
  fetchCrawlTasks, createCrawlTask, runCrawlTask,
  pauseCrawlTask, resumeCrawlTask, deleteCrawlTask,
  fetchDataSources,
} from '@/api/metadata';
import type { CrawlTask, CrawlTaskStatus } from '@/api/metadata/types';

const statusConfig: Record<string, { color: string; text: string }> = {
  scheduled: { color: colors.info[500], text: '已调度' },
  running: { color: colors.primary[500], text: '运行中' },
  completed: { color: colors.success[500], text: '已完成' },
  failed: { color: colors.error[500], text: '失败' },
  paused: { color: colors.warning[500], text: '已暂停' },
  cancelled: { color: colors.neutral[500], text: '已取消' },
};

const CrawlTasksPage: React.FC = () => {
  const [data, setData] = useState<CrawlTask[]>([]);
  const [dataSources, setDataSources] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await fetchCrawlTasks({ page, pageSize });
      setData(res.data);
      setTotal(res.total);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载采集任务失败: ${error.message}`);
      } else {
        message.error('加载采集任务失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDataSources = async () => {
    try {
      const res = await fetchDataSources({ pageSize: 100 });
      setDataSources(res.data.map((ds: { id: string; name: string }) => ({ id: ds.id, name: ds.name })));
    } catch {
      // 静默失败，数据源列表为空不影响页面
    }
  };

  useEffect(() => { loadTasks(); loadDataSources(); }, [page, pageSize]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      await createCrawlTask({
        dataSourceId: values.dataSourceId,
        name: values.name,
        schedule: values.schedule || undefined,
        config: {
          extractDDL: values.extractDDL ?? true,
          extractSampleData: values.extractSampleData ?? true,
          extractLineage: values.extractLineage ?? false,
          extractStats: values.extractStats ?? true,
          sampleSize: values.sampleSize || 5,
        },
      });
      message.success('采集任务创建成功');
      setModalVisible(false);
      form.resetFields();
      loadTasks();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建失败: ${error.message}`);
      } else {
        message.error('创建失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async (id: string) => {
    setRunningTaskId(id);
    try {
      await runCrawlTask(id);
      message.success('采集任务已触发执行');
      loadTasks();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`执行失败: ${error.message}`);
      } else {
        message.error('执行失败，请稍后重试');
      }
    } finally {
      setRunningTaskId(null);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await pauseCrawlTask(id);
      message.success('采集任务已暂停');
      loadTasks();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`暂停失败: ${error.message}`);
      } else {
        message.error('暂停失败，请稍后重试');
      }
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeCrawlTask(id);
      message.success('采集任务已恢复');
      loadTasks();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`恢复失败: ${error.message}`);
      } else {
        message.error('恢复失败，请稍后重试');
      }
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteCrawlTask(id);
      message.success('采集任务已删除');
      loadTasks();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败: ${error.message}`);
      } else {
        message.error('删除失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '数据源',
      dataIndex: 'dataSourceId',
      key: 'dataSourceId',
      width: 160,
      render: (id: string) => {
        const ds = dataSources.find((s) => s.id === id);
        return ds ? <Tag color={colors.info[500]}>{ds.name}</Tag> : id;
      },
    },
    {
      title: '调度',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 140,
      render: (v: string) => v || <Tag color={colors.neutral[400]}>手动</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: CrawlTaskStatus) => {
        const cfg = statusConfig[status] || statusConfig.scheduled;
        return (
          <Tag color={cfg.color}>
            {status === 'running' && <SyncOutlined spin />} {cfg.text}
          </Tag>
        );
      },
    },
    {
      title: '上次运行',
      key: 'lastRun',
      width: 220,
      render: (_: unknown, record: CrawlTask) => (
        <div>
          {record.lastRunAt ? (
            <>
              <div>{new Date(record.lastRunAt).toLocaleString('zh-CN')}</div>
              <Tag
                color={record.lastRunResult?.success ? colors.success[500] : colors.error[500]}
                style={{ fontSize: 11 }}
              >
                {record.lastRunResult?.success
                  ? `${record.lastRunResult.tablesFound} 表 / ${record.lastRunResult.fieldsFound} 字段`
                  : record.lastRunResult?.error || '失败'}
              </Tag>
            </>
          ) : (
            <Tag color={colors.neutral[400]}>未运行</Tag>
          )}
        </div>
      ),
    },
    {
      title: '下次运行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 160,
      render: (v: string) => v ? (
        <Tooltip title={<ClockCircleOutlined />}>
          {new Date(v).toLocaleString('zh-CN')}
        </Tooltip>
      ) : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: CrawlTask) => (
        <Space>
          {record.status === 'paused' ? (
            <Button
              size="small"
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleResume(record.id)}
            >
              恢复
            </Button>
          ) : record.status === 'running' ? (
            <Button
              size="small"
              type="link"
              icon={<PauseCircleOutlined />}
              onClick={() => handlePause(record.id)}
            >
              暂停
            </Button>
          ) : (
            <Button
              size="small"
              type="link"
              icon={<PlayCircleOutlined />}
              loading={runningTaskId === record.id}
              onClick={() => handleRun(record.id)}
            >
              执行
            </Button>
          )}
          <Popconfirm
            title="确认删除？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.md }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        采集任务
      </Title>
      <Typography.Text
        type="secondary"
        style={{ color: colors.neutral[500], fontSize: 14, display: 'block', marginBottom: spacing.md }}
      >
        管理元数据采集任务，支持定时调度和手动执行，采集数据库/文件/API 的元数据信息
      </Typography.Text>

      <Card
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            style={{ borderRadius: componentRadius.button.md }}
          >
            创建采集任务
          </Button>
        }
        style={{ borderRadius: componentRadius.card }}
      >
        {loading && data.length === 0 ? (
          <Empty description="加载中..." />
        ) : data.length === 0 ? (
          <Empty
            description="暂无采集任务"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                创建第一个采集任务
              </Button>
            }
          />
        ) : (
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="id"
              pagination={{
                current: page, pageSize, total, showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: setPage, onShowSizeChange: (_p, s) => setPageSize(s),
              }}
              size="middle"
            />
          </Spin>
        )}
      </Card>

      {/* 创建采集任务弹窗 */}
      <Modal
        title="创建采集任务"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => setModalVisible(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 700, margin: '0 auto' }}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="如：每日采集生产库元数据" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="dataSourceId" label="数据源" rules={[{ required: true, message: '请选择数据源' }]}>
            <Select
              options={dataSources.map((ds) => ({ value: ds.id, label: ds.name }))}
              placeholder="选择数据源"
            />
          </Form.Item>
          <Form.Item
            name="schedule"
            label="调度表达式"
            tooltip="留空则为手动执行，支持标准 cron 表达式"
          >
            <Input placeholder="0 2 * * * (每天凌晨2点)" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="extractDDL" label="提取 DDL 结构" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="extractSampleData" label="采样样本数据" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="extractLineage" label="分析血缘关系" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="sampleSize" label="采样行数" initialValue={5}>
            <Input type="number" min={1} max={100} style={{ width: 100, borderRadius: componentRadius.input }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CrawlTasksPage;
```

### 4.5 数据详情页（`/governance/metadata-catalog/:id`）

**文件**: `orion-frontend/src/pages/MetadataCatalog/Detail.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Tabs, Table, Tag, Card, Descriptions, Button, Space, Empty,
  message, Typography, Progress, Tooltip, Spin, Divider,
} from 'antd';
import { Title } from 'antd/es/typography';
import {
  SafetyCertificateOutlined, ArrowLeftOutlined,
  TableOutlined, LinkOutlined, DatabaseOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import { fetchCatalogDetail, fetchCatalogLineage } from '@/api/metadata';
import type { MetadataCatalog, FieldLineage } from '@/api/metadata/types';

const qualityColor = (score: number): string => {
  if (score >= 0.8) return colors.success[500];
  if (score >= 0.6) return colors.warning[500];
  return colors.error[500];
};

const MetadataDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MetadataCatalog | null>(null);
  const [lineage, setLineage] = useState<{ upstream: FieldLineage[]; downstream: FieldLineage[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detailRes, lineageRes] = await Promise.all([
        fetchCatalogDetail(id),
        fetchCatalogLineage(id, { direction: 'both' }),
      ]);
      setDetail(detailRes.data);
      setLineage(lineageRes.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载数据详情失败: ${error.message}`);
      } else {
        message.error('加载数据详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  if (!detail && !loading) {
    return (
      <div style={{ padding: spacing.md }}>
        <Empty description="数据不存在" extra={
          <Button type="primary" onClick={() => navigate('/governance/metadata-catalog')}>
            返回数据目录
          </Button>
        } />
      </div>
    );
  }

  const columns = [
    { title: '字段名', dataIndex: 'name', key: 'name', width: 180 },
    { title: '数据类型', dataIndex: 'type', key: 'type', width: 140 },
    {
      title: '主键', dataIndex: 'isPrimaryKey', key: 'isPrimaryKey', width: 60,
      render: (v: boolean) => v ? <Tag color={colors.primary[500]}>PK</Tag> : '',
    },
    {
      title: '必填', dataIndex: 'nullable', key: 'nullable', width: 60,
      render: (v: boolean) => !v ? '是' : '否',
    },
    {
      title: '敏感等级', dataIndex: 'sensitivity', key: 'sensitivity', width: 100,
      render: (v: string) => v ? <Tag color={v === 'L3-机密' || v === 'L4-绝密' ? colors.error[500] : colors.warning[500]}>{v}</Tag> : '-',
    },
    { title: '注释', dataIndex: 'comment', key: 'comment' },
    {
      title: '关联术语', dataIndex: 'mappedTerm', key: 'mappedTerm', width: 120,
      render: (v: string) => v ? <Tag color={colors.primary[500]}>{v}</Tag> : '-',
    },
  ];

  const upstreamColumns = [
    { title: '上游表', dataIndex: 'sourceCatalogName', key: 'sourceCatalogName', render: (v: string) => <Tag>{v}</Tag> },
    { title: '上游字段', dataIndex: 'sourceField', key: 'sourceField' },
    { title: '转换类型', dataIndex: 'transformType', key: 'transformType', render: (v: string) => <Tag color={colors.info[500]}>{v}</Tag> },
    { title: '转换描述', dataIndex: 'transformDesc', key: 'transformDesc' },
  ];

  const downstreamColumns = [
    { title: '下游表', dataIndex: 'targetCatalogName', key: 'targetCatalogName', render: (v: string) => <Tag>{v}</Tag> },
    { title: '下游字段', dataIndex: 'targetField', key: 'targetField' },
    { title: '转换类型', dataIndex: 'transformType', key: 'transformType', render: (v: string) => <Tag color={colors.info[500]}>{v}</Tag> },
    { title: '转换描述', dataIndex: 'transformDesc', key: 'transformDesc' },
  ];

  const tabItems = [
    {
      key: 'schema',
      label: <span><TableOutlined /> 字段信息</span>,
      children: detail?.schemaInfo?.columns?.length ? (
        <Table columns={columns} dataSource={detail.schemaInfo.columns} rowKey="name" pagination={false} size="small" />
      ) : (
        <Empty description="暂无字段信息" />
      ),
    },
    {
      key: 'lineage',
      label: <span><LinkOutlined /> 血缘关系</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card title={`上游依赖 (${lineage?.upstream.length ?? 0})`} size="small">
            {lineage?.upstream.length ? (
              <Table columns={upstreamColumns} dataSource={lineage.upstream} rowKey="id" pagination={false} size="small" />
            ) : (
              <Empty description="无上游依赖" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
          <Card title={`下游影响 (${lineage?.downstream.length ?? 0})`} size="small">
            {lineage?.downstream.length ? (
              <Table columns={downstreamColumns} dataSource={lineage.downstream} rowKey="id" pagination={false} size="small" />
            ) : (
              <Empty description="无下游影响" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'info',
      label: <span><DatabaseOutlined /> 基本信息</span>,
      children: (
        <Descriptions column={2} bordered>
          <Descriptions.Item label="名称">{detail?.name}</Descriptions.Item>
          <Descriptions.Item label="类型">{detail?.type}</Descriptions.Item>
          <Descriptions.Item label="业务域">{detail?.domain || '-'}</Descriptions.Item>
          <Descriptions.Item label="数据量">{detail?.rowCount?.toLocaleString() || '-'}</Descriptions.Item>
          <Descriptions.Item label="数据大小">{detail?.dataSizeBytes ? `${(detail.dataSizeBytes / 1024 / 1024).toFixed(2)} MB` : '-'}</Descriptions.Item>
          <Descriptions.Item label="质量评分">
            <Progress percent={Math.round((detail?.qualityScore ?? 0) * 100)} size="small" strokeColor={qualityColor(detail?.qualityScore ?? 0)} />
          </Descriptions.Item>
          <Descriptions.Item label="数据 Owner">{detail?.ownerId || <Tag color={colors.neutral[400]}>未指定</Tag>}</Descriptions.Item>
          <Descriptions.Item label="敏感等级">
            {detail?.sensitivity ? <Tag color={colors.error[500]}>{detail.sensitivity}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="SLA 等级">{detail?.slaLevel || '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>{detail?.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="标签" span={2}>
            {detail?.tags?.length ? detail.tags.map((t) => <Tag key={t}>{t}</Tag>) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最后采集时间">
            {detail?.lastCrawledAt ? new Date(detail.lastCrawledAt).toLocaleString('zh-CN') : '未采集'}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.md }}>
      <Spin spinning={loading}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/governance/metadata-catalog')}
          style={{ marginBottom: spacing.sm }}
        >
          返回
        </Button>

        <Title level={2} style={{ marginBottom: 8 }}>
          <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          {detail?.name || '数据详情'}
        </Title>
        <Typography.Text
          type="secondary"
          style={{ color: colors.neutral[500], fontSize: 14, display: 'block', marginBottom: spacing.md }}
        >
          {detail?.description || '暂无描述'}
        </Typography.Text>

        <Card style={{ borderRadius: componentRadius.card }}>
          <Tabs defaultActiveKey="schema" items={tabItems} />
        </Card>
      </Spin>
    </div>
  );
};

export default MetadataDetailPage;
```

### 4.6 业务术语表页（`/governance/business-terms`）

**文件**: `orion-frontend/src/pages/BusinessTerms/index.tsx`

```tsx
import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Tag, Card, Modal, Form, Input, Select,
  message, Typography, Empty, Popconfirm, Spin, Drawer, Descriptions, Divider,
} from 'antd';
import { Title } from 'antd/es/typography';
import {
  SafetyCertificateOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined, BookOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';
import {
  fetchBusinessTerms, createBusinessTerm, updateBusinessTerm,
  deleteBusinessTerm, mapTermField,
} from '@/api/metadata';
import type { BusinessTerm, TermCategory } from '@/api/metadata/types';

const CATEGORY_OPTIONS: { value: TermCategory; label: string }[] = [
  { value: 'entity', label: '实体' },
  { value: 'attribute', label: '属性' },
  { value: 'event', label: '事件' },
  { value: 'rule', label: '规则' },
];

const categoryColor: Record<string, string> = {
  entity: colors.primary[500],
  attribute: colors.info[500],
  event: colors.warning[500],
  rule: colors.purple[500],
};

const BusinessTermsPage: React.FC = () => {
  const [data, setData] = useState<BusinessTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState<BusinessTerm | null>(null);
  const [editingTerm, setEditingTerm] = useState<BusinessTerm | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchBusinessTerms({ page, pageSize });
      setData(res.data);
      setTotal(res.total);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载业务术语失败: ${error.message}`);
      } else {
        message.error('加载业务术语失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, pageSize]);

  const handleOpenCreate = () => {
    setEditingTerm(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleOpenEdit = (record: BusinessTerm) => {
    setEditingTerm(record);
    form.setFieldsValue({
      term: record.term,
      definition: record.definition,
      category: record.category,
      synonyms: record.synonyms.join(', '),
      rootWord: record.rootWord,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const payload = {
        term: values.term,
        definition: values.definition,
        category: values.category,
        synonyms: values.synonyms ? values.synonyms.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        rootWord: values.rootWord || undefined,
      };
      if (editingTerm) {
        await updateBusinessTerm(editingTerm.id, payload);
        message.success('术语更新成功');
      } else {
        await createBusinessTerm(payload);
        message.success('术语创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`保存失败: ${error.message}`);
      } else {
        message.error('保存失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteBusinessTerm(id);
      message.success('术语已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败: ${error.message}`);
      } else {
        message.error('删除失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '术语名称',
      dataIndex: 'term',
      key: 'term',
      render: (term: string, record: BusinessTerm) => (
        <a
          onClick={() => setDetailDrawer(record)}
          style={{ color: colors.primary[500], cursor: 'pointer', fontWeight: 500 }}
        >
          <BookOutlined style={{ marginRight: 4 }} />
          {term}
        </a>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: TermCategory) => (
        <Tag color={categoryColor[cat] || colors.neutral[500]}>
          {CATEGORY_OPTIONS.find((o) => o.value === cat)?.label || cat}
        </Tag>
      ),
    },
    {
      title: '定义',
      dataIndex: 'definition',
      key: 'definition',
      ellipsis: true,
    },
    {
      title: '词根',
      dataIndex: 'rootWord',
      key: 'rootWord',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '同义词',
      dataIndex: 'synonyms',
      key: 'synonyms',
      width: 160,
      render: (syns: string[]) =>
        syns?.length ? syns.map((s) => <Tag key={s} style={{ fontSize: 11 }}>{s}</Tag>) : '-',
    },
    {
      title: '映射字段数',
      key: 'mappedFields',
      width: 120,
      render: (_: unknown, record: BusinessTerm) => (
        <Tag color={colors.info[500]}>{record.mappedFields?.length ?? 0}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: BusinessTerm) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            description="删除后关联的字段映射也将被清除"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.md }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        业务术语表
      </Title>
      <Typography.Text
        type="secondary"
        style={{ color: colors.neutral[500], fontSize: 14, display: 'block', marginBottom: spacing.md }}
      >
        管理数据资产的业务术语，建立业务概念与物理字段的映射关系
      </Typography.Text>

      <Card
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            style={{ borderRadius: componentRadius.button.md }}
          >
            创建术语
          </Button>
        }
        style={{ borderRadius: componentRadius.card }}
      >
        {loading && data.length === 0 ? (
          <Empty description="加载中..." />
        ) : data.length === 0 ? (
          <Empty
            description="暂无业务术语"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                创建第一个术语
              </Button>
            }
          />
        ) : (
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={data}
              rowKey="id"
              pagination={{
                current: page, pageSize, total, showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
                onChange: setPage, onShowSizeChange: (_p, s) => setPageSize(s),
              }}
              size="middle"
            />
          </Spin>
        )}
      </Card>

      {/* 创建/编辑术语弹窗 */}
      <Modal
        title={editingTerm ? '编辑术语' : '创建术语'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingTerm ? '保存' : '创建'}
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 700, margin: '0 auto' }}>
          <Form.Item name="term" label="术语名称" rules={[{ required: true, message: '请输入术语名称' }]}>
            <Input placeholder="如：客户编号" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="definition" label="定义" rules={[{ required: true, message: '请输入定义' }]}>
            <Input.TextArea rows={3} placeholder="术语的业务含义描述" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="rootWord" label="词根">
            <Input placeholder="如：customer" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item name="synonyms" label="同义词">
            <Input placeholder="多个同义词用逗号分隔" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 术语详情 Drawer */}
      <Drawer
        title="术语详情"
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={600}
      >
        {detailDrawer && (
          <>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="术语名称">{detailDrawer.term}</Descriptions.Item>
              <Descriptions.Item label="定义">{detailDrawer.definition}</Descriptions.Item>
              <Descriptions.Item label="分类">
                <Tag color={categoryColor[detailDrawer.category]}>{detailDrawer.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="词根">{detailDrawer.rootWord || '-'}</Descriptions.Item>
              <Descriptions.Item label="同义词">
                {detailDrawer.synonyms?.length ? detailDrawer.synonyms.map((s) => <Tag key={s}>{s}</Tag>) : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">映射字段</Divider>
            {detailDrawer.mappedFields?.length ? (
              <Table
                dataSource={detailDrawer.mappedFields}
                rowKey={(r) => `${r.catalogId}-${r.fieldName}`}
                pagination={false}
                size="small"
                columns={[
                  { title: '数据资产', dataIndex: 'catalogName', key: 'catalogName', render: (v: string) => <Tag>{v}</Tag> },
                  { title: '字段名', dataIndex: 'fieldName', key: 'fieldName' },
                ]}
              />
            ) : (
              <Empty description="暂无映射字段" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default BusinessTermsPage;
```

### 4.7 API 客户端层

**文件**: `orion-frontend/src/api/metadata.ts`

```typescript
import request from './request';
import type {
  DataSource, MetadataCatalog, CrawlTask, CrawlExecution,
  BusinessTerm, CatalogStats, FieldLineage,
  DataSourceCreate, DataSourceUpdate,
  CrawlTaskCreate, TermCreate, TermUpdate,
} from './metadata/types';

// === 数据源 ===

export const createDataSource = (data: DataSourceCreate) =>
  request.post<{ data: DataSource }>('/v1/metadata/data-sources', data);

export const fetchDataSources = (params?: { type?: string; status?: string; search?: string; page?: number; pageSize?: number }) =>
  request.get<{ data: DataSource[]; total: number; page: number; pageSize: number }>('/v1/metadata/data-sources', { params });

export const fetchDataSourceDetail = (id: string) =>
  request.get<{ data: DataSource }>(`/v1/metadata/data-sources/${id}`);

export const updateDataSource = (id: string, data: DataSourceUpdate) =>
  request.put<{ data: DataSource }>(`/v1/metadata/data-sources/${id}`, data);

export const deleteDataSource = (id: string) =>
  request.delete(`/v1/metadata/data-sources/${id}`);

export const testDataSource = (id: string) =>
  request.post<{ data: { success: boolean; message: string; latencyMs: number } }>(`/v1/metadata/data-sources/${id}/test`);

// === 数据目录 ===

export const fetchMetadataCatalog = (params?: { search?: string; domain?: string; type?: string; sensitivity?: string; dataSourceId?: string; page?: number; pageSize?: number; orderBy?: string; order?: 'ASC' | 'DESC' }) =>
  request.get<{ data: MetadataCatalog[]; total: number; page: number; pageSize: number }>('/v1/metadata/catalog', { params });

export const fetchCatalogDetail = (id: string) =>
  request.get<{ data: MetadataCatalog }>(`/v1/metadata/catalog/${id}`);

export const fetchCatalogLineage = (id: string, params?: { direction?: 'upstream' | 'downstream' | 'both' }) =>
  request.get<{ data: { upstream: FieldLineage[]; downstream: FieldLineage[] } }>(`/v1/metadata/catalog/${id}/lineage`, { params });

export const fetchCatalogStats = (params?: { dataSourceId?: string; domain?: string }) =>
  request.get<{ data: CatalogStats }>('/v1/metadata/catalog/stats', { params });

export const updateCatalog = (id: string, data: { description?: string; domain?: string; tags?: string[]; ownerId?: string; stewardIds?: string[]; sensitivity?: string; slaLevel?: string }) =>
  request.put<{ data: MetadataCatalog }>(`/v1/metadata/catalog/${id}`, data);

// === 采集任务 ===

export const createCrawlTask = (data: CrawlTaskCreate) =>
  request.post<{ data: CrawlTask }>('/v1/metadata/crawl-tasks', data);

export const fetchCrawlTasks = (params?: { dataSourceId?: string; status?: string; page?: number; pageSize?: number }) =>
  request.get<{ data: CrawlTask[]; total: number; page: number; pageSize: number }>('/v1/metadata/crawl-tasks', { params });

export const fetchCrawlTaskDetail = (id: string) =>
  request.get<{ data: CrawlTask }>(`/v1/metadata/crawl-tasks/${id}`);

export const updateCrawlTask = (id: string, data: { name?: string; schedule?: string; config?: object }) =>
  request.put<{ data: CrawlTask }>(`/v1/metadata/crawl-tasks/${id}`, data);

export const runCrawlTask = (id: string) =>
  request.post<{ data: { executionId: string; status: string } }>(`/v1/metadata/crawl-tasks/${id}/run`);

export const pauseCrawlTask = (id: string) =>
  request.post<{ data: { status: string } }>(`/v1/metadata/crawl-tasks/${id}/pause`);

export const resumeCrawlTask = (id: string) =>
  request.post<{ data: { status: string } }>(`/v1/metadata/crawl-tasks/${id}/resume`);

export const deleteCrawlTask = (id: string) =>
  request.delete(`/v1/metadata/crawl-tasks/${id}`);

export const fetchCrawlExecutions = (id: string, params?: { page?: number; pageSize?: number }) =>
  request.get<{ data: CrawlExecution[]; total: number; page: number; pageSize: number }>(`/v1/metadata/crawl-tasks/${id}/executions`, { params });

// === 业务术语 ===

export const createBusinessTerm = (data: TermCreate) =>
  request.post<{ data: BusinessTerm }>('/v1/metadata/terms', data);

export const fetchBusinessTerms = (params?: { search?: string; category?: string; rootWord?: string; page?: number; pageSize?: number }) =>
  request.get<{ data: BusinessTerm[]; total: number; page: number; pageSize: number }>('/v1/metadata/terms', { params });

export const fetchTermDetail = (id: string) =>
  request.get<{ data: BusinessTerm }>(`/v1/metadata/terms/${id}`);

export const updateBusinessTerm = (id: string, data: TermUpdate) =>
  request.put<{ data: BusinessTerm }>(`/v1/metadata/terms/${id}`, data);

export const deleteBusinessTerm = (id: string) =>
  request.delete(`/v1/metadata/terms/${id}`);

export const mapTermField = (id: string, data: { catalogId: string; fieldName: string }) =>
  request.post<{ success: boolean }>(`/v1/metadata/terms/${id}/map-field`, data);

export const unmapTermField = (id: string, mappingId: string) =>
  request.delete<{ success: boolean }>(`/v1/metadata/terms/${id}/map-field/${mappingId}`);
```

---

## 五、路由配置

在 `orion-frontend/src/router/routes.tsx` 中新增路由：

```tsx
// 在 governance 路由分组下新增
{
  path: 'metadata-catalog',
  element: <MetadataCatalogPage />,
  meta: { title: '数据目录', module: 'governance' },
},
{
  path: 'metadata-catalog/:id',
  element: <MetadataDetailPage />,
  meta: { title: '数据详情', module: 'governance', hidden: true },
},
{
  path: 'data-sources',
  element: <DataSourcesPage />,
  meta: { title: '数据源管理', module: 'governance' },
},
{
  path: 'crawl-tasks',
  element: <CrawlTasksPage />,
  meta: { title: '采集任务', module: 'governance' },
},
{
  path: 'business-terms',
  element: <BusinessTermsPage />,
  meta: { title: '业务术语表', module: 'governance' },
},
```

---

## 六、菜单配置

在菜单配置中新增元数据管理子菜单：

```typescript
// 治理模块 -> 元数据管理
{
  key: 'metadata',
  icon: <SafetyCertificateOutlined />,
  label: '元数据管理',
  children: [
    { key: '/governance/metadata-catalog', label: '数据目录' },
    { key: '/governance/data-sources', label: '数据源管理' },
    { key: '/governance/crawl-tasks', label: '采集任务' },
    { key: '/governance/business-terms', label: '业务术语表' },
  ],
}
```

---

## 七、Design Token 使用总结

| 用途 | Token | 值 | 使用位置 |
|------|-------|----|----------|
| 页面主标题图标色 | `colors.primary[500]` | `#3370E6` | 所有页面标题图标 |
| 主按钮 | `colors.primary[500]` | `#3370E6` | 创建/注册/保存按钮 |
| 成功状态（高质/活跃） | `colors.success[500]` | `#52c41a` | 质量 >= 80%, 状态 active |
| 警告状态（中质/暂停） | `colors.warning[500]` | `#faad14` | 质量 60-79%, 状态 paused/error |
| 错误状态（低质/失败） | `colors.error[500]` | `#f5222d` | 质量 < 60%, 状态 failed/L4-绝密 |
| 信息标签（类型/映射数） | `colors.info[500]` | `#3a98f4` | 数据源类型标签 |
| 紫色（规则分类） | `colors.purple[500]` | `#7C5CFC` | 术语分类: 规则 |
| 副标题文字 | `colors.neutral[500]` | `#8c8c8c` | 页面描述文字 |
| 未指定状态 | `colors.neutral[400]` | `#bfbfbf` | Owner 未指定 |
| 表格链接 | `colors.primary[500]` | `#3370E6` | 表名/名称可点击链接 |
| Card 圆角 | `componentRadius.card` | `12px` | 所有卡片 |
| Modal 圆角 | `componentRadius.modal` | `16px` | 弹窗 |
| Button 圆角 | `componentRadius.button.md` | `6px` | 所有按钮 |
| Input 圆角 | `componentRadius.input` | `6px` | 所有输入框 |
| Tag 圆角 | `componentRadius.tag` | `6px` | 所有标签 |
| 页面内边距 | `spacing.md` | `16px` | 页面容器 padding |
| Card 间距 | `spacing.md` | `16px` | 卡片间距 |
| 按钮间距 | `spacing.sm` | `8px` | Space 组件间距 |
| 标题底部间距 | `spacing.sm` | `8px` | Title marginBottom (有副标题) |
| 返回按钮间距 | `spacing.sm` | `8px` | 返回按钮 marginBottom |

---

## 八、验收标准

### 8.1 端到端场景测试

| # | 场景 | 操作步骤 | 预期结果 |
|---|------|----------|----------|
| E1 | 注册 MySQL 数据源并测试连接 | 进入数据源管理 → 点击"注册数据源" → 填写 MySQL 连接信息 → 点击"测试连接" | 连接测试成功，显示延迟时间，数据源状态变为 `active` |
| E2 | 创建采集任务并手动执行 | 进入采集任务 → 点击"创建采集任务" → 选择数据源 → 配置采集选项 → 保存 → 点击"执行" | 任务状态变为 `running`，完成后状态变为 `completed`，显示采集到的表数和字段数 |
| E3 | 在数据目录搜索表 | 进入数据目录 → 输入搜索关键词 → 点击搜索 | 搜索结果正确展示表名、类型、业务域、质量评分 |
| E4 | 查看字段血缘 | 进入数据详情 → 切换到"血缘关系" Tab | 显示上游依赖和下游影响，包含来源表、字段名、转换类型 |
| E5 | 创建业务术语并映射字段 | 进入业务术语表 → 创建术语 → 填写名称/定义/分类 → 保存 | 术语出现在列表中，字段详情页显示关联术语 |
| E6 | 按域/类型/敏感度过滤数据目录 | 在数据目录页选择业务域/类型/敏感度 → 点击"应用筛选" | 列表正确过滤，统计卡片更新 |
| E7 | 查看目录统计面板 | 进入数据目录页 | 统计卡片显示总数、按域分布、按类型分布、平均质量评分、未指定 Owner 数量 |
| E8 | 删除数据源 | 点击数据源"删除" → 二次确认 → 确认 | 数据源删除成功，关联采集任务状态更新或级联删除 |
| E9 | 暂停/恢复采集任务 | 点击任务"暂停"/"恢复" | 状态正确切换，下次执行时间更新 |
| E10 | 数据详情页三 Tab 切换 | 进入数据详情 → 切换"字段信息"/"血缘关系"/"基本信息" | 每个 Tab 内容正确加载，无空白 |

### 8.2 量化指标

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| 数据目录加载时间 | < 1.5s (p95) | 前端 Performance API |
| 连接测试响应时间 | < 5s | API 响应时间测量 |
| 采集任务调度精度 | < 1min 偏差 | 调度时间与实际执行时间对比 |
| 术语搜索响应时间 | < 500ms | API 响应时间测量 |
| 前端单元测试覆盖率 | > 75% | Vitest coverage 报告 |
| API 接口测试覆盖率 | > 80% | Jest coverage 报告 |
| 页面 Lighthouse 性能评分 | > 85 | Lighthouse CI |

### 8.3 前端交互完整性审查（强制通过项）

| 检查项 | 数据目录 | 数据源管理 | 采集任务 | 数据详情 | 业务术语表 |
|--------|:--------:|:----------:|:--------:|:--------:|:----------:|
| 页面标题 + 图标 + 副标题 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 搜索/过滤有交互链 | ✅ | - | - | - | - |
| 列表有 loading 状态 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 空状态有引导按钮 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 创建/编辑有完整表单 | - | ✅ | ✅ | - | ✅ |
| 异步操作有 success/error 提示 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 按钮有 loading/disabled | ✅ | ✅ | ✅ | - | ✅ |
| 删除有二次确认 | - | ✅ | ✅ | - | ✅ |
| 详情页有返回按钮 | - | - | - | ✅ | - |
| 表单有校验规则 | - | ✅ | ✅ | - | ✅ |
| 错误处理有 message.error | ✅ | ✅ | ✅ | ✅ | ✅ |
| 使用 Design Token（无硬编码） | ✅ | ✅ | ✅ | ✅ | ✅ |

### 8.4 后端验收检查

| 检查项 | 要求 |
|--------|------|
| 数据库迁移 | 188_create_metadata_tables.sql 可执行，含 RLS、触发器、索引 |
| Rollback | 188_create_metadata_tables-rollback.sql 可执行，完整清理所有对象 |
| Repository 层 | 5 个 Repository 类，覆盖全部 CRUD 操作 |
| Service 层 | MetadataService + 4 个采集器，单元测试覆盖率 > 80% |
| Controller 层 | 4 个 Controller，覆盖全部 25 个 API 端点 |
| 权限中间件 | 全部端点挂载 `authenticateUser` + `requirePermission` |
| 租户隔离 | 全部查询自动过滤 `tenant_id`，RLS 策略生效 |
| 软删除 | 全部查询自动过滤 `deleted_at IS NULL`，删除操作设时间戳 |
| 连接加密 | `connectionConfig` 加密存储，查询时不解密密码 |
| 错误处理 | 统一错误响应格式 `{ error: { code, message, details } }` |

---

_文档版本: v2.0 | 创建日期: 2026-05-22 | 替代: `docs/superpowers/specs/03-metadata-management-spec.md`_
