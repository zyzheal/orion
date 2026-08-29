# WeKnora 知识图谱集成方案 v1.0

> **文档**: WeKnora 集成设计 | **日期**: 2026-08-26 | **状态**: Draft
>
> **背景**: Orion 平台已有 knowledge（RAG）、graph（图数据库）、pandawiki 三套独立知识模块，缺乏统一的知识图谱能力。WeKnora 作为外部知识图谱引擎，可以填补语义实体抽取、关系发现、图谱推理等关键能力缺口。

---

## 1. 现状分析

### 1.1 现有知识模块

| 模块 | 路径 | 能力 | 缺口 |
|------|------|------|------|
| `internal/knowledge` | 394行service + 479行models | 空间CRUD、文档CRUD、RAG查询、对话管理、评估 | 无语义实体抽取、无关系发现、无图谱可视化 |
| `internal/graph` | 1038行service | 节点CRUD、关系CRUD、最短路径、邻居查询、拓扑查询 | 纯手动建图，无自动实体抽取 |
| `internal/pandawiki` | 288行models | Wiki文档、目录树、同步日志 | 无图谱索引、无跨文档关联 |
| RAG Pipeline | 394行rag_pipeline.go | 语义缓存→分类→改写→混合检索→MMR→重排→上下文→生成→验证 | 仅向量检索，无图谱增强 |

### 1.2 关键缺口

1. **实体抽取 (NER)**：无法从文档中自动识别服务、人员、流程等实体
2. **关系发现**：无法自动发现实体间的依赖、归属、触发关系
3. **图谱推理**：无法回答「A服务的所有依赖是什么」等图结构问题
4. **知识关联**：文档间无自动关联，无法构建知识网络
5. **混合检索**：RAG 仅依赖向量相似度，缺乏图结构增强

---

## 2. WeKnora 定位与集成架构

### 2.1 集成模式

```
┌─────────────────────────────────────────────────────────────┐
│                     Orion Platform                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │ Knowledge │  │  Graph   │  │  PandaWiki   │              │
│  │  Module   │  │  Module  │  │   Module     │              │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘              │
│        │              │               │                       │
│        └──────────────┼───────────────┘                       │
│                       │                                       │
│              ┌────────▼────────┐                               │
│              │  weknora-bridge │  ← 新增桥接层                │
│              │  (Adapter)      │                               │
│              └────────┬────────┘                               │
│                       │  HTTP/gRPC                             │
│              ┌────────▼────────┐                               │
│              │  WeKnora API    │  ← 外部知识图谱引擎           │
│              │  (Entity/NLP)   │                               │
│              └────────┬────────┘                               │
│                       │                                       │
│              ┌────────▼────────┐                               │
│              │  Neo4j/GraphDB  │  ← 图存储                    │
│              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 分层职责

| 层 | 职责 | 新增/复用 |
|----|------|-----------|
| API Handler | 统一知识图谱 API | 新增 `internal/knowledge-graph/handler` |
| Service | 编排 bridge + graph + RAG | 新增 `internal/knowledge-graph/service` |
| Bridge | WeKnora 客户端适配器 | 新增 `internal/knowledge-graph/weknora` |
| Graph Service | 本地图存储操作 | 复用 `internal/graph/service` |
| RAG Pipeline | 图谱增强检索 | 扩展 `internal/knowledge/service/rag_pipeline` |
| Storage | 图数据持久化 | 复用 PostgreSQL JSONB / Neo4j |

---

## 3. 核心能力设计

### 3.1 实体抽取（Entity Extraction）

**目标**：从文档内容中自动识别和抽取结构化实体。

**API**：
```
POST /api/v1/knowledge-graph/extract
Request:  { "content": "...", "space_id": "opt", "entity_types": ["Service","Person","Process"] }
Response: { "entities": [{ "id": "uuid", "type": "Service", "label": "api-gateway", "properties": {...} }] }
```

**流程**：
```
Document → WeKnora NER → Entity → Graph Node → RAG Index
```

**Go 接口**：
```go
type EntityExtractionRequest struct {
    Content     string        `json:"content"`
    SpaceID     string        `json:"space_id"`
    EntityType []string      `json:"entity_types"`
    Language    string        `json:"language"` // zh, en
}

type ExtractedEntity struct {
    ID         string            `json:"id"`
    Type       string            `json:"type"`       // Service, Person, Process, etc.
    Label      string            `json:"label"`
    Properties map[string]any    `json:"properties"` // {"version":"1.0", "env":"prod"}
    Confidence float64           `json:"confidence"`
    Span       []int             `json:"span"`       // [start, end] in content
}

