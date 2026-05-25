# 数据血缘（Data Lineage）完整设计

> **文档类型**: 功能设计 + 页面交互设计 + API 设计
> **创建日期**: 2026-05-22
> **关联计划**: `docs/plans/orion-upgrade-executable-plan-2026-05-22.md` Section 11.6
> **状态**: 待评审
> **模块归属**: 可观测性

---

## 一、业务闭环设计

### 1.1 完整流程：数据源扫描 → SQL 解析 → 字段血缘提取 → 血缘图构建 → 影响分析

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  数据源扫描   │────▶│  SQL 解析     │────▶│  字段血缘提取  │────▶│  血缘图构建    │────▶│  影响分析     │
│  Scanner     │     │  Parser       │     │  Extractor    │     │  Graph Builder│     │  Impact       │
│              │     │               │     │               │     │               │     │               │
│ • 扫描 SQL   │     │ • AST 解析    │     │ • 源字段识别   │     │ • 节点去重    │     │ • 上游依赖    │
│ • ETL 元数据  │     │ • JOIN 分析   │     │ • 目标字段识别  │     │ • 边关系构建   │     │ • 下游溯源    │
│ • ORM 代码   │     │ • 函数追踪    │     │ • 转换规则提取  │     │ • 层级计算    │     │ • 循环检测    │
│ • Pipeline 日志│    │ • 聚合推导    │     │ • 数据类型映射  │     │ • 版本快照    │     │ • 级联影响    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
   LineageScanner      SQLLineageParser    FieldLineageExtractor LineageGraphBuilder   ImpactAnalyzer
         │                    │                     │                      │                   │
         ▼                    ▼                     ▼                      ▼                   ▼
   SQL Scripts            AST Tree             FieldMapping           DAG Graph            ImpactReport
   ETL Configs            QueryPlan            TransformRules         VersionHistory       CascadeAnalysis
   Pipeline Runs          Subqueries           TypeInference          CyclesDetected       SLOImpact
```

**各阶段职责**：

| 阶段 | 做什么 | 谁做 | 产出 |
|------|--------|------|------|
| **数据源扫描** | 从 SQL 脚本/ETL 配置/Pipeline 日志/ORM 代码中提取原始血缘信息 | `LineageScannerService` | 原始血缘线索列表 |
| **SQL 解析** | 将 SQL 语句解析为 AST，识别 SELECT/FROM/JOIN/WHERE 等子句中的表/字段引用 | `SQLLineageParserService` | AST 树 + 表/字段引用列表 |
| **字段血缘提取** | 从 AST 中提取 source_field → transform → target_field 映射关系 | `FieldLineageExtractorService` | 字段级血缘记录 |
| **血缘图构建** | 将离散的字段血缘记录聚合为 DAG 图，去重、建立层级关系 | `LineageGraphBuilderService` | `DataLineageGraph` 对象 |
| **影响分析** | 基于血缘图计算变更影响范围，包括级联依赖和数据质量传播 | `ImpactAnalyzerService` | `ImpactAnalysisReport` |

### 1.2 血缘层级

系统支持三个层级的血缘追踪，层级之间可以逐层钻取：

```
┌─────────────────────────────────────────────────┐
│  L1: 任务级血缘（Pipeline → Output）              │
│  ┌─────────────────────────────────────────────┐ │
│  │  L2: 表级血缘（source_table → target_table） │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │  L3: 字段级血缘                        │  │ │
│  │  │  source_field → transform → target_fld│  │ │
│  │  └───────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

| 层级 | 粒度 | 示例 | 数据来源 | 已有/新增 |
|------|------|------|----------|-----------|
| **L1 任务级** | Pipeline 任务 → 输出制品 | `pipeline:etl-daily` → `table:user_agg` | Pipeline 执行日志 | 已有 |
| **L2 表级** | 源表 → 目标表 | `db_a.users` → `db_b.user_dim` | SQL FROM/INSERT 语句 | 已有 |
| **L3 字段级** | 源字段 → 转换 → 目标字段 | `users.email` → `LOWER()` → `user_dim.email_lower` | SELECT/WHERE 子句解析 | **新增** |

### 1.3 血缘采集

#### 1.3.1 SQL 解析（核心采集方式）

```
SQL: INSERT INTO user_dim (id, name_lower, dept_name)
     SELECT u.id, LOWER(u.name), d.name
     FROM users u JOIN departments d ON u.dept_id = d.id
     WHERE u.status = 'active'
```

解析产出：

| source_table | source_field | transform | target_table | target_field |
|-------------|-------------|-----------|-------------|-------------|
| `users` | `id` | `direct` | `user_dim` | `id` |
| `users` | `name` | `LOWER()` | `user_dim` | `name_lower` |
| `departments` | `name` | `direct` | `user_dim` | `dept_name` |

#### 1.3.2 ETL 工具集成

从 ETL 工具元数据中提取血缘，支持的 ETL 工具：

| ETL 工具 | 采集方式 | 提取内容 |
|----------|----------|----------|
| dbt | 解析 `manifest.json` | model → source 依赖 + column 映射 |
| Airflow | 解析 DAG Python 代码 | Operator → task → table 引用 |
| DataX | 解析 JSON 配置文件 | reader.table → writer.table |
| Kettle | 解析 `.ktr` XML | step → table/field 引用 |
| 自研 Pipeline | Pipeline `transform_steps` JSON | 配置中的 source/target |

#### 1.3.3 代码扫描

| 扫描目标 | 解析方式 | 提取内容 |
|----------|----------|----------|
| `.sql` 脚本文件 | SQL 解析器 | 全部 SQL 血缘 |
| ORM 代码（TypeORM, Prisma, Sequelize） | AST 静态分析 | Model → Table 映射 + Query 血缘 |
| Python SQLAlchemy | AST 分析 | model/table 映射 |
| Git Commit Diff | Diff 解析 | schema 变更的血缘影响 |

### 1.4 血缘图计算

#### 1.4.1 数据结构

```typescript
// 血缘节点
interface LineageNode {
  id: string;              // 全局唯一 ID
  tenantId: string;        // 租户隔离
  nodeType: 'table' | 'field' | 'pipeline' | 'model';  // 节点类型
  database?: string;       // 数据库名
  schema?: string;         // schema 名
  name: string;            // 表名/字段名/管道名
  displayName: string;     // 展示名称
  metadata?: {
    dataType?: string;     // 字段数据类型
    nullable?: boolean;
    isPrimaryKey?: boolean;
    description?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

// 血缘边
interface LineageEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: 'direct' | 'transform' | 'join' | 'aggregate' | 'filter' | 'map';
  transformLogic?: string;   // 转换逻辑 SQL 表达式
  transformDescription?: string;  // 人类可读描述
  confidence: number;         // 置信度 0-1（自动解析 vs 手动标注）
  recordedAt: Date;
  recordedBy: 'auto_parser' | 'etl_integration' | 'code_scanner' | 'manual';
}

// 血缘图
interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  levels: number;            // 最大深度
  hasCycle: boolean;         // 是否有循环依赖
  snapshotVersion: number;   // 版本号
  capturedAt: Date;
}

// 影响分析报告
interface ImpactAnalysisReport {
  targetNodeId: string;
  changeType: 'schema_change' | 'data_quality_issue' | 'delete' | 'modify_transform';
  upstreamNodes: LineageNode[];
  downstreamNodes: LineageNode[];
  affectedPaths: Array<{ path: string[]; edgeCount: number }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: {
    upstreamCount: number;
    downstreamCount: number;
    totalAffectedTables: number;
    totalAffectedFields: number;
    criticalPipelines: string[];
  };
}
```

#### 1.4.2 上游依赖查询（影响分析）

从目标节点出发，沿边逆向遍历至所有根节点：

```
影响分析：如果 users 表删除 status 字段，影响哪些下游？

users.status
  │
  ├──► user_dim.status          (direct, Pipeline A)
  │     │
  │     ├──► user_report.status_filter  (filter, Pipeline B)
  │     │     │
  │     │     └──► dashboard.user_stats  (aggregate, Pipeline C)
  │     │
  │     └──► user_sync.status   (map, Pipeline D)
  │
  └──► audit_log.status_change  (transform, Pipeline E)

影响范围：5 张下游表，8 个下游字段，3 条活跃 Pipeline
风险等级：HIGH（影响 3 条生产 Pipeline）
```

算法：BFS 逆向遍历，记录完整路径，检测循环依赖。

#### 1.4.3 下游溯源（溯源分析）

从目标节点出发，沿边正向遍历至所有源节点：

```
溯源分析：user_report.status_filter 的数据来源？

dashboard.user_stats
  ▲
  │ (aggregate)
user_report.status_filter
  ▲
  │ (filter)
user_dim.status
  ▲
  │ (direct)
users.status

完整血缘链：users.status → user_dim.status → user_report.status_filter → dashboard.user_stats
数据源：MySQL users 表 status 字段
```

#### 1.4.4 循环依赖检测

