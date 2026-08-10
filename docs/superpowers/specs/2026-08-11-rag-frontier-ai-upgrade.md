# V2.11 补丁：AI 前沿技术能力补充

> **版本**: V2.11
> **触发原因**: 领域专家从 Agentic RAG、End-to-End LLM、Reasoning、Long-Term Memory、Multimodal 五个前沿视角，对现有设计进行深度分析，发现 8 项缺失能力需补充
> **评审范围**: 主设计文档全篇 + V2.2~V2.10 补丁
> **核心原则**: 不推翻现有架构，仅在前沿维度上做增量补充

---

## 一、评审发现汇总

| # | 缺失能力 | 前沿视角 | 严重度 | 影响范围 |
|---|---------|---------|--------|---------|
| P0-1 | **Agentic Self-Correction Loop** — Citation Verifier 失败后无重新规划能力 | Agentic RAG | P0 | §3.1 Phase 4, §8.4 |
| P0-2 | **Structured Generation** — LLM 输出 JSON 无 Schema 约束，可能格式错误 | End-to-End LLM | P0 | §3.3 |
| P0-3 | **Adaptive Test-Time Compute** — 简单/复杂查询资源分配无差异 | Reasoning | P0 | §16.1 |
| P1-1 | **Tool-Augmented RAG (只读验证)** — 答案无法自动验证当前系统状态 | Agentic RAG | P1 | §3.1 Phase 4, §8.4 |
| P1-2 | **Cross-Session Memory** — 用户纠正无法跨会话持久化 | Long-Term Memory | P1 | §15.3 |
| P1-3 | **Clarification / Active Learning** — 不确定时主动反问而非猜测 | Long-Term Memory | P1 | §13.1 |
| P2-1 | **End-to-End Retrieval Fine-tuning** — 用反馈数据 fine-tune embedding | End-to-End LLM | P2 | §14 |
| P2-2 | **Live System Observation** — 查询时拉取实时 Prometheus 遥测数据 | Multimodal | P2 | §3.1 Phase 2 |

---

## 二、P0-1 修复：Agentic Self-Correction Loop

### 2.1 问题

当前 §8.4 的 Citation Verifier 失败后仅重试 2 次，无重新规划能力：

```
// ❌ 当前：重试 → 重试 → 放弃
Citation Verifier 检测到虚假引用
  → 重新生成（最多 2 次）
  → 仍失败 → 降权返回
  → 无原因分析，无策略调整
```

### 2.2 修复方案：5 阶段 Agentic Loop

```
LLM 生成答案
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Verifier Engine（V2.6 Layer C 增强版）                            │
│                                                                  │
│ 检查维度：                                                        │
│ 1. Citation Accuracy — 引用 ID 是否在检索结果中？                  │
│ 2. Factual Support — 答案断言能否被检索内容支持？                  │
│ 3. Permission Feasibility — 答案中操作是否在用户权限范围内？       │
│ 4. Format Compliance — 输出格式是否符合 JSON Schema？            │
└─────────────────────────────────────────────────────────────────┘
    │
    ├── 全部通过 ✅ → 返回答案
    │
    └── 检测到问题 ❌
          │
          ▼
    ┌─────────────────────────────────────────────────────────┐
    │ Failure Analyzer（新增：问题根因分析）                     │
    │                                                         │
    │ 分析失败原因：                                            │
    │ • citation_missing → 检索结果不包含该引用                  │
    │ • hallucinated_api → API 不存在或路径错误                  │
    │ • insufficient_evidence → 检索结果不足以支持答案          │
    │ • permission_gap → 答案涉及超出用户权限的操作              │
    │ • format_error → 输出 JSON 格式不符合 Schema              │
    │                                                         │
    │ 输出: { failure_type, details[], remediation_plan }      │
    └─────────────────────────────────────────────────────────┘
          │
          ▼
    ┌─────────────────────────────────────────────────────────┐
    │ Remediation Orchestrator（新增：策略编排）                 │
    │                                                         │
    │ 根据失败类型选择修正策略：                                 │
    │                                                         │
    │ citation_missing → 重新检索（放宽 Top-K + 降低阈值）     │
    │ hallucinated_api → 重新检索+增加 BM25 权重（精确匹配）   │
    │ insufficient_evidence → 扩大检索范围（多源扩展）          │
    │ permission_gap → 移除越权内容，仅保留有权限部分           │
    │ format_error → 用结构化生成模板重新生成                   │
    │                                                         │
    │ 最大循环次数: 3（比当前多 1 次，但每次策略不同）          │
    └─────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────┐
  │ 重新执行 Phase 2/3/4 但使用调整后的策略参数           │
  └─────────────────────────────────────────────────────┘
          │
          ▼
      回到 Verifier Engine（循环检测）
```