type EntityExtractionResponse struct {
    Entities []ExtractedEntity `json:"entities"`
    Count    int               `json:"count"`
    Duration time.Duration     `json:"duration"`
}
```

### 3.2 关系发现（Relationship Discovery）

**目标**：自动发现实体间的语义关系。

**API**：
```
POST /api/v1/knowledge-graph/relationships/discover
Request:  { "entities": ["entity_id_1", "entity_id_2"], "relation_types": ["DEPENDS_ON","OWNS","TRIGGERS"] }
Response: { "relationships": [{ "source": "entity_1", "target": "entity_2", "type": "DEPENDS_ON", "confidence": 0.85 }] }
```

**Go 接口**：
```go
type RelationshipDiscoveryRequest struct {
    EntityIDs   []string `json:"entity_ids"`
    RelationTypes []string `json:"relation_types"` // DEPENDS_ON, OWNS, TRIGGERS, CONTAINS
    Scope       string   `json:"scope"`             // space_id or "global"
}

type DiscoveredRelationship struct {
    SourceNodeID string  `json:"source_node_id"`
    TargetNodeID string  `json:"target_node_id"`
    Type         string  `json:"type"`
    Confidence   float64 `json:"confidence"`
    Properties   map[string]any `json:"properties"`
}
```

### 3.3 图谱查询（Graph Query）

**目标**：支持自然语言和结构化图查询。

**API**：
```
GET /api/v1/knowledge-graph/query?type=shortest_path&from=svc-a&to=svc-b
GET /api/v1/knowledge-graph/query?type=neighbors&node=svc-a&depth=3
GET /api/v1/knowledge-graph/query?type=cyphe&query=...  (高级)
```

**Go 接口**：
```go
type GraphQueryRequest struct {
    QueryType string `json:"query_type"` // shortest_path, neighbors, cypher, impact_analysis
    From      string `json:"from"`
    To        string `json:"to"`
    Depth     int    `json:"depth"`
    Cypher    string `json:"cypher"`  // 高级查询
    TenantID  string `json:"tenant_id"`
}

type GraphQueryResponse struct {
    Nodes         []GraphNode            `json:"nodes"`
    Relationships []GraphRelationship   `json:"relationships"`
    Paths         []GraphPath           `json:"paths"`
    TotalCount    int                   `json:"total_count"`
    Confidence    float64               `json:"confidence"`
}
```

### 3.4 RAG 图谱增强（Graph-Enhanced RAG）

**目标**：在 RAG 检索阶段注入图谱上下文，提升回答质量。

**增强策略**：
1. **检索前**：将用户问题中的实体映射到图谱节点
2. **检索中**：沿图谱边扩展相关文档（多跳检索）
3. **检索后**：将图谱结构信息注入 LLM 上下文

**Go 接口**：
```go
// 扩展现有 RAGPipelineService
func (p *RAGPipelineService) GraphEnhancedRetrieve(ctx context.Context, tenantID string, query string, req models.RetrieveRequest) (*GraphEnhancedResult, error)

type GraphEnhancedResult struct {
    Documents  []models.RAGRetrieveResult `json:"documents"`
    GraphNodes []ExtractedEntity          `json:"graph_nodes"`
    Relations  []DiscoveredRelationship   `json:"relations"`
    Topology   string                     `json:"topology"` // 可视化拓扑描述
}
```

---

## 4. 数据模型

### 4.1 新增模型文件

```go
// internal/knowledge-graph/models/models.go

package models

import "time"

// ExtractedEntity - 从文档抽取的实体
type ExtractedEntity struct {
    ID          string            `json:"id" db:"id"`
    TenantID    string            `json:"tenant_id" db:"tenant_id"`
    Type        string            `json:"type" db:"type"`
    Label       string            `json:"label" db:"label"`
    Properties  map[string]any    `json:"properties" db:"properties"` // JSONB
    Confidence  float64           `json:"confidence" db:"confidence"`
    SourceDocID string            `json:"source_doc_id" db:"source_doc_id"`
    SpaceID     string            `json:"space_id" db:"space_id"`
    CreatedAt   time.Time         `json:"created_at" db:"created_at"`
}

// DiscoveredRelationship - 发现的关系
type DiscoveredRelationship struct {
    ID            string            `json:"id" db:"id"`
    TenantID      string            `json:"tenant_id" db:"tenant_id"`
    Type          string            `json:"type" db:"type"`
    SourceNodeID  string            `json:"source_node_id" db:"source_node_id"`
    TargetNodeID  string            `json:"target_node_id" db:"target_node_id"`
    Properties    map[string]any    `json:"properties" db:"properties"`
    Confidence    float64           `json:"confidence" db:"confidence"`
    CreatedAt     time.Time         `json:"created_at" db:"created_at"`
}

