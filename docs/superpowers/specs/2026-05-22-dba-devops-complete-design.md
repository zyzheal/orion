# 数据库 DevOps 模块 — 完整功能设计

> 版本: 1.0
> 日期: 2026-05-22
> 模块: `dba_slow_queries`, `dba_index_analysis`, `dba_schema_changes`
> 迁移编号: 192
> 定位: 基础设施管理 — 数据库 DevOps（DBA 仪表盘 / 慢 SQL / 索引优化 / Schema 变更）

---

## 一、业务闭环

```
SQL 采集 → 慢查询分析 → 索引优化建议 → Schema 变更管理 → 效果验证
   │            │              │              │              │
   │            ▼              │              │              │
   │      慢查询趋势图    未使用/冗余索引   变更申请审批    变更前后对比
   │      Top N 排名      缺失索引建议    风险评估       优化效果指标
   ▼            │              │              │              │
pg_stat_statements  ──────┴──────────────┴──────────────┴──────▶ DBA 仪表盘
```

### 1.1 核心数据流

1. **采集层**：从 `pg_stat_statements` 扩展 + 业务代码慢查询日志自动捕获 SQL
2. **分析层**：EXPLAIN ANALYZE 执行计划解析 + 索引使用率统计（`pg_stat_user_indexes`）
3. **决策层**：未使用索引检测 + 冗余索引识别 + 缺失索引建议 + Schema 变更风险评估
4. **执行层**：变更申请 → 审批流 → 自动/手动执行 → 回滚能力
5. **验证层**：变更前后慢查询对比 + 索引效果对比 + 仪表盘汇总

---

## 二、数据库设计（迁移 192）

### 2.1 表 1：`dba_slow_queries`

慢查询记录表，存储从 `pg_stat_statements` 采集的慢查询数据。

```sql
-- ============================================================
-- Migration: 192_create_dba_devops_tables.sql
-- ============================================================

CREATE TABLE dba_slow_queries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    query_id        BIGINT NOT NULL,                     -- pg_stat_statements.queryid
    normalized_sql  TEXT NOT NULL,                        -- 参数化后的 SQL
    database_name   VARCHAR(128) NOT NULL,
    schema_name     VARCHAR(128) DEFAULT 'public',
    query_text      TEXT,                                 -- 原始 SQL（脱敏后）
    execution_count BIGINT NOT NULL DEFAULT 1,
    total_time_ms   NUMERIC(20,2) NOT NULL DEFAULT 0,    -- 累计执行时间 (ms)
    min_time_ms     NUMERIC(20,2) NOT NULL DEFAULT 0,    -- 最小执行时间
    max_time_ms     NUMERIC(20,2) NOT NULL DEFAULT 0,    -- 最大执行时间
    mean_time_ms    NUMERIC(20,2) NOT NULL DEFAULT 0,    -- 平均执行时间
    stddev_time_ms  NUMERIC(20,2) DEFAULT 0,             -- 执行时间标准差
    rows_returned   BIGINT DEFAULT 0,                    -- 返回行数
    rows_affected   BIGINT DEFAULT 0,                    -- 影响行数
    shared_blks_hit BIGINT DEFAULT 0,                    -- 共享缓冲命中
    shared_blks_read BIGINT DEFAULT 0,                   -- 共享缓冲读取
    temp_blks_written BIGINT DEFAULT 0,                  -- 临时块写入
    call_timestamp  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 采集时间
    status          VARCHAR(30) NOT NULL DEFAULT 'detected'
                    CHECK (status IN ('detected', 'analyzing', 'optimized', 'ignored', 'archived')),
    severity        VARCHAR(30) NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
    analyze_result  JSONB DEFAULT '{}',                   -- EXPLAIN ANALYZE 结果
    optimization_suggestion TEXT,                         -- 优化建议（文本）
    suggested_indexes JSONB DEFAULT '[]',                 -- 建议创建的索引
    related_indexes JSONB DEFAULT '[]',                   -- 已相关的现有索引
    assigned_to     VARCHAR(100),                         -- 处理人
    resolved_at     TIMESTAMPTZ,                          -- 解决时间
    resolution_notes TEXT,                               -- 解决说明
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(100),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

ALTER TABLE dba_slow_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_dba_slow_queries ON dba_slow_queries
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_dba_slow_queries_tenant ON dba_slow_queries(tenant_id);
CREATE INDEX idx_dba_slow_queries_status ON dba_slow_queries(tenant_id, status);
CREATE INDEX idx_dba_slow_queries_severity ON dba_slow_queries(tenant_id, severity);
CREATE INDEX idx_dba_slow_queries_mean_time ON dba_slow_queries(tenant_id, mean_time_ms DESC);
CREATE INDEX idx_dba_slow_queries_call_ts ON dba_slow_queries(tenant_id, call_timestamp DESC);
CREATE INDEX idx_dba_slow_queries_database ON dba_slow_queries(tenant_id, database_name);
CREATE UNIQUE INDEX idx_dba_slow_queries_unique ON dba_slow_queries(tenant_id, database_name, query_id, call_timestamp::date);

CREATE TRIGGER trg_dba_slow_queries_updated_at
    BEFORE UPDATE ON dba_slow_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 表 2：`dba_index_analysis`

索引分析表，存储未使用索引、冗余索引、缺失索引建议。

```sql
CREATE TABLE dba_index_analysis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    database_name   VARCHAR(128) NOT NULL,
    schema_name     VARCHAR(128) DEFAULT 'public',
    table_name      VARCHAR(256) NOT NULL,
    index_name      VARCHAR(256) NOT NULL,
    index_definition TEXT NOT NULL,                     -- CREATE INDEX 语句
    analysis_type   VARCHAR(30) NOT NULL
                    CHECK (analysis_type IN ('unused', 'duplicate', 'missing', 'low_usage', 'bloat')),
    analysis_result VARCHAR(30) NOT NULL
                    CHECK (analysis_result IN ('recommend_drop', 'recommend_merge', 'recommend_create', 'monitor', 'healthy')),
    priority        VARCHAR(30) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    -- 使用统计
    index_scans     BIGINT DEFAULT 0,                   -- pg_stat_user_indexes.idx_scan
    index_tuples_read BIGINT DEFAULT 0,                 -- idx_tup_read
    index_tuples_fetch BIGINT DEFAULT 0,                -- idx_tup_fetch
    index_size_bytes BIGINT DEFAULT 0,                  -- pg_relation_size
    table_size_bytes BIGINT DEFAULT 0,                  -- 表大小
    bloat_ratio     NUMERIC(5,2) DEFAULT 0,             -- 膨胀率 0.00~1.00
    last_used_at    TIMESTAMPTZ,                        -- 最后使用时间
    -- 冗余/缺失索引详情
    duplicate_of    VARCHAR(256),                       -- 冗余时，被重复的索引名
    merged_suggestion TEXT,                             -- 合并建议
    missing_columns JSONB DEFAULT '[]',                 -- 缺失索引建议列
    benefit_estimate TEXT,                              -- 预期收益描述
    related_query_id UUID REFERENCES dba_slow_queries(id), -- 关联的慢查询
    status          VARCHAR(30) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'applied', 'ignored', 'dismissed')),
    applied_at      TIMESTAMPTZ,                        -- 应用时间
    notes           TEXT,
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(100),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

ALTER TABLE dba_index_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_dba_index_analysis ON dba_index_analysis
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_dba_index_analysis_tenant ON dba_index_analysis(tenant_id);
CREATE INDEX idx_dba_index_analysis_type ON dba_index_analysis(tenant_id, analysis_type);
CREATE INDEX idx_dba_index_analysis_result ON dba_index_analysis(tenant_id, analysis_result);
CREATE INDEX idx_dba_index_analysis_priority ON dba_index_analysis(tenant_id, priority);
CREATE INDEX idx_dba_index_analysis_status ON dba_index_analysis(tenant_id, status);
CREATE INDEX idx_dba_index_analysis_table ON dba_index_analysis(tenant_id, table_name);

CREATE TRIGGER trg_dba_index_analysis_updated_at
    BEFORE UPDATE ON dba_index_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.3 表 3：`dba_schema_changes`

Schema 变更申请表，管理 DDL 变更的申请、审批、执行、回滚全生命周期。

