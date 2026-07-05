# Spec: 知识图谱 (Graph)

> **日期**: 2026-07-03
> **状态**: 编写中
> **能力域**: 知识图谱
> **目标成熟度**: L1 → L2
> **关键交付**: 图谱节点、关系管理、路径查询、可视化、影响分析

## 一、功能描述

### 1.1 现状评估 (L1)

Orion 当前已实现（Go 微服务 `orion-graph-svc-go`）：
- 图谱节点 CRUD（GraphService + Repository）
- 节点类型管理（GraphNode 模型）
- 节点属性存储（JSONB）
- 节点分页查询
- 多租户隔离
- OpenTelemetry 追踪

**不足**：
- 无节点关系管理（Edge/Relation）
- 无路径查询（A → B 的最短路径）
- 无图谱可视化
- 无影响分析（节点变更影响范围）
- 无图谱导入/导出
- 无节点自动发现
- 无图谱搜索（全文检索）

### 1.2 Phase 1 目标 (L2)

| 功能模块 | 描述 | 验收等级 |
|----------|------|:--------:|
| 关系管理 | 节点间关系定义（类型/方向/权重） | L2 |
| 路径查询 | 最短路径/全路径查询 | L2 |
| 影响分析 | 节点变更影响范围分析 | L2 |
| 图谱可视化 | 拓扑图/关系图渲染 | L2 |
| 导入导出 | JSON/CSV/GraphML 格式 | L2 |

## 二、验收标准

### 2.1 节点管理

| # | 标准 | 验证方式 |
|---|------|----------|
| GR1 | 支持创建图谱节点（type + label + properties） | API 测试 |
| GR2 | 支持多种节点类型（service/database/endpoint/user/config） | API 测试 |
| GR3 | 节点属性以 JSONB 存储，支持任意 KV | API 测试 |
| GR4 | 支持更新节点属性 | API 测试 |
| GR5 | 支持删除节点（级联删除关联关系） | API 测试 |
| GR6 | 节点按类型分组展示 | API 测试 |
| GR7 | 多租户隔离 | 集成测试 |

### 2.2 关系管理

| # | 标准 | 验证方式 |
|---|------|----------|
| GR8 | 支持创建节点间关系（source/target/type/weight） | API 测试 |
| GR9 | 关系类型：depends_on/calls/owns/configures/triggers | API 测试 |
| GR10 | 关系支持方向性（有向/无向） | API 测试 |
| GR11 | 关系可设置权重（0-1 影响度） | API 测试 |
| GR12 | 关系可更新/删除 | API 测试 |
| GR13 | 查询节点关联的所有关系（出边/入边） | API 测试 |

### 2.3 路径查询

| # | 标准 | 验证方式 |
|---|------|----------|
| GR14 | 最短路径查询（A → B 最少跳数） | API 测试 |
| GR15 | 全路径查询（A → B 所有可能路径，限制深度） | API 测试 |
| GR16 | 路径查询支持关系类型过滤 | API 测试 |
| GR17 | 路径查询深度限制（最大 10 层） | API 测试 |
| GR18 | 路径查询结果含节点和关系 | API 测试 |

### 2.4 影响分析

| # | 标准 | 验证方式 |
|---|------|----------|
| GR19 | 节点变更影响分析：所有下游节点 | API 测试 |
| GR20 | 影响范围按关系权重排序 | API 测试 |
| GR21 | 支持指定影响深度（1层/2层/3层） | API 测试 |
| GR22 | 影响分析结果含受影响节点数/关系数 | API 测试 |
| GR23 | 影响分析用于变更风险评估 | 集成测试 |

### 2.5 图谱可视化

| # | 标准 | 验证方式 |
|---|------|----------|
| GR24 | 提供子图数据（指定节点为中心的 N 层邻居） | API 测试 |
| GR25 | 子图数据含节点 + 关系，支持前端力导向图 | 前端验证 |
| GR26 | 支持按类型过滤节点/关系 | API 测试 |
| GR27 | 支持按标签过滤 | API 测试 |

### 2.6 导入导出

| # | 标准 | 验证方式 |
|---|------|----------|
| GR28 | 支持 JSON 格式导入 | API 测试 |
| GR29 | 支持 GraphML 格式导入 | API 测试 |
| GR30 | 支持导出 JSON（含节点+关系） | API 测试 |
| GR31 | 导入时支持 upsert（按ID更新或创建） | API 测试 |
| GR32 | 导入/导出支持批量操作 | API 测试 |

## 三、API 设计

```
Base: /api/v1/graph
```

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/nodes` | 创建节点 |
| GET | `/nodes` | 节点列表 |
| GET | `/nodes/:id` | 节点详情 |
| PUT | `/nodes/:id` | 更新节点 |
| DELETE | `/nodes/:id` | 删除节点 |
| POST | `/edges` | 创建关系 |
| GET | `/edges` | 关系列表 |
| DELETE | `/edges/:id` | 删除关系 |
| GET | `/shortest-path` | 最短路径 |
| GET | `/all-paths` | 全路径查询 |
| GET | `/impact/:nodeId` | 影响分析 |
| GET | `/subgraph/:nodeId` | 子图数据 |
| POST | `/import/json` | JSON 导入 |
| POST | `/import/graphml` | GraphML 导入 |
| GET | `/export/json` | JSON 导出 |

## 四、数据模型

```sql
-- 图谱节点
CREATE TABLE IF NOT EXISTS graph_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  node_type       VARCHAR(50) NOT NULL,
  label           VARCHAR(200) NOT NULL,
  properties      JSONB DEFAULT '{}',
  labels          TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 图谱边（关系）
CREATE TABLE IF NOT EXISTS graph_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  source_id       UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_id       UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  edge_type       VARCHAR(50) NOT NULL,
  weight          DECIMAL(5,4) DEFAULT 1.0,
  properties      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id, edge_type)
);

CREATE INDEX idx_graph_nodes_tenant ON graph_nodes(tenant_id, node_type);
CREATE INDEX idx_graph_nodes_type ON graph_nodes(node_type);
CREATE INDEX idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(target_id);
CREATE INDEX idx_graph_edges_type ON graph_edges(edge_type);
```

## 五、前端设计

**路由**: `/graph`

主要页面：
- 图谱浏览页：力导向图/拓扑图渲染
- 节点列表页：按类型筛选
- 节点详情页：属性/关联关系
- 关系管理页：创建/编辑/删除关系
- 影响分析页：节点变更影响范围
- 导入导出页：JSON/GraphML 导入导出

## 六、测试策略

| 类型 | 用例数 | 描述 |
|------|:------:|------|
| 单元测试 | 20 | GraphService、PathFinder、ImpactAnalyzer |
| 集成测试 | 6 | 节点CRUD→关系→路径查询→影响分析→导入导出 |
| 前端测试 | 4 | 图谱可视化、节点操作、影响分析 |

---
_文档版本: v1.0 | 创建日期: 2026-07-03 | 状态: 编写中_