### 2.3 策略参数调整矩阵

| 失败类型 | Top-K 调整 | 权重调整 | 额外操作 |
|---------|-----------|---------|---------|
| citation_missing | 10 → 20 | 无 | 增加 BM25 的精确匹配权重 |
| hallucinated_api | 10 → 30 | BM25 权重提升 0.35→0.5 | 降低 similarity 阈值 0.92→0.85 |
| insufficient_evidence | 10 → 15 | 图谱权重提升 0.25→0.4 | 启用 2-hop 图谱扩展 |
| format_error | 不变 | 不变 | 改用 Jsonformer/Outlines 结构化生成 |

### 2.4 在 RAG Agent 中的集成位置

```
Phase 3: Context Assembler → Phase 4: LLM Inference
    │                             │
    ▼                             ▼
Answer Verifier (Layer C) ← ──── 答案
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Failure Analyzer + Remediation Orchestrator  ← 【新增】       │
│                                                              │
│ 失败 → 回退到 Phase 2（修改策略参数，不重新执行 Phase 1）     │
│ 成功 → 返回答案                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、P0-2 修复：Structured Generation

### 3.1 问题

当前 §3.3 的回答格式依赖 LLM 自然语言生成 JSON，无 Schema 约束。LLM 可能输出：
- 字段名大小写不一致（`Answer` vs `answer`）
- 缺少必填字段（如 `citations[].verified`）
- 类型错误（`confidence` 为字符串而非数字）

### 3.2 修复方案：JSON Schema + 结构化生成

#### 3.2.1 回答格式 Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RAGResponse",
  "type": "object",
  "required": ["answer", "citations", "confidence"],
  "properties": {
    "answer": {
      "type": "string",
      "maxLength": 2000,
      "description": "操作指引正文"
    },
    "citations": {
      "type": "array",
      "minItems": 0,
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["text", "source", "entity_id", "verified"],
        "properties": {
          "text":          { "type": "string" },
          "source":        { "type": "string", "enum": ["runbook", "api", "frontend_page", "db_table", "alert_rule"] },
          "entity_id":     { "type": "string" },
          "verified":      { "type": "boolean" },
          "relevance_score": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "graph_links": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["label", "url", "executable"],
        "properties": {
          "label":      { "type": "string" },
          "url":        { "type": "string", "format": "uri" },
          "executable": { "type": "boolean" }
        }
      }
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "truncated_sources": {
      "type": "array",
      "items": { "type": "string" }
    },
    "feedback_token": {
      "type": "string",
      "pattern": "^[a-f0-9-]{36}$"
    }
  }
}
```

#### 3.2.2 结构化生成实现

```go
// 使用 Jsonformer 或 Outlines 库约束 LLM 输出
type RAGResponse struct {
    Answer     string      `json:"answer" validate:"required,max=2000"`
    Citations  []Citation  `json:"citations" validate:"required,min=0,max=10,dive"`
    GraphLinks []GraphLink `json:"graph_links,omitempty"`
    Confidence float64     `json:"confidence" validate:"min=0,max=1"`
    Truncated  []string    `json:"truncated_sources,omitempty"`
    FeedbackToken string   `json:"feedback_token" validate:"omitempty,uuid"`
}

// 生成时：将 Schema 作为约束传递给 LLM
// 生成后：用 validate 库校验，失败则触发 Agentic Loop（P0-1）
```

