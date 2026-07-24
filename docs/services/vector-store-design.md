# S10 向量存储 (Vector Store) 设计文档

| 属性 | 值 |
|------|------|
| 模块编号 | S10 |
| 模块名称 | Vector Store (向量存储) |
| 版本 | v1.0 |
| 状态 | 已实现 |
| 最后更新 | 2026-05-15 |

---

## 1. 模块概述

### 1.1 定位与用途

Vector Store 模块为 Orion 平台提供**语义搜索与向量文档管理**能力，是知识库检索、AI Code Review、RAG（检索增强生成）等 AI 场景的基础设施组件。

核心能力包括：

- **文档向量化存储**：将文本内容通过 Embedding 模型转换为高维向量，持久化至 PostgreSQL pgvector 扩展
- **语义相似度搜索**：基于余弦距离 (cosine distance) 对查询文本进行 Top-K 相似文档检索
- **多 Embedding Provider 支持**：支持 OpenAI API、自定义 Provider、以及基于 Hash 的降级方案
- **元数据过滤**：在向量搜索的同时支持 JSONB 元数据条件过滤
- **集合管理**：支持按 collection 隔离不同业务场景的向量数据

### 1.2 典型使用场景

| 场景 | 说明 |
|------|------|
| 知识库语义检索 | 在运维知识库中进行自然语言语义搜索 |
| AI Code Review | 将代码片段向量化后检索相似的历史 Review 案例 |
| RAG Pipeline | 作为检索层为大语言模型提供上下文文档 |
| 告警关联分析 | 将历史告警事件向量化，识别语义相似的告警模式 |
| 根因诊断 | 在历史故障库中检索相似根因描述 |

---

## 2. 架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)                │
│  CollectionList / VectorSearch / DocumentManager │
│  CollectionDetail / CreateCollectionModal        │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│              API Routes (Fastify)                │
│  /api/v1/vector-store/documents  (POST/DELETE)   │
│  /api/v1/vector-store/search     (POST)          │
│  /api/v1/vector-store/stats      (GET)           │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              VectorStore Service                 │
│  - Embedding Provider 路由                        │
│  - 文档增删 + 自动生成 Embedding                   │
│  - 搜索请求转换                                   │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│            VectorRepository (Data Access)        │
│  - SQL 拼装 + pgvector <=> 运算符                │
│  - IVFFlat / HNSW 索引利用                       │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│         PostgreSQL + pgvector Extension          │
│  Table: vector_documents                         │
│  Index: ivfflat (embedding vector_cosine_ops)    │
│  Index: GIN (metadata JSONB)                     │
└─────────────────────────────────────────────────┘
```

### 2.2 核心文件清单

| 文件路径 | 职责 |
|----------|------|
| `orion-platform-service/src/api/vector-store-routes.ts` | Fastify 路由注册，请求/响应处理 |
| `orion-platform-service/src/services/ai/VectorStore.ts` | 核心服务类：Embedding 生成、文档管理、搜索 |
| `orion-platform-service/src/services/ai/types.ts` | 类型定义 (VectorDocument, SearchResult, VectorStoreConfig) |
| `orion-platform-service/src/repositories/VectorRepository.ts` | 数据访问层：SQL 操作、pgvector 查询 |
| `orion-platform-service/src/db/migrations/057_create_vector_store.sql` | 数据库迁移：表结构 + 索引 |
| `orion-frontend/src/api/vector-store.ts` | 前端 API 客户端 |
| `orion-frontend/src/pages/VectorStore/index.tsx` | 前端主页面 |

---

## 3. Embedding Provider 与配置

### 3.1 支持的 Provider

| Provider | 标识 | 说明 | 适用场景 |
|----------|------|------|----------|
| OpenAI | `openai` | 调用 OpenAI Embedding API (`text-embedding-ada-002`) | 生产环境，需要高质量语义理解 |
| Hash | `hash` | 本地字符级 Hash → 归一化至 [-1, 1] | 开发/测试环境，或无外部 API 时的降级方案 |
| Custom | `custom` | 传入自定义 `embeddingFn` | 集成自研 Embedding 模型 |

### 3.2 配置参数

通过环境变量配置：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `VECTOR_STORE_HOST` | `localhost` | PostgreSQL 主机地址 |
| `VECTOR_STORE_PORT` | `19530` | PostgreSQL 端口 |
| `VECTOR_STORE_COLLECTION` | `orion` | 默认集合名称 |
| `VECTOR_STORE_DIMENSION` | `1536` | 向量维度（与 OpenAI ada-002 兼容） |
| `VECTOR_EMBEDDING_PROVIDER` | `hash` | Embedding 提供者类型 |
| `VECTOR_EMBEDDING_MODEL` | `text-embedding-ada-002` | OpenAI 模型名称 |
| `OPENAI_API_KEY` | - | OpenAI API Key（仅 OpenAI provider 需要） |

### 3.3 Embedding 生成流程

```
addDocument(content)
    │
    ▼