// GraphTask - 异步图谱任务（抽取/发现）
type GraphTask struct {
    ID         string    `json:"id" db:"id"`
    TenantID   string    `json:"tenant_id" db:"tenant_id"`
    TaskType   string    `json:"task_type" db:"task_type"` // extract, discover, sync
    Status     string    `json:"status" db:"status"`       // pending, running, completed, failed
    Source     string    `json:"source" db:"source"`       // space_id, doc_id
    Result     map[string]any `json:"result" db:"result"`  // JSONB
    ErrorMsg   string    `json:"error_msg" db:"error_msg"`
    CreatedAt  time.Time `json:"created_at" db:"created_at"`
    CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
}
```

### 4.2 数据库迁移

```sql
-- 新表
CREATE TABLE knowledge_graph_entities (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL,
    label VARCHAR(256) NOT NULL,
    properties JSONB DEFAULT '{}',
    confidence REAL DEFAULT 1.0,
    source_doc_id VARCHAR(64),
    space_id VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_kge_tenant_type ON knowledge_graph_entities(tenant_id, type);
CREATE INDEX idx_kge_label ON knowledge_graph_entities(label);

CREATE TABLE knowledge_graph_relationships (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL,
    source_node_id VARCHAR(64) NOT NULL,
    target_node_id VARCHAR(64) NOT NULL,
    properties JSONB DEFAULT '{}',
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_kgr_tenant_type ON knowledge_graph_relationships(tenant_id, type);
CREATE INDEX idx_kgr_source ON knowledge_graph_relationships(source_node_id);
CREATE INDEX idx_kgr_target ON knowledge_graph_relationships(target_node_id);

CREATE TABLE knowledge_graph_tasks (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    source VARCHAR(256),
    result JSONB DEFAULT '{}',
    error_msg TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX idx_kgt_tenant_type ON knowledge_graph_tasks(tenant_id, task_type);
```

---

## 5. WeKnora Bridge 接口

### 5.1 Bridge 定义

```go
// internal/knowledge-graph/weknora/bridge.go

package weknora

import "context"

// BridgeConfig 配置 WeKnora 连接
type BridgeConfig struct {
    Endpoint   string `json:"endpoint"`   // WeKnora API 地址
    APIKey     string `json:"api_key"`
    Timeout    int    `json:"timeout"`    // 秒
    MaxRetries int    `json:"max_retries"`
}

// Bridge WeKnora 客户端接口
type Bridge interface {
    // 实体抽取
    ExtractEntities(ctx context.Context, content string, entityTypes []string) ([]ExtractedEntity, error)
    // 关系发现
    DiscoverRelations(ctx context.Context, entityIDs []string, relationTypes []string) ([]DiscoveredRelationship, error)
    // 图谱查询
    QueryGraph(ctx context.Context, query string) (map[string]any, error)
    // 健康检查
    Health(ctx context.Context) error
}

// HTTPBridge WeKnora HTTP 客户端实现
type HTTPBridge struct {
    cfg BridgeConfig
    client *http.Client
}

func NewHTTPBridge(cfg BridgeConfig) *HTTPBridge {
    return &HTTPBridge{
        cfg: cfg,
        client: &http.Client{Timeout: time.Duration(cfg.Timeout) * time.Second},
    }
}
```

### 5.2 配置管理

```yaml
# config/weknora.yaml
weknora:
  endpoint: "http://weknora-api:8080"
  api_key: "${WEKNORA_API_KEY}"
  timeout: 30
  max_retries: 3
  entity_types:
    - Service
    - Person
    - Process
    - Component
    - Incident
  relation_types:
    - DEPENDS_ON
    - OWNS
    - TRIGGERS
    - CONTAINS
    - RELATED_TO
```

---

## 6. 集成点设计

### 6.1 与 Knowledge Module 集成

**触发点**：文档创建/更新时自动触发实体抽取。

```
POST /api/v1/knowledge/docs  (existing)
  → Save Document
  → Publish Event: knowledge.doc.created
  → weknora-bridge SubscribeEvent
  → Extract Entities → Save to knowledge_graph_entities
  → Discover Relations → Save to knowledge_graph_relationships
  → Update RAG Index with graph context
```

**实现方式**：通过 EventBus 订阅文档事件，解耦处理。

### 6.2 与 RAG Pipeline 集成

**增强点**：在 `Retrieve()` 阶段注入图谱上下文。

```
用户查询 → classifyQuery → rewriteQuery
  → HybridRetriever (向量检索)
  → GraphEnhancedRetrieve (图谱增强)  ← 新增
      ├─ 实体识别：query 中匹配图谱实体
      ├─ 邻居扩展：沿图谱边拉取相关文档
      └─ 拓扑注入：将图谱结构编码为 LLM 上下文
  → MMR → Rerank → BuildContext → GenerateAnswer
```

### 6.3 与 Graph Module 集成

**同步点**：本地 graph 数据与 WeKnora 图谱保持同步。

```
手动操作 Graph Module
  → POST /api/v1/graph/nodes
  → 同步到 WeKnora 图谱（如果启用）
  → 返回结果

WeKnora 自动抽取
  → 写入 knowledge_graph_entities
  → 可选：同步到 graph 模块（如果开启双向同步）
```

---

## 7. API 设计

### 7.1 路由注册

```go
// internal/knowledge-graph/handler/handler.go

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    kg := rg.Group("/knowledge-graph")
    
    // Entity extraction
    kg.POST("/extract", h.ExtractEntities)
    kg.POST("/extract/async", h.ExtractEntitiesAsync)  // 返回 task_id
    
    // Relationship discovery
    kg.POST("/relationships/discover", h.DiscoverRelations)
    
    // Graph query
    kg.GET("/query", h.QueryGraph)
    kg.GET("/neighbors", h.GetNeighbors)
    kg.GET("/path", h.FindPath)
    
    // Task management
    kg.GET("/tasks", h.ListTasks)
    kg.GET("/tasks/:id", h.GetTask)
    
    // Stats
    kg.GET("/stats", h.GetStats)
    
    // Sync
    kg.POST("/sync", h.SyncGraph)
    kg.GET("/sync/status", h.GetSyncStatus)
}
```

### 7.2 API 清单

| Method | Path | 功能 | 权限 |
|--------|------|------|------|
| POST | `/knowledge-graph/extract` | 同步实体抽取 | knowledge:write |
| POST | `/knowledge-graph/extract/async` | 异步实体抽取 | knowledge:write |
| POST | `/knowledge-graph/relationships/discover` | 关系发现 | knowledge:write |
| GET | `/knowledge-graph/query` | 图谱查询 | knowledge:read |
| GET | `/knowledge-graph/neighbors` | 邻居查询 | knowledge:read |
| GET | `/knowledge-graph/path` | 路径查询 | knowledge:read |
| GET | `/knowledge-graph/tasks` | 任务列表 | knowledge:read |
| GET | `/knowledge-graph/tasks/:id` | 任务详情 | knowledge:read |
| GET | `/knowledge-graph/stats` | 图谱统计 | knowledge:read |
| POST | `/knowledge-graph/sync` | 同步图谱 | knowledge:write |
| GET | `/knowledge-graph/sync/status` | 同步状态 | knowledge:read |

---

## 8. 实现路线图

### Phase 1: 基础设施 (1-2 周)
- [ ] 创建 `internal/knowledge-graph/` 目录结构
- [ ] 实现 models（实体、关系、任务）
- [ ] 实现 WeKnora Bridge 接口和 HTTP 实现
- [ ] 数据库迁移（3 张新表）
- [ ] 基础 Handler + Service
- [ ] 路由注册

### Phase 2: 核心能力 (2-3 周)
- [ ] 实体抽取 API（同步 + 异步）
- [ ] 关系发现 API
- [ ] 图谱查询 API（neighbors, path, cypher）
- [ ] EventBus 订阅文档事件
- [ ] 图谱统计 API

### Phase 3: RAG 增强 (1-2 周)
- [ ] 扩展 RAG Pipeline：GraphEnhancedRetrieve
- [ ] 实体识别 + 邻居扩展
- [ ] 拓扑注入 LLM 上下文
- [ ] 混合检索权重调优

### Phase 4: 集成测试 (1 周)
- [ ] 端到端测试：文档 → 抽取 → 图谱 → 查询
- [ ] 性能测试：大规模文档抽取
- [ ] 错误处理：WeKnora 不可用时的降级
- [ ] 单元测试覆盖率 ≥ 80%

---

## 9. 降级策略

```go
// 当 WeKnora 不可用时，优雅降级
func (s *Service) ExtractEntities(ctx context.Context, req *models.EntityExtractionRequest) (*models.EntityExtractionResponse, error) {
    if !s.weknoraAvailable() {
        // 降级：使用基于规则的本地抽取
        return s.localRuleBasedExtraction(ctx, req), nil
    }
    return s.weknora.ExtractEntities(ctx, req.Content, req.EntityType)
}
```

**降级级别**：
1. **WeKnora 可用**：完整图谱能力
2. **WeKnora 超时**：使用本地规则抽取（正则+关键词）
3. **完全离线**：仅向量检索（现有 RAG）

---

## 10. 监控指标

| 指标 | 类型 | 说明 |
|------|------|------|
| `kgraph_extraction_total` | Counter | 实体抽取次数 |
| `kgraph_extraction_duration_ms` | Histogram | 抽取耗时 |
| `kgraph_entities_total` | Gauge | 总实体数 |
| `kgraph_relationships_total` | Gauge | 总关系数 |
| `kgraph_task_status` | Gauge | 任务状态分布 |
| `kgraph_weknora_errors` | Counter | WeKnora 错误数 |
| `kgraph_rag_enhanced_queries` | Counter | 图谱增强查询数 |
| `kgraph_extraction_confidence_avg` | Histogram | 抽取置信度分布 |

---

## 11. 依赖服务

| 服务 | 地址 | 必需 | 说明 |
|------|------|:----:|------|
| WeKnora API | `http://weknora-api:8080` | ✅ | 知识图谱引擎 |
| Neo4j/GraphDB | `bolt://neo4j:7687` | ✅ | 图存储 |
| PostgreSQL | `postgresql://db:5432/orion` | ✅ | 关系型存储 |
| RabbitMQ | `amqp://mq:5672` | ✅ | 异步任务队列 |
| Redis | `redis://cache:6379` | ❌ | 缓存 |
| Vector DB | `milvus://vector:19530` | ❌ | 向量检索 |

---

## 12. 配置管理

```go
// config/knowledge_graph_config.go

type KnowledgeGraphConfig struct {
    WeKnora BridgeConfig `yaml:"weknora"`
    Enabled bool         `yaml:"enabled"`     // 总开关
    AutoExtract bool     `yaml:"auto_extract"` // 文档创建时自动抽取
    SyncToGraph bool     `yaml:"sync_to_graph"` // 同步到 graph 模块
    GraphEnhancedRAG bool `yaml:"graph_enhanced_rag"` // RAG 图谱增强
}
```

```yaml
# config/application.yaml 追加
knowledge_graph:
  enabled: true
  weknora:
    endpoint: "http://weknora-api:8080"
    api_key: "${WEKNORA_API_KEY}"
    timeout: 30
    max_retries: 3
  auto_extract: true
  sync_to_graph: true
  graph_enhanced_rag: true
```

---

## 13. 测试计划

### 13.1 单元测试
- `weknora/bridge_test.go`：Mock WeKnora API，测试 HTTP 通信
- `service_test.go`：测试降级逻辑、异步任务调度
- `handler_test.go`：路由注册、权限控制

### 13.2 集成测试
- 文档创建 → EventBus → 实体抽取 → 图谱写入
- 图谱查询 → 路径/邻居/拓扑
- RAG 查询 → 图谱增强 → 上下文注入

### 13.3 压力测试
- 单文档 100K 字抽取
- 1000 文档批量抽取
- 100 并发查询

---

## 14. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|:----:|:----:|------|
| WeKnora 服务不可用 | 中 | 高 | 降级到本地规则抽取 |
| 实体抽取准确率不足 | 中 | 中 | 人工审核队列 + 置信度阈值 |
| 图谱规模过大影响查询 | 低 | 高 | 分片 + 索引优化 |
| 多租户数据泄漏 | 低 | 严重 | tenant_id 强制隔离 |
| RAG 上下文过长 | 中 | 中 | 截断策略 + 优先级排序 |

---

## 15. 总结

WeKnora 集成方案通过**桥接层适配器模式**，将 WeKnora 知识图谱能力融入 Orion 平台现有的 knowledge + graph + RAG 体系，实现：

1. ✅ **自动实体抽取**：文档 → 结构化实体
2. ✅ **自动关系发现**：实体间语义关系
3. ✅ **图谱增强 RAG**：多跳检索 + 拓扑注入
4. ✅ **统一 API**：知识图谱一站式查询
5. ✅ **优雅降级**：WeKnora 不可用时不中断
6. ✅ **多租户隔离**：tenant_id 全链路隔离

---

*文档版本: v1.0 | 作者: 商量 (SenseNova) | 日期: 2026-08-26*
