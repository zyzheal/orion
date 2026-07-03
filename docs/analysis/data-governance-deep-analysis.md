# 数据治理（Data Governance）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/data-lineage/` + `data-quality/` + `metadata/`

---

## 模块概览

Data Governance 模块承担**数据血缘追踪、数据质量检查、元数据管理**三大职责。当前实现已完成 PostgreSQL 持久化迁移，核心功能完整，是数据平台域的重要组成部分。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 数据血缘 | `services/data-lineage/DataLineageService.ts` + `DataLineageRepository.ts` | ✅ PostgreSQL |
| 血缘图构建 | `DataLineageService.buildGraph()` | ✅ 节点/边管理 |
| 血缘可视化 | `getLineageGraph()` 端点 | ✅ JSON 图结构 |
| 影响分析 | `getImpactAnalysis()` | ✅ 上游/下游分析 |
| 数据质量 | `services/data-quality/DataQualityService.ts` | ✅ PostgreSQL |
| 质量规则 | `DataQualityService.createRule()` | ✅ 规则管理 |
| 质量检查 | `DataQualityService.runCheck()` | ✅ 检查执行 |
| 质量报告 | `DataQualityService.getQualityReport()` | ✅ 质量报告 |
| 元数据管理 | `services/metadata/MetadataService.ts` | ✅ PostgreSQL |
| 元数据采集 | `MetadataService.syncMetadata()` | ✅ 自动/手动采集 |
| 元数据搜索 | `MetadataService.search()` | ✅ 全文搜索 |

---

## 架构设计

### 分层结构

```
API Routes (data-lineage-routes.ts, data-quality-routes.ts, metadata-routes.ts)
    ↓
Controllers (DataPipelineController 等)
    ↓
Service Layer (DataLineageService, DataQualityService, MetadataService)
    ↓
Repository Layer (LineageNodeRepository, LineageEdgeRepository, 
                   LineageRecordRepository, DataQualityRepository, MetadataRepository)
    ↓
PostgreSQL Database
```

### 关键设计模式

- **图结构存储**：血缘数据以 Node + Edge 形式存储，支持图遍历
- **租户隔离**：所有数据带 tenant_id，支持多租户血缘隔离
- **质量规则引擎**：基于规则的数据质量检查，支持自定义规则
- **元数据自动同步**：支持从 Pipeline/DB/Service 自动采集元数据

---

## 功能完整性评估

### 数据血缘

| 功能 | 状态 | 说明 |
|------|------|------|
| 节点管理 | ✅ | 创建/查询/删除血缘节点 |
| 边管理 | ✅ | 创建/查询血缘关系 |
| 图构建 | ✅ | pipeline 级血缘图 |
| 可视化数据 | ✅ | JSON 格式返回图结构 |
| 影响分析 | ✅ | 下游影响分析 |
| 血缘记录 | ✅ | 执行级血缘快照 |
| 字段级血缘 | ⚠️ | 节点支持 schema，但字段级追踪待完善 |

### 数据质量

| 功能 | 状态 | 说明 |
|------|------|------|
| 质量规则 CRUD | ✅ | 创建/查询/更新/删除规则 |
| 规则类型 | ✅ | 完整性/唯一性/有效性/范围 |
| 检查执行 | ✅ | 手动/定时触发检查 |
| 检查结果 | ✅ | 通过率/失败记录 |
| 质量分数 | ✅ | 按数据集/表聚合 |
| 质量报告 | ✅ | 趋势报告 |
| 告警集成 | ⚠️ | 服务层支持，路由未完全对接 |

### 元数据管理

| 功能 | 状态 | 说明 |
|------|------|------|
| 元数据采集 | ✅ | 自动/手动采集 |
| 元数据搜索 | ✅ | 全文搜索 |
| 数据字典 | ✅ | 表/字段/描述 |
| 业务元数据 | ✅ | 业务含义/owner/敏感度 |
| 技术元数据 | ✅ | 类型/长度/默认值 |
| 血缘关联 | ✅ | 元数据与血缘关联 |

---

## API 端点清单

### 数据血缘（`/api/v1/data-lineage`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/graph/:pipelineId` | 获取血缘图 |
| GET | `/nodes/:nodeId/upstream` | 上游血缘 |
| GET | `/nodes/:nodeId/downstream` | 下游血缘 |
| POST | `/impact-analysis` | 影响分析 |
| POST | `/records` | 记录血缘快照 |
| GET | `/records/:executionId` | 血缘记录查询 |