┌─────────────────────────────┐
│ embeddingProvider 选择       │
│  custom → config.embeddingFn│
│  openai → createOpenAIEmbeddingFn()
│  hash   → hashEmbedding()   │
└──────────┬──────────────────┘
           ▼
    embedding: number[]
           │
           ▼
    VectorRepository.insert()
           │
           ▼
    PostgreSQL pgvector 存储
```

**Hash Embedding 算法**：`hashEmbedding()` 将输入文本进行字符级简单 Hash，产出变长 Hash 数组，再通过 `(hash[i % length] / 255) * 2 - 1` 映射到 [-1, 1] 区间，最后按配置的 `dimension` 循环填充至固定维度。该方案**不保证语义相似性**，仅作为开发和降级使用。

---

## 4. API 端点

所有路由统一挂载在 `/api/v1/vector-store` 前缀下。

### 4.1 添加文档

```
POST /api/v1/vector-store/documents
```

**请求体**：
```json
{
  "content": "数据库连接池配置优化方案",
  "metadata": {
    "source": "knowledge-base",
    "category": "database",
    "author": "admin"
  }
}
```

**响应**：
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "persistent": true
}
```

### 4.2 语义搜索

```
POST /api/v1/vector-store/search
```

**请求体**：
```json
{
  "query": "如何优化数据库连接池性能",
  "topK": 5,
  "filter": {
    "category": "database"
  }
}
```

**响应**：
```json
{
  "results": [
    {
      "document": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "content": "数据库连接池配置优化方案",
        "metadata": { "source": "knowledge-base", "category": "database", "author": "admin" },
        "embedding": [0.12, -0.34, ...]
      },
      "score": 0.8523
    }
  ]
}
```

### 4.3 删除文档

```
DELETE /api/v1/vector-store/documents/:id
```

**响应**：
```json
{ "success": true }
```

### 4.4 获取统计信息

```
GET /api/v1/vector-store/stats
```

**响应**：
```json
{
  "documentCount": 1536,
  "persistent": true
}
```

### 4.5 API 端点汇总表

| 方法 | 路径 | 功能 | 状态码 |
|------|------|------|--------|
| POST | `/documents` | 添加向量文档 | 200/400 |
| POST | `/search` | 语义搜索 | 200/400 |
| DELETE | `/documents/:id` | 删除文档 | 200/404 |
| GET | `/stats` | 获取统计信息 | 200 |

---

## 5. 数据模型

### 5.1 数据库表结构 (`vector_documents`)

```sql
CREATE TABLE vector_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection    VARCHAR(200) NOT NULL DEFAULT 'default',
  content       TEXT NOT NULL,
  content_hash  VARCHAR(64),
  metadata      JSONB NOT NULL DEFAULT '{}',
  embedding     vector(1536),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 索引策略

| 索引名称 | 类型 | 用途 |
|----------|------|------|
| `idx_vector_collection` | B-Tree | 按集合名快速过滤 |
| `idx_vector_content_hash` | B-Tree | 按内容 Hash 去重/检索 |
| `idx_vector_metadata` | GIN | JSONB 元数据高效过滤 |
| `idx_vector_embedding` | IVFFlat | 向量近似相似度搜索（`vector_cosine_ops`，lists=100） |

### 5.3 核心类型定义

**VectorEntity** (数据层实体)：
```typescript
interface VectorEntity {
  id: string;           // UUID
  collection: string;   // 所属集合
  content: string;      // 原始文本内容
  contentHash?: string; // 内容 Hash（去重用）
  metadata: Record<string, any>;  // JSONB 元数据
  embedding: number[] | null;     // 向量嵌入
  createdAt: Date;
  updatedAt: Date;
}
```

**VectorDocument** (服务层文档)：
```typescript
interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
}
```

**SearchResult** (搜索结果)：
```typescript
interface SearchResult {
  document: VectorDocument;
  score: number;   // 相似度分数 [0, 1]
}
```

### 5.4 Embedding 存储格式

向量以 PostgreSQL pgvector 原生 `vector` 类型存储，在 SQL 层表示为 `[0.12,-0.34,...]` 格式的数组字符串。`VectorRepository` 通过 `parseEmbedding()` 方法进行 JSON 解析转回 `number[]`。

---

## 6. 搜索算法

### 6.1 相似度计算

搜索使用 **余弦相似度 (Cosine Similarity)**，通过 pgvector 的 `<=>` 运算符计算余弦距离：

```sql
SELECT *, 1 - (embedding <=> $1::vector) AS similarity_score
FROM vector_documents
ORDER BY embedding <=> $1::vector
LIMIT $2
```

**公式**：
```
cosine_similarity(A, B) = (A · B) / (||A|| * ||B||)
similarity_score = 1 - cosine_distance
```

pgvector 的 `<=>` 返回余弦距离 (cosine distance)，通过 `1 - distance` 转换为相似度分数，范围 [0, 1]，值越大表示越相似。

### 6.2 搜索流程

```
search(query, topK, filter)
    │
    ▼