```sql
CREATE TABLE dba_schema_changes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    change_number   VARCHAR(32) NOT NULL UNIQUE,          -- 变更编号，如 DBA-20260522-001
    database_name   VARCHAR(128) NOT NULL,
    schema_name     VARCHAR(128) DEFAULT 'public',
    table_name      VARCHAR(256),                         -- 变更目标表
    change_type     VARCHAR(30) NOT NULL
                    CHECK (change_type IN ('create_table', 'alter_table', 'add_column', 'drop_column',
                                            'modify_column', 'create_index', 'drop_index',
                                            'create_constraint', 'drop_constraint',
                                            'create_trigger', 'drop_trigger',
                                            'alter_default', 'rename')),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    ddl_sql         TEXT NOT NULL,                        -- 执行的 DDL 语句
    rollback_sql    TEXT,                                 -- 回滚 DDL 语句
    -- 风险评估
    risk_level      VARCHAR(30) NOT NULL DEFAULT 'low'
                    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_factors    JSONB DEFAULT '[]',                   -- 风险因子列表
    estimated_rows  BIGINT,                               -- 预估影响行数
    estimated_duration_sec INT,                           -- 预估执行时间 (秒)
    lock_type       VARCHAR(30),                          -- 锁类型 (AccessShareLock, AccessExclusiveLock 等)
    lock_duration_estimate VARCHAR(100),                  -- 锁持续时间预估
    requires_downtime BOOLEAN DEFAULT false,              -- 是否需要停机
    -- 审批流
    requester       VARCHAR(100) NOT NULL,                -- 申请人
    reviewer        VARCHAR(100),                         -- 审批人
    review_comment  TEXT,
    approved_at     TIMESTAMPTZ,                          -- 审批时间
    rejected_at     TIMESTAMPTZ,                          -- 拒绝时间
    -- 执行记录
    executor        VARCHAR(100),                         -- 执行人
    executed_at     TIMESTAMPTZ,                          -- 执行时间
    execution_output TEXT,                               -- 执行输出
    execution_error TEXT,                                 -- 执行错误
    duration_ms     NUMERIC(20,2),                        -- 实际执行耗时
    -- 回滚记录
    rollback_executor VARCHAR(100),                       -- 回滚执行人
    rollback_at     TIMESTAMPTZ,                          -- 回滚时间
    rollback_output TEXT,                                 -- 回滚输出
    rollback_error  TEXT,                                 -- 回滚错误
    -- 状态
    status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected',
                                       'executing', 'completed', 'failed', 'rolled_back', 'cancelled')),
    scheduled_at    TIMESTAMPTZ,                          -- 计划执行时间
    tags            JSONB DEFAULT '[]',                   -- 标签
    created_by      VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(100),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

ALTER TABLE dba_schema_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_dba_schema_changes ON dba_schema_changes
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_dba_schema_changes_tenant ON dba_schema_changes(tenant_id);
CREATE INDEX idx_dba_schema_changes_status ON dba_schema_changes(tenant_id, status);
CREATE INDEX idx_dba_schema_changes_risk ON dba_schema_changes(tenant_id, risk_level);
CREATE INDEX idx_dba_schema_changes_type ON dba_schema_changes(tenant_id, change_type);
CREATE INDEX idx_dba_schema_changes_created_at ON dba_schema_changes(tenant_id, created_at DESC);
CREATE INDEX idx_dba_schema_changes_database ON dba_schema_changes(tenant_id, database_name);
CREATE INDEX idx_dba_schema_changes_requester ON dba_schema_changes(tenant_id, requester);

CREATE TRIGGER trg_dba_schema_changes_updated_at
    BEFORE UPDATE ON dba_schema_changes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.4 对应 Rollback 迁移

```sql
-- 192_rollback_dba_devops_tables.sql
DROP TRIGGER IF EXISTS trg_dba_schema_changes_updated_at ON dba_schema_changes;
DROP TRIGGER IF EXISTS trg_dba_index_analysis_updated_at ON dba_index_analysis;
DROP TRIGGER IF EXISTS trg_dba_slow_queries_updated_at ON dba_slow_queries;

DROP TABLE IF EXISTS dba_schema_changes;
DROP TABLE IF EXISTS dba_index_analysis;
DROP TABLE IF EXISTS dba_slow_queries;
```

---

## 三、后端功能设计

### 3.1 慢 SQL 检测服务

**服务文件**：`orion-platform-service/src/services/dba/dba-slow-query-service.ts`

#### 3.1.1 慢查询自动捕获

| 能力 | 描述 | 实现方式 |
|------|------|----------|
| pg_stat_statements 采集 | 定期从 `pg_stat_statements` 扩展拉取 Top N 慢查询 | Cron Job 每 5 分钟 |
| 阈值配置 | `slow_query_threshold_ms` 默认 1000ms | 租户级配置 `dba_config` |
| 参数化 SQL | 自动归一化参数为 `$1, $2` | `pg_stat_statements` 原生支持 |
| 去重合并 | 同 `query_id` 按天聚合，避免重复记录 | `UNIQUE INDEX (query_id, date)` |

**核心接口**：

```typescript
interface SlowQueryRecord {
  queryId: bigint;
  normalizedSql: string;
  databaseName: string;
  executionCount: number;
  meanTimeMs: number;
  maxTimeMs: number;
  totalTimeMs: number;
  rowsReturned: number;
  sharedBlksHit: number;
  sharedBlksRead: number;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
}

class DbaSlowQueryService {
  // 从 pg_stat_statements 采集慢查询
  collectSlowQueries(databaseName: string, thresholdMs: number): Promise<SlowQueryRecord[]>;

  // 查询慢查询列表（支持分页、过滤、排序）
  listSlowQueries(params: ListSlowQueryParams): Promise<PaginatedResult<SlowQueryEntity>>;

  // 获取单条慢查询详情
  getSlowQuery(id: string): Promise<SlowQueryEntity>;

  // 运行 EXPLAIN ANALYZE
  analyzeQuery(databaseName: string, sql: string): Promise<ExplainResult>;

  // 慢查询趋势（按天/周/月）
  getSlowQueryTrends(params: TrendParams): Promise<TrendPoint[]>;

  // Top N 慢 SQL 排名
  getTopNSlowQueries(params: TopNParams): Promise<SlowQueryEntity[]>;

  // 标记状态（忽略/已优化/归档）
  updateStatus(id: string, status: string, notes: string): Promise<void>;
}
```

#### 3.1.2 执行计划分析

| 分析项 | 检测规则 | 严重度 |
|--------|---------|--------|
| Seq Scan | 大表（> 10 万行）走全表扫描 | warning |
| Nested Loop | 非索引 Nested Loop + 大结果集 | critical |
| Sort (disk) | 排序操作使用磁盘（work_mem 不足） | warning |
| Hash Join | 大表 Hash Join 无索引 | warning |
| Index Scan (low selectivity) | 索引扫描返回 > 50% 表数据 | info |
| Bitmap Heap Scan (lossy) | 位图扫描发生 lossy 降级 | warning |

#### 3.1.3 慢查询趋势与 Top N

| 接口 | 参数 | 返回 |
|------|------|------|
| `GET /dba/slow-queries/trends` | `granularity=day|week|month`, `days=7\|30\|90` | `{ points: [{ date, count, avgMs, p99Ms }] }` |
| `GET /dba/slow-queries/top` | `limit=10\|20\|50`, `orderBy=mean_time\|total_time\|count` | `SlowQueryEntity[]` |

### 3.2 索引分析服务

**服务文件**：`orion-platform-service/src/services/dba/dba-index-service.ts`

#### 3.2.1 未使用索引检测

从 `pg_stat_user_indexes` 获取 `idx_scan = 0` 且 `idx_tup_read = 0` 的索引：

```sql
SELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch,
       pg_relation_size(indexrelid) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND idx_tup_read = 0
  AND NOT indisunique  -- 排除唯一索引
  AND NOT indisprimary  -- 排除主键
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### 3.2.2 冗余索引检测

检测规则：同一表上，两个索引的前导列完全相同或子集关系。

```
冗余示例：
  INDEX A: (user_id, created_at)
  INDEX B: (user_id)          ← B 是 A 的前缀子集，冗余

  INDEX C: (status)
  INDEX D: (status, type)     ← 若 C 的使用率极低，建议合并到 D
```

#### 3.2.3 缺失索引建议

基于慢查询的 WHERE / JOIN / ORDER BY 列，结合 `pg_stat_user_tables.seq_scan` 高频率表，生成缺失索引建议：

```
慢查询: SELECT * FROM orders WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC
建议: CREATE INDEX idx_orders_user_id_status_created_at ON orders(user_id, status, created_at DESC)
```

#### 3.2.4 核心接口

```typescript
class DbaIndexService {
  // 运行索引分析
  analyzeIndexes(databaseName: string): Promise<IndexAnalysis[]>;

  // 查询索引分析列表
  listIndexAnalyses(params: ListIndexParams): Promise<PaginatedResult<IndexAnalysisEntity>>;

  // 获取单条分析详情
  getIndexAnalysis(id: string): Promise<IndexAnalysisEntity>;

  // 应用索引建议（创建/删除/合并）
  applyIndexSuggestion(id: string, action: 'drop' | 'create' | 'merge'): Promise<void>;

  // 忽略/驳回分析项
  dismissAnalysis(id: string, reason: string): Promise<void>;

  // 获取索引使用统计
  getIndexStats(databaseName: string, tableName?: string): Promise<IndexStats[]>;
}
```

### 3.3 Schema 变更管理服务

**服务文件**：`orion-platform-service/src/services/dba/dba-schema-change-service.ts`

#### 3.3.1 变更申请与审批

| 状态 | 流转 | 条件 |
|------|------|------|
| `draft` | → `pending_review` | 申请人提交 |
| `pending_review` | → `approved` / `rejected` | DBA 审批 |
| `approved` | → `executing` | 到达计划执行时间 |
| `executing` | → `completed` / `failed` | 执行结果 |
| `failed` | → `rolled_back` | 自动/手动回滚 |
| 任意状态 | → `cancelled` | 申请人/管理员取消 |

#### 3.3.2 变更风险评估

| 风险因子 | 评估规则 | 风险等级 |
|---------|---------|---------|
| 表行数 > 100 万 | `pg_class.reltuples` 查询 | high |
| 表行数 > 1000 万 | 超大表 | critical |
| ADD COLUMN 带 DEFAULT | 需重写整表 | high |
| ADD COLUMN 不带 DEFAULT | 元数据操作，快 | low |
| CREATE INDEX CONCURRENTLY | 不锁表，但慢 | medium |
| CREATE INDEX（非 CONCURRENTLY） | AccessExclusiveLock | high |
| DROP COLUMN | 元数据操作 | low |
| ALTER COLUMN TYPE | 需重写数据 | high |
| RENAME | 元数据操作 | low |
| 需要停机 | 业务影响 | critical |

风险评估算法：

