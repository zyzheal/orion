# 元数据管理（Metadata Management）能力增强设计

> **日期**: 2026-05-22
> **状态**: 设计中
> **模块优先级**: P1
> **基于模块**: CMDB（`services/cmdb/`）
> **目标成熟度**: 7/10 → 8.5/10

---

## 一、业务概述与现状评估

### 1.1 背景

Orion CMDB 已有完整的 CI（配置项）管理、拓扑关系、K8s 调和能力。
但缺少**元数据增强**能力：数据源管理、采集任务调度、数据字典、业务术语表等企业级元数据管理功能。

### 1.2 现状评估

| 维度 | 现状 | 文件 |
|------|------|------|
| CI 管理 | ✅ 完整 | `CmdbService.ts` |
| 拓扑关系 | ✅ 完整 | `TopologyService.ts` |
| K8s 调和 | ✅ 完整 | `K8sReconciliationService.ts` |
| 数据目录 | ❌ 缺失 | 无统一数据资产目录 |
| 数据源管理 | ❌ 缺失 | 无数据源注册/测试/监控 |
| 采集任务 | ❌ 缺失 | 无元数据采集调度 |
| 数据字典 | ❌ 缺失 | 无表/字段级元数据 |
| 业务术语 | ❌ 缺失 | 无术语表/词根管理 |

### 1.3 增强目标

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 数据目录 | 统一数据资产视图，按域/类型/来源分类 | 8.5 |
| 数据源管理 | 注册/测试/监控数据源（DB/API/文件/K8s） | 8.5 |
| 采集任务 | 定时/手动元数据采集，进度跟踪 | 8.5 |
| 数据详情 | 表结构、字段信息、血缘关系、质量指标 | 8.5 |
| 业务术语表 | 术语定义、词根管理、术语-字段映射 | 8.5 |

---

## 二、功能设计（后端）

### 2.1 数据目录

统一展示所有已采集的数据资产，支持：
- 按域分类（业务域：订单、用户、支付、物流）
- 按类型分类（表、API、Topic、File）
- 按来源分类（MySQL、PostgreSQL、Kafka、K8s）
- 搜索（名称/描述/标签）
- 质量评分（基于采集结果的完整性）

### 2.2 数据源管理

**支持的数据源类型**：

