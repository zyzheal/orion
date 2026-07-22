# 向量存储（Vector Store）模块深度分析报告

**生成日期**: 2026-07-03
**分析模块**: `orion-platform-service/src/services/vector-store/` + `vectorize-rules/` + 相关路由

---

## 模块概览

Vector Store 模块承担**向量存储、语义检索、向量化规则引擎**三大职责。当前实现已迁移到 PostgreSQL，是 Orion AI 域的核心基础设施。

| 子域 | 目录/文件 | 当前状态 |
|------|----------|----------|
| 向量存储服务 | `services/vector-store/VectorStoreService.ts` | ✅ PostgreSQL |
| 向量 Repository | `services/vector-store/VectorStoreRepository.ts` | ✅ PostgreSQL |
| 语义搜索 | `services/ai/SemanticSearchService.ts` | ✅ 完整 |
| 代码嵌入 | `services/ai/CodeEmbeddingService.ts` | ✅ 完整 |
| 向量化规则 | `services/vectorize-rules/VectorizeRulesService.ts` | ✅ 完整 |
| 类型定义 | `services/ai/vector-types.ts` + `services/vector-store/types.ts` | ✅ 完整 |

---

## 架构设计

### 分层结构

```
API Routes (vector-store-routes.ts)
    ↓
Controllers (VectorController)
    ↓
Service Layer (VectorStoreService, SemanticSearchService, CodeEmbeddingService)
    ↓
Repository Layer (VectorStoreRepository)
    ↓
PostgreSQL Database (pgvector extension)
         ↑
AI Services (AIGateway, MLInferenceService for embeddings)
```

### 关键设计模式

- **pgvector 扩展**：PostgreSQL + pgvector 存储向量
- **Embedding 模型**：通过 AIGateway 调用外部 Embedding 模型
- **语义搜索**：余弦相似度搜索
- **向量化规则**：VectorizeRulesService 管理自动向量化规则

---

## 功能完整性评估

### 向量存储

| 功能 | 状态 | 说明 |
|------|------|------|
| 向量插入 | ✅ | upsert 向量 |
| 向量查询 | ✅ | 相似度搜索 |
| 向量删除 | ✅ | 删除向量 |
| 元数据过滤 | ✅ | 元数据过滤搜索 |
| 批量操作 | ⚠️ | 基础支持 |

### 语义搜索

| 功能 | 状态 | 说明 |
|------|------|------|
| 文本嵌入 | ✅ | 通过 Embedding 模型 |
| 代码嵌入 | ✅ | CodeEmbeddingService |
| 相似度搜索 | ✅ | 余弦相似度 |
| 结果排序 | ✅ | 按相似度排序 |
| 分页 | ✅ | 支持分页 |

### 代码嵌入

| 功能 | 状态 | 说明 |
|------|------|------|
| 代码分块 | ✅ | 按函数/类分块 |
| 块嵌入 | ✅ | 每个块生成 embedding |
| 块索引 | ✅ | 建立向量索引 |
| 语义搜索 | ✅ | 代码语义搜索 |

### 向量化规则

| 功能 | 状态 | 说明 |
|------|------|------|
| 规则 CRUD | ✅ | 创建/查询/更新/删除规则 |
| 自动触发 | ✅ | 事件触发向量化 |
| 规则评估 | ✅ | 评估哪些数据需要向量化 |
| 批量向量化 | ✅ | 批量处理 |

---

## API 端点清单

### 向量存储（`/api/v1/vector-store`）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/vectors` | 插入向量 |
| POST | `/vectors/search` | 相似度搜索 |
| DELETE | `/vectors/:id` | 删除向量 |
| POST | `/vectors/batch` | 批量插入 |
| GET | `/vectors/:id` | 向量详情 |

---

## 数据模型

### VectorStore

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 向量 ID |
| tenant_id | string | 租户 ID |
| collection | string | 集合名称 |
| embedding | vector | 向量（pgvector） |
| metadata | JSONB | 元数据 |
| document_id | UUID | 关联文档 |
| created_at | timestamp | 创建时间 |

### VectorizeRule

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 规则 ID |
| tenant_id | string | 租户 ID |
| name | string | 规则名称 |
| source_type | string | 数据源类型 |
| trigger_events | string[] | 触发事件 |
| embedding_model | string | Embedding 模型 |
| enabled | boolean | 是否启用 |

---

## 与其他模块集成点

| 模块 | 集成点 | 状态 |
|------|--------|------|
| AI Gateway | Embedding 模型调用 | ✅ |
| Code | 代码语义搜索 | ✅ |
| Knowledge | 知识库向量化 | ✅ |
| Pipeline | Pipeline 文档向量化 | ⚠️ 未对接 |

---

## 缺失功能

### P0 级（阻塞生产）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无前端语义搜索 | 用户无法使用语义搜索 | 开发语义搜索页面 |
| Embedding 模型未确定 | 未固定 Embedding 模型 | 确定并接入 Embedding 模型 |

### P1 级（高优先级）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无向量索引优化 | 大规模向量搜索慢 | 增加 HNSW/IVF 索引 |
| 无向量版本管理 | 模型更新后向量过期 | 增加版本管理 |

### P2 级（改进项）

| 问题 | 影响 | 建议修复 |
|------|------|----------|
| 无混合搜索 | 仅向量搜索，无全文 | 增加混合搜索 |
| 无向量可视化 | 向量空间不可视 | 增加 t-SNE/UMAP 可视化 |

---

## 关键文件索引

| 文件路径 | 角色 | 重要性 |
|----------|------|--------|
| `services/vector-store/VectorStoreService.ts` | 向量存储核心 | ⭐⭐⭐ |
| `services/vector-store/VectorStoreRepository.ts` | 向量数据访问 | ⭐⭐⭐ |
| `services/ai/SemanticSearchService.ts` | 语义搜索 | ⭐⭐⭐ |
| `services/ai/CodeEmbeddingService.ts` | 代码嵌入 | ⭐⭐⭐ |
| `services/vectorize-rules/VectorizeRulesService.ts` | 向量化规则 | ⭐⭐⭐ |
| `api/vector-store-routes.ts` | 向量路由 | ⭐⭐⭐ |
| `api/controllers/VectorController.ts` | 向量控制器 | ⭐⭐⭐ |

---

## 结论

**Vector Store 模块**的向量存储和语义搜索核心功能完整，PostgreSQL + pgvector 持久化到位。

**当前最大缺口**：
1. 无前端语义搜索页面
2. Embedding 模型未确定
3. 无大规模向量索引优化

建议确定 Embedding 模型，然后开发前端语义搜索页面。