```typescript
function assessRisk(change: SchemaChangeInput): RiskAssessment {
  let risk = 0;
  const factors: RiskFactor[] = [];

  // 行数因子
  if (rowCount > 10_000_000) { risk += 3; factors.push({ type: 'table_size', level: 'critical', desc: '表行数超过 1000 万' }); }
  else if (rowCount > 1_000_000) { risk += 2; factors.push({ type: 'table_size', level: 'high', desc: '表行数超过 100 万' }); }
  else if (rowCount > 100_000) { risk += 1; factors.push({ type: 'table_size', level: 'medium', desc: '表行数超过 10 万' }); }

  // 操作类型因子
  const opRisk: Record<string, number> = {
    'alter_column_type': 3, 'add_column_default': 3,
    'create_index': 2, 'create_index_concurrently': 1,
    'drop_column': 1, 'add_column': 1, 'rename': 0
  };
  risk += opRisk[change.changeType] ?? 0;

  // 锁类型因子
  if (change.lockType === 'AccessExclusiveLock') { risk += 2; factors.push({ type: 'lock', level: 'high', desc: '需要 AccessExclusiveLock' }); }
  else if (change.lockType === 'ShareRowExclusiveLock') { risk += 1; factors.push({ type: 'lock', level: 'medium', desc: '需要 ShareRowExclusiveLock' }); }

  return {
    level: risk >= 5 ? 'critical' : risk >= 3 ? 'high' : risk >= 1 ? 'medium' : 'low',
    score: risk,
    factors
  };
}
```

#### 3.3.3 变更执行与回滚

```typescript
class DbaSchemaChangeService {
  // 创建变更申请
  createChange(input: CreateSchemaChangeInput): Promise<SchemaChangeEntity>;

  // 列表查询
  listChanges(params: ListSchemaChangeParams): Promise<PaginatedResult<SchemaChangeEntity>>;

  // 获取详情
  getChange(id: string): Promise<SchemaChangeEntity>;

  // 获取风险评估
  assessRisk(id: string): Promise<RiskAssessment>;

  // 审批
  approveChange(id: string, reviewer: string, comment?: string): Promise<void>;
  rejectChange(id: string, reviewer: string, reason: string): Promise<void>;

  // 执行变更
  executeChange(id: string, executor: string): Promise<ExecutionResult>;

  // 回滚变更
  rollbackChange(id: string, executor: string): Promise<RollbackResult>;

  // 取消变更
  cancelChange(id: string, reason: string): Promise<void>;

  // 变更历史审计
  getChangeHistory(databaseName?: string, days?: number): Promise<SchemaChangeEntity[]>;
}
```

### 3.4 DBA 仪表盘聚合服务

**服务文件**：`orion-platform-service/src/services/dba/dba-dashboard-service.ts`

```typescript
interface DbaDashboardSummary {
  slowQueryStats: {
    total: number;
    critical: number;
    warning: number;
    resolved: number;
    trend: 'up' | 'down' | 'stable';       // 对比 7 天前
    p99Ms: number;                          // 当前 P99 延迟
  };
  indexStats: {
    totalIndexes: number;
    unusedCount: number;
    duplicateCount: number;
    missingSuggestions: number;
    potentialSavingsMB: number;             // 删除未使用索引可释放空间
  };
  schemaChangeStats: {
    pending: number;
    executing: number;
    completedThisWeek: number;
    failedThisWeek: number;
    rollbackCount: number;
  };
  topSlowQueries: SlowQueryEntity[];        // Top 5 最慢查询
  recentChanges: SchemaChangeEntity[];      // 最近 5 条变更
}

class DbaDashboardService {
  getSummary(tenantId: string): Promise<DbaDashboardSummary>;
}
```

### 3.5 外部依赖

| 依赖 | 用途 | 必要性 | 降级方案 |
|------|------|--------|----------|
| PostgreSQL `pg_stat_statements` 扩展 | 慢查询数据采集 | 必须 | 应用层日志采集（降级精度） |
| PostgreSQL `pg_stat_user_indexes` | 索引使用统计 | 必须 | 手动分析 |
| PostgreSQL `pg_stat_user_tables` | 表行数/SeqScan 统计 | 必须 | 手动估算 |
| PostgreSQL `pg_locks` | 锁检测与风险评估 | 必须 | 跳过锁评估 |
| `pg_advisory_lock` | 变更执行时防止并发冲突 | 推荐 | 应用层锁 |
| 审批流引擎（已有的 ApprovalService） | Schema 变更审批 | 推荐 | 简化审批（单人） |
| EventBus（已有的 EventBus） | 变更事件通知 | 推荐 | 同步通知 |

### 3.6 权限模型

| 角色 | 权限 | 说明 |
|------|------|------|
| `dba_admin` | 全部 CRUD + 审批 + 执行 | DBA 团队管理员 |
| `dba_analyst` | 查看慢 SQL + 查看索引分析 + 创建变更申请 | 分析师，无审批/执行权 |
| `developer` | 查看慢 SQL（自己的）+ 创建变更申请 | 开发人员 |
| `tenant_admin` | 查看仪表盘 + 审批变更 | 租户管理员 |

权限检查中间件：

```typescript
// 路由级权限守卫
router.get('/dba/slow-queries', requireRole('dba_admin', 'dba_analyst', 'developer', 'tenant_admin'), listSlowQueriesHandler);
router.post('/dba/schema-changes', requireRole('dba_admin', 'dba_analyst', 'developer'), createSchemaChangeHandler);
router.post('/dba/schema-changes/:id/approve', requireRole('dba_admin', 'tenant_admin'), approveSchemaChangeHandler);
router.post('/dba/schema-changes/:id/execute', requireRole('dba_admin'), executeSchemaChangeHandler);
```

---

## 四、API 设计

### 4.1 路由文件

**新建文件**：`orion-platform-service/src/api/dba-devops-routes.ts`

**注册入口**：在 `orion-platform-service/src/api/routes.ts` 中添加：

```typescript
import { dbaDevOpsRoutes } from './dba-devops-routes';
// ...
app.register(dbaDevOpsRoutes, { prefix: '/api/v1/dba' });
```

### 4.2 全部端点

#### 慢 SQL 端点

| Method | Path | 描述 | 权限 | 请求参数 | 响应体 |
|--------|------|------|------|---------|--------|
| `GET` | `/dba/slow-queries` | 慢查询列表 | `dba_*`, `developer`, `tenant_admin` | `page, limit, status, severity, database, orderBy` | `{ data: SlowQuery[], total, page, limit }` |
| `GET` | `/dba/slow-queries/:id` | 慢查询详情 | 同上 | - | `SlowQuery` |
| `POST` | `/dba/slow-queries/:id/analyze` | 执行 EXPLAIN ANALYZE | `dba_admin` | 无（使用已有 query_text） | `{ explainPlan: ExplainNode[], analysis: string }` |
| `GET` | `/dba/slow-queries/trends` | 慢查询趋势 | 同上 | `granularity=day\|week\|month, days=7\|30\|90, database?` | `{ points: [{ date, count, avgMs, p99Ms }] }` |
| `GET` | `/dba/slow-queries/top` | Top N 排名 | 同上 | `limit=10\|20\|50, orderBy=mean_time\|total_time\|count, database?` | `SlowQuery[]` |
| `PATCH` | `/dba/slow-queries/:id/status` | 更新状态 | `dba_admin`, `dba_analyst` | `{ status, notes }` | `{ success: true }` |
| `POST` | `/dba/slow-queries/collect` | 手动触发采集 | `dba_admin` | `{ databaseName?, thresholdMs? }` | `{ collected: number }` |

#### 索引分析端点

| Method | Path | 描述 | 权限 | 请求参数 | 响应体 |
|--------|------|------|------|---------|--------|
| `GET` | `/dba/indexes` | 索引分析列表 | `dba_*`, `tenant_admin` | `page, limit, type, result, status, table?` | `{ data: IndexAnalysis[], total, page, limit }` |
| `GET` | `/dba/indexes/:id` | 索引分析详情 | 同上 | - | `IndexAnalysis` |
| `POST` | `/dba/indexes/:id/apply` | 应用索引建议 | `dba_admin` | `{ action: 'drop' \| 'create' \| 'merge' }` | `{ success: true, ddl: string }` |
| `PATCH` | `/dba/indexes/:id/dismiss` | 驳回分析项 | `dba_admin`, `dba_analyst` | `{ reason }` | `{ success: true }` |
| `POST` | `/dba/indexes/analyze` | 手动触发分析 | `dba_admin` | `{ databaseName? }` | `{ analyzed: number }` |
| `GET` | `/dba/indexes/stats` | 索引使用统计 | 同上 | `database, table?` | `{ tables: [{ name, indexCount, unusedCount, sizeBytes }] }` |

#### Schema 变更端点

| Method | Path | 描述 | 权限 | 请求参数 | 响应体 |
|--------|------|------|------|---------|--------|
| `GET` | `/dba/schema-changes` | 变更列表 | `dba_*`, `developer`, `tenant_admin` | `page, limit, status, riskLevel, database, requester?` | `{ data: SchemaChange[], total, page, limit }` |
| `GET` | `/dba/schema-changes/:id` | 变更详情 | 同上 | - | `SchemaChange` |
| `POST` | `/dba/schema-changes` | 创建变更申请 | `dba_*`, `developer` | `CreateSchemaChangeInput` | `SchemaChange` |
| `GET` | `/dba/schema-changes/:id/risk` | 获取风险评估 | 同上 | - | `RiskAssessment` |
| `POST` | `/dba/schema-changes/:id/approve` | 审批通过 | `dba_admin`, `tenant_admin` | `{ comment? }` | `{ success: true }` |
| `POST` | `/dba/schema-changes/:id/reject` | 审批拒绝 | 同上 | `{ reason }` | `{ success: true }` |
| `POST` | `/dba/schema-changes/:id/execute` | 执行变更 | `dba_admin` | 无 | `{ success: true, output, durationMs }` |
| `POST` | `/dba/schema-changes/:id/rollback` | 回滚变更 | `dba_admin` | 无 | `{ success: true, output }` |
| `POST` | `/dba/schema-changes/:id/cancel` | 取消变更 | 任意 | `{ reason }` | `{ success: true }` |
| `GET` | `/dba/schema-changes/history` | 变更历史审计 | `dba_*`, `tenant_admin` | `database?, days=7\|30\|90` | `SchemaChange[]` |

#### 仪表盘端点

| Method | Path | 描述 | 权限 | 响应体 |
|--------|------|------|------|--------|
| `GET` | `/dba/dashboard` | DBA 仪表盘汇总 | `dba_*`, `tenant_admin` | `DbaDashboardSummary` |