使用拓扑排序检测 DAG 中是否存在环：

```typescript
function detectCycle(nodes: LineageNode[], edges: LineageEdge[]): { hasCycle: boolean; cyclePath: string[] } {
  // Kahn 算法：计算每个节点的入度，不断移除入度为 0 的节点
  // 最终剩余节点即为环中的节点
}
```

### 1.5 影响分析场景

| 场景 | 触发方式 | 分析维度 | 输出 |
|------|----------|----------|------|
| **Schema 变更** | DDL 执行前 Hook / 手动分析 | 被删除/修改的字段有哪些下游消费者 | 影响报告 + 风险等级 |
| **数据质量问题** | 数据质量规则触发 | 问题数据沿血缘传播到的所有下游节点 | 污染范围报告 |
| **删除操作** | 删除表/字段/Pipeline 前 | 级联影响的所有下游节点和 Pipeline | 级联影响报告 |
| **Pipeline 变更** | Pipeline 定义变更 | 受影响的输出表和依赖 Pipeline | 变更影响链 |
| **ETL 失败排查** | Pipeline 执行失败 | 从失败节点向上追溯到数据源 | 根因定位报告 |

### 1.6 外部依赖

| 依赖 | 类型 | 用途 | 容错策略 |
|------|------|------|----------|
| PostgreSQL | 必须 | `data_lineage` 表存储血缘记录 | 服务降级，返回缓存 |
| Git Repository | 可选 | SQL 脚本/ORM 代码扫描 | 跳过代码扫描 |
| ETL 工具 API | 可选 | 从 ETL 元数据提取血缘 | 仅依赖已配置的 ETL |
| Pipeline Engine | 可选 | 从 Pipeline 执行日志提取血缘 | 降级为仅 SQL 解析 |
| Prometheus | 可选 | 血缘变更的性能指标采集 | 不影响核心功能 |

### 1.7 权限模型

| 角色 | 读血缘图 | 触发采集 | 手动标注 | 查看影响分析 | 导出数据血缘 |
|------|---------|---------|---------|-------------|-------------|
| 管理员 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 数据工程师 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 运维工程师 | ✅ | ✅ | ❌ | ✅ | ✅ |
| 开发工程师 | ✅ | ❌ | ❌ | ✅ | ❌ |
| 只读用户 | ✅ | ❌ | ❌ | ❌ | ❌ |

权限通过已有的 RBAC 中间件 `requirePermission({ resource: 'data_lineage', action: 'read' | 'write' | 'execute' })` 实现。

---

## 二、数据库迁移设计

### 2.1 迁移 194：扩展 data_lineage 表

```sql
-- 194: Extend data_lineage with field-level lineage support

-- 新增字段级血缘列
ALTER TABLE data_lineage
  ADD COLUMN IF NOT EXISTS source_field   VARCHAR(200),          -- 源字段名
  ADD COLUMN IF NOT EXISTS target_field   VARCHAR(200),          -- 目标字段名
  ADD COLUMN IF NOT EXISTS lineage_graph  JSONB DEFAULT '{}',    -- 血缘图快照（DAG 序列化）
  ADD COLUMN IF NOT EXISTS transform_sql  TEXT,                  -- 转换逻辑的 SQL 表达式
  ADD COLUMN IF NOT EXISTS confidence     DECIMAL(3,2) DEFAULT 1.00,  -- 置信度 0.00-1.00
  ADD COLUMN IF NOT EXISTS source_type    VARCHAR(50) DEFAULT 'sql_parser',  -- 采集来源: sql_parser|etl_integration|code_scanner|manual
  ADD COLUMN IF NOT EXISTS version        INTEGER DEFAULT 1,     -- 血缘版本
  ADD COLUMN IF NOT EXISTS created_by     VARCHAR(100) NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by     VARCHAR(100) DEFAULT 'system';

-- 新增字段级索引
CREATE INDEX IF NOT EXISTS idx_data_lineage_source_field ON data_lineage(source_table, source_field);
CREATE INDEX IF NOT EXISTS idx_data_lineage_target_field ON data_lineage(target_table, target_field);
CREATE INDEX IF NOT EXISTS idx_data_lineage_source_type ON data_lineage(source_type);
CREATE INDEX IF NOT EXISTS idx_data_lineage_confidence ON data_lineage(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_data_lineage_version ON data_lineage(version DESC);

-- updated_at 触发器
CREATE OR REPLACE FUNCTION update_data_lineage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_data_lineage_updated_at
  BEFORE UPDATE ON data_lineage
  FOR EACH ROW
  EXECUTE FUNCTION update_data_lineage_updated_at();
```

### 2.2 迁移 195：新建血缘采集任务表

```sql
-- 195: Lineage collection jobs

CREATE TABLE IF NOT EXISTS lineage_collection_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_name          VARCHAR(200) NOT NULL,
  job_type          VARCHAR(50) NOT NULL,              -- sql_scan|etl_sync|code_scan|manual
  config            JSONB NOT NULL DEFAULT '{}',
  schedule          VARCHAR(50),
  status            VARCHAR(30) NOT NULL DEFAULT 'inactive',
  last_run_at       TIMESTAMPTZ,
  last_run_status   VARCHAR(30),
  last_record_count INTEGER DEFAULT 0,
  created_by        VARCHAR(100) NOT NULL,
  updated_by        VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_lineage_jobs_tenant ON lineage_collection_jobs(tenant_id);
CREATE INDEX idx_lineage_jobs_status ON lineage_collection_jobs(status);
CREATE INDEX idx_lineage_jobs_type ON lineage_collection_jobs(job_type);
```

### 2.3 迁移 196：新建血缘标注表（手动补充）

```sql
-- 196: Manual lineage annotations

CREATE TABLE IF NOT EXISTS lineage_annotations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_table      VARCHAR(200) NOT NULL,
  source_field      VARCHAR(200),
  target_table      VARCHAR(200) NOT NULL,
  target_field      VARCHAR(200),
  transform_logic   TEXT,
  description       TEXT,
  created_by        VARCHAR(100) NOT NULL,
  updated_by        VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_lineage_annotations_tenant ON lineage_annotations(tenant_id);
CREATE INDEX idx_lineage_annotations_source ON lineage_annotations(source_table, source_field);
CREATE INDEX idx_lineage_annotations_target ON lineage_annotations(target_table, target_field);
```

---

## 三、后端 API 设计

### 3.1 路由总览

在 `orion-platform-service/src/api/` 下新建 `data-lineage-routes.ts`，在 `routes.ts` 中注册。

```
/v1/lineage/*
  GET    /search                          血缘搜索
  GET    /graph                           获取完整血缘图
  GET    /graph/:tableId                  获取指定表的血缘图（上下游）
  GET    /fields/:tableId                 获取表字段级血缘
  GET    /fields/:tableId/:fieldId        获取指定字段的血缘链
  GET    /impact                          影响分析（批量）
  POST   /impact/analyze                  单次影响分析
  GET    /cycles                          循环依赖检测
  POST   /collect                         手动触发血缘采集
  GET    /collect/jobs                    采集任务列表
  POST   /collect/jobs                    创建采集任务
  GET    /collect/jobs/:jobId             采集任务详情
  DELETE /collect/jobs/:jobId             删除采集任务
  POST   /collect/jobs/:jobId/run         执行采集任务
  GET    /collect/jobs/:jobId/runs        采集任务执行历史
  GET    /audit                           血缘变更审计日志
  GET    /audit/:recordId                 单条血缘变更记录
  POST   /annotate                        手动标注血缘
  PUT    /annotate/:annotationId          更新标注
  DELETE /annotate/:annotationId          删除标注
  GET    /stats                           血缘统计概览
```

### 3.2 核心端点详细设计

#### 3.2.1 GET /v1/lineage/search — 血缘搜索

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 否 | 搜索关键词（匹配表名/字段名） |
| `sourceType` | string | 否 | 采集来源过滤: `sql_parser\|etl_integration\|code_scanner\|manual` |
| `minConfidence` | number | 否 | 最小置信度 0-1 |
| `direction` | string | 否 | 搜索方向: `upstream\|downstream\|both` |
| `page` | number | 否 | 页码，默认 1 |
| `pageSize` | number | 否 | 每页条数，默认 20 |

```jsonc
// Response
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid-1",
        "sourceTable": "users",
        "sourceField": "email",
        "targetTable": "user_dim",
        "targetField": "email_lower",
        "transformLogic": "LOWER(u.email)",
        "transformType": "map",
        "sourceType": "sql_parser",
        "confidence": 0.95,
        "version": 1,
        "recordedAt": "2026-05-22T10:00:00Z",
        "createdBy": "system"
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 3.2.2 GET /v1/lineage/graph/:tableId — 血缘图

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tableId` | string | 是 | 表名或表 ID（格式: `database.schema.table` 或 UUID） |
| `depth` | number | 否 | 追溯深度，默认 5，最大 20 |
| `direction` | string | 否 | `upstream\|downstream\|both`，默认 `both` |
| `level` | string | 否 | 血缘层级: `table\|field`，默认 `table` |