### 数据质量（`/api/v1/data-quality`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/rules` | 创建质量规则 |
| GET | `/rules` | 规则列表 |
| GET | `/rules/:id` | 规则详情 |
| PUT | `/rules/:id` | 更新规则 |
| DELETE | `/rules/:id` | 删除规则 |
| POST | `/checks/run` | 执行检查 |
| GET | `/checks/:checkId` | 检查结果 |
| GET | `/reports/summary` | 质量报告 |
| GET | `/datasets/:datasetId/score` | 数据集分数 |

### 元数据（`/api/v1/metadata`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/sync` | 同步元数据 |
| GET | `/search` | 搜索元数据 |
| GET | `/datasets` | 数据集列表 |
| GET | `/datasets/:id` | 数据集详情 |
| GET | `/tables/:tableName` | 表元数据 |
| GET | `/columns/:tableName/:columnName` | 字段元数据 |

---

## 数据模型

### LineageNode

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 节点 ID |
| tenant_id | string | 租户 ID |
| name | string | 节点名称 |
| type | string | source/transform/sink/dataset/model |
| description | text | 描述 |
| pipeline_id | UUID | 关联 Pipeline |
| stage_id | UUID | 关联 Stage |
| schema | JSONB | 数据结构 |
| metadata | JSONB | 扩展元数据 |

### LineageEdge

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 边 ID |
| tenant_id | string | 租户 ID |
| from_node_id | UUID | 起始节点 |
| to_node_id | UUID | 目标节点 |
| relationship | string | produces/consumes/transforms/derives |
| field_mapping | JSONB | 字段映射 |

### DataQualityRule

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 规则 ID |
| tenant_id | string | 租户 ID |
| name | string | 规则名称 |
| description | text | 规则描述 |
| dataset_id | UUID | 关联数据集 |
| rule_type | string | completeness/uniqueness/validity/range |
| config | JSONB | 规则配置 |
| severity | string | 严重度 |
| enabled | boolean | 是否启用 |

### MetadataEntry

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 元数据 ID |
| tenant_id | string | 租户 ID |
| name | string | 元数据名称 |
| type | string | 元数据类型 |
| category | string | 分类 |
| description | text | 描述 |
| owner | string | 负责人 |
| sensitivity | string | 敏感度 |
| schema | JSONB | 数据结构 |
| lineage | JSONB | 血缘关联 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| Pipeline | 血缘追踪 | ✅ |
| Data Platform | 数据集元数据 | ✅ |
| Quality Gate | 质量检查触发 | ⚠️ 未对接 |
| Alert | 质量告警 | ⚠️ 未对接 |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端血缘可视化 | 用户无法查看血缘图 | 开发血缘可视化页面 |
| 字段级血缘不完整 | 无法追踪字段级数据流 | 增强字段级血缘 |
| 无自动质量检查 | 需手动触发质量检查 | Pipeline 集成自动检查 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无数据目录 | 用户无法发现数据 | 开发数据目录页面 |
| 质量告警未对接 | 质量问题不通知 | 与 Alert 模块联动 |
| 元数据采集不自动 | 需手动同步 | 自动发现 + 同步 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无数据分级 | 敏感数据未分级 | 增加数据分级标签 |
| 无数据生命周期 | 未管理数据生命周期 | 增加生命周期管理 |
| 血缘性能 | 大型血缘图查询慢 | 增加血缘缓存 |

---

## 技术债务

| 类别 | 债务项 | 风险 | 建议 |
|------|--------|------|------|
| 血缘性能 | 大型图查询可能慢 | 中 | 增加图遍历优化 |
| 质量规则硬编码 | 部分规则逻辑硬编码 | 低 | 配置化规则引擎 |
| 元数据同步 | 同步逻辑分散 | 低 | 统一元数据采集器 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/data-lineage/DataLineageService.ts` | 血缘核心服务 | ⭐⭐⭐ |
| `services/data-lineage/DataLineageRepository.ts` | 血缘数据访问 | ⭐⭐⭐ |
| `services/data-quality/DataQualityService.ts` | 质量核心服务 | ⭐⭐⭐ |
| `services/metadata/MetadataService.ts` | 元数据核心服务 | ⭐⭐⭐ |
| `api/data-lineage-routes.ts` | 血缘路由 | ⭐⭐⭐ |
| `api/data-quality-routes.ts` | 质量路由 | ⭐⭐⭐ |
| `api/metadata-routes.ts` | 元数据路由 | ⭐⭐⭐ |

---

## 结论

**Data Governance 模块**的三个子域（血缘/质量/元数据）均已完成 PostgreSQL 持久化，核心功能完整。

**当前最大缺口**：
1. 无前端可视化（血缘图/数据目录）
2. 字段级血缘不完整
3. 无自动质量检查 + 告警

建议优先开发前端数据目录 + 血缘可视化，然后完善自动质量检查 Pipeline 集成。