#### 3.2.3 约束 LLM 的 Prompt 模板（增强版）

```
回答格式约束（必须遵守）：
1. 输出必须是合法的 JSON 对象
2. 必须包含以下字段：answer (string), citations (array), confidence (number 0-1)
3. citations 数组中每个元素必须包含：text, source, entity_id, verified
4. source 字段只能是以下之一：runbook, api, frontend_page, db_table, alert_rule
5. confidence 必须在 0 到 1 之间
6. answer 长度不超过 2000 字符

输出示例（JSON 格式）：
{
  "answer": "操作步骤...",
  "citations": [
    { "text": "引用文本", "source": "runbook", "entity_id": "rb-001", "verified": true, "relevance_score": 0.92 }
  ],
  "confidence": 0.89
}
```

---

## 四、P0-3 修复：Adaptive Test-Time Compute

### 4.1 问题

当前所有查询使用相同的预算和处理路径（§16.1），简单查询和复杂查询无差异：

```
// ❌ 当前：所有查询统一处理
"如何查看流水线状态" → 600ms 同等路径
"CI失败的根因是什么，影响范围多大，如何回滚" → 600ms 同等路径
```

### 4.2 修复方案：三路复杂度感知路由

```
用户查询
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Query Classifier（复杂度评估增强）                              │
│                                                             │
│ 从当前 3 级（simple/moderate/complex）扩展为 3 路路由：        │
│                                                             │
│ simple（~60% 查询）:                                          │
│   • 特征: ≤ 5 词, 单意图, 常见操作                             │
│   • 路径: 语义缓存 → 命中+返回 / 未命中→BM25+向量→RRF→LLM     │
│   • 预算: 200ms                                              │
│   • 模型: Qwen2.5-3B 本地（快速推理）                          │
│                                                             │
│ moderate（~30% 查询）:                                        │
│   • 特征: 6-15 词, 单意图, 含时间/条件限定                     │
│   • 路径: 语义缓存 → 向量+BM25+图谱→RRF→Re-rank→LLM          │
│   • 预算: 600ms                                              │
│   • 模型: Qwen2.5-3B 本地                                   │
│                                                             │
│ complex（~10% 查询）:                                         │
│   • 特征: >15 词, 多意图, 含跨领域/故障排查场景                 │
│   • 路径: 全量（含 Agentic Loop + 多源扩展）                    │
│   • 预算: 5s                                                 │
│   • 模型: Qwen2.5-3B 本地 + Claude 兜底（复杂推理兜底）        │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 性能预算更新

| 查询类型 | 占比 | P50 目标 | P99 目标 | 说明 |
|---------|------|---------|---------|------|
| **simple** | 60% | 200ms | 500ms | 语义缓存命中时 < 50ms |
| **moderate** | 30% | 600ms | 1500ms | 含 Re-rank |
| **complex** | 10% | 2s | 5s | 含 Agentic Loop + 多源扩展 |
| **加权平均** | 100% | **~520ms** | **~1.8s** | 比当前 ~545ms 略优，P99 改善 |

---

## 五、P1-1 修复：Tool-Augmented RAG（只读验证）

### 5.1 问题

当前 RAG 仅基于静态索引生成答案，无法验证"当前系统状态是否与文档一致"。

### 5.2 修复方案：只读 API 验证层

```go
// Tool-Augmented Verification（在 Citation Verifier 之后执行）
// 仅调用 GET 只读 API，不写操作

type VerificationTool struct {
    Name        string
    Endpoint    string
    Method      string  // 仅 GET
    Timeout     time.Duration
    Description string
}