┌─────────────────────────┐
│ 1. 查询文本 Embedding    │
│    embeddingFn(query)    │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 2. 构建 SQL 查询         │
│    - 条件: collection    │
│    - 条件: metadata      │
│    - 排序: <=> 距离      │
│    - 限制: topK          │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 3. pgvector 索引扫描     │
│    IVFFlat / HNSW       │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│ 4. 返回 SearchResult[]   │
│    score = 1 - distance  │
└─────────────────────────┘
```

### 6.3 元数据过滤

元数据过滤通过 JSONB 操作符 `metadata->>'key' = value` 实现，在 `WHERE` 子句中与集合条件组合，最终由 GIN 索引加速：

```typescript
// 单值精确匹配
if (options?.metadataFilter) {
  for (const [key, value] of Object.entries(options.metadataFilter)) {
    conditions.push(`metadata->>'${key}' = $${paramIndex}`);
  }
}
```

当前仅支持精确等值匹配。如需范围查询、数组包含等高级过滤，需扩展过滤逻辑。

### 6.4 服务层余弦相似度 (本地计算)

`VectorStore` 类中还实现了本地的 `cosineSimilarity()` 方法，用于内存计算或验证：

```typescript
private cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

---

## 7. 前端页面结构

### 7.1 组件层次

```
VectorStorePage (index.tsx)
├── 统计面板 (Card + Statistic)
│   ├── 文档总数
│   ├── 集合数量
│   ├── 向量嵌入数
│   └── 平均维度
├── 左侧 (Col span=16)
│   └── CollectionList — 集合列表表格
│       └── 搜索过滤 + 操作列（查看/删除）
├── 右侧 (Col span=8)
│   ├── VectorSearch — 语义搜索面板
│   │   ├── 搜索输入
│   │   ├── 集合选择器
│   │   ├── Top-K 调节
│   │   └── 搜索结果列表
│   └── DocumentManager — 文档上传面板
│       ├── 集合选择
│       ├── 内容输入
│       └── 元数据 JSON 输入
├── CreateCollectionModal — 创建集合弹窗
└── CollectionDetail — 集合详情抽屉
    ├── 基本信息 Tab
    └── 文档列表 Tab
```

### 7.2 子组件职责

| 组件 | 文件 | 职责 |
|------|------|------|
| CollectionList | `CollectionList.tsx` | 集合列表展示、搜索过滤、删除操作 |
| CollectionDetail | `CollectionDetail.tsx` | 集合详情 Drawer，含文档列表 |
| VectorSearch | `VectorSearch.tsx` | 语义搜索面板，结果展示 |
| DocumentManager | `DocumentManager.tsx` | 文档上传（文本+元数据） |
| CreateCollectionModal | `CreateCollectionModal.tsx` | 新建集合表单 |
| utils | `utils.ts` | 展示层工具函数（图标映射、颜色等） |

### 7.3 前端 API 客户端

`orion-frontend/src/api/vector-store.ts` 封装了 7 个 API 调用函数：

| 函数 | 方法 | 端点 | 用途 |
|------|------|------|------|
| `addDocument` | POST | `/documents` | 添加文档 |
| `deleteDocument` | DELETE | `/documents/:id` | 删除文档 |
| `searchVectors` | POST | `/search` | 语义搜索 |
| `getCollections` | GET | `/collections` | 获取集合列表 |
| `createCollection` | POST | `/collections` | 创建集合 |
| `deleteCollection` | DELETE | `/collections/:name` | 删除集合 |
| `getCollectionDocuments` | GET | `/collections/:name/documents` | 获取集合文档 |
| `getVectorStats` | GET | `/stats` | 获取统计信息 |