```jsonc
// Response
{
  "success": true,
  "data": {
    "graph": {
      "nodes": [
        { "id": "n1", "nodeType": "table", "database": "db_a", "schema": "public", "name": "users", "displayName": "users", "metadata": { "description": "用户主表" } },
        { "id": "n2", "nodeType": "table", "database": "db_b", "schema": "dw", "name": "user_dim", "displayName": "user_dim" },
        { "id": "n3", "nodeType": "table", "database": "db_c", "schema": "report", "name": "user_report", "displayName": "user_report" }
      ],
      "edges": [
        { "id": "e1", "fromNodeId": "n1", "toNodeId": "n2", "edgeType": "direct", "transformDescription": "直接映射", "confidence": 1.0, "recordedAt": "2026-05-22T10:00:00Z", "recordedBy": "sql_parser" },
        { "id": "e2", "fromNodeId": "n2", "toNodeId": "n3", "edgeType": "aggregate", "transformDescription": "聚合统计", "confidence": 0.9, "recordedAt": "2026-05-22T11:00:00Z", "recordedBy": "etl_integration" }
      ]
    },
    "hasCycle": false,
    "levels": 2,
    "upstreamCount": 1,
    "downstreamCount": 1,
    "capturedAt": "2026-05-22T12:00:00Z"
  }
}
```

#### 3.2.3 GET /v1/lineage/fields/:tableId/:fieldId — 字段级血缘

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tableId` | string | 是 | 表名 |
| `fieldId` | string | 是 | 字段名 |

```jsonc
// Response
{
  "success": true,
  "data": {
    "field": {
      "table": "user_dim",
      "field": "email_lower",
      "dataType": "varchar(255)",
      "nullable": false
    },
    "upstreamChain": [
      {
        "table": "users",
        "field": "email",
        "dataType": "varchar(255)",
        "transformLogic": "LOWER(u.email)",
        "transformType": "map",
        "database": "db_a",
        "confidence": 0.95
      }
    ],
    "downstreamChain": [
      {
        "table": "user_report",
        "field": "contact_email",
        "dataType": "varchar(255)",
        "transformLogic": "direct",
        "transformType": "direct",
        "database": "db_c",
        "confidence": 0.85
      }
    ],
    "capturedAt": "2026-05-22T12:00:00Z"
  }
}
```

#### 3.2.4 POST /v1/lineage/impact/analyze — 影响分析

```jsonc
// Request
{
  "targetTable": "users",
  "targetField": "status",       // 可选，不填则分析整表
  "changeType": "schema_change", // schema_change | data_quality_issue | delete | modify_transform
  "changeDescription": "删除 status 字段"
}

// Response
{
  "success": true,
  "data": {
    "targetTable": "users",
    "targetField": "status",
    "changeType": "schema_change",
    "upstreamNodes": [],
    "downstreamNodes": [
      { "id": "n1", "nodeType": "field", "table": "user_dim", "field": "status", "database": "db_b", "pipeline": "Pipeline A" },
      { "id": "n2", "nodeType": "field", "table": "user_report", "field": "status_filter", "database": "db_c", "pipeline": "Pipeline B" },
      { "id": "n3", "nodeType": "field", "table": "dashboard", "field": "user_stats", "database": "db_d", "pipeline": "Pipeline C" }
    ],
    "affectedPaths": [
      { "path": ["users.status", "user_dim.status", "user_report.status_filter"], "edgeCount": 2 },
      { "path": ["users.status", "user_dim.status", "dashboard.user_stats"], "edgeCount": 2 }
    ],
    "riskLevel": "high",
    "summary": {
      "upstreamCount": 0,
      "downstreamCount": 5,
      "totalAffectedTables": 3,
      "totalAffectedFields": 8,
      "criticalPipelines": ["Pipeline A", "Pipeline B"]
    }
  }
}
```

#### 3.2.5 GET /v1/lineage/cycles — 循环依赖检测

```jsonc
// Response
{
  "success": true,
  "data": {
    "hasCycle": true,
    "cycles": [
      {
        "cycleId": "cycle-1",
        "path": ["table_a → table_b → table_c → table_a"],
        "affectedFields": ["table_a.col1", "table_b.col2", "table_c.col3"],
        "severity": "critical",
        "description": "table_a.col1 → table_b.col2 → table_c.col3 → table_a.col1 形成循环依赖"
      }
    ],
    "totalCycles": 1,
    "checkedAt": "2026-05-22T12:00:00Z"
  }
}
```

#### 3.2.6 GET /v1/lineage/audit — 血缘变更审计日志

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `table` | string | 否 | 过滤表名 |
| `field` | string | 否 | 过滤字段名 |
| `action` | string | 否 | 操作类型: `created\|updated\|deleted\|annotated` |
| `sourceType` | string | 否 | 采集来源 |
| `startTime` | string | 否 | 起始时间 ISO 8601 |
| `endTime` | string | 否 | 结束时间 ISO 8601 |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页条数 |

```jsonc
// Response
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "audit-1",
        "action": "created",
        "sourceTable": "users",
        "sourceField": "email",
        "targetTable": "user_dim",
        "targetField": "email_lower",
        "sourceType": "sql_parser",
        "confidence": 0.95,
        "changedBy": "system",
        "changedAt": "2026-05-22T10:00:00Z",
        "changeReason": "SQL 解析自动提取"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 3.2.7 POST /v1/lineage/annotate — 手动标注血缘

```jsonc
// Request
{
  "sourceTable": "users",
  "sourceField": "email",
  "targetTable": "user_dim",
  "targetField": "email_lower",
  "transformLogic": "LOWER(email)",
  "description": "邮箱转小写用于统一存储"
}

// Response
{
  "success": true,
  "data": {
    "id": "annotation-uuid",
    "sourceTable": "users",
    "sourceField": "email",
    "targetTable": "user_dim",
    "targetField": "email_lower",
    "transformLogic": "LOWER(email)",
    "description": "邮箱转小写用于统一存储",
    "createdBy": "user@example.com",
    "createdAt": "2026-05-22T10:00:00Z"
  }
}
```

#### 3.2.8 GET /v1/lineage/stats — 血缘统计概览

```jsonc
// Response
{
  "success": true,
  "data": {
    "totalTables": 120,
    "totalFields": 1580,
    "totalLineageRecords": 3420,
    "tableLevelRelations": 280,
    "fieldLevelRelations": 3140,
    "bySourceType": {
      "sql_parser": 2100,
      "etl_integration": 800,
      "code_scanner": 320,
      "manual": 200
    },
    "averageConfidence": 0.89,
    "activeCollectionJobs": 5,
    "hasCycle": false,
    "lastCollectedAt": "2026-05-22T10:00:00Z"
  }
}
```

---

## 四、后端服务层设计

### 4.1 文件结构

```
orion-platform-service/src/
  api/
    data-lineage-routes.ts              # 路由注册
    controllers/
      DataLineageController.ts          # API 控制器
  services/
    data-lineage/
      DataLineageService.ts             # 已有，升级为 PostgreSQL Repository 模式
      SQLLineageParserService.ts        # SQL 解析（新增）
      FieldLineageExtractorService.ts   # 字段血缘提取（新增）
      LineageGraphBuilderService.ts     # 血缘图构建（新增）
      ImpactAnalyzerService.ts          # 影响分析（新增）
      LineageScannerService.ts          # 数据源扫描（新增）
      CycleDetectorService.ts           # 循环依赖检测（新增）
      LineageCollectionJobService.ts    # 采集任务管理（新增）
      LineageAuditService.ts            # 审计日志（新增）
    repositories/
      DataLineageRepository.ts          # 数据访问层（新增）
      LineageAnnotationRepository.ts    # 标注数据访问层（新增）
      LineageCollectionJobRepository.ts # 采集任务数据访问层（新增）
  models/
    DataLineage.ts                      # 数据模型（新增）
    LineageAnnotation.ts                # 标注模型（新增）
    LineageCollectionJob.ts             # 采集任务模型（新增）
```

### 4.2 DataLineageService 核心方法升级