var DefaultVerificationTools = []VerificationTool{
    {
        Name:    "handler_registry_check",
        Method:  "GET",
        Endpoint: "/api/v1/handler-registry/entries/{handler_id}",
        Timeout: 500 * time.Millisecond,
        Description: "验证 handler 是否真实注册且 active",
    },
    {
        Name:    "pipeline_status_check",
        Method:  "GET",
        Endpoint: "/api/v1/pipeline/runs/{run_id}",
        Timeout: 500 * time.Millisecond,
        Description: "验证流水线运行状态是否如文档所述",
    },
    {
        Name:    "alert_rule_exists",
        Method:  "GET",
        Endpoint: "/api/v1/alert-rules/{rule_id}",
        Timeout: 500 * time.Millisecond,
        Description: "验证告警规则是否存在",
    },
}
```

### 5.3 集成流程

```
LLM 生成答案
    │
    ▼
Citation Verifier（引用 ID 校验）
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Tool-Augmented Verifier 【新增】                               │
│                                                              │
│ 1. 从答案中提取可验证的实体（handler_id, run_id, rule_id）    │
│ 2. 匹配对应的 VerificationTool                                │
│ 3. 并行调用对应 GET 只读 API（500ms 超时）                    │
│ 4. 结果分类：                                                  │
│    • 全部 200 OK → 标注 "verified_by_live_system" ✅          │
│    • 部分 404 → 标注 "entity_not_found" ⚠️（降权引用）        │
│    • 全部失败 → 触发 Agentic Loop（P0-1）                     │
│ 5. 记录审计日志                                                │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 安全边界

- 仅调用 GET 只读端点，不写操作
- 端点白名单（仅允许 `handler_registry` / `pipeline` / `alert-rules` 等预设模块）
- 500ms 超时，防止阻塞
- 失败不阻塞答案返回，仅降级引用标记

---

## 六、P1-2 修复：Cross-Session Memory

### 6.1 问题

当前用户反馈（§15.3）仅影响当前会话，跨会话无记忆。用户今天纠正了"回滚的入口在交付模块"，明天问同样问题仍然得到错误答案。

### 6.2 修复方案

```sql
-- 用户偏好记忆表（新增）
CREATE TABLE rag_user_preferences (
    user_id         VARCHAR(255) PRIMARY KEY,
    tenant_id       VARCHAR(255) NOT NULL,
    -- 用户纠正记录
    corrections     JSONB DEFAULT '[]',  -- [{ query, corrected_answer, corrected_at, applied_count }]
    -- 用户偏好
    preferred_scope VARCHAR(50),          -- 默认 scope（ci_cd / observability 等）
    excluded_topics TEXT[],               -- 用户不感兴趣的话题列表
    -- 用户行为画像
    query_patterns  JSONB DEFAULT '{}',   -- { frequent_terms[], avg_confidence, avg_satisfaction }
    active_until    TIMESTAMPTZ,          -- 活跃期（无活动 90 天后归档）
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rag_user_corrections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(255) NOT NULL,
    query           TEXT NOT NULL,
    original_answer TEXT,
    corrected_answer TEXT,
    similarity_hash VARCHAR(64),          -- 查询语义 hash，用于自动匹配相似查询
    applied_count   INT DEFAULT 0,        -- 被自动应用的次数
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rag_usr_corr_hash ON rag_user_corrections(similarity_hash);
```

### 6.3 记忆集成流程

```
用户提问
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Memory-Aware Retriever 【新增】                                │
│                                                              │
│ 1. 计算用户查询的 similarity_hash                               │
│ 2. 查询 rag_user_corrections: 是否有相似查询的纠正记录？       │
│ 3. 如果有（cosine > 0.95）:                                    │
│    • 在检索结果中注入纠正记录作为额外 context                  │
│    • 在 System Prompt 中注入 "用户之前纠正过：..."            │
│    • LLM 生成时优先考虑纠正信息                                │
│ 4. 如果没有 → 正常流程                                         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
正常 RAG 流程
    │
    ▼
用户反馈（👍👎 + 纠正文本）
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ Memory Updater 【新增】                                        │
│                                                              │
│ 👎 + corrected_answer != null:                                │
│   • 写入 rag_user_corrections（计算 similarity_hash）          │
│   • 更新 rag_user_preferences.query_patterns                  │
│                                                              │
│ 👍:                                                           │
│   • 更新 rag_user_preferences.query_patterns（强化权重）       │
└──────────────────────────────────────────────────────────────┘
```

