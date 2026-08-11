# RAG 设计 vs 代码 GAP 分析报告

> **日期**: 2026-08-11
> **分析范围**: 主设计文档（V2.2-V2.12 全部补丁） vs `orion-platform-svc-go`（实际生产后端）+ `orion-frontend`（前端）
> **结论**: 设计文档功能链路完善，但代码实现仅覆盖链路前半段（查询+检索），6 条闭环链路缺失

---

## 一、链路现状总览

```
【已打通链路】✅ 2 条
┌─────────────────────────────────────────────────────────────────────┐
│ 链路1: RAG 查询                                                     │
│   RAGQuery.tsx → ai-docs.ts.rAGQuery → POST /rag/query              │
│     → knowledge/handler.RAGQuery → KnowledgeService.Retrieve()      │
│     → repository.SearchDocuments() → PostgreSQL 检索               │
│     → 返回 answer + sources + confidence                           │
│                                                                     │
│ 链路2: 知识图谱（部分）                                             │
│   getKnowledgeGraph() → GET /graph → 已注册                         │
│   但前端页面用 DocumentList 占位（§17.3 已标注 TODO）                │
└─────────────────────────────────────────────────────────────────────┘

【缺失链路】❌ 6 条（设计有、代码无）
  反馈闭环 / 索引管理 / 安全审计 / 评估端点 / 管理员三层开关 / 语义缓存 / SSE 流式
```

---

## 二、逐链路 GAP 详情

### 2.1 已打通链路

#### 链路 1：RAG 查询 ✅

| 层 | 文件 | 状态 | 说明 |
|----|------|------|------|
| 前端页面 | `orion-frontend/src/pages/AIDocManagement/RAGQuery.tsx` | ✅ | 已实现（§17 规范对齐） |
| API 客户端 | `orion-frontend/src/api/ai-docs.ts:196-202` | ⚠️ | **路径 bug**: `/api/v1/knowledge/api/v1/rag/query`（多余嵌套 `/api/v1`） |
| 前端路由 | `routes.tsx:690` `/console/ai-docs/rag` | ✅ | 已注册 |
| 后端 Handler | `internal/knowledge/handler.go:66-69, 426` | ✅ | RAGQuery 已实现 |
| 后端 Service | `KnowledgeService.Retrieve()` | ⚠️ | 是**文档检索**，非完整 RAG Agent 管道 |
| 数据层 | `SearchDocuments()` → PostgreSQL | ✅ | 已实现 |

> **关键发现**：后端 `RAGQuery` 调用的是 `svc.Retrieve()`（文档向量检索 + 相似度筛选），
> **尚未实现**设计文档 §3.1 的完整 RAG Agent 管道（Query Rewriter → 6 源并行 → RRF → Re-ranker → Generation → Citation Verifier）。

#### 链路 2：知识图谱 ⚠️ 部分

| 层 | 状态 | 说明 |
|----|------|------|
| API 客户端 | ✅ | `getKnowledgeGraph()` → `GET /graph` |
| 后端 Handler | ✅ | `internal/knowledge/handler.go:71` 已注册 |
| 前端页面 | ⚠️ | `/console/ai-docs/graph` 用 DocumentList 占位 |

### 2.2 缺失链路（设计有、代码无）

| # | 链路 | 设计文档 | 代码状态 | 缺失实现 |
|---|------|---------|---------|---------|
| 1 | **反馈闭环** | §10.2 `POST /rag/feedback` | ❌ 无端点 | Feedback Service + `rag_feedback_events` 表 |
| 2 | **索引构建** | §10.3 `POST /rag/index/*` | ❌ 无端点 | Indexer Worker + Adapter Registry + 6 适配器 |
| 3 | **安全审计** | §10.4 `GET /rag/audit/*` | ❌ 无端点 | Audit Service + 4 个审计查询 |
| 4 | **评估端点** | §10.5 `GET /rag/eval/*` | ❌ 无端点 | Evaluator + Ground Truth 管理 |
| 5 | **管理员三层开关** | §10.6 `GET /rag/admin/*` | ❌ 无端点 | Adapter Registry 管理 + 引擎开关 |
| 6 | **语义缓存** | §16.2b Milvus Collection | ❌ 无实现 | Cache Service + Milvus Collection |
| 7 | **SSE 流式** | V2.12 `POST /rag/query/stream` | ❌ 无端点 | SSE 三阶段协议 |
| 8 | **反馈投毒防护** | V2.12 `rag_user_corrections` | ❌ 无表 | Memory Manager + 2 表 |

### 2.3 设计文档依赖的数据表（当前代码缺失）