```typescript
// 原有方法保留，新增以下方法

interface FieldLineageQuery {
  table: string;
  field?: string;
  direction?: 'upstream' | 'downstream' | 'both';
  depth?: number;
}

interface ImpactAnalysisQuery {
  targetTable: string;
  targetField?: string;
  changeType: 'schema_change' | 'data_quality_issue' | 'delete' | 'modify_transform';
  changeDescription?: string;
}

class DataLineageService {
  // 已有方法（升级从 Map 到 PostgreSQL）
  async recordLineage(...): Promise<LineageRecord>;
  getLineage(pipelineId: string): DataLineageGraph | null;
  getLineageHistory(pipelineId: string, limit: number): LineageRecord[];
  getUpstream(nodeId: string): LineageNode[];
  getDownstream(nodeId: string): LineageNode[];
  async getImpactAnalysis(nodeId: string): Promise<ImpactAnalysisResult>;
  getAllLineage(tenantId: string): DataLineageGraph;

  // 新增方法
  async searchLineage(query: SearchQuery): Promise<PaginatedResult<LineageRecord>>;
  async getTableGraph(tableId: string, options: GraphOptions): Promise<LineageGraph>;
  async getFieldLineage(table: string, field: string): Promise<FieldLineageChain>;
  async analyzeImpact(query: ImpactAnalysisQuery): Promise<ImpactAnalysisReport>;
  async detectCycles(): Promise<CycleDetectionResult>;
  async createCollectionJob(job: CreateCollectionJobInput): Promise<LineageCollectionJob>;
  async runCollectionJob(jobId: string): Promise<CollectionJobRun>;
  async createAnnotation(annotation: CreateAnnotationInput): Promise<LineageAnnotation>;
  async getStats(): Promise<LineageStats>;
}
```

---

## 五、前端页面交互设计

### 5.1 页面清单与路由

| 页面 | 路由路径 | 文件名 | 功能 |
|------|----------|--------|------|
| 血缘搜索 | `/lineage/search` | `pages/lineage-svc/LineageSearch/index.tsx` | 搜索血缘记录、过滤、分页 |
| 血缘图可视化 | `/lineage/graph/:tableId` | `pages/lineage-svc/LineageGraph/index.tsx` | DAG 有向无环图可视化 |
| 字段级血缘 | `/lineage/fields/:tableId/:fieldId` | `pages/lineage-svc/FieldLineage/index.tsx` | 字段血缘链追踪 |
| 影响分析 | `/lineage/impact` | `pages/lineage-svc/ImpactAnalysis/index.tsx` | 变更影响评估 |
| 血缘审计 | `/lineage/audit` | `pages/lineage-svc/LineageAudit/index.tsx` | 血缘变更审计日志 |

### 5.2 API Client

新建 `orion-frontend/src/api/data-lineage.ts`：

```typescript
/**
 * Data Lineage API
 * 数据血缘搜索、图查询、字段血缘、影响分析、审计
 */
import apiClient from './client';

export interface LineageNode {
  id: string;
  nodeType: 'table' | 'field' | 'pipeline' | 'model';
  database?: string;
  schema?: string;
  name: string;
  displayName: string;
  metadata?: Record<string, unknown>;
}

export interface LineageEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: 'direct' | 'transform' | 'join' | 'aggregate' | 'filter' | 'map';
  transformDescription?: string;
  confidence: number;
  recordedAt: string;
  recordedBy: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  hasCycle: boolean;
  levels: number;
  capturedAt: string;
}

export interface LineageSearchResult {
  id: string;
  sourceTable: string;
  sourceField?: string;
  targetTable: string;
  targetField?: string;
  transformLogic?: string;
  transformType: string;
  sourceType: string;
  confidence: number;
  version: number;
  recordedAt: string;
  createdBy: string;
}

export interface ImpactAnalysisReport {
  targetTable: string;
  targetField?: string;
  changeType: string;
  upstreamNodes: LineageNode[];
  downstreamNodes: LineageNode[];
  affectedPaths: Array<{ path: string[]; edgeCount: number }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: {
    upstreamCount: number;
    downstreamCount: number;
    totalAffectedTables: number;
    totalAffectedFields: number;
    criticalPipelines: string[];
  };
}

export const lineageApi = {
  search: async (params?: {
    keyword?: string;
    sourceType?: string;
    minConfidence?: number;
    direction?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const response = await apiClient.get('/api/v1/lineage/search', { params });
    return response.data as { results: LineageSearchResult[]; total: number; page: number; pageSize: number };
  },

  getGraph: async (tableId: string, options?: { depth?: number; direction?: string; level?: string }) => {
    const response = await apiClient.get(`/api/v1/lineage/graph/${tableId}`, { params: options });
    return response.data as { graph: LineageGraph; hasCycle: boolean; levels: number; upstreamCount: number; downstreamCount: number; capturedAt: string };
  },

  getFieldLineage: async (tableId: string, fieldId: string) => {
    const response = await apiClient.get(`/api/v1/lineage/fields/${tableId}/${fieldId}`);
    return response.data as {
      field: { table: string; field: string; dataType: string; nullable: boolean };
      upstreamChain: Array<{ table: string; field: string; dataType: string; transformLogic: string; transformType: string; database: string; confidence: number }>;
      downstreamChain: Array<{ table: string; field: string; dataType: string; transformLogic: string; transformType: string; database: string; confidence: number }>;
      capturedAt: string;
    };
  },

  analyzeImpact: async (data: {
    targetTable: string;
    targetField?: string;
    changeType: string;
    changeDescription?: string;
  }) => {
    const response = await apiClient.post('/api/v1/lineage/impact/analyze', data);
    return response.data as ImpactAnalysisReport;
  },

  detectCycles: async () => {
    const response = await apiClient.get('/api/v1/lineage/cycles');
    return response.data as { hasCycle: boolean; cycles: Array<{ cycleId: string; path: string[]; affectedFields: string[]; severity: string; description: string }>; totalCycles: number; checkedAt: string };
  },

  getAudit: async (params?: {
    table?: string;
    field?: string;
    action?: string;
    sourceType?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const response = await apiClient.get('/api/v1/lineage/audit', { params });
    return response.data as { records: Array<{ id: string; action: string; sourceTable: string; sourceField?: string; targetTable: string; targetField?: string; sourceType: string; confidence: number; changedBy: string; changedAt: string; changeReason: string }>; total: number; page: number; pageSize: number };
  },

  annotate: async (data: {
    sourceTable: string;
    sourceField?: string;
    targetTable: string;
    targetField?: string;
    transformLogic?: string;
    description?: string;
  }) => {
    const response = await apiClient.post('/api/v1/lineage/annotate', data);
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/api/v1/lineage/stats');
    return response.data;
  },
};

export default lineageApi;
```

### 5.3 页面 1：血缘搜索（`/lineage/search`）

```tsx
/**
 * 血缘搜索页面
 * /lineage/search
 * 功能：搜索血缘记录、过滤采集来源/置信度、分页浏览
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  TableOutlined,
  FieldBinaryOutlined,
  ShareAltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { lineageApi, type LineageSearchResult } from '@/api/data-lineage';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

const sourceTypeOptions = [
  { value: 'sql_parser', label: 'SQL 解析', color: 'blue' },
  { value: 'etl_integration', label: 'ETL 集成', color: 'green' },
  { value: 'code_scanner', label: '代码扫描', color: 'orange' },
  { value: 'manual', label: '手动标注', color: 'purple' },
];

const LineageSearch: React.FC = () => {
  const [results, setResults] = useState<LineageSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourceType, setSourceType] = useState<string>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lineageApi.search({
        keyword: searchKeyword || undefined,
        sourceType,
        page,
        pageSize,
      });
      setResults(data.results);
      setTotal(data.total);
    } catch (error: unknown) {
      message.error(`搜索失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, sourceType, page, pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await lineageApi.getStats();
      setStats(data);
    } catch {
      // 统计加载失败不影响搜索
    }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const columns = [
    {
      title: '源表',
      dataIndex: 'sourceTable',
      key: 'sourceTable',
      width: 160,
      render: (v: string, record: LineageSearchResult) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          {record.sourceField && <Text type="secondary" style={{ fontSize: 12 }}>{record.sourceField}</Text>}
        </Space>
      ),
    },
    {
      title: '目标表',
      dataIndex: 'targetTable',
      key: 'targetTable',
      width: 160,
      render: (v: string, record: LineageSearchResult) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          {record.targetField && <Text type="secondary" style={{ fontSize: 12 }}>{record.targetField}</Text>}
        </Space>
      ),
    },
    {
      title: '转换类型',
      dataIndex: 'transformType',
      key: 'transformType',
      width: 100,
      render: (v: string) => {
        const colorMap: Record<string, string> = { direct: 'blue', transform: 'orange', join: 'purple', aggregate: 'cyan', filter: 'green', map: 'geekblue' };
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
      },
    },
    {
      title: '转换逻辑',
      dataIndex: 'transformLogic',
      key: 'transformLogic',
      ellipsis: { showTitle: true },
      width: 240,
      render: (v: string) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">直接映射</Text>,
    },
    {
      title: '采集来源',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 120,
      render: (v: string) => {
        const opt = sourceTypeOptions.find(o => o.value === v);
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : <Tag>{v}</Tag>;
      },
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (v: number) => {
        const color = v >= 0.9 ? colors.success[500] : v >= 0.7 ? colors.warning[500] : colors.error[500];
        return <Text strong style={{ color }}>{(v * 100).toFixed(0)}%</Text>;
      },
    },
    {
      title: '记录时间',
      dataIndex: 'recordedAt',
      key: 'recordedAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <ShareAltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据血缘
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: spacing.md, display: 'block' }}>
        搜索和浏览表级/字段级数据血缘关系
      </Text>

      {/* 统计卡片 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Statistic title="表级血缘" value={stats.tableLevelRelations ?? 0} prefix={<TableOutlined style={{ color: colors.primary[500] }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Statistic title="字段级血缘" value={stats.fieldLevelRelations ?? 0} prefix={<FieldBinaryOutlined style={{ color: colors.primary[500] }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Statistic title="平均置信度" value={(stats.averageConfidence ?? 0) * 100} suffix="%" valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Statistic title="活跃采集任务" value={stats.activeCollectionJobs ?? 0} prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />} />
          </Card>
        </Col>
      </Row>

      {/* 搜索过滤 */}
      <Card style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Input
              placeholder="搜索表名/字段名..."
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              onPressEnter={fetchResults}
              style={{ width: 300, borderRadius: componentRadius.input }}
              allowClear
            />
            <Select
              placeholder="采集来源"
              allowClear
              value={sourceType}
              onChange={setSourceType}
              style={{ width: 150 }}
              options={sourceTypeOptions.map(o => ({ value: o.value, label: o.label }))}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchResults} loading={loading} style={{ borderRadius: componentRadius.button.md }}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchResults} loading={loading} style={{ borderRadius: componentRadius.button.md }}>
              重置
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 搜索结果表格 */}
      <Card title="血缘记录" style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Table
          columns={columns}
          dataSource={results}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>
    </div>
  );
};