---

## 七、P1-3 修复：Clarification / Active Learning

### 7.1 问题

当前用户查询不明确时，LLM 直接猜测答案，可能返回错误指引。

### 7.2 修复方案：不确定性检测 + 主动反问

```go
// 不确定性检测
func (r *QueryClassifier) EstimateUncertainty(query string, retrievalResults []Result) float64 {
    // 根据以下因素综合评估不确定性
    score := 0.0

    // 1. 检索结果数量（< 3 个结果 → 高不确定性）
    if len(retrievalResults) < 3 {
        score += 0.3
    }

    // 2. 最高置信度（< 0.6 → 高不确定性）
    if len(retrievalResults) > 0 && retrievalResults[0].Score < 0.6 {
        score += 0.3
    }

    // 3. 查询歧义度（检测歧义词）
    ambiguousTerms := []string{"那个", "这个", "it", "that", "the one", "之前的"}
    for _, term := range ambiguousTerms {
        if strings.Contains(query, term) {
            score += 0.2
            break
        }
    }

    // 4. 实体缺失（查询中无具体实体名）
    if len(r.extractEntities(query)) == 0 {
        score += 0.2
    }

    return math.Min(score, 1.0)
}

// 不确定性 ≥ 0.5 → 触发主动反问
func (a *RAGAgent) HandleQuery(ctx, req) {
    uncertainty := a.classifier.EstimateUncertainty(req.Query, results)

    if uncertainty >= 0.5 {
        // 生成反问列表
        clarification := a.generateClarification(req.Query, results)
        return &QueryResponse{
            Type: "clarification_required",  // 前端特殊处理
            Clarifications: []string{
                "请确认你指的是 CI 流水线还是审批工作流？",
                "你指的是哪个模块？可选：交付/可观测性/基础设施",
                "你想查看当前状态还是操作指引？",
            },
            OriginalQuery: req.Query,
        }
    }

    // 正常流程
    return a.generateAnswer(ctx, req, results)
}
```

### 7.3 前端交互（§17 补充）

```
反问场景:

┌──────────────────────────────────────────────────────────────┐
│ 🤔 我需要确认一下...                                          │
│                                                              │
│ 你说"那个流水线"——请确认你指的是：                              │
│                                                              │
│ [Button] 1. CI/CD 流水线（交付模块）                          │
│ [Button] 2. 审批工作流（治理模块）                            │
│ [Button] 3. 都不是（重新描述）                                │
│                                                              │
│ 选择后我会重新检索                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 八、P2-1 修复：End-to-End Retrieval Fine-tuning

### 8.1 问题

当前使用固定预训练 embedding 模型（bge-base-zh），检索质量无法通过反馈数据持续优化。

### 8.2 修复方案：反馈驱动的 Embedding Fine-tuning

```
数据收集阶段（持续）
─────────────────────────────────────────────────────────────
1. 用户反馈（👎）的 query + 用户纠正的 correct_answer 作为正样本
2. 用户反馈（👎）的 query + 原始错误答案作为负样本
3. 每周生成一批训练样本（query, positive, negative）

Fine-tuning 阶段（每 2 周）
─────────────────────────────────────────────────────────────
1. 使用 Sentence Transformer 训练框架
2. 对比损失 (Contrastive Loss): max(0, margin - sim(q, p) + sim(q, n))
3. 冻结基础模型前 6 层，仅微调最后 2 层
4. 训练数据: 当前 > 200 条反馈样本，目标每 2 周 +50 条
5. 验证: 在 Ground Truth 集上评估 Recall@5 提升