| 表 | 设计文档 | 代码 | 功能 |
|----|---------|------|------|
| `rag_knowledge_nodes` | §7.1 | ❌ | 知识图谱节点 |
| `rag_knowledge_edges` | §7.2 | ❌ | 知识图谱边 |
| `rag_embeddings` | §7.3 | ❌ | Milvus 向量 |
| `rag_sync_status` | §7.4 | ❌ | 同步状态 |
| `rag_conversations` | §7.5 | ❌ | 对话历史 |
| `rag_eval_metrics` | §7.6 | ❌ | 评估指标 |
| `rag_eval_ground_truth` | §7.6 | ❌ | 评估基准 |
| `rag_feedback_events` | V2.4 | ❌ | 反馈事件 |
| `rag_user_corrections` | V2.12 | ❌ | 用户纠正记忆 |
| `rag_prompt_templates` | V2.12 | ❌ | Prompt 版本 |
| `rag_semantic_cache` | §16.2b | ❌ | 语义缓存（Milvus Collection） |

> 注意：`orion-intelligence-svc/migrations/001_init.sql` 有同名表，但那是 **orion-intelligence-svc**（另一服务），非 orion-platform-svc-go 实际使用的 RAG 表。两者未打通。

---

## 三、前端-后端 API 路径 bug

**当前**（`ai-docs.ts`）：
```typescript
// 前端
export const ragQuery = async (...) => {
  return api.post<RAGResponse>('/api/v1/knowledge/api/v1/rag/query', data);
  //                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                bug: 多余嵌套 /api/v1
};
```

**实际后端挂载**（`internal/knowledge/handler.go:26-27`）：
```go
f := rg.Group("/knowledge")
f.POST("/rag/query", ...)  // 若 rg 前缀为 /api/v1 → /api/v1/knowledge/rag/query
```

**影响**：`/api/v1/knowledge/api/v1/rag/query` ≠ `/api/v1/knowledge/rag/query`，请求会 404。

> 设计文档 §10 把 `api/v1/knowledge/api/v1/rag/*` 固化为"规范"，**放大了这个 bug**。应改为 `/api/v1/knowledge/rag/*`。

---

## 四、设计文档需修订处（基于 GAP 分析）

| # | 位置 | 问题 | 修订 |
|---|------|------|------|
| 1 | §10 API 前缀 | 固化双层 `/api/v1` bug | 改为 `/api/v1/knowledge/rag/*` |
| 2 | §11 MVP Phase 1 | 声称 6 项交付物 | 实际代码仅 1-2 项（查询+图谱部分）完成 |

---

## 五、补全优先级排序

### Phase A：补齐查询链路基础（已有 60% 基础）

| # | 任务 | 依赖 | 说明 |
|---|------|------|------|
| A1 | 修复 API 路径 bug | 无 | `ai-docs.ts` 改 `/api/v1/knowledge/rag/*` |
| A2 | RAG Agent 管道落地 | A1 | 实现完整管道（Rewriter → 6 源 → RRF → Re-ranker → Generation） |

### Phase B：补齐闭环链路（缺失的 6 条）

| # | 任务 | 依赖 | 优先级 |
|---|------|------|--------|
| B1 | 反馈闭环 | A2 | P1 |
| B2 | 语义缓存 | A2 | P1 |
| B3 | 索引管理 + Adapter Registry | A2 | P1 |
| B4 | 安全审计端点 | A1 | P2 |
| B5 | 评估端点 + Ground Truth | B1 | P2 |
| B6 | 管理员三层开关 | B3 | P2 |
| B7 | SSE 流式 | A2 | P1 |

### Phase C：数据层建设

| # | 任务 | 依赖 |
|---|------|------|
| C1 | 建 10 张 RAG 表 + Milvus Collection | B 全部 |

---

## 六、总结

| 维度 | 结论 |
|------|------|
| **设计文档功能链路** | 完善（查询→检索→生成→验证→反馈→评估→缓存→管理全覆盖） |
| **代码已实现** | 查询 + 检索（文档级），约占总设计 30% |
| **代码缺失** | 6 条闭环链路 + 10 张数据表 + 完整 RAG Agent 管道 |
| **实际后端** | 是 `orion-platform-svc-go`（Go），非文档中的 `orion-platform-service`（TS） |
| **API 路径 bug** | 前端双层 `/api/v1` 会 404，且被设计文档固化为规范 |

**下一步建议**：优先执行 Phase A（修 bug + 完整 RAG Agent 管道），再 Phase B（反馈/缓存/索引/SSE 闭环）。需要我启动实施吗？