```typescript
type DataSourceType = 'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'kafka' | 'elasticsearch' | 'api' | 'k8s' | 'file';

interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  connectionConfig: Record<string, any>;  // 加密存储
  status: 'active' | 'inactive' | 'error' | 'testing';
  lastTestAt?: Date;
  lastTestResult?: { success: boolean; message: string };
  metadata: { databaseCount?: number; tableCount?: number; lastCrawlAt?: Date };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 采集任务

```typescript
interface CrawlTask {
  id: string;
  dataSourceId: string;
  name: string;
  schedule: string;              // cron 表达式
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  lastRunAt?: Date;
  lastRunResult?: { success: boolean; tablesFound: number; fieldsFound: number; durationMs: number };
  nextRunAt?: Date;
  config: {
    includePatterns?: string[];
    excludePatterns?: string[];
    extractDDL?: boolean;
    extractSampleData?: boolean;
    extractLineage?: boolean;
  };
  createdBy: string;
  createdAt: Date;
}
```

### 2.4 业务术语表

```typescript
interface BusinessTerm {
  id: string;
  term: string;                  // 术语名称
  definition: string;            // 定义
  category: string;              // 分类
  synonyms: string[];            // 同义词
  rootWord?: string;             // 词根
  mappedFields: {                // 关联的物理字段
    dataSourceId: string;
    tableName: string;
    fieldName: string;
  }[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 三、数据模型设计

### 3.1 新增数据库表

```sql
-- 数据源表
CREATE TABLE metadata_data_sources (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  type            VARCHAR(30) NOT NULL,
  connection_config JSONB NOT NULL,           -- 加密存储
  status          VARCHAR(20) NOT NULL DEFAULT 'inactive',
  last_test_at    TIMESTAMP,
  last_test_result JSONB,
  metadata        JSONB DEFAULT '{}',
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 数据目录表
CREATE TABLE metadata_catalog (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  data_source_id  VARCHAR(36) NOT NULL,
  name            VARCHAR(200) NOT NULL,       -- 表名/Topic名/API路径
  type            VARCHAR(20) NOT NULL,        -- table/topic/api/file
  domain          VARCHAR(50),                  -- 业务域
  description     TEXT,
  schema_info     JSONB,                        -- 字段信息
  quality_score   DECIMAL(3,2) DEFAULT 0.00,
  sample_count    INT DEFAULT 0,
  row_count       BIGINT,
  tags            JSONB DEFAULT '[]',
  last_crawled_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- 采集任务表
CREATE TABLE metadata_crawl_tasks (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  data_source_id  VARCHAR(36) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  schedule        VARCHAR(50),                  -- cron 表达式
  status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  last_run_at     TIMESTAMP,
  last_run_result JSONB,
  next_run_at     TIMESTAMP,
  config          JSONB DEFAULT '{}',
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- 业务术语表
CREATE TABLE business_terms (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  term            VARCHAR(100) NOT NULL,
  definition      TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL,
  synonyms        JSONB DEFAULT '[]',
  root_word       VARCHAR(100),
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, term)
);

-- 术语-字段映射表
CREATE TABLE term_field_mappings (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id         VARCHAR(36) NOT NULL,
  catalog_id      VARCHAR(36) NOT NULL,
  field_name      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 字段血缘表
CREATE TABLE field_lineage (
  id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  source_catalog_id VARCHAR(36) NOT NULL,
  source_field    VARCHAR(100) NOT NULL,
  target_catalog_id VARCHAR(36) NOT NULL,
  target_field    VARCHAR(100) NOT NULL,
  transform_type  VARCHAR(30),                   -- direct/transform/aggregate
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_catalog_tenant ON metadata_catalog(tenant_id);
CREATE INDEX idx_catalog_domain ON metadata_catalog(domain);
CREATE INDEX idx_catalog_type ON metadata_catalog(type);
CREATE INDEX idx_crawl_tasks_tenant ON metadata_crawl_tasks(tenant_id);
CREATE INDEX idx_terms_tenant ON business_terms(tenant_id);
CREATE INDEX idx_lineage_tenant ON field_lineage(tenant_id);
```

---

## 四、API 路由设计

### 4.1 端点清单

| 方法 | 路径 | 描述 | 权限 | 请求体 | 响应 |
|------|------|------|------|--------|------|
| **数据源管理** |
| POST | `/metadata/data-sources` | 注册数据源 | `metadata:write` | `DataSourceCreate` | `{ data: DataSource }` |
| GET | `/metadata/data-sources` | 数据源列表 | `metadata:read` | query | `{ data: [], total }` |
| GET | `/metadata/data-sources/:id` | 数据源详情 | `metadata:read` | - | `{ data: DataSource }` |
| PUT | `/metadata/data-sources/:id` | 更新数据源 | `metadata:write` | `DataSourceUpdate` | `{ data: DataSource }` |
| DELETE | `/metadata/data-sources/:id` | 删除数据源 | `metadata:admin` | - | `{ success: true }` |
| POST | `/metadata/data-sources/:id/test` | 测试连接 | `metadata:write` | - | `{ data: { success, message } }` |
| **数据目录** |
| GET | `/metadata/catalog` | 数据目录列表 | `metadata:read` | query | `{ data: MetadataCatalog[], total }` |
| GET | `/metadata/catalog/:id` | 数据详情 | `metadata:read` | - | `{ data: MetadataCatalog }` |
| GET | `/metadata/catalog/:id/lineage` | 字段血缘 | `metadata:read` | - | `{ data: FieldLineage[] }` |
| GET | `/metadata/catalog/stats` | 目录统计 | `metadata:read` | query | `{ data: { byDomain, byType, totalQuality } }` |
| **采集任务** |
| POST | `/metadata/crawl-tasks` | 创建采集任务 | `metadata:write` | `CrawlTaskCreate` | `{ data: CrawlTask }` |
| GET | `/metadata/crawl-tasks` | 任务列表 | `metadata:read` | query | `{ data: [], total }` |
| GET | `/metadata/crawl-tasks/:id` | 任务详情 | `metadata:read` | - | `{ data: CrawlTask }` |
| POST | `/metadata/crawl-tasks/:id/run` | 手动执行 | `metadata:write` | - | `{ data: { taskId, status } }` |
| POST | `/metadata/crawl-tasks/:id/pause` | 暂停任务 | `metadata:write` | - | `{ data: { status } }` |
| DELETE | `/metadata/crawl-tasks/:id` | 删除任务 | `metadata:admin` | - | `{ success: true }` |
| **业务术语** |
| POST | `/metadata/terms` | 创建术语 | `metadata:write` | `TermCreate` | `{ data: BusinessTerm }` |
| GET | `/metadata/terms` | 术语列表 | `metadata:read` | query | `{ data: [], total }` |
| GET | `/metadata/terms/:id` | 术语详情 | `metadata:read` | - | `{ data: BusinessTerm }` |
| PUT | `/metadata/terms/:id` | 更新术语 | `metadata:write` | `TermUpdate` | `{ data: BusinessTerm }` |
| DELETE | `/metadata/terms/:id` | 删除术语 | `metadata:admin` | - | `{ success: true }` |
| POST | `/metadata/terms/:id/map-field` | 映射字段 | `metadata:write` | `{ catalogId, fieldName }` | `{ success: true }` |

---

## 五、页面交互设计（前端）

### 5.1 页面清单

| 页面 | 路径 | 菜单归属 | 核心功能 |
|------|------|----------|----------|
| 数据目录 | `/governance/metadata-catalog` | 治理 | 搜索/过滤/分类浏览/质量评分 |
| 数据源管理 | `/governance/data-sources` | 治理 | 注册/测试/监控数据源 |
| 采集任务 | `/governance/crawl-tasks` | 治理 | 创建/执行/暂停/查看日志 |
| 数据详情 | `/governance/metadata-catalog/:id` | 治理 | 表结构/字段/血缘/样本 |
| 业务术语表 | `/governance/business-terms` | 治理 | 术语 CRUD/映射字段 |

### 5.2 数据目录页

**文件**: `orion-frontend/src/pages/MetadataCatalog/index.tsx`

```tsx
// 数据目录搜索与分类浏览
// 左侧: 分类树（按域/类型/来源）
// 中间: 搜索 + 过滤
// 右侧: 数据资产列表

const handleSearch = async () => {
  setLoading(true);
  try {
    const res = await fetchMetadataCatalog({
      search: searchText,
      domain: domainFilter,
      type: typeFilter,
      dataSourceId: sourceFilter,
      page, pageSize: 20,
    });
    setCatalog(res.data);
    setTotal(res.total);
  } catch {
    message.error('加载数据目录失败');
  } finally {
    setLoading(false);
  }
};

// 质量评分颜色
const qualityColor = (score: number) => {
  if (score >= 80) return colors.success[500];
  if (score >= 60) return colors.warning[500];
  return colors.error[500];
};
```

### 5.3 数据源管理页

**文件**: `orion-frontend/src/pages/DataSources/index.tsx`

```tsx
// 注册数据源表单
const handleTestConnection = async () => {
  setTesting(true);
  try {
    const res = await testDataSource(form.id, form.connectionConfig);
    if (res.data.success) {
      message.success('连接测试成功');
    } else {
      message.error(`连接失败: ${res.data.message}`);
    }
  } catch {
    message.error('连接测试异常');
  } finally {
    setTesting(false);
  }
};
```

### 5.4 数据详情页

**文件**: `orion-frontend/src/pages/MetadataCatalog/Detail.tsx`

```tsx
// Tab 结构: 基本信息 | 字段信息 | 血缘关系 | 样本数据 | 质量指标

// 字段信息表格
<Table dataSource={schemaInfo.fields} rowKey="name">
  <Column title="字段名" dataIndex="name" />
  <Column title="类型" dataIndex="type" />
  <Column title="注释" dataIndex="comment" />
  <Column title="是否主键" dataIndex="isPrimaryKey" render={(v: boolean) => v ? '是' : '否'} />
  <Column title="是否必填" dataIndex="nullable" render={(v: boolean) => !v ? '是' : '否'} />
  <Column title="关联术语" dataIndex="mappedTerm"
    render={(v: string) => v ? <Tag color={colors.primary[500]}>{v}</Tag> : '-'} />
</Table>

// 血缘关系图（简化版，使用 Ant Design Graph 或自定义）
// 上游 → 当前表 → 下游
```

### 5.5 业务术语表页

**文件**: `orion-frontend/src/pages/BusinessTerms/index.tsx`

```tsx
// 术语列表 + 术语详情 Drawer

// 创建术语表单
<Form form={form} onFinish={handleCreate}>
  <Form.Item name="term" label="术语名称" rules={[{ required: true }]}>
    <Input placeholder="如：客户编号" />
  </Form.Item>
  <Form.Item name="definition" label="定义" rules={[{ required: true }]}>
    <Input.TextArea rows={3} placeholder="术语的业务含义描述" />
  </Form.Item>
  <Form.Item name="category" label="分类" rules={[{ required: true }]}>
    <Select options={[
      { value: 'entity', label: '实体' },
      { value: 'attribute', label: '属性' },
      { value: 'event', label: '事件' },
      { value: 'rule', label: '规则' },
    ]} />
  </Form.Item>
  <Form.Item name="rootWord" label="词根">
    <Input placeholder="如：customer" />
  </Form.Item>
</Form>
```

---

## 六、权限模型

| 角色 | 查看目录 | 管理数据源 | 管理任务 | 管理术语 |
|------|:--------:|:----------:|:--------:|:--------:|
| Viewer | ✅ | - | - | - |
| Member | ✅ | ✅ (创建) | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Platform Admin | ✅ | ✅ | ✅ | ✅ |

权限: `requirePermission({ resource: 'metadata', action: 'read' | 'write' | 'admin' })`

---

## 七、外部依赖检查

| 依赖 | 用途 | 状态 |
|------|------|------|
| CMDB `CmdbService` | CI 拓扑关系复用 | ✅ 已有 |
| 数据血缘 `DataLineageService` | 字段血缘计算 | ✅ 已有 |
| Cron 引擎内置调度器 | 采集任务定时执行 | ✅ 已有 (`services/scheduler/`) |
| K8s API | K8s 数据源元数据采集 | ✅ 已有 |

---

## 八、Design Token 使用

| 用途 | Token |
|------|-------|
| 高质量评分 | `colors.success[500]` |
| 中质量评分 | `colors.warning[500]` |
| 低质量评分 | `colors.error[500]` |
| 术语 Tag | `colors.primary[500]` |
| 卡片圆角 | `componentRadius.card` (12px) |
| 卡片间距 | `spacing.md` (16px) |

---

## 九、验收标准

### 9.1 端到端场景

| # | 场景 | 预期结果 |
|---|------|----------|
| E1 | 注册 MySQL 数据源并测试连接 | 连接成功，状态变为 active |
| E2 | 创建采集任务并手动执行 | 任务运行，采集到表和字段信息 |
| E3 | 在数据目录搜索表 | 搜索结果正确展示表结构和质量评分 |
| E4 | 查看字段血缘 | 显示上游/下游依赖关系 |
| E5 | 创建业务术语并映射字段 | 术语保存成功，字段详情页显示关联术语 |
| E6 | 按域/类型过滤数据目录 | 过滤结果正确缩小 |
| E7 | 查看目录统计面板 | 显示按域/类型分布和质量总览 |
| E8 | 删除数据源 | 二次确认，关联采集任务同步处理 |

### 9.2 量化指标

| 指标 | 目标值 |
|------|--------|
| 数据目录加载时间 | < 1.5s (p95) |
| 连接测试响应时间 | < 5s |
| 采集任务调度精度 | < 1min 偏差 |
| 术语搜索响应时间 | < 500ms |
| 前端单元测试覆盖率 | > 75% |

---

_文档版本: v1.0 | 创建日期: 2026-05-22_