export default LineageSearch;
```

### 5.4 页面 2：血缘图可视化（`/lineage/graph/:tableId`）

```tsx
/**
 * 血缘图可视化页面
 * /lineage/graph/:tableId
 * 功能：DAG 有向无环图可视化、节点点击高亮、上下游追溯、字段级钻取
 *
 * 技术方案：使用 @antv/g6 或 react-flow 绘制血缘图
 * 本示例使用 react-flow 方案（轻量、React 友好）
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Drawer,
  Descriptions,
  message,
  Spin,
  Segmented,
} from 'antd';
import {
  ShareAltOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FieldBinaryOutlined,
  TableOutlined,
  ReloadOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MarkerType,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { lineageApi, type LineageNode, type LineageEdge, type LineageGraph } from '@/api/data-lineage';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

// ============================================================
// 自定义节点：表节点
// ============================================================
const TableNode: React.FC<{ data: { label: string; type: string; onClick: (id: string) => void }; id: string }> = ({ data, id }) => (
  <div
    onClick={() => data.onClick(id)}
    style={{
      padding: '12px 16px',
      borderRadius: componentRadius.card,
      background: '#fff',
      border: `1px solid ${data.type === 'source' ? colors.success[500] : data.type === 'target' ? colors.error[500] : colors.primary[500]}`,
      borderLeft: `3px solid ${data.type === 'source' ? colors.success[500] : data.type === 'target' ? colors.error[500] : colors.primary[500]}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      cursor: 'pointer',
      minWidth: 140,
    }}
  >
    <Handle type="target" position={Position.Left} style={{ background: colors.neutral[500] }} />
    <Space direction="vertical" size={2}>
      <Text strong style={{ fontSize: 13 }}>{data.label}</Text>
      <Tag style={{ fontSize: 11, margin: 0 }}>{data.type}</Tag>
    </Space>
    <Handle type="source" position={Position.Right} style={{ background: colors.neutral[500] }} />
  </div>
);

// ============================================================
// 自定义节点：字段节点
// ============================================================
const FieldNode: React.FC<{ data: { label: string; table: string; transform: string }; id: string }> = ({ data }) => (
  <div
    style={{
      padding: '8px 12px',
      borderRadius: componentRadius.tag,
      background: colors.light.bg.secondary,
      border: `1px solid ${colors.neutral[200]}`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      minWidth: 120,
    }}
  >
    <Handle type="target" position={Position.Left} style={{ background: colors.neutral[500], width: 8, height: 8 }} />
    <Space direction="vertical" size={2}>
      <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
      <Text type="secondary" style={{ fontSize: 11 }}>{data.table}</Text>
      {data.transform && <Text code style={{ fontSize: 10 }}>{data.transform}</Text>}
    </Space>
    <Handle type="source" position={Position.Right} style={{ background: colors.neutral[500], width: 8, height: 8 }} />
  </div>
);

const nodeTypes = { tableNode: TableNode, fieldNode: FieldNode };

const riskConfig: Record<string, { color: string; label: string }> = {
  low: { color: colors.success[500], label: '低' },
  medium: { color: colors.warning[500], label: '中' },
  high: { color: colors.error[500], label: '高' },
  critical: { color: colors.purple[500], label: '严重' },
};

const LineageGraphPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [depth, setDepth] = useState(5);
  const [direction, setDirection] = useState<'upstream' | 'downstream' | 'both'>('both');
  const [level, setLevel] = useState<'table' | 'field'>('table');
  const [graphData, setGraphData] = useState<LineageGraph | null>(null);
  const [upstreamCount, setUpstreamCount] = useState(0);
  const [downstreamCount, setDownstreamCount] = useState(0);
  const [hasCycle, setHasCycle] = useState(false);

  const fetchGraph = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const data = await lineageApi.getGraph(tableId, { depth, direction, level });
      setGraphData(data.graph);
      setHasCycle(data.hasCycle);
      setUpstreamCount(data.upstreamCount);
      setDownstreamCount(data.downstreamCount);
    } catch (error: unknown) {
      message.error(`加载血缘图失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [tableId, depth, direction, level]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // 将后端 Graph 数据转换为 ReactFlow 节点/边
  useEffect(() => {
    if (!graphData) return;

    const flowNodes: Node[] = graphData.nodes.map((node, idx) => {
      const isSource = !graphData.edges.some(e => e.toNodeId === node.id);
      const isTarget = !graphData.edges.some(e => e.fromNodeId === node.id);
      const type = isSource ? 'source' : isTarget ? 'target' : 'intermediate';

      if (level === 'field') {
        return {
          id: node.id,
          type: 'fieldNode',
          position: { x: idx * 200, y: 100 },
          data: {
            label: node.name,
            table: `${node.database}.${node.schema}`,
            transform: node.metadata?.transformLogic as string,
            onClick: (id: string) => handleNodeClick(node),
          },
        };
      }

      return {
        id: node.id,
        type: 'tableNode',
        position: { x: idx * 200, y: 100 },
        data: {
          label: node.displayName,
          type,
          onClick: (id: string) => handleNodeClick(node),
        },
      };
    });

    const flowEdges: Edge[] = graphData.edges.map(edge => ({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: colors.neutral[400] },
      style: { stroke: colors.neutral[400], strokeWidth: 2 },
      label: edge.transformDescription,
      labelStyle: { fill: colors.neutral[500], fontSize: 11 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, level]);

  const handleNodeClick = useCallback((node: LineageNode) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  // 影响分析
  const handleImpactAnalysis = useCallback(async () => {
    if (!selectedNode) return;
    try {
      const report = await lineageApi.analyzeImpact({
        targetTable: selectedNode.name,
        changeType: 'schema_change',
        changeDescription: `分析 ${selectedNode.name} 的变更影响`,
      });
      message.success(`影响分析完成：影响 ${report.summary.downstreamCount} 个下游节点`);
    } catch (error: unknown) {
      message.error(`影响分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [selectedNode]);

  // 钻取到字段级血缘
  const handleDrillDown = useCallback(() => {
    if (!selectedNode) return;
    navigate(`/lineage/fields/${selectedNode.name}`);
  }, [selectedNode, navigate]);

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <ShareAltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        血缘图可视化
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: spacing.md, display: 'block' }}>
        表 ID: {tableId} — 可视化展示数据血缘的有向无环图 (DAG)
      </Text>

      {/* 控制栏 */}
      <Card style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Space>
          <Segmented
            value={level}
            onChange={v => setLevel(v as 'table' | 'field')}
            options={[
              { label: <><TableOutlined /> 表级</>, value: 'table' },
              { label: <><FieldBinaryOutlined /> 字段级</>, value: 'field' },
            ]}
          />
          <Segmented
            value={direction}
            onChange={v => setDirection(v as 'upstream' | 'downstream' | 'both')}
            options={[
              { label: <><ArrowUpOutlined /> 上游</>, value: 'upstream' },
              { label: <>双向</>, value: 'both' },
              { label: <><ArrowDownOutlined /> 下游</>, value: 'downstream' },
            ]}
          />
          <Select
            value={depth}
            onChange={setDepth}
            style={{ width: 120 }}
            options={[
              { label: '深度 3', value: 3 },
              { label: '深度 5', value: 5 },
              { label: '深度 10', value: 10 },
              { label: '深度 20', value: 20 },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchGraph} loading={loading} style={{ borderRadius: componentRadius.button.md }}>
            刷新
          </Button>
          {hasCycle && (
            <Tag color={colors.error[500]} icon={<ExclamationCircleOutlined />}>
              检测到循环依赖
            </Tag>
          )}
        </Space>
      </Card>

      {/* 血缘图统计 */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Statistic title="上游表" value={upstreamCount} prefix={<ArrowUpOutlined style={{ color: colors.success[500] }} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Statistic title="下游表" value={downstreamCount} prefix={<ArrowDownOutlined style={{ color: colors.error[500] }} />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Statistic title="血缘层级" value={`${graphData?.levels ?? 0} 层`} />
          </Card>
        </Col>
      </Row>

      {/* DAG 图 */}
      <Card
        title="血缘图"
        extra={
          <Space>
            <Button size="small" onClick={() => setLevel('table')} style={{ borderRadius: componentRadius.button.md }}>
              <TableOutlined /> 表级视图
            </Button>
            <Button size="small" onClick={() => setLevel('field')} style={{ borderRadius: componentRadius.button.md }}>
              <FieldBinaryOutlined /> 字段级视图
            </Button>
          </Space>
        }
        style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <div style={{ height: 600 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Spin size="large" />
            </div>
          ) : nodes.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
              <Text type="secondary">暂无血缘数据</Text>
              <Button type="primary" onClick={() => navigate('/lineage/search')} style={{ marginTop: spacing.sm, borderRadius: componentRadius.button.md }}>
                去搜索血缘
              </Button>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={2}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: colors.neutral[400] },
              }}
            >
              <Background color={colors.neutral[200]} gap={16} size={1} />
              <Controls />
            </ReactFlow>
          )}
        </div>
      </Card>

      {/* 节点详情 Drawer */}
      <Drawer
        title="节点详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        styles={{ body: { padding: spacing.md } }}
      >
        {selectedNode && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="节点类型">
                <Tag color={selectedNode.nodeType === 'table' ? 'blue' : 'green'}>{selectedNode.nodeType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="表名">{selectedNode.name}</Descriptions.Item>
              <Descriptions.Item label="数据库">{selectedNode.database || '-'}</Descriptions.Item>
              <Descriptions.Item label="Schema">{selectedNode.schema || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedNode.metadata?.description as string || '-'}</Descriptions.Item>
            </Descriptions>

            <Space direction="vertical" style={{ width: '100%', marginTop: spacing.md }}>
              <Button type="primary" block onClick={handleImpactAnalysis} style={{ borderRadius: componentRadius.button.md }}>
                <ExclamationCircleOutlined /> 影响分析
              </Button>
              {selectedNode.nodeType === 'table' && (
                <Button block onClick={handleDrillDown} style={{ borderRadius: componentRadius.button.md }}>
                  <FieldBinaryOutlined /> 查看字段血缘
                </Button>
              )}
              <Button block onClick={() => { setDrawerOpen(false); }} style={{ borderRadius: componentRadius.button.md }}>
                关闭
              </Button>
            </Space>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default LineageGraphPage;
```

### 5.5 页面 3：字段级血缘（`/lineage/fields/:tableId/:fieldId`）

```tsx
/**
 * 字段级血缘页面
 * /lineage/fields/:tableId/:fieldId
 * 功能：展示上游字段 → 转换规则 → 下游字段的完整血缘链
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Divider,
  Descriptions,
  message,
  Spin,
} from 'antd';
import {
  FieldBinaryOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { lineageApi } from '@/api/data-lineage';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

const FieldLineage: React.FC = () => {
  const { tableId, fieldId } = useParams<{ tableId: string; fieldId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    field: { table: string; field: string; dataType: string; nullable: boolean };
    upstreamChain: Array<{ table: string; field: string; dataType: string; transformLogic: string; transformType: string; database: string; confidence: number }>;
    downstreamChain: Array<{ table: string; field: string; dataType: string; transformLogic: string; transformType: string; database: string; confidence: number }>;
    capturedAt: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const result = await lineageApi.getFieldLineage(tableId, fieldId || '');
      setData(result);
    } catch (error: unknown) {
      message.error(`加载字段血缘失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [tableId, fieldId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, padding: 24 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">暂无数据</Text>
      </div>
    );
  }

  // 渲染字段节点卡片
  const renderFieldCard = (
    item: { table: string; field: string; dataType: string; transformLogic: string; transformType: string; database: string; confidence: number },
    direction: 'upstream' | 'downstream',
    idx: number
  ) => {
    const isHead = direction === 'upstream' ? idx === 0 : idx === 0;
    const borderLeftColor = direction === 'upstream' ? colors.success[500] : colors.error[500];

    return (
      <Card
        key={`${direction}-${idx}`}
        size="small"
        style={{
          borderRadius: componentRadius.card,
          borderLeft: `3px solid ${borderLeftColor}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          marginLeft: direction === 'upstream' ? idx * 24 : idx * 24,
        }}
      >
        <Space direction="vertical" size={4}>
          <Space>
            <Text strong>{item.table}.{item.field}</Text>
            <Tag color={direction === 'upstream' ? colors.success[500] : colors.error[500]}>
              {direction === 'upstream' ? '上游' : '下游'}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {item.database} · {item.dataType}
          </Text>
          {item.transformLogic && (
            <Text code style={{ fontSize: 12 }}>{item.transformLogic}</Text>
          )}
          <Text style={{ fontSize: 11 }}>
            置信度: <Text strong style={{ color: item.confidence >= 0.9 ? colors.success[500] : colors.warning[500] }}>
              {(item.confidence * 100).toFixed(0)}%
            </Text>
          </Text>
        </Space>
      </Card>
    );
  };

  // 渲染转换箭头
  const renderArrow = (direction: 'upstream' | 'downstream', idx: number, transformType: string) => (
    <div key={`arrow-${direction}-${idx}`} style={{ marginLeft: (idx + 1) * 24, textAlign: 'center', padding: '4px 0' }}>
      <ArrowRightOutlined style={{ color: colors.neutral[400], transform: direction === 'upstream' ? 'rotate(180deg)' : undefined }} />
      <Tag style={{ marginLeft: 8, fontSize: 11 }}>{transformType}</Tag>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <FieldBinaryOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        字段级血缘
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: spacing.md, display: 'block' }}>
        {data.field.table}.{data.field.field} — {data.field.dataType}
        {data.field.nullable ? ' (可空)' : ' (非空)'}
      </Text>

      <Space style={{ marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: componentRadius.button.md }}>
          刷新
        </Button>
        <Button icon={<SwapOutlined />} onClick={() => navigate(`/lineage/graph/${data.field.table}`)} style={{ borderRadius: componentRadius.button.md }}>
          查看表级血缘图
        </Button>
      </Space>

      <div style={{ display: 'flex', gap: spacing.md }}>
        {/* 上游血缘链 */}
        <Card
          title={<Space><ArrowUpOutlined style={{ color: colors.success[500] }} /> 上游血缘 ({data.upstreamChain.length})</Space>}
          style={{ flex: 1, borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {data.upstreamChain.length === 0 ? (
            <Text type="secondary">无上游依赖（源字段）</Text>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {[...data.upstreamChain].reverse().map((item, idx) => (
                <React.Fragment key={`up-${idx}`}>
                  {renderFieldCard(item, 'upstream', idx)}
                  {idx < data.upstreamChain.length - 1 && renderArrow('upstream', idx, item.transformType)}
                </React.Fragment>
              ))}
            </Space>
          )}
        </Card>

        {/* 当前字段 */}
        <Card
          style={{
            borderRadius: componentRadius.card,
            border: `2px solid ${colors.primary[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            minWidth: 200,
            textAlign: 'center',
          }}
        >
          <FieldBinaryOutlined style={{ fontSize: 32, color: colors.primary[500] }} />
          <div style={{ marginTop: 8 }}>
            <Text strong style={{ fontSize: 14 }}>{data.field.field}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>{data.field.table}</Text>
        </Card>

        {/* 下游血缘链 */}
        <Card
          title={<Space><ArrowDownOutlined style={{ color: colors.error[500] }} /> 下游血缘 ({data.downstreamChain.length})</Space>}
          style={{ flex: 1, borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {data.downstreamChain.length === 0 ? (
            <Text type="secondary">无下游依赖（末端字段）</Text>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {data.downstreamChain.map((item, idx) => (
                <React.Fragment key={`down-${idx}`}>
                  {renderFieldCard(item, 'downstream', idx)}
                  {idx < data.downstreamChain.length - 1 && renderArrow('downstream', idx, item.transformType)}
                </React.Fragment>
              ))}
            </Space>
          )}
        </Card>
      </div>
    </div>
  );
};

export default FieldLineage;
```

### 5.6 页面 4：影响分析（`/lineage/impact`）

```tsx
/**
 * 影响分析页面
 * /lineage/impact
 * 功能：选择目标表/字段、选择变更类型、分析影响范围、高亮受影响节点
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Space,
  Tag,
  Descriptions,
  Divider,
  message,
  Alert,
  Tree,
} from 'antd';
import {
  ExclamationCircleOutlined,
  ArrowRightOutlined,
  SearchOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { lineageApi, type ImpactAnalysisReport } from '@/api/data-lineage';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

const changeTypeOptions = [
  { value: 'schema_change', label: 'Schema 变更（字段增删改）' },
  { value: 'data_quality_issue', label: '数据质量问题' },
  { value: 'delete', label: '删除表/字段' },
  { value: 'modify_transform', label: '修改转换逻辑' },
];

const riskConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  low: { color: colors.success[500], label: '低', icon: <CheckCircleOutlined /> },
  medium: { color: colors.warning[500], label: '中', icon: <WarningOutlined /> },
  high: { color: colors.error[500], label: '高', icon: <ExclamationCircleOutlined /> },
  critical: { color: colors.purple[500], label: '严重', icon: <ExclamationCircleOutlined /> },
};

const ImpactAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImpactAnalysisReport | null>(null);

  const handleAnalyze = useCallback(async (values: { targetTable: string; targetField?: string; changeType: string; changeDescription: string }) => {
    setLoading(true);
    try {
      const result = await lineageApi.analyzeImpact(values);
      setReport(result);
      message.success('影响分析完成');
    } catch (error: unknown) {
      message.error(`影响分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // 构建影响树
  const buildImpactTree = useCallback((report: ImpactAnalysisReport) => {
    const treeData: Array<{ title: string; key: string; children?: Array<{ title: string; key: string }> }> = [];

    // 上游
    if (report.upstreamNodes.length > 0) {
      treeData.push({
        title: `上游依赖 (${report.summary.upstreamCount})`,
        key: 'upstream',
        children: report.upstreamNodes.map(n => ({
          title: `${n.database ? n.database + '.' : ''}${n.name}`,
          key: `up-${n.id}`,
        })),
      });
    }

    // 变更目标
    treeData.push({
      title: `${report.targetTable}${report.targetField ? `.${report.targetField}` : ''} [${report.changeType}]`,
      key: 'target',
    });

    // 下游
    if (report.downstreamNodes.length > 0) {
      treeData.push({
        title: `下游影响 (${report.summary.downstreamCount})`,
        key: 'downstream',
        children: report.downstreamNodes.map(n => ({
          title: `${n.database ? n.database + '.' : ''}${n.name}`,
          key: `down-${n.id}`,
        })),
      });
    }

    return treeData;
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <ExclamationCircleOutlined style={{ marginRight: 12, color: colors.error[500] }} />
        影响分析
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: spacing.md, display: 'block' }}>
        评估 Schema 变更、数据质量问题、删除操作对下游数据流的影响范围
      </Text>

      {/* 分析表单 */}
      <Card title="分析配置" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Form form={form} layout="vertical" onFinish={handleAnalyze} style={{ maxWidth: 700 }}>
          <Form.Item label="目标表" name="targetTable" rules={[{ required: true, message: '请输入目标表名' }]}>
            <Input placeholder="如: users" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item label="目标字段（可选）" name="targetField">
            <Input placeholder="如: status，不填则分析整表" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item label="变更类型" name="changeType" rules={[{ required: true, message: '请选择变更类型' }]}>
            <Select options={changeTypeOptions} placeholder="选择变更类型" />
          </Form.Item>
          <Form.Item label="变更描述" name="changeDescription">
            <Input.TextArea rows={2} placeholder="描述变更内容，如: 删除 status 字段" style={{ borderRadius: componentRadius.input }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SearchOutlined />} style={{ borderRadius: componentRadius.button.md }}>
              开始分析
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 分析结果 */}
      {report && (
        <>
          {/* 风险等级 */}
          {(() => {
            const risk = riskConfig[report.riskLevel];
            return (
              <Alert
                message={`风险等级: ${risk.label}`}
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>影响 {report.summary.totalAffectedTables} 张下游表，{report.summary.totalAffectedFields} 个字段，{report.summary.downstreamCount} 个下游节点</Text>
                    {report.summary.criticalPipelines.length > 0 && (
                      <Text>
                        影响关键 Pipeline: {report.summary.criticalPipelines.map(p => <Tag key={p} color={colors.error[500]}>{p}</Tag>)}
                      </Text>
                    )}
                  </Space>
                }
                type={report.riskLevel === 'high' || report.riskLevel === 'critical' ? 'error' : 'warning'}
                icon={risk.icon}
                style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}
              />
            );
          })()}

          {/* 影响树 */}
          <Card title="影响范围" style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Tree
              treeData={buildImpactTree(report)}
              defaultExpandAll
              selectable={false}
            />
          </Card>

          {/* 影响路径 */}
          <Card title="影响路径" style={{ borderRadius: componentRadius.card, marginTop: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {report.affectedPaths.map((path, idx) => (
                <div key={idx} style={{ padding: spacing.sm, background: colors.light.bg.secondary, borderRadius: componentRadius.tag }}>
                  <Text>
                    {path.path.map((node, i) => (
                      <span key={i}>
                        <Tag color={colors.primary[500]}>{node}</Tag>
                        {i < path.path.length - 1 && <ArrowRightOutlined style={{ margin: '0 4px', color: colors.neutral[400] }} />}
                      </span>
                    ))}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{path.edgeCount} 条边</Text>
                </div>
              ))}
            </Space>
          </Card>
        </>
      )}
    </div>
  );
};

export default ImpactAnalysis;
```

### 5.7 页面 5：血缘审计（`/lineage/audit`）

```tsx
/**
 * 血缘变更审计页面
 * /lineage/audit
 * 功能：查看血缘变更记录、过滤操作类型/时间范围、分页浏览
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Input,
  Select,
  Button,
  DatePicker,
  message,
} from 'antd';
import {
  AuditOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { lineageApi } from '@/api/data-lineage';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

const actionConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  created: { color: colors.success[500], icon: <PlusOutlined />, label: '新增' },
  updated: { color: colors.primary[500], icon: <EditOutlined />, label: '更新' },
  deleted: { color: colors.error[500], icon: <DeleteOutlined />, label: '删除' },
  annotated: { color: colors.purple[500], icon: <EditOutlined />, label: '标注' },
};

const LineageAudit: React.FC = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [tableFilter, setTableFilter] = useState<string>();
  const [actionFilter, setActionFilter] = useState<string>();
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lineageApi.getAudit({
        table: tableFilter,
        action: actionFilter,
        sourceType: sourceTypeFilter,
        page,
        pageSize,
      });
      setRecords(data.records);
      setTotal(data.total);
    } catch (error: unknown) {
      message.error(`加载审计日志失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [tableFilter, actionFilter, sourceTypeFilter, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (v: string) => {
        const cfg = actionConfig[v] || { color: 'default', icon: null, label: v };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: '源表/字段',
      key: 'source',
      width: 180,
      render: (_: unknown, record: { sourceTable: string; sourceField?: string }) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.sourceTable}</Text>
          {record.sourceField && <Text type="secondary" style={{ fontSize: 12 }}>{record.sourceField}</Text>}
        </Space>
      ),
    },
    {
      title: '目标表/字段',
      key: 'target',
      width: 180,
      render: (_: unknown, record: { targetTable: string; targetField?: string }) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.targetTable}</Text>
          {record.targetField && <Text type="secondary" style={{ fontSize: 12 }}>{record.targetField}</Text>}
        </Space>
      ),
    },
    {
      title: '采集来源',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 120,
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          sql_parser: { color: 'blue', label: 'SQL 解析' },
          etl_integration: { color: 'green', label: 'ETL 集成' },
          code_scanner: { color: 'orange', label: '代码扫描' },
          manual: { color: 'purple', label: '手动标注' },
        };
        const cfg = map[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 90,
      render: (v: number) => <Text strong style={{ color: v >= 0.9 ? colors.success[500] : v >= 0.7 ? colors.warning[500] : colors.error[500] }}>{(v * 100).toFixed(0)}%</Text>,
    },
    {
      title: '操作人',
      dataIndex: 'changedBy',
      key: 'changedBy',
      width: 140,
    },
    {
      title: '变更时间',
      dataIndex: 'changedAt',
      key: 'changedAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '变更原因',
      dataIndex: 'changeReason',
      key: 'changeReason',
      ellipsis: { showTitle: true },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <AuditOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        血缘变更审计
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14, marginBottom: spacing.md, display: 'block' }}>
        追踪数据血缘记录的创建、更新、删除和手动标注历史
      </Text>

      {/* 过滤栏 */}
      <Card style={{ borderRadius: componentRadius.card, marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Space>
          <Input
            placeholder="过滤表名..."
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value)}
            onPressEnter={fetchData}
            style={{ width: 200, borderRadius: componentRadius.input }}
            allowClear
          />
          <Select
            placeholder="操作类型"
            allowClear
            value={actionFilter}
            onChange={setActionFilter}
            style={{ width: 130 }}
            options={Object.entries(actionConfig).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            placeholder="采集来源"
            allowClear
            value={sourceTypeFilter}
            onChange={setSourceTypeFilter}
            style={{ width: 150 }}
            options={[
              { value: 'sql_parser', label: 'SQL 解析' },
              { value: 'etl_integration', label: 'ETL 集成' },
              { value: 'code_scanner', label: '代码扫描' },
              { value: 'manual', label: '手动标注' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData} loading={loading} style={{ borderRadius: componentRadius.button.md }}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ borderRadius: componentRadius.button.md }}>
            重置
          </Button>
        </Space>
      </Card>

      {/* 审计日志表格 */}
      <Card style={{ borderRadius: componentRadius.card, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>
    </div>
  );
};

export default LineageAudit;
```

### 5.8 路由注册

在 `orion-frontend/src/router/routes.tsx` 中添加：

```tsx
{
  path: '/lineage',
  children: [
    {
      path: 'search',
      element: React.lazy(() => import('@/pages/lineage-svc/LineageSearch')),
    },
    {
      path: 'graph/:tableId',
      element: React.lazy(() => import('@/pages/lineage-svc/LineageGraph')),
    },
    {
      path: 'fields/:tableId/:fieldId?',
      element: React.lazy(() => import('@/pages/lineage-svc/FieldLineage')),
    },
    {
      path: 'impact',
      element: React.lazy(() => import('@/pages/lineage-svc/ImpactAnalysis')),
    },
    {
      path: 'audit',
      element: React.lazy(() => import('@/pages/lineage-svc/LineageAudit')),
    },
  ],
},
```

---

## 六、验收标准

### 6.1 后端验收标准

| 编号 | 验收项 | 验收方法 | 预期结果 |
|------|--------|----------|----------|
| BE-1 | 数据库迁移执行 | 运行迁移 194/195/196 | `data_lineage` 表新增 9 列；`lineage_collection_jobs` 和 `lineage_annotations` 表创建成功 |
| BE-2 | 血缘搜索 API | `GET /v1/lineage/search?keyword=users` | 返回包含 `users` 表的血缘记录，分页正确 |
| BE-3 | 血缘图 API | `GET /v1/lineage/graph/users` | 返回 nodes + edges 构成的 DAG，hasCycle 字段正确 |
| BE-4 | 字段级血缘 API | `GET /v1/lineage/fields/users/email` | 返回 upstreamChain 和 downstreamChain，包含 transformLogic |
| BE-5 | 影响分析 API | `POST /v1/lineage/impact/analyze` 传入删除变更 | 返回 riskLevel、downstreamNodes、affectedPaths |
| BE-6 | 循环依赖检测 | `GET /v1/lineage/cycles` | 有环时返回 cyclePath，无环时 hasCycle=false |
| BE-7 | 手动标注 API | `POST /v1/lineage/annotate` | 标注写入 `lineage_annotations` 表，可查询 |
| BE-8 | 审计日志 API | `GET /v1/lineage/audit` | 返回血缘变更记录，支持过滤和分页 |
| BE-9 | 统计概览 API | `GET /v1/lineage/stats` | 返回表级/字段级血缘数量、平均置信度等 |
| BE-10 | SQL 解析能力 | 输入包含 JOIN/SELECT/LOWER 的 SQL | 正确提取字段级血缘关系，transform_type 和 transform_logic 正确 |
| BE-11 | 字段级血缘存储 | 迁移 194 执行后写入一条字段级血缘 | `source_field` 和 `target_field` 列有值，`lineage_graph` JSONB 存储 DAG 快照 |
| BE-12 | 租户隔离 | 不同租户的 lineage 查询 | 仅返回当前租户的血缘数据，RLS 策略生效 |
| BE-13 | 权限控制 | 只读用户调用 POST 端点 | 返回 403 Forbidden |

### 6.2 前端验收标准

| 编号 | 验收项 | 验收方法 | 预期结果 |
|------|--------|----------|----------|
| FE-1 | 页面标题规范 | 检查 5 个页面的 `<Title level={2}>` | 使用 Design Token 颜色，带图标，有副标题 |
| FE-2 | 血缘搜索页面 | 访问 `/lineage/search`，输入关键词搜索 | 显示统计卡片、搜索过滤栏、结果表格（含分页） |
| FE-3 | 血缘图可视化 | 访问 `/lineage/graph/users` | ReactFlow 渲染 DAG 图，节点可点击，边有方向箭头 |
| FE-4 | 节点点击交互 | 点击血缘图中的表节点 | 右侧 Drawer 展示节点详情，包含影响分析按钮和字段血缘跳转按钮 |
| FE-5 | 字段级血缘 | 访问 `/lineage/fields/users/email` | 展示上游血缘链 → 当前字段 → 下游血缘链，转换规则可见 |
| FE-6 | 影响分析 | 访问 `/lineage/impact`，提交分析表单 | 显示风险等级 Alert、影响树 Tree、影响路径列表 |
| FE-7 | 血缘审计 | 访问 `/lineage/audit` | 显示操作类型 Tag（新增/更新/删除/标注），支持过滤和分页 |
| FE-8 | 空状态引导 | 搜索无结果 / 图无数据 | 显示 `<Empty>` 组件 + 引导按钮（如"去搜索血缘"） |
| FE-9 | Loading 状态 | 所有异步操作 | 按钮/表格显示 loading，防止重复点击 |
| FE-10 | 错误提示 | 模拟 API 失败 | `message.error` 显示具体错误信息 |
| FE-11 | Design Token 使用 | 检查所有 .tsx 文件 | 无硬编码色值（`#3370E6` 等），全部使用 `colors.*` token |
| FE-12 | 圆角规范 | 检查 Card/Button/Input | 使用 `componentRadius.card` / `componentRadius.button.md` / `componentRadius.input` |
| FE-13 | 间距规范 | 检查所有 margin/padding | 遵循 4px 网格（4/8/12/16/24），不使用 13/17 等值 |
| FE-14 | 响应式适配 | 浏览器窗口缩至 768px | 表格隐藏次要列，过滤栏自动换行 |
| FE-15 | 路由注册 | 检查 `routes.tsx` | 5 个子路由全部注册，lazy loading 正确 |

### 6.3 集成验收标准

| 编号 | 验收项 | 验收方法 | 预期结果 |
|------|--------|----------|----------|
| INT-1 | 数据管道 → 血缘集成 | 执行一条 Data Pipeline | 自动生成管道级血缘记录到 `data_lineage` 表 |
| INT-2 | SQL 解析 → 字段血缘 | Pipeline 中包含 SQL transform | 自动解析 SQL 并生成字段级血缘记录 |
| INT-3 | 前端 → 后端联调 | 在血缘搜索页搜索 | 前端调用后端 API，数据正确渲染 |
| INT-4 | 血缘图 → 字段级钻取 | 血缘图中点击表节点 → 查看字段血缘 | 路由跳转 `/lineage/fields/:tableId`，数据正确加载 |
| INT-5 | 影响分析 → 变更预防 | 在影响分析中评估删除操作 | 高风险变更展示清晰的下游影响链 |

---

## 七、实施路线图

| Phase | 内容 | 预估工时 | 依赖 |
|-------|------|----------|------|
| **Phase 1** | 数据库迁移 194/195/196 | 0.5 天 | 无 |
| **Phase 2** | 后端服务层：Repository + DataLineageService 升级 | 2 天 | Phase 1 |
| **Phase 3** | 后端服务层：SQLLineageParser + FieldLineageExtractor + GraphBuilder | 3 天 | Phase 2 |
| **Phase 4** | 后端服务层：ImpactAnalyzer + CycleDetector + AuditService | 2 天 | Phase 3 |
| **Phase 5** | 后端 API：data-lineage-routes.ts + DataLineageController | 2 天 | Phase 2-4 |
| **Phase 6** | 前端 API Client + 路由注册 | 0.5 天 | Phase 5 |
| **Phase 7** | 前端页面：搜索 + 审计（基础 CRUD） | 2 天 | Phase 6 |
| **Phase 8** | 前端页面：血缘图可视化 + 字段级血缘 | 3 天 | Phase 7 |
| **Phase 9** | 前端页面：影响分析 | 1.5 天 | Phase 7 |
| **Phase 10** | 集成测试 + 端到端验证 | 1 天 | Phase 8-9 |
| **合计** | | **17.5 天**（约 3.5 人周） | |

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SQL 解析复杂度高 | 无法处理嵌套子查询/CTE/window function | 先支持标准 SELECT/FROM/JOIN，复杂 SQL 标记低置信度，后续迭代增强 |
| 血缘图数据量爆炸 | 大图渲染性能差 | 分页加载 + depth 限制 + 前端虚拟滚动 |
| 多数据源血缘合并冲突 | 同一血缘关系被多个采集源记录 | 使用 confidence 字段区分，前端展示最高置信度版本 |
| 循环依赖导致无限追溯 | 上游/下游查询死循环 | 设置最大 depth 限制 + CycleDetector 前置检测 |
| 前端 DAG 可视化性能 | 节点数 >200 时 ReactFlow 渲染慢 | 节点数 >200 时切换为简化列表模式，提示用户缩小范围 |