### 4.3 核心请求/响应体

```typescript
// ---- Slow Query ----

interface SlowQueryEntity {
  id: string;
  queryId: string;
  normalizedSql: string;
  databaseName: string;
  schemaName: string;
  queryText?: string;
  executionCount: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  stddevMs?: number;
  rowsReturned: number;
  sharedBlksHit: number;
  sharedBlksRead: number;
  status: 'detected' | 'analyzing' | 'optimized' | 'ignored' | 'archived';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  analyzeResult?: Record<string, unknown>;
  optimizationSuggestion?: string;
  suggestedIndexes?: string[];
  assignedTo?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Index Analysis ----

interface IndexAnalysisEntity {
  id: string;
  databaseName: string;
  schemaName: string;
  tableName: string;
  indexName: string;
  indexDefinition: string;
  analysisType: 'unused' | 'duplicate' | 'missing' | 'low_usage' | 'bloat';
  analysisResult: 'recommend_drop' | 'recommend_merge' | 'recommend_create' | 'monitor' | 'healthy';
  priority: 'critical' | 'high' | 'medium' | 'low';
  indexScans: number;
  indexSizeBytes: number;
  tableSizeBytes: number;
  bloatRatio: number;
  lastUsedAt?: string;
  duplicateOf?: string;
  mergedSuggestion?: string;
  missingColumns?: string[];
  benefitEstimate?: string;
  status: 'open' | 'applied' | 'ignored' | 'dismissed';
  appliedAt?: string;
  createdAt: string;
}

// ---- Schema Change ----

interface SchemaChangeEntity {
  id: string;
  changeNumber: string;
  databaseName: string;
  schemaName: string;
  tableName?: string;
  changeType: string;
  title: string;
  description?: string;
  ddlSql: string;
  rollbackSql?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  estimatedRows?: number;
  estimatedDurationSec?: number;
  lockType?: string;
  requiresDowntime: boolean;
  requester: string;
  reviewer?: string;
  reviewComment?: string;
  approvedAt?: string;
  rejectedAt?: string;
  executor?: string;
  executedAt?: string;
  executionError?: string;
  status: string;
  scheduledAt?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: RiskFactor[];
}

interface RiskFactor {
  type: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface CreateSchemaChangeInput {
  databaseName: string;
  schemaName?: string;
  tableName?: string;
  changeType: string;
  title: string;
  description?: string;
  ddlSql: string;
  rollbackSql?: string;
  scheduledAt?: string;
  tags?: string[];
}
```

---

## 五、前端页面交互设计

### 5.1 页面路由

| 路径 | 页面组件 | 说明 |
|------|---------|------|
| `/dba` | `DbaDashboard` | DBA 仪表盘（默认首页） |
| `/dba/slow-queries` | `SlowQueryList` | 慢 SQL 列表 |
| `/dba/slow-queries/:id` | `SlowQueryDetail` | SQL 详情页 — 执行计划可视化 |
| `/dba/indexes` | `IndexAnalysis` | 索引分析 |
| `/dba/schema-changes` | `SchemaChangeList` | Schema 变更列表 |
| `/dba/schema-changes/new` | `SchemaChangeForm` | Schema 变更申请 |

### 5.2 页面 1：DBA 仪表盘（`/dba`）