---

## 8. 集成点

### 8.1 与知识库集成

Vector Store 为 `orion-knowledge` 模块提供底层语义检索能力：

```
orion-knowledge (PandaWiki fork)
    │ 知识库文档 Chunk → Vector Store
    ▼
Vector Store (pgvector)
    │ 语义搜索 → 相关文档片段
    ▼
LLM (RAG 上下文增强)
```

### 8.2 与 AI 服务集成

`VectorStore` 位于 `services/ai/` 目录下，与以下 AI 服务模块协同：

| 服务模块 | 集成方式 |
|----------|----------|
| CostOptimizerService | 可选的语义分析输入 |
| AIGateway | Embedding Provider 共用 OpenAI API Key |
| RuleEngine | 规则引擎可从向量存储中检索历史规则 |

### 8.3 RAG Pipeline 中的角色

```
用户问题
  │
  ▼
VectorStore.search(query, topK=5)
  │ 返回最相似的 Top-K 文档片段
  ▼
Prompt 构建: [系统提示] + [检索上下文] + [用户问题]
  │
  ▼
LLM 生成回答
  │
  ▼
返回结果
```

### 8.4 事件集成点

当前 `VectorStore` 未接入 EventBus（与平台整体状态一致）。未来可在文档添加、搜索命中时发布事件，用于：
- 搜索热度统计
- Embedding 质量评估
- 缓存预热策略

---

## 9. 未来增强方向

### 9.1 短期 (v1.x)

| 增强项 | 描述 | 优先级 |
|--------|------|--------|
| 批量导入 | 支持批量上传文档（文件/文件夹/URL 抓取） | 高 |
| 分块 (Chunking) | 长文本自动分块，支持 chunk_size / overlap 配置 | 高 |
| 文档更新 | 支持 `PUT /documents/:id` 更新内容与元数据 | 中 |
| 集合管理 API | 补全 collection CRUD 后端路由（前端已实现） | 高 |
| 多值元数据过滤 | 支持 `in` / `nin` / 范围查询 / 数组包含 | 中 |
| 内容去重 | 基于 `content_hash` 的自动去重 | 低 |

### 9.2 中期 (v2.0)

| 增强项 | 描述 |
|--------|------|
| Milvus 支持 | 接入 Milvus 作为高性能向量后端，支持大规模 (千万级) 向量检索 |
| ChromaDB 支持 | 接入 ChromaDB，支持本地部署的轻量级向量存储 |
| 多租户隔离 | 按 `tenantId` 隔离 collection，支持租户级别的权限控制 |
| HNSW 索引 | 从 IVFFlat 切换至 HNSW 索引，提升近似搜索精度 |
| 混合搜索 | BM25 全文搜索 + 向量语义搜索，提升召回效果 |
| Embedding 缓存 | 对相同内容的 Embedding 结果进行缓存，减少 API 调用 |

### 9.3 长期 (v3.0)

| 增强项 | 描述 |
|--------|------|
| 向量可视化 | t-SNE / UMAP 降维可视化，查看向量分布 |
| 自动调参 | 根据数据量自动调整 IVFFlat lists 参数或 HNSW 参数 |
| 分布式部署 | 向量存储分片，支持水平扩展 |
| 向量数据库抽象层 | 统一 `VectorRepository` 接口，支持运行时切换后端 |

---

## 10. 已知限制

1. **Hash Embedding 无语义能力**：`hash` provider 仅保证确定性输出，不保证语义相似性，不适合生产环境使用
2. **仅支持等值元数据过滤**：不支持范围查询、正则匹配、数组包含等高级过滤
3. **Collection CRUD 未完整实现**：前端已实现集合管理界面，但后端路由仅暴露了 `/collections` GET/POST/DELETE 的 API 定义，需确认实际路由注册
4. **无原生分页**：`search()` 仅支持 `topK` 限制，不支持分页遍历
5. **无 EventBus 集成**：文档变更和搜索操作未发布事件
6. **单实例部署**：当前 `VectorStore` 为进程内单例，无分布式协调

---

## 11. 相关文档

- INDEX.md — 模块目录索引 (S10)
- `docs/architecture/` — 系统架构文档
- ADR — 架构决策记录
- Migration 057 — 数据库迁移文件