部署阶段
─────────────────────────────────────────────────────────────
1. 新模型版本号写入 rag_embeddings.model_version
2. 新旧版本共存 7 天（V2.7 嵌入模型版本管理策略）
3. 对账无误后切换为新模型
```

### 8.3 评估指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| Ground Truth Recall@5 | 0.85 | 0.90（+5pp） |
| 用户正面反馈率 | 70% | 75%（+5pp） |
| 每周训练样本数 | 0 | 50+ |

---

## 九、P2-2 修复：Live System Observation

### 9.1 问题

当前 RAG 仅基于静态索引，无法感知"当前系统状态"——如当前告警数量、服务健康状态、部署进度。

### 9.2 修复方案：查询时实时数据注入

```go
// 实时数据源（查询时同步拉取，非索引）
type LiveDataSource struct {
    Name        string
    FetchFunc   func(ctx, tenantID) ([]byte, error)
    CacheTTL    time.Duration
    Timeout     time.Duration
}

var DefaultLiveSources = []LiveDataSource{
    {
        Name: "active_alerts",
        FetchFunc: fetchActiveAlerts,  // 查询租户当前活跃告警
        CacheTTL: 30 * time.Second,
        Timeout:  2 * time.Second,
    },
    {
        Name: "recent_deployments",
        FetchFunc: fetchRecentDeployments,  // 最近 24h 部署状态
        CacheTTL: 60 * time.Second,
        Timeout:  2 * time.Second,
    },
    {
        Name: "service_health",
        FetchFunc: fetchServiceHealth,  // 服务健康检查
        CacheTTL: 30 * time.Second,
        Timeout:  2 * time.Second,
    },
}
```

### 9.3 集成位置

```
Phase 2: Hybrid Retrieval
    │
    ├── Vector Search (静态索引)
    ├── BM25 Search (静态索引)
    ├── Graph Query (静态索引)
    └── Live Data 【新增】— 并行拉取实时数据
         ├── active_alerts → 注入 Context 作为 "当前系统状态"
         ├── recent_deployments → 注入 Context
         └── service_health → 注入 Context
              │
              ▼
    Context Assembler: 静态检索 + 实时数据 合并
```

---

## 十、修复后 V2.11 缺陷状态

| # | 缺失能力 | 修复前 | 修复后 |
|---|---------|--------|--------|
| P0-1 | Agentic Self-Correction | 重试 2 次后放弃 | 5 阶段 Agentic Loop + 策略动态调整 |
| P0-2 | Structured Generation | 无 Schema 约束 | JSON Schema + validate 校验 |
| P0-3 | Adaptive Test-Time Compute | 统一路径 | 三路复杂度感知路由（200ms/600ms/5s） |
| P1-1 | Tool-Augmented RAG | 无实时验证 | 只读 GET API 验证层 |
| P1-2 | Cross-Session Memory | 跨会话清零 | 持久化纠正记忆 + 自动应用 |
| P1-3 | Clarification | 直接猜测 | 不确定性检测 + 主动反问 |
| P2-1 | Retrieval Fine-tuning | 固定预训练模型 | 反馈驱动每 2 周微调 |
| P2-2 | Live System Observation | 仅静态索引 | 查询时拉取实时遥测数据 |

## 十一、与主设计文档的关系

| 版本 | 核心能力 | 关系 |
|------|---------|------|
| V2.2-V2.10 | 基础 RAG 能力 + 安全 + 评估 + 可扩展 | 基础 |
| V2.11 | **AI 前沿能力补充** | 在现有架构上做 8 项增量补充，不推翻现有设计 |

### 主文档对应章节更新标记

| 主文档位置 | 更新内容 | V2.11 引用 |
|-----------|---------|-----------|
| §3.1 Phase 4 | 增加 Agentic Loop 回退路径 | §二 |
| §3.3 回答格式 | 增加 JSON Schema 约束 | §三 |
| §8.4 Citation Verifier | 增强为 5 阶段 Verifier Engine | §二 |
| §13.1 Query Understanding | 增加复杂度评估路由 | §四 |
| §15.3 用户反馈闭环 | 增加 Cross-Session Memory | §六 |
| §16.1 性能预算 | 替换为三路预算表 | §四 |
| §14 评估框架 | 增加 Embedding 微调指标 | §八 |