```tsx
/**
 * DBA 仪表盘 — 慢 SQL + 索引 + Schema 变更 一览
 * 路径: /dba
 * 组件: DbaDashboard
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Statistic, Space, Tag, Button, Empty } from 'antd';
import {
  DatabaseOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageSkeleton from '@/components/PageSkeleton';
import TrendChart from '@/components/TrendChart';          // 复用已有趋势图组件
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { componentRadius } from '@/tokens/radius';
import { getDbaDashboard } from '@/api/dba-devops';        // 新建 API client

const { Title, Text } = Typography;

const DbaDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DbaDashboardSummary | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getDbaDashboard();
      setData(res.data?.data ?? null);
    } catch (e: unknown) {
      // 禁止模糊错误提示 — 必须显示具体失败原因
      message.error(`加载 DBA 仪表盘失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return <PageSkeleton cards={6} rows={4} />;
  if (!data) return <Empty description="暂无 DBA 数据，请先配置数据源" />;

  return (
    <div style={{ padding: spacing.lg }}>
      {/* ===== 主标题 ===== */}
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        数据库 DevOps
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        慢 SQL 监控 · 索引优化 · Schema 变更管理
      </Text>

      {/* ===== 统计卡片行 ===== */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card hoverable style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="慢查询总数"
              value={data.slowQueryStats.total}
              prefix={<WarningOutlined style={{ color: colors.warning[500] }} />}
            />
            <Space style={{ marginTop: 8 }}>
              <Tag color="red">Critical {data.slowQueryStats.critical}</Tag>
              <Tag color="orange">Warning {data.slowQueryStats.warning}</Tag>
              <Tag color="green">已解决 {data.slowQueryStats.resolved}</Tag>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="P99 延迟"
              value={data.slowQueryStats.p99Ms}
              suffix="ms"
              valueStyle={{ color: data.slowQueryStats.p99Ms > 5000 ? colors.error[500] : colors.success[500] }}
            />
            <Tag color={data.slowQueryStats.trend === 'up' ? 'red' : 'green'}>
              {data.slowQueryStats.trend === 'up' ? '上升' : data.slowQueryStats.trend === 'down' ? '下降' : '持平'}
            </Tag>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="未使用索引"
              value={data.indexStats.unusedCount}
              prefix={<DatabaseOutlined style={{ color: colors.neutral[500] }} />}
            />
            <Text type="secondary">可释放 {data.indexStats.potentialSavingsMB} MB</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable style={{ borderRadius: componentRadius.card }}>
            <Statistic
              title="待审批变更"
              value={data.schemaChangeStats.pending}
              prefix={<ThunderboltOutlined style={{ color: colors.primary[500] }} />}
            />
            <Space>
              <Tag color="blue">执行中 {data.schemaChangeStats.executing}</Tag>
              <Tag color="green">本周完成 {data.schemaChangeStats.completedThisWeek}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* ===== 趋势图 + Top 慢 SQL ===== */}
      <Row gutter={[spacing.md, spacing.md]}>
        <Col span={16}>
          <Card
            title="慢查询趋势"
            extra={
              <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>
                刷新
              </Button>
            }
            style={{ borderRadius: componentRadius.card }}
          >
            <TrendChart
              data={/* 从 dashboard 或独立 trends API 获取 */ []}
              height={280}
              xKey="date"
              yKeys={['count', 'avgMs']}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title="Top 5 慢 SQL"
            extra={
              <Button type="link" size="small" onClick={() => navigate('/dba/slow-queries')}>
                查看全部 <RightOutlined />
              </Button>
            }
            style={{ borderRadius: componentRadius.card }}
          >
            {data.topSlowQueries.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无慢查询" />
            ) : (
              data.topSlowQueries.map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: `${spacing.sm}px 0`,
                    borderBottom: `1px solid ${colors.neutral[100]}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/dba/slow-queries/${q.id}`)}
                >
                  <Space>
                    <Tag color={q.severity === 'critical' ? 'red' : q.severity === 'warning' ? 'orange' : 'blue'}>
                      {q.severity}
                    </Tag>
                    <Text code style={{ fontSize: 11 }}>
                      {q.normalizedSql.slice(0, 40)}...
                    </Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    平均 {q.meanMs}ms · {q.executionCount} 次
                  </Text>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* ===== 最近变更 ===== */}
      <Card
        title="最近 Schema 变更"
        extra={
          <Space>
            <Button type="primary" size="small" onClick={() => navigate('/dba/schema-changes/new')}>
              新建变更
            </Button>
            <Button size="small" onClick={() => navigate('/dba/schema-changes')}>
              查看全部 <RightOutlined />
            </Button>
          </Space>
        }
        style={{ borderRadius: componentRadius.card, marginTop: spacing.md }}
      >
        {data.recentChanges.length === 0 ? (
          <Empty description="暂无变更记录" />
        ) : (
          data.recentChanges.map((c) => (
            <div key={c.id} style={{ padding: `${spacing.sm}px 0`, borderBottom: `1px solid ${colors.neutral[100]}` }}>
              <Space>
                <Tag color={c.status === 'completed' ? 'green' : c.status === 'failed' ? 'red' : c.status === 'executing' ? 'orange' : 'blue'}>
                  {c.status}
                </Tag>
                <Text strong>{c.title}</Text>
                <Tag color={c.riskLevel === 'critical' ? 'magenta' : c.riskLevel === 'high' ? 'red' : 'default'}>
                  {c.riskLevel}
                </Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                {c.changeNumber} · {c.databaseName} · {c.createdAt}
              </Text>
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default DbaDashboard;
```

### 5.3 页面 2：慢 SQL 列表（`/dba/slow-queries`）

```tsx
/**
 * 慢 SQL 列表 — 分页、过滤、排序、批量操作
 * 路径: /dba/slow-queries
 * 组件: SlowQueryList
 */
import React, { useState, useEffect } from 'react';
import { Typography, Table, Select, Button, Space, Tag, Input, Card, message, Badge } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageSkeleton from '@/components/PageSkeleton';
import Table from '@/components/Table';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { componentRadius } from '@/tokens/radius';
import { listSlowQueries, collectSlowQueries } from '@/api/dba-devops';

const SlowQueryList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [queries, setQueries] = useState<SlowQueryEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState({ status: '', severity: '', database: '', keyword: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listSlowQueries({ page, limit, ...filters });
      setQueries(res.data?.data?.items ?? []);
      setTotal(res.data?.data?.total ?? 0);
    } catch (e: unknown) {
      message.error(`加载慢查询列表失败: ${(e as Error).message}`);
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, limit, filters]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const res = await collectSlowQueries({});
      message.success(`采集完成，共采集 ${res.data?.data?.collected} 条慢查询`);
      loadData();
    } catch (e: unknown) {
      message.error(`采集失败: ${(e as Error).message}`);
    } finally {
      setCollecting(false);
    }
  };

  const columns = [
    {
      key: 'severity',
      title: '严重度',
      width: 100,
      render: (_: unknown, r: SlowQueryEntity) => (
        <Tag color={
          r.severity === 'critical' ? 'red' :
          r.severity === 'warning' ? 'orange' :
          r.severity === 'emergency' ? 'magenta' : 'blue'
        }>{r.severity}</Tag>
      ),
    },
    {
      key: 'normalizedSql',
      title: 'SQL',
      ellipsis: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 12 }}>{String(v).slice(0, 80)}</Text>
      ),
    },
    {
      key: 'databaseName',
      title: '数据库',
      width: 140,
      render: (v: unknown) => (
        <Space><DatabaseOutlined style={{ color: colors.primary[500] }} /><Text>{String(v)}</Text></Space>
      ),
    },
    {
      key: 'meanMs',
      title: '平均耗时',
      width: 100,
      sorter: true,
      render: (v: unknown) => {
        const ms = Number(v);
        return <Text style={{ color: ms > 5000 ? colors.error[500] : colors.neutral[900] }}>{ms.toFixed(0)}ms</Text>;
      },
    },
    {
      key: 'executionCount',
      title: '执行次数',
      width: 100,
      sorter: true,
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (v: unknown) => {
        const map: Record<string, string> = {
          detected: 'processing', analyzing: 'warning', optimized: 'success', ignored: 'default', archived: 'default',
        };
        const labelMap: Record<string, string> = {
          detected: '已检测', analyzing: '分析中', optimized: '已优化', ignored: '已忽略', archived: '已归档',
        };
        return <Badge status={map[v as string]} text={labelMap[v as string]} />;
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, r: SlowQueryEntity) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/dba/slow-queries/${r.id}`)}>
            详情
          </Button>
          {r.status === 'detected' && (
            <Button type="link" size="small" onClick={() => handleAnalyze(r.id)}>
              分析
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        慢 SQL 列表
      </Title>

      {/* 操作栏 */}
      <Card size="small" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
        <Space>
          <Input
            placeholder="搜索 SQL..."
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onPressEnter={() => setPage(1)}
          />
          <Select
            style={{ width: 120 }}
            placeholder="状态"
            allowClear
            value={filters.status || undefined}
            onChange={(v) => { setFilters({ ...filters, status: v || '' }); setPage(1); }}
            options={[
              { label: '已检测', value: 'detected' },
              { label: '分析中', value: 'analyzing' },
              { label: '已优化', value: 'optimized' },
              { label: '已忽略', value: 'ignored' },
            ]}
          />
          <Select
            style={{ width: 120 }}
            placeholder="严重度"
            allowClear
            value={filters.severity || undefined}
            onChange={(v) => { setFilters({ ...filters, severity: v || '' }); setPage(1); }}
            options={[
              { label: 'Critical', value: 'critical' },
              { label: 'Warning', value: 'warning' },
              { label: 'Info', value: 'info' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadData(); }} loading={loading}>
            刷新
          </Button>
          <Button
            icon={<DownloadOutlined />}
            loading={collecting}
            onClick={handleCollect}
          >
            采集慢查询
          </Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={queries}
        loading={loading}
        rowKey="id"
        striped
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => setPage(p),
          onShowSizeChange: (_, s) => { setLimit(s); setPage(1); },
        }}
        locale={{
          emptyText: <Empty description="暂无慢查询数据" />,
        }}
      />
    </div>
  );
};

export default SlowQueryList;
```

### 5.4 页面 3：SQL 详情页 — 执行计划可视化（`/dba/slow-queries/:id`）

```tsx
/**
 * 慢 SQL 详情页 — 执行计划可视化 + 优化建议
 * 路径: /dba/slow-queries/:id
 * 组件: SlowQueryDetail
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Button, Space, Tag, Collapse, Empty, message } from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import PageSkeleton from '@/components/PageSkeleton';
import ExplainTree from '@/components/ExplainTree';        // 执行计划树可视化组件（需新建或复用）
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { componentRadius } from '@/tokens/radius';
import { getSlowQuery, analyzeSlowQuery, updateSlowQueryStatus } from '@/api/dba-devops';

const { Title, Text, Paragraph } = Typography;

const SlowQueryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [query, setQuery] = useState<SlowQueryEntity | null>(null);
  const [explainPlan, setExplainPlan] = useState<ExplainNode[] | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getSlowQuery(id);
      setQuery(res.data?.data ?? null);
    } catch (e: unknown) {
      message.error(`加载慢查询详情失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAnalyze = async () => {
    if (!id || !query) return;
    setAnalyzing(true);
    try {
      const res = await analyzeSlowQuery(id);
      setExplainPlan(res.data?.data?.explainPlan ?? null);
      message.success('执行计划分析完成');
    } catch (e: unknown) {
      message.error(`分析失败: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOptimize = async () => {
    if (!id) return;
    try {
      await updateSlowQueryStatus(id, { status: 'optimized', notes: '已优化' });
      message.success('已标记为已优化');
      load();
    } catch (e: unknown) {
      message.error(`操作失败: ${(e as Error).message}`);
    }
  };

  if (loading && !query) return <PageSkeleton cards={3} rows={6} />;
  if (!query) return <Empty description="未找到该慢查询记录" />;

  return (
    <div style={{ padding: spacing.lg }}>
      {/* 返回按钮 + 标题 */}
      <Space style={{ marginBottom: spacing.md }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
        <Title level={2} style={{ margin: 0 }}>
          <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          慢查询详情
        </Title>
      </Space>

      {/* 基本信息 */}
      <Card title="基本信息" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Query ID"><Text code>{query.queryId}</Text></Descriptions.Item>
          <Descriptions.Item label="数据库">{query.databaseName}.{query.schemaName}</Descriptions.Item>
          <Descriptions.Item label="严重度">
            <Tag color={query.severity === 'critical' ? 'red' : 'orange'}>{query.severity}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag>{query.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="平均耗时">{query.meanMs.toFixed(0)} ms</Descriptions.Item>
          <Descriptions.Item label="最大耗时">{query.maxMs.toFixed(0)} ms</Descriptions.Item>
          <Descriptions.Item label="执行次数">{query.executionCount}</Descriptions.Item>
          <Descriptions.Item label="返回行数">{query.rowsReturned}</Descriptions.Item>
          <Descriptions.Item label="缓存命中">{query.sharedBlksHit}</Descriptions.Item>
          <Descriptions.Item label="磁盘读取">{query.sharedBlksRead}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* SQL 文本 */}
      <Card title="SQL 语句" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
        <Paragraph copyable style={{ fontFamily: 'monospace', background: colors.neutral[50], padding: spacing.sm, borderRadius: componentRadius.button.md }}>
          {query.queryText || query.normalizedSql}
        </Paragraph>
      </Card>

      {/* 执行计划 */}
      <Card
        title="执行计划"
        extra={
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleAnalyze}
            loading={analyzing}
          >
            EXPLAIN ANALYZE
          </Button>
        }
        style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}
      >
        {explainPlan ? (
          <ExplainTree nodes={explainPlan} />
        ) : (
          <Empty description="点击「EXPLAIN ANALYZE」查看执行计划" />
        )}
      </Card>

      {/* 优化建议 */}
      {query.optimizationSuggestion && (
        <Card title="优化建议" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
          <Paragraph>{query.optimizationSuggestion}</Paragraph>
          {query.suggestedIndexes && query.suggestedIndexes.length > 0 && (
            <>
              <Text strong>建议创建的索引：</Text>
              {query.suggestedIndexes.map((idx, i) => (
                <Paragraph key={i} copyable code style={{ marginLeft: spacing.sm }}>{idx}</Paragraph>
              ))}
            </>
          )}
        </Card>
      )}

      {/* 操作 */}
      <Card style={{ borderRadius: componentRadius.card }}>
        <Space>
          {query.status !== 'optimized' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleOptimize}>
              标记为已优化
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default SlowQueryDetail;
```

### 5.5 页面 4：索引分析（`/dba/indexes`）

```tsx
/**
 * 索引分析页 — 未使用/冗余/缺失索引一览
 * 路径: /dba/indexes
 * 组件: IndexAnalysis
 */
import React, { useState, useEffect } from 'react';
import { Typography, Table, Tabs, Card, Button, Space, Tag, Select, Input, Popconfirm, message, Empty, Statistic, Row, Col } from 'antd';
import { ReloadOutlined, DeleteOutlined, PlusOutlined, DownloadOutlined, DashboardOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageSkeleton from '@/components/PageSkeleton';
import TableComponent from '@/components/Table';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { componentRadius } from '@/tokens/radius';
import { listIndexAnalyses, analyzeIndexes, dismissAnalysis, applyIndexSuggestion } from '@/api/dba-devops';

const { Title, Text } = Typography;

const IndexAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [items, setItems] = useState<IndexAnalysisEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeType, setActiveType] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (activeType !== 'all') params.type = activeType;
      const res = await listIndexAnalyses(params);
      setItems(res.data?.data?.items ?? []);
      setTotal(res.data?.data?.total ?? 0);
    } catch (e: unknown) {
      message.error(`加载索引分析失败: ${(e as Error).message}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, activeType]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await analyzeIndexes({});
      message.success(`分析完成，共发现 ${res.data?.data?.analyzed} 个索引问题`);
      loadData();
    } catch (e: unknown) {
      message.error(`分析失败: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async (id: string, action: 'drop' | 'create') => {
    try {
      await applyIndexSuggestion(id, { action });
      message.success(`${action === 'drop' ? '删除' : '创建'}索引成功`);
      loadData();
    } catch (e: unknown) {
      message.error(`操作失败: ${(e as Error).message}`);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissAnalysis(id, { reason: '手动驳回' });
      message.success('已驳回该分析项');
      loadData();
    } catch (e: unknown) {
      message.error(`驳回失败: ${(e as Error).message}`);
    }
  };

  const typeLabel: Record<string, string> = {
    unused: '未使用索引',
    duplicate: '冗余索引',
    missing: '缺失索引',
    low_usage: '低使用率',
    bloat: '索引膨胀',
  };

  const resultColor: Record<string, string> = {
    recommend_drop: 'red',
    recommend_create: 'green',
    recommend_merge: 'orange',
    monitor: 'blue',
    healthy: 'default',
  };

  const columns = [
    { key: 'analysisType', title: '分析类型', width: 120, render: (v: unknown) => <Tag>{typeLabel[v as string] || v}</Tag> },
    {
      key: 'tableName',
      title: '表名',
      width: 180,
      render: (v: unknown, r: IndexAnalysisEntity) => (
        <Space><DatabaseOutlined style={{ color: colors.primary[500] }} /><Text>{r.schemaName}.{r.tableName}</Text></Space>
      ),
    },
    { key: 'indexName', title: '索引名', ellipsis: true, render: (v: unknown) => <Text code style={{ fontSize: 12 }}>{String(v)}</Text> },
    {
      key: 'analysisResult',
      title: '建议',
      width: 120,
      render: (v: unknown) => <Tag color={resultColor[v as string] || 'default'}>{v as string}</Tag>,
    },
    {
      key: 'priority',
      title: '优先级',
      width: 90,
      render: (v: unknown) => {
        const colorMap: Record<string, string> = { critical: 'red', high: 'orange', medium: 'blue', low: 'default' };
        return <Tag color={colorMap[v as string]}>{v}</Tag>;
      },
    },
    { key: 'indexScans', title: '扫描次数', width: 100, sorter: true },
    {
      key: 'indexSizeBytes',
      title: '索引大小',
      width: 110,
      render: (v: unknown) => `${(Number(v) / 1024 / 1024).toFixed(1)} MB`,
    },
    { key: 'status', title: '状态', width: 90, render: (v: unknown) => <Tag>{v as string}</Tag> },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, r: IndexAnalysisEntity) => (
        <Space size="small">
          {r.status === 'open' && r.analysisResult === 'recommend_drop' && (
            <Popconfirm title="确认删除此索引？" onConfirm={() => handleApply(r.id, 'drop')}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
          {r.status === 'open' && r.analysisResult === 'recommend_create' && (
            <Button type="link" size="small" onClick={() => handleApply(r.id, 'create')}>创建</Button>
          )}
          {r.status === 'open' && (
            <Popconfirm title="确认驳回？" onConfirm={() => handleDismiss(r.id)}>
              <Button type="link" size="small">驳回</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        索引分析
      </Title>

      {/* 统计行 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small"><Statistic title="未使用索引" value={items.filter(i => i.analysisType === 'unused').length} valueStyle={{ color: colors.error[500] }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="冗余索引" value={items.filter(i => i.analysisType === 'duplicate').length} valueStyle={{ color: colors.warning[500] }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="缺失索引建议" value={items.filter(i => i.analysisType === 'missing').length} valueStyle={{ color: colors.success[500] }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="可释放空间" value="—" suffix="MB" /></Card>
        </Col>
      </Row>

      {/* 工具栏 */}
      <Card size="small" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
        <Space>
          <Select
            style={{ width: 140 }}
            value={activeType}
            onChange={(v) => { setActiveType(v); setPage(1); }}
            options={[
              { label: '全部类型', value: 'all' },
              ...Object.entries(typeLabel).map(([k, v]) => ({ label: v, value: k })),
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadData(); }} loading={loading}>刷新</Button>
          <Button icon={<DownloadOutlined />} loading={analyzing} onClick={handleAnalyze}>分析索引</Button>
        </Space>
      </Card>

      <TableComponent
        columns={columns}
        dataSource={items}
        loading={loading}
        rowKey="id"
        striped
        pagination={{ current: page, pageSize: 20, total, showTotal: (t: number) => `共 ${t} 条`, onChange: (p) => setPage(p) }}
        locale={{ emptyText: <Empty description="暂无索引分析数据，请先执行分析" /> }}
      />
    </div>
  );
};

export default IndexAnalysis;
```

### 5.6 页面 5：Schema 变更列表（`/dba/schema-changes`）

```tsx
/**
 * Schema 变更列表
 * 路径: /dba/schema-changes
 * 组件: SchemaChangeList
 */
import React, { useState, useEffect } from 'react';
import { Typography, Table, Card, Button, Space, Tag, Select, Input, Popconfirm, message, Empty, Badge } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, PlayCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageSkeleton from '@/components/PageSkeleton';
import TableComponent from '@/components/Table';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { componentRadius } from '@/tokens/radius';
import { listSchemaChanges, executeSchemaChange, rollbackSchemaChange, cancelSchemaChange } from '@/api/dba-devops';

const { Title, Text } = Typography;

const SchemaChangeList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<SchemaChangeEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', riskLevel: '', database: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listSchemaChanges({ page, limit: 20, ...filters });
      setChanges(res.data?.data?.items ?? []);
      setTotal(res.data?.data?.total ?? 0);
    } catch (e: unknown) {
      message.error(`加载变更列表失败: ${(e as Error).message}`);
      setChanges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [page, filters]);

  const handleExecute = async (id: string) => {
    try {
      await executeSchemaChange(id);
      message.success('变更已提交执行');
      loadData();
    } catch (e: unknown) {
      message.error(`执行失败: ${(e as Error).message}`);
    }
  };

  const handleRollback = async (id: string) => {
    try {
      await rollbackSchemaChange(id);
      message.success('变更已回滚');
      loadData();
    } catch (e: unknown) {
      message.error(`回滚失败: ${(e as Error).message}`);
    }
  };

  const statusColor: Record<string, string> = {
    draft: 'default', pending_review: 'processing', approved: 'cyan', rejected: 'red',
    executing: 'orange', completed: 'success', failed: 'error', rolled_back: 'magenta', cancelled: 'default',
  };
  const statusLabel: Record<string, string> = {
    draft: '草稿', pending_review: '待审批', approved: '已批准', rejected: '已拒绝',
    executing: '执行中', completed: '已完成', failed: '失败', rolled_back: '已回滚', cancelled: '已取消',
  };

  const columns = [
    { key: 'changeNumber', title: '变更编号', width: 160, render: (v: unknown) => <Text code>{String(v)}</Text> },
    { key: 'title', title: '标题', ellipsis: true, render: (v: unknown) => <Text strong>{String(v)}</Text> },
    {
      key: 'databaseName',
      title: '数据库',
      width: 140,
      render: (v: unknown) => <Space><DatabaseOutlined style={{ color: colors.primary[500] }} /><Text>{String(v)}</Text></Space>,
    },
    { key: 'changeType', title: '变更类型', width: 120, render: (v: unknown) => <Tag>{v}</Tag> },
    {
      key: 'riskLevel',
      title: '风险等级',
      width: 100,
      render: (v: unknown) => {
        const c: Record<string, string> = { low: 'green', medium: 'blue', high: 'orange', critical: 'red' };
        return <Tag color={c[v as string]}>{v}</Tag>;
      },
    },
    {
      key: 'status',
      title: '状态',
      width: 110,
      render: (v: unknown) => <Badge status={statusColor[v as string]} text={statusLabel[v as string]} />,
    },
    { key: 'requester', title: '申请人', width: 120 },
    { key: 'createdAt', title: '创建时间', width: 160 },
    {
      key: 'actions',
      title: '操作',
      width: 240,
      render: (_: unknown, r: SchemaChangeEntity) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/dba/schema-changes/${r.id}`)}>详情</Button>
          {r.status === 'approved' && (
            <Popconfirm title="确认执行此变更？" onConfirm={() => handleExecute(r.id)}>
              <Button type="link" size="small" style={{ color: colors.success[500] }} icon={<PlayCircleOutlined />}>执行</Button>
            </Popconfirm>
          )}
          {r.status === 'completed' && r.rollbackSql && (
            <Popconfirm title="确认回滚此变更？" onConfirm={() => handleRollback(r.id)}>
              <Button type="link" size="small" danger icon={<RollbackOutlined />}>回滚</Button>
            </Popconfirm>
          )}
          {r.status === 'pending_review' && (
            <Popconfirm title="确认取消？" onConfirm={() => handleCancel(r.id)}>
              <Button type="link" size="small">取消</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Schema 变更
      </Title>

      <Card size="small" style={{ borderRadius: componentRadius.card, marginBottom: spacing.md }}>
        <Space>
          <Input placeholder="搜索变更..." prefix={<SearchOutlined />} style={{ width: 200 }}
            value={filters.database || ''} onChange={(e) => setFilters({ ...filters, database: e.target.value })} />
          <Select style={{ width: 120 }} placeholder="状态" allowClear value={filters.status || undefined}
            onChange={(v) => { setFilters({ ...filters, status: v || '' }); setPage(1); }}
            options={Object.entries(statusLabel).map(([k, v]) => ({ label: v, value: k }))} />
          <Select style={{ width: 120 }} placeholder="风险" allowClear value={filters.riskLevel || undefined}
            onChange={(v) => { setFilters({ ...filters, riskLevel: v || '' }); setPage(1); }}
            options={[{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }, { label: 'Critical', value: 'critical' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadData(); }} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dba/schema-changes/new')}>新建变更</Button>
        </Space>
      </Card>

      <TableComponent columns={columns} dataSource={changes} loading={loading} rowKey="id" striped
        pagination={{ current: page, pageSize: 20, total, showTotal: (t: number) => `共 ${t} 条`, onChange: (p) => setPage(p) }}
        locale={{ emptyText: <Empty description="暂无变更" /> }} />
    </div>
  );
};

export default SchemaChangeList;
```

### 5.7 页面 6：Schema 变更申请（`/dba/schema-changes/new`）

```tsx
/**
 * Schema 变更申请表单
 * 路径: /dba/schema-changes/new
 * 组件: SchemaChangeForm
 */
import React, { useState } from 'react';
import { Typography, Form, Input, Select, Button, Card, Space, Tag, Alert, message, Divider } from 'antd';
import { ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { componentRadius } from '@/tokens/radius';
import { createSchemaChange, getRiskAssessment } from '@/api/dba-devops';

const { Title, Text } = Typography;
const { TextArea } = Input;

const changeTypeOptions = [
  { label: 'CREATE TABLE', value: 'create_table' },
  { label: 'ALTER TABLE', value: 'alter_table' },
  { label: 'ADD COLUMN', value: 'add_column' },
  { label: 'DROP COLUMN', value: 'drop_column' },
  { label: 'MODIFY COLUMN', value: 'modify_column' },
  { label: 'CREATE INDEX', value: 'create_index' },
  { label: 'DROP INDEX', value: 'drop_index' },
  { label: 'CREATE CONSTRAINT', value: 'create_constraint' },
  { label: 'DROP CONSTRAINT', value: 'drop_constraint' },
];

const SchemaChangeForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);

  const handleAssess = async () => {
    try {
      const values = await form.validateFields(['databaseName', 'tableName', 'changeType', 'ddlSql']);
      setAssessing(true);
      // 先创建草稿获取 ID，再评估风险
      const res = await createSchemaChange({ ...values, title: form.getFieldValue('title') || '待填写', status: 'draft' });
      const id = res.data?.data?.id;
      if (id) {
        const riskRes = await getRiskAssessment(id);
        setRiskAssessment(riskRes.data?.data ?? null);
        message.success('风险评估完成');
      }
    } catch (e: unknown) {
      const err = e as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`风险评估失败: ${(e as Error).message}`);
      }
    } finally {
      setAssessing(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createSchemaChange(values);
      message.success('变更申请已提交，等待审批');
      navigate('/dba/schema-changes');
    } catch (e: unknown) {
      const err = e as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`提交失败: ${(e as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const riskColor: Record<string, string> = { low: colors.success[500], medium: colors.warning[500], high: colors.error[500], critical: '#7C5CFC' };

  return (
    <div style={{ padding: spacing.lg }}>
      <Space style={{ marginBottom: spacing.md }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
        <Title level={2} style={{ margin: 0 }}>
          <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          新建 Schema 变更
        </Title>
      </Space>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <Card style={{ borderRadius: componentRadius.card }}>
          <Form form={form} layout="vertical">
            <Form.Item name="title" label="变更标题" rules={[{ required: true, message: '请输入变更标题' }]}>
              <Input placeholder="如: 为 users 表添加 email 索引" />
            </Form.Item>

            <Form.Item name="databaseName" label="目标数据库" rules={[{ required: true, message: '请选择目标数据库' }]}>
              <Select placeholder="选择数据库" options={/* 从数据源 API 获取 */ []} />
            </Form.Item>

            <Form.Item name="schemaName" label="Schema" initialValue="public">
              <Input placeholder="public" />
            </Form.Item>

            <Form.Item name="tableName" label="目标表">
              <Input placeholder="如: users" />
            </Form.Item>

            <Form.Item name="changeType" label="变更类型" rules={[{ required: true, message: '请选择变更类型' }]}>
              <Select options={changeTypeOptions} />
            </Form.Item>

            <Form.Item name="ddlSql" label="DDL 语句" rules={[{ required: true, message: '请输入 DDL 语句' }]}>
              <TextArea rows={6} placeholder="CREATE INDEX idx_users_email ON users(email);" style={{ fontFamily: 'monospace' }} />
            </Form.Item>

            <Form.Item name="rollbackSql" label="回滚 DDL（可选）">
              <TextArea rows={3} placeholder="DROP INDEX idx_users_email;" style={{ fontFamily: 'monospace' }} />
            </Form.Item>

            <Form.Item name="description" label="变更说明">
              <TextArea rows={3} placeholder="说明变更原因和影响范围..." />
            </Form.Item>

            <Form.Item name="scheduledAt" label="计划执行时间（可选）">
              <Input type="datetime-local" />
            </Form.Item>

            <Divider />

            {/* 风险评估 */}
            <Form.Item label="风险评估">
              <Button loading={assessing} onClick={handleAssess}>
                执行风险评估
              </Button>
              {riskAssessment && (
                <Alert
                  message={`风险等级: ${riskAssessment.level.toUpperCase()}`}
                  description={
                    <>
                      <Text>风险评分: {riskAssessment.score}</Text>
                      <ul>
                        {riskAssessment.factors.map((f, i) => (
                          <li key={i}><Tag color={riskColor[f.level]}>{f.level}</Tag> {f.description}</li>
                        ))}
                      </ul>
                    </>
                  }
                  type={
                    riskAssessment.level === 'critical' ? 'error' :
                    riskAssessment.level === 'high' ? 'warning' : 'info'
                  }
                  style={{ marginTop: spacing.sm }}
                />
              )}
            </Form.Item>

            {/* 提交按钮 */}
            <Form.Item>
              <Space>
                <Button type="primary" onClick={handleSubmit} loading={submitting} block>
                  提交变更申请
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default SchemaChangeForm;
```

---

## 六、前端 API Client

**新建文件**：`orion-frontend/src/api/dba-devops.ts`

```typescript
/**
 * DBA DevOps API Client
 * 慢 SQL / 索引分析 / Schema 变更 / 仪表盘
 */
import { api } from './client';

// ---- Dashboard ----

export function getDbaDashboard() {
  return api.get('/dba/dashboard');
}

// ---- Slow Queries ----

export function listSlowQueries(params?: {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  database?: string;
  orderBy?: string;
}) {
  return api.get('/dba/slow-queries', { params });
}

export function getSlowQuery(id: string) {
  return api.get(`/dba/slow-queries/${id}`);
}

export function analyzeSlowQuery(id: string) {
  return api.post(`/dba/slow-queries/${id}/analyze`);
}

export function updateSlowQueryStatus(id: string, data: { status: string; notes?: string }) {
  return api.patch(`/dba/slow-queries/${id}/status`, data);
}

export function collectSlowQueries(params?: { databaseName?: string; thresholdMs?: number }) {
  return api.post('/dba/slow-queries/collect', params ?? {});
}

// ---- Index Analysis ----

export function listIndexAnalyses(params?: {
  page?: number;
  limit?: number;
  type?: string;
  result?: string;
  status?: string;
  table?: string;
}) {
  return api.get('/dba/indexes', { params });
}

export function analyzeIndexes(params?: { databaseName?: string }) {
  return api.post('/dba/indexes/analyze', params ?? {});
}

export function applyIndexSuggestion(id: string, data: { action: 'drop' | 'create' | 'merge' }) {
  return api.post(`/dba/indexes/${id}/apply`, data);
}

export function dismissAnalysis(id: string, data: { reason: string }) {
  return api.patch(`/dba/indexes/${id}/dismiss`, data);
}

// ---- Schema Changes ----

export function listSchemaChanges(params?: {
  page?: number;
  limit?: number;
  status?: string;
  riskLevel?: string;
  database?: string;
  requester?: string;
}) {
  return api.get('/dba/schema-changes', { params });
}

export function getSchemaChange(id: string) {
  return api.get(`/dba/schema-changes/${id}`);
}

export function createSchemaChange(data: CreateSchemaChangeInput) {
  return api.post('/dba/schema-changes', data);
}

export function getRiskAssessment(id: string) {
  return api.get(`/dba/schema-changes/${id}/risk`);
}

export function executeSchemaChange(id: string) {
  return api.post(`/dba/schema-changes/${id}/execute`);
}

export function rollbackSchemaChange(id: string) {
  return api.post(`/dba/schema-changes/${id}/rollback`);
}

export function cancelSchemaChange(id: string, data: { reason: string }) {
  return api.post(`/dba/schema-changes/${id}/cancel`, data);
}
```

---

## 七、路由注册

### 7.1 后端路由注册

在 `orion-platform-service/src/api/routes.ts` 中添加：

```typescript
// DBA DevOps
import { dbaDevOpsRoutes } from './dba-devops-routes';

await app.register(dbaDevOpsRoutes, { prefix: '/api/v1' });
```

### 7.2 前端路由注册

在 `orion-frontend/src/router/routes.tsx` 中添加：

```tsx
{
  path: '/dba',
  element: <DbaDashboard />,
  protected: true,
  meta: { title: '数据库 DevOps', icon: <DatabaseOutlined /> },
},
{
  path: '/dba/slow-queries',
  element: <SlowQueryList />,
  protected: true,
  meta: { title: '慢 SQL 列表' },
},
{
  path: '/dba/slow-queries/:id',
  element: <SlowQueryDetail />,
  protected: true,
  meta: { title: '慢查询详情' },
},
{
  path: '/dba/indexes',
  element: <IndexAnalysis />,
  protected: true,
  meta: { title: '索引分析' },
},
{
  path: '/dba/schema-changes',
  element: <SchemaChangeList />,
  protected: true,
  meta: { title: 'Schema 变更' },
},
{
  path: '/dba/schema-changes/new',
  element: <SchemaChangeForm />,
  protected: true,
  meta: { title: '新建变更' },
},
```

### 7.3 菜单配置

在菜单配置中添加到"基础设施"模块下：

```typescript
{
  key: 'dba',
  label: '数据库 DevOps',
  icon: <DatabaseOutlined />,
  children: [
    { key: '/dba', label: '仪表盘' },
    { key: '/dba/slow-queries', label: '慢 SQL' },
    { key: '/dba/indexes', label: '索引分析' },
    { key: '/dba/schema-changes', label: 'Schema 变更' },
  ],
}
```

---

## 八、验收标准

### 8.1 后端验收

| # | 验收项 | 标准 | 验证方法 |
|---|--------|------|----------|
| R1 | 3 张表 DDL | 符合规范 11.8（UUID 主键 / RLS / TIMESTAMPTZ / created_by / updated_by / deleted_at / 触发器 / CHECK 约束 / Rollback） | 审查迁移 SQL |
| R2 | 慢查询采集 | 从 `pg_stat_statements` 采集 > 1s 的查询，按天去重 | 单元测试 + 集成测试 |
| R3 | 慢查询列表 API | `GET /dba/slow-queries` 支持分页、过滤、排序，返回 `PaginatedResult` | API 测试 |
| R4 | EXPLAIN ANALYZE | 返回结构化执行计划，检测 Seq Scan / Nested Loop / Sort(disk) | 集成测试 |
| R5 | 慢查询趋势 | `GET /dba/slow-queries/trends` 按 day/week/month 聚合，返回 `{ points }` | API 测试 |
| R6 | Top N 排名 | `GET /dba/slow-queries/top` 支持按 mean_time / total_time / count 排序 | API 测试 |
| R7 | 索引分析 | 检测未使用（`idx_scan=0`）+ 冗余（前缀子集）+ 缺失（基于慢查询） | 集成测试 |
| R8 | 索引统计 | `GET /dba/indexes/stats` 返回各表索引数量、未使用数、空间占用 | API 测试 |
| R9 | Schema 变更申请 | 创建草稿 → 提交审批 → 审批 → 执行 → 回滚，全状态流转正确 | 集成测试 |
| R10 | 风险评估 | 基于表行数 + 操作类型 + 锁类型自动评分，输出 low/medium/high/critical | 单元测试 |
| R11 | 变更历史审计 | `GET /dba/schema-changes/history` 返回指定时间范围的全部变更 | API 测试 |
| R12 | 权限控制 | 4 角色权限验证，越权访问返回 403 | 集成测试 |
| R13 | Rollback 迁移 | `192_rollback_dba_devops_tables.sql` 可干净执行 | 手动执行验证 |

### 8.2 前端验收

| # | 验收项 | 标准 | 验证方法 |
|---|--------|------|----------|
| F1 | 仪表盘加载 | 4 个统计卡片 + 趋势图 + Top 5 + 最近变更，加载时显示 PageSkeleton | 手动 + E2E |
| F2 | 慢 SQL 列表 | 分页、搜索、状态/严重度过滤、采集按钮、空状态引导 | 手动 + E2E |
| F3 | SQL 详情页 | 基本信息 + SQL 文本（可复制）+ EXPLAIN 分析 + 优化建议 + 标记操作 | 手动 |
| F4 | 索引分析 | 统计行 + 类型 Tab + 表格（删除/创建/驳回操作）+ 空状态引导 | 手动 + E2E |
| F5 | Schema 变更列表 | 分页 + 过滤 + 状态 Badge + 执行/回滚/取消操作 + Popconfirm 二次确认 | 手动 + E2E |
| F6 | 变更申请表单 | 必填校验 + DDL 输入 + 回滚 SQL + 风险评估 + 提交成功跳转 | 手动 |
| F7 | Design Token | 全部色值/间距/圆角使用 Token（colors / spacing / componentRadius），无硬编码 | 代码审查 |
| F8 | 操作反馈 | 每个异步操作有 `message.success` / `message.error`，按钮有 loading/disabled | 代码审查 |
| F9 | 空状态 | 每个列表页无数据时显示 `<Empty description="..." />` + 引导按钮 | 代码审查 |
| F10 | 标题规范 | 页面主标题 `level={2}` + 图标 + `marginBottom: 8px`，副标题 `colors.neutral[500]` | 代码审查 |
| F11 | 页面 FCP | < 1.8s，使用路由懒加载 + PageSkeleton | Lighthouse |
| F12 | 编辑完整性 | 每个数据实体支持 CRUD 完整操作链（创建 → 查看 → 编辑 → 删除/归档） | 场景逆向验证 |

### 8.3 端到端场景验收

| # | 场景 | 步骤 | 预期结果 |
|---|------|------|----------|
| E1 | 发现并优化慢查询 | 仪表盘发现 Critical 慢查询 → 点击详情 → 执行 EXPLAIN → 查看优化建议 → 标记为已优化 | 慢查询状态变为 `optimized`，仪表盘统计更新 |
| E2 | 删除未使用索引 | 索引分析页看到未使用索引 → 点击"删除" → Popconfirm 确认 → 执行成功 | 索引从列表中移除，仪表盘可释放空间更新 |
| E3 | Schema 变更全流程 | 创建变更申请 → 风险评估为 high → 提交审批 → DBA 审批通过 → 执行 → 完成 | 变更状态从 `draft` → `pending_review` → `approved` → `executing` → `completed` |
| E4 | 变更回滚 | 变更执行后发现异常 → 点击"回滚" → 确认 → 回滚成功 | 变更状态变为 `rolled_back`，rollback_output 有记录 |
| E5 | 权限隔离 | developer 角色访问变更列表 → 可见 → 尝试审批 → 返回 403 | 权限控制生效 |

---

## 九、交付清单

| 类别 | 文件 | 状态 |
|------|------|------|
| **数据库迁移** | `192_create_dba_devops_tables.sql` | 待创建 |
| **数据库回滚** | `192_rollback_dba_devops_tables.sql` | 待创建 |
| **后端服务** | `src/services/dba/dba-slow-query-service.ts` | 待创建 |
| **后端服务** | `src/services/dba/dba-index-service.ts` | 待创建 |
| **后端服务** | `src/services/dba/dba-schema-change-service.ts` | 待创建 |
| **后端服务** | `src/services/dba/dba-dashboard-service.ts` | 待创建 |
| **后端路由** | `src/api/dba-devops-routes.ts` | 待创建 |
| **路由注册** | `src/api/routes.ts` (修改) | 待修改 |
| **前端页面** | `orion-frontend/src/pages/dba/DbaDashboard.tsx` | 待创建 |
| **前端页面** | `orion-frontend/src/pages/dba/SlowQueryList.tsx` | 待创建 |
| **前端页面** | `orion-frontend/src/pages/dba/SlowQueryDetail.tsx` | 待创建 |
| **前端页面** | `orion-frontend/src/pages/dba/IndexAnalysis.tsx` | 待创建 |
| **前端页面** | `orion-frontend/src/pages/dba/SchemaChangeList.tsx` | 待创建 |
| **前端页面** | `orion-frontend/src/pages/dba/SchemaChangeForm.tsx` | 待创建 |
| **前端路由** | `orion-frontend/src/router/routes.tsx` (修改) | 待修改 |
| **前端 API** | `orion-frontend/src/api/dba-devops.ts` | 待创建 |
| **前端组件** | `orion-frontend/src/components/ExplainTree.tsx`（执行计划树可视化） | 待创建 |
| **测试** | `src/services/dba/__tests__/dba-slow-query-service.test.ts` | 待创建 |
| **测试** | `src/services/dba/__tests__/dba-index-service.test.ts` | 待创建 |
| **测试** | `src/services/dba/__tests__/dba-schema-change-service.test.ts` | 待创建 |
| **测试** | `orion-frontend/src/pages/dba/__tests__/DbaDashboard.test.tsx` | 待创建 |

---

## 十、风险与依赖说明

### 10.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `pg_stat_statements` 扩展未安装 | 无法采集慢查询 | 启动时检查扩展，提供应用层日志采集降级方案 |
| 大表 EXPLAIN ANALYZE 超时 | 详情页加载失败 | 设置 30s 超时 + 异步分析 + 结果缓存 |
| 变更执行时锁表阻塞业务 | 生产可用性影响 | 强制要求 `CONCURRENTLY` + 计划执行时间 + 锁检测前置 |
| 索引分析误判 | 误删有用索引 | 删除操作需 Popconfirm + 二次确认 + 回滚能力 |

### 10.2 外部依赖确认

| 依赖 | 当前状态 | 需要确认 |
|------|---------|----------|
| `pg_stat_statements` | PostgreSQL 标准扩展 | 各环境是否已安装启用 |
| 审批流引擎 (ApprovalService) | 已有实现 | 是否支持 DBA 变更审批节点 |
| EventBus | 已有实现 (NATS + in-memory) | DBA 变更事件是否需要推送通知 |
| 数据源管理 (dba.ts 已有 DataSource) | 已有 CRUD | 是否需要扩展以支持多实例连接 |

### 10.3 与现有 DBA 模块的关系

现有 `orion-frontend/src/pages/dba/DbaPage.tsx` 已实现：
- SQL 工单管理（orders）
- 数据源管理（datasources）
- 审计规则（audit-rules）

本次新增的 DBA DevOps 模块是**独立增强**，不替代现有功能。建议将 `DbaPage` 重构为：

```
/dba                     → DbaDashboard（新增的仪表盘，替代原来的三 Tab 页面）
/dba/orders              → SQL工单（原有 DbaPage 的 orders tab，拆为独立页）
/dba/datasources         → 数据源管理（原有 datasources tab，拆为独立页）
/dba/slow-queries        → 慢 SQL（新增）
/dba/indexes             → 索引分析（新增）
/dba/schema-changes      → Schema 变更（新增）
```

---

## 十一、与升级执行计划对齐

本设计文档对应 `docs/plans/orion-upgrade-executable-plan-2026-05-22.md` 中：

| 计划章节 | 对应内容 |
|---------|---------|
| Section 11.6 — 数据库 DevOps | 新建 3 张表（`dba_slow_queries`, `dba_index_analysis`, `dba_schema_changes`），迁移编号 192 |
| Section 11.8 — 新建表设计规范 | 全部 DDL 符合 UUID 主键 / RLS / TIMESTAMPTZ / 审计字段 / CHECK 约束 / 触发器 / Rollback |
| Section 11.11 — 补充规范 | updated_by / 触发器 / CHECK 约束 / Rollback / a11y / 性能指标全部覆盖 |
| Section 12.5 — DDL 完整性验证 | 本文档提供完整 DDL，消除"11.6 节 19 张表无 DDL"问题 |
