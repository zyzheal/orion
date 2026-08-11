# V2.12 补丁：五专家评审修复 — 评估基础设施 + 系统韧性

> **版本**: V2.12
> **触发原因**: 5 位资深领域专家并行评审（检索架构/LLM-Agentic/安全信任/系统架构/评估质量），发现 4 项 P0 + 12 项 P1 + 10+ 项 P2 缺口
> **评审范围**: V2.2-V2.11 全部设计文档
> **核心原则**: 仅补齐 P0 + 高价值 P1，P2 项留作后续迭代

---

## 一、评审发现汇总

| 严重度 | 数量 | 核心领域 |
|--------|------|---------|
| **P0** | 4 | CoT 推理、SSE 流式、评估基础设施、微调自动回滚 |
| **P1（高价值）** | 6 | MMR 去重、Planning、Prompt 版本管理、安全防护、系统韧性、指标扩展 |
| **P1（其余）** | 6 | 留 V2.13 迭代 |
| **P2** | 10+ | 留 V2.13+/V3 迭代 |

---

## 二、P0-1 修复：CoT 链式推理

### 2.1 问题

当前 complex 查询路径（10% 的查询）直接生成答案，无分步推理过程。对于故障排查场景（如"CI 失败根因分析"），LLM 直接猜答案，出错时无法定位推理断点。

### 2.2 修复方案：CoT 提示模板

```go
// CoT 推理模板（仅用于 complex 查询路径）
func buildCoTPrompt(query string, retrieval []Result, context string) string {
    return fmt.Sprintf(`你是一个运维故障排查专家。请按照以下步骤分析问题。

步骤1: 理解问题
  - 用户的问题是: "%s"
  - 涉及的系统: [从检索结果中提取]
  - 可能的故障类型: [列出 2-3 种可能性]

步骤2: 分析检索结果
  - 相关 API: [列出相关端点]
  - 相关 Runbook: [列出相关操作手册]
  - 相关数据表: [列出相关表结构]

步骤3: 推理过程
  - 最可能的原因: [基于检索结果推理]
  - 验证方法: [如何确认这个原因]
  - 如果 A 不对，下一个可能性: [备选方案]

步骤4: 生成操作指引
  - 基于以上分析，给出具体的操作步骤
  - 每步必须引用来源（标注 [来源ID]）
  - 如果推理不确定，标注置信度

检索内容:
%s

用户问题: %s
回答:`, query, context, retrieval.Format(), query)
}
```

### 2.3 在前端 §17 中的展示

```
CoT 推理过程展示（折叠面板，默认收起）:

┌──────────────────────────────────────────────────────────────┐
│  🤔 推理过程                                    [展开 ▼]    │
│                                                              │
│  Step 1: 理解问题                                             │
│    → 用户在排查 CI 流水线失败                                  │
│    → 涉及系统: pipeline, git, build                           │
│                                                              │
│  Step 2: 分析检索结果                                         │
│    → 找到 3 个相关 Runbook                                   │
│    → 找到 5 个相关 API 端点                                   │
│                                                              │
│  Step 3: 推理结果                                             │
│    → 最可能原因: 构建节点 OOM（置信度 85%）                    │
│    → 验证方法: 查看构建日志中的 OOM 关键字                     │
│    → 备选: 依赖镜像拉取超时（置信度 30%）                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、P0-2 修复：SSE 流式输出

### 3.1 问题

当前 RAG 查询全量返回（P99 complex 查询 5s），用户看 5 秒空白 Loading。已有平台 SSE 基础设施（Pipeline SSE 集成），但未用于 RAG。

### 3.2 修复方案：三阶段 SSE 协议

```
SSE 端点: POST /api/v1/knowledge/api/v1/rag/query/stream
Content-Type: text/event-stream

事件流:

阶段 1: 检索进度
────────────────────────────────────────────────────────────────────
event: retrieval_progress
data: {"phase": "query_understanding", "status": "done", "duration_ms": 120}
data: {"phase": "retrieval_vector", "status": "done", "duration_ms": 35, "hits": 15}
data: {"phase": "retrieval_bm25", "status": "done", "duration_ms": 22, "hits": 12}
data: {"phase": "retrieval_graph", "status": "running", "duration_ms": 45}
data: {"phase": "retrieval_live", "status": "pending"}

阶段 2: LLM 生成流
────────────────────────────────────────────────────────────────────
event: generation_start
data: {"model": "qwen2.5-3b", "estimated_tokens": 800}

event: generation_chunk
data: {"delta": "要回滚流水线运行，请按以下步骤操作：\n\n"}
data: {"delta": "1. 进入【交付】→【流水线管理】页面\n"}
data: {"delta": "2. 在列表中找到失败的运行"}

阶段 3: 完成
────────────────────────────────────────────────────────────────────
event: completion
data: {"answer": "完整答案...", "citations": [...], "confidence": 0.89}

错误:
event: error
data: {"code": "RETRIEVAL_TIMEOUT", "message": "图谱检索超时，已降级为 BM25 only"}
```

### 3.3 前端集成

```typescript
// 复用平台已有 SSE 工具（useEventSource / pipeline-svc 的实现）
function useRAGStream(query: RAGQuery) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [answer, setAnswer] = useState<string>('');

  const eventSource = useEventSource('/api/v1/knowledge/api/v1/rag/query/stream', {
    query: JSON.stringify(query),
  });

  eventSource.on('retrieval_progress', (data) => {
    setPhases(prev => [...prev, data]);
  });

  eventSource.on('generation_chunk', (data) => {
    setAnswer(prev => prev + data.delta);
  });

  eventSource.on('completion', (data) => {
    // 渲染完整答案（含 citations/graph_links）
    renderComplete(data);
  });
}
```

---

## 四、P0-3 修复：评估基础设施

### 4.1 问题

当前评估框架（§14）存在 7 项系统性缺失：无离线/在线评估分离、无 LLM-as-judge 偏差校准、无人工标注工作流、无评估数据版本管理、无统计显著性检验、无回归测试集扩展策略、无评估结果可解释性。

### 4.2 修复方案：评估基础设施四层架构

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: 离线评估管道（每日自动执行）                              │
│                                                                  │
│ 1. 加载 Ground Truth 集（当前版本）                              │
│ 2. 对每条 query 执行 RAG 查询（record 模式下，不写缓存）          │
│ 3. 计算 7 维指标：                                                │
│    • 检索质量: Recall@5 / MRR / Context Precision@K              │
│    • 答案质量: Faithfulness / Answer Relevance                    │
│    • 精确匹配: Citation Accuracy / Answer Correctness             │
│ 4. 写入 rag_eval_metrics 表（带评估版本号）                      │
│ 5. 生成评估报告（含退化检测 + 对比上一版本）                      │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: LLM-as-Judge 偏差校准（每月）                           │
│                                                                  │
│ 1. 抽取 50 条历史评估样本（分层抽样：各难度/领域）                │
│ 2. 送人工标注（标注指南 + 一致性检验 Cohen's Kappa ≥ 0.8）       │
│ 3. 对比 Judge 评分 vs 人工评分                                    │
│ 4. 计算 Judge 偏差向量（如"偏好冗长答案" = +0.15 bias）          │
│ 5. 更新 Judge 校准参数 → 下次评估时自动修正偏差                   │
│ 6. 如果 Kappa < 0.6 → 触发 Judge 模型切换或 Prompt 优化          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: 评估数据版本管理                                        │
│                                                                  │
│ rag_eval_ground_truth 表增加版本管理字段：                        │
│   eval_version: VARCHAR(20)  -- "v1.0", "v1.1", "v2.0"          │
│   is_active:    BOOLEAN     -- 当前版本标记为 active              │
│   superseded_by: VARCHAR(20) -- 被哪个版本替代                    │
│                                                                  │
│ 版本升级规则:                                                     │
│   • v1.x: 小幅修正（修正标注错误、增加 hard 案例）               │
│   • v2.0+: 大规模扩展（增加新领域、新查询类型）                  │
│   • 旧版本不删除，保留历史评估结果可回溯                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: 回归测试集自动扩展（每季度）                             │
│                                                                  │
│ 1. 收集过去 3 个月用户真实查询（匿名化后）                       │
│ 2. 聚类去重（按 query embedding 相似度分组）                     │
│ 3. 从每个聚类中选取代表性问题                                    │
│ 4. 领域专家标注 + 人工审核                                        │
│ 5. 加入 Ground Truth 集 + 升级评估版本号                         │
│ 6. 目标: 每季度 +20 条，覆盖新场景                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 评估指标扩展

| 指标 | 计算方式 | 目标值 | 新增 |
|------|---------|--------|------|
| **Recall@5** | 正确节点数 / 应返回节点数 | ≥ 0.85 | 已有 |
| **MRR** | 1/首个正确结果的排名 | ≥ 0.70 | 已有 |
| **Context Precision@K** | 检索结果中相关节点比例 | ≥ 0.80 | **新增** |
| **Faithfulness** | 答案中可被检索内容支持的比例 | ≥ 0.90 | 已有 |
| **Answer Relevance** | 答案与问题的相关性（LLM-as-judge） | ≥ 0.80 | 已有 |
| **Answer Correctness** | 答案与标准答案的语义等价 F1 | ≥ 0.75 | **新增** |
| **Citation Accuracy** | 引用真实存在的比例 | ≥ 0.95 | 已有 |

### 4.4 退化检测补充

```go
// 统计显著性检验（Mann-Whitney U）
func (d *DegradationDetector) Detect(ctx context.Context, metrics []Metric) (*DegradationReport, error) {
    // 1. 获取 7 天滚动基线
    baseline := d.getRollingBaseline(ctx, 7*24*time.Hour)

    // 2. Mann-Whitney U 检验（今天 vs 基线）
    for _, metric := range metrics {
        pValue := mannWhitneyU(metric.DailyValues, baseline.DailyValues)
        if pValue < 0.05 {
            // 统计显著差异
            effectSize := cohensD(metric.DailyValues, baseline.DailyValues)
            if effectSize > 0.5 && metric.Mean < baseline.Mean {
                // 中等以上效应量 + 退化方向 → 触发告警
                d.alert(ctx, metric.Name, metric.Mean, baseline.Mean, pValue)
            }
        }
    }

    // 3. 2-sigma 异常检测（单日异常波动）
    for _, metric := range metrics {
        sigma := calculateSigma(metric.DailyValues)
        if metric.TodayValue < baseline.Mean-2*sigma {
            d.alert(ctx, metric.Name, metric.TodayValue, baseline.Mean, "2-sigma 异常")
        }
    }
}
```

---

## 五、P0-4 修复：Retrieval 微调自动回滚

### 5.1 问题

当前 §8 的微调方案仅"7 天共存 + 手动对账"，无自动回滚条件。

### 5.2 修复方案：自动回滚门控

```go
// 微调部署流程（自动门控，非手动）
func (f *FineTunePipeline) Deploy(ctx context.Context, newModelID string) error {
    // Stage 1: 离线验证（在 Ground Truth 集上评估）
    oldMetrics := f.evaluator.Evaluate(ctx, f.currentModelID)
    newMetrics := f.evaluator.Evaluate(ctx, newModelID)

    // 门控 1: Recall@5 下降 < 0.02
    if newMetrics.RecallAt5 < oldMetrics.RecallAt5 - 0.02 {
        return fmt.Errorf("门控失败: Recall@5 从 %.4f 降至 %.4f", oldMetrics.RecallAt5, newMetrics.RecallAt5)
    }

    // 门控 2: 统计显著性检验（p < 0.05）
    pValue := f.statisticalTest(oldMetrics, newMetrics)
    if pValue > 0.05 {
        return fmt.Errorf("门控失败: 新旧模型无统计显著差异 (p=%.4f)", pValue)
    }

    // Stage 2: 灰度上线（5% 流量，24h 观察期）
    f.rollout(ctx, newModelID, 0.05)

    // 观察期 24h
    time.Sleep(24 * time.Hour)

    // 门控 3: 用户正面反馈率下降 < 3%
    newFeedbackRate := f.feedbackCollector.GetPositiveRate(ctx, newModelID, 24*time.Hour)
    oldFeedbackRate := f.feedbackCollector.GetPositiveRate(ctx, f.currentModelID, 24*time.Hour)
    if newFeedbackRate < oldFeedbackRate - 0.03 {
        f.rollback(ctx, newModelID)  // 自动回滚
        return fmt.Errorf("自动回滚: 用户正面反馈率从 %.2f 降至 %.2f", oldFeedbackRate, newFeedbackRate)
    }

    // Stage 3: 全量上线（100% 流量）
    f.rollout(ctx, newModelID, 1.0)
    return nil
}
```

---

## 六、P1-1 修复：MMR 检索去重与多样性

### 6.1 问题

多源并行检索 + 多子查询分解后，同源重复 chunk 可能挤占 Context Window。当前无 MMR（Maximal Marginal Relevance）去重。

### 6.2 修复方案

```go
// MMR 去重（在 RRF 融合之后、Context Window 填充之前执行）
func (m *MMRSelector) Select(ctx context.Context, candidates []Result, topK int, lambda float64) []Result {
    if len(candidates) == 0 {
        return candidates
    }

    selected := []Result{candidates[0]}  // 选最高分
    remaining := candidates[1:]

    for len(selected) < topK && len(remaining) > 0 {
        bestIdx := -1
        bestScore := -1.0

        for i, cand := range remaining {
            // MMR = λ * relevance - (1-λ) * max_similarity_to_selected
            relevance := cand.Score
            maxSim := 0.0
            for _, sel := range selected {
                sim := m.cosineSimilarity(cand.Embedding, sel.Embedding)
                if sim > maxSim {
                    maxSim = sim
                }
            }
            mmrScore := lambda*relevance - (1-lambda)*maxSim

            if mmrScore > bestScore {
                bestScore = mmrScore
                bestIdx = i
            }
        }

        selected = append(selected, remaining[bestIdx])
        remaining = append(remaining[:bestIdx], remaining[bestIdx+1:]...)
    }

    return selected
}

// λ = 0.5（平衡相关性与多样性）
// 在 Context Window Manager 的贪心填充前执行 MMR
```

### 6.3 集成位置

```
Phase 2c: Cross-Encoder Re-ranker → Top-10
    │
    ▼
【新增】MMR Selector（λ=0.5, 去重阈值 cosine>0.85）
    │
    ▼
Phase 2d: ACL-Aware Reranker
    │
    ▼
Phase 3a: Context Window Manager（贪心填充）
```

---

## 七、P1-2 修复：Planning 事前规划

### 7.1 问题

Agentic Loop 是"事后修正"（生成→验证→重试），缺少"事前规划"（先规划再执行）。

### 7.2 修复方案：Plan→Execute→Verify 三步循环

```go
// 仅在 complex 查询路径启用
func (a *RAGAgent) HandleComplexQuery(ctx context.Context, req QueryRequest) (*QueryResponse, error) {
    // Step 1: Planning — 生成排查计划
    plan := a.planner.GeneratePlan(ctx, req.Query)
    // 输出: ["步骤1: 检查构建日志", "步骤2: 分析资源使用", "步骤3: 确认依赖版本"]

    var allResults []Result
    for _, step := range plan.Steps {
        // Step 2: Execute — 按计划逐步检索（每步使用该步的改写查询）
        results := a.retriever.Search(ctx, step.RewrittenQuery, req.TenantID, 10)
        allResults = append(allResults, results...)

        // Step 3: Verify — 验证该步结果是否足够
        if a.verifier.HasSufficientEvidence(results, step.Goal) {
            continue  // 进入下一步
        } else {
            // 结果不足 → 调整策略重新检索
            results = a.retriever.SearchWithAdjustedStrategy(ctx, step, req.TenantID)
            allResults = append(allResults, results...)
        }
    }

    // 全部步骤完成后，进入正常生成流程
    return a.generateAnswer(ctx, req, allResults)
}
```

### 7.3 Planning Prompt 模板

```
你是一个故障排查规划师。请将以下运维问题分解为独立的排查步骤。

输入: "CI 流水线失败，如何排查？"

输出格式（JSON）:
{
  "steps": [
    { "step": 1, "goal": "确认失败阶段", "keywords": ["构建日志", "失败阶段", "错误码"] },
    { "step": 2, "goal": "分析资源使用", "keywords": ["OOM", "CPU", "内存", "超时"] },
    { "step": 3, "goal": "检查依赖版本", "keywords": ["镜像", "依赖", "版本", "兼容性"] }
  ],
  "estimated_complexity": "moderate",
  "dependencies": []  // 步骤间依赖关系（空=无依赖，可并行）
}
```

---

## 八、P1-3 修复：Prompt 版本管理

### 8.1 问题

所有系统提示模板硬编码在代码中，无法版本化、回滚、灰度对比。

### 8.2 修复方案

```sql
CREATE TABLE rag_prompt_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key    VARCHAR(100) NOT NULL,  -- "system_prompt", "cot_prompt", "decompose_prompt"
    version         VARCHAR(20) NOT NULL,   -- "v1.0", "v1.1", "v2.0"
    template_text   TEXT NOT NULL,
    parameters      JSONB,                  -- 模板变量定义
    status          VARCHAR(20) DEFAULT 'draft',  -- draft / active / deprecated / rolled_back
    active_scope    JSONB DEFAULT '{}',     -- 生效范围（{ "query_type": "complex", "tenant_ids": [] }）
    authored_by     VARCHAR(255),
    changelog       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    activated_at    TIMESTAMPTZ,
    UNIQUE(template_key, version)
);

-- 查询时：获取当前 active 版本
SELECT template_text FROM rag_prompt_templates
WHERE template_key = 'system_prompt' AND status = 'active'
ORDER BY activated_at DESC LIMIT 1;

-- 灰度发布：修改 active_scope 实现百分比流量切换
```

### 8.3 灰度流程

```
1. 创建新版本: template_key='system_prompt', version='v1.2', status='draft'
2. 手动审核通过 → status='active', active_scope={ "weight": 5 }  (5% 流量)
3. 观察 24h → 对比 v1.1 vs v1.2 的用户反馈率
4. 如果 v1.2 反馈率 ≥ v1.1 → 逐步增加 weight (10% → 50% → 100%)
5. 如果 v1.2 反馈率 < v1.1 → 自动回滚到 v1.1
```

---

## 九、P1-4 修复：安全加固

### 9.1 反馈投毒防护

```go
// 对 rag_user_corrections 的纠正内容增加双重校验
func (m *MemoryManager) validateCorrection(correction UserCorrection) error {
    // 校验 1: LLM-as-judge 验证纠正合理性
    prompt := fmt.Sprintf(`判断以下用户纠正是否合理：

原始查询: "%s"
原始答案: "%s"
用户纠正: "%s"

判断标准:
1. 纠正是否与查询相关？
2. 纠正是否与 Orion 平台相关？
3. 纠正是否包含恶意内容（注入、广告、政治敏感）？

输出: {"reasonable": true/false, "reason": "..."}`, correction.Query, correction.OriginalAnswer, correction.CorrectedAnswer)

    result := m.llm.Judge(ctx, prompt)
    if !result.Reasonable {
        return ErrUnreasonableCorrection
    }

    // 校验 2: 阈值触发人工审核
    // 新用户（注册 < 7 天）的前 3 次纠正必须人工审核
    // 单用户纠正被拒绝率 > 50% → 标记为可疑用户
    if m.isNewUser(correction.UserID) && m.userCorrectionCount(correction.UserID) < 3 {
        m.flagForManualReview(correction)
        return ErrPendingManualReview
    }

    return nil
}
```

### 9.2 实时数据源安全过滤

```go
// Live Data 源输出必须经过 Layer 3 安全过滤
func (l *LiveDataManager) Fetch(ctx context.Context, source string) ([]byte, error) {
    data, err := l.fetchFromSource(ctx, source)
    if err != nil {
        return nil, err
    }

    // 与静态索引相同的安全过滤标准
    sanitized := l.safetyPipeline.Sanitize(ctx, data, SafetyLevel{
        KeywordScan:    true,
        PIIDetection:   true,
        SemanticInjection: true,
        LengthLimit:    2000,
    })

    return sanitized, nil
}
```

---

## 十、P1-5 修复：系统韧性增强

### 10.1 索引构建背压机制

```go
type IndexBackpressure struct {
    queue       chan IndexJob
    maxQueue    int
    dropPolicy  DropPolicy  // Block / DropNewest / SwitchToFullSync
    workerCount int
}

func (b *IndexBackpressure) Submit(ctx context.Context, job IndexJob) error {
    select {
    case b.queue <- job:
        return nil
    default:
        // 队列满 → 执行降级策略
        switch b.dropPolicy {
        case DropNewest:
            log.Warn("索引队列已满，丢弃最新事件", "queue_len", len(b.queue))
            return nil
        case SwitchToFullSync:
            log.Warn("索引队列已满，降级为全量对账")
            go b.triggerFullSync(ctx)
            return nil
        default:
            // Block: 等待队列有空位
            select {
            case b.queue <- job:
                return nil
            case <-ctx.Done():
                return ctx.Err()
            }
        }
    }
}
```

### 10.2 配置热更新

```go
// 从 unified_config 表读取策略参数，支持热加载
type DynamicConfig struct {
    RetrievalWeights  map[string]float64  `json:"retrieval_weights"`  // { "vector": 0.5, "bm25": 0.35, "graph": 0.15 }
    CircuitBreakerThresholds map[string]int `json:"cb_thresholds"`     // { "milvus": 3, "embedding": 3, "reranker": 3 }
    CircuitBreakerTimeouts   map[string]int `json:"cb_timeouts"`       // { "milvus": 30, "embedding": 30, "reranker": 30 }
    RateLimit    map[string]int `json:"rate_limit"`     // { "per_user": 30, "per_tenant": 60 }
    LLMRoute     map[string]string `json:"llm_route"`  // { "simple": "local", "moderate": "local", "complex": "local+claude" }
}

// 每 60s 轮询 unified_config 表，检测配置变更
func (c *DynamicConfigManager) Watch(ctx context.Context) {
    ticker := time.NewTicker(60 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            newConfig, err := c.loadFromDB(ctx)
            if err != nil {
                log.Error("配置加载失败", "error", err)
                continue
            }
            if newConfig.Version != c.currentConfig.Version {
                log.Info("配置热更新", "version", newConfig.Version)
                c.currentConfig = newConfig
                c.applyConfig(ctx, newConfig)
            }
        case <-ctx.Done():
            return
        }
    }
}
```

### 10.3 多实例缓存一致性

```go
// 语义缓存迁移到 Redis Cluster（替代 per-instance Milvus 缓存）
type RedisSemanticCache struct {
    redis    *redis.ClusterClient
    ttl      time.Duration
    milvus   *milvus.Client  // 缓存不命中时回退到 Milvus 检索
}

func (c *RedisSemanticCache) Lookup(ctx context.Context, query string, tenantID string) (*CacheHit, error) {
    // 1. 计算 query embedding（bge-base-zh）
    vec := c.embedding.Encode(query)

    // 2. Redis 向量搜索（所有实例共享）
    results, err := c.redis.FTSearch(ctx, &redis.FTSearchOptions{
        Index: "idx:rag:cache",
        Query: vec,
        TopK:  1,
    })
    if err != nil || len(results) == 0 {
        // 3. 缓存未命中 → 回退 Milvus
        return c.milvus.Search(ctx, query)
    }

    // 4. 命中 → 返回缓存
    if results[0].Score > 0.92 {
        return c.hydrate(result[0])
    }
    return nil, ErrCacheMiss
}
```

---

## 十一、P1-6 修复：RAGAS 七维指标 + Ground Truth 扩展

### 11.1 指标扩展

| 指标 | 计算方式 | 目标值 | 说明 |
|------|---------|--------|------|
| **Recall@5** | 正确节点数/应返回节点数 | ≥ 0.85 | 已有 |
| **MRR** | 1/首个正确结果排名 | ≥ 0.70 | 已有 |
| **Context Precision@K** | 检索结果中相关节点比例 | ≥ 0.80 | **新增** |
| **Faithfulness** | 答案可被检索内容支持的比例 | ≥ 0.90 | 已有 |
| **Answer Relevance** | 答案与问题相关性 | ≥ 0.80 | 已有 |
| **Answer Correctness** | 答案与标准答案语义等价 F1 | ≥ 0.75 | **新增** |
| **Citation Accuracy** | 引用真实存在比例 | ≥ 0.95 | 已有 |

### 11.2 Ground Truth 扩展

| 维度 | 当前 | 目标 | 变化 |
|------|------|------|------|
| 总条数 | 100 | **200+** | +100 |
| 每领域 | ~17 | **≥ 30** | 均匀分布 |
| hard 案例 | 未明确 | **≥ 20%** | 40+ 条 hard |
| 查询类型 | 未分类 | 事实型/流程型/排障型/比较型/最佳实践型 | 5 分法 |
| adversarial 案例 | 0 | **≥ 10** | 歧义查询、边界情况 |
| 版本管理 | 无 | v1.0 / v1.1 / v2.0 | 可回溯 |

---

## 十二、修复后 V2.12 缺陷状态

| # | 缺口 | 修复前 | 修复后 |
|---|------|--------|--------|
| P0-1 | CoT 推理 | 直接猜答案 | Plan→Execute→Verify 三步 + CoT 模板 |
| P0-2 | SSE 流式 | 5s 空白 Loading | 3 阶段 SSE 协议（检索进度+生成流+完成） |
| P0-3 | 评估基础设施 | 7 项缺失 | 4 层评估架构 + 指标扩展 + 退化检测 |
| P0-4 | 微调自动回滚 | 手动灰度 | 3 门控自动回滚（Recall@5/统计显著性/反馈率） |
| P1-1 | MMR 去重 | 无多样性 | λ=0.5 MMR 在 Re-rank 后执行 |
| P1-2 | Planning | 事后修正 | complex 路径 Plan→Execute→Verify |
| P1-3 | Prompt 版本管理 | 硬编码 | rag_prompt_templates 表 + 灰度流程 |
| P1-4 | 安全加固 | 无防护 | 反馈投毒防护 + 实时数据安全过滤 |
| P1-5 | 系统韧性 | 背压/热更新/缓存缺失 | 背压队列 + 配置热更新 + Redis 缓存一致性 |
| P1-6 | 指标+GT 扩展 | 5 维 + 100 条 | 7 维 + 200+ 条 + 5 类型 + 版本管理 |

---

## 十三、与主设计文档的关系

| 版本 | 核心能力 | 关系 |
|------|---------|------|
| V2.2-V2.10 | 基础 RAG + 安全 + 评估 + 可扩展 | 基础 |
| V2.11 | AI 前沿能力补充（Agentic/Structured/Adaptive） | 前沿 |
| V2.12 | **五专家评审修复** — 评估基础设施 + 系统韧性 | 补齐评审发现的 P0 + 高价值 P1 |

### 主文档对应章节更新标记

| 主文档位置 | 更新内容 | V2.12 引用 |
|-----------|---------|-----------|
| §3.1 Phase 1 | 复杂度评估增加 CoT 路由标记 | §二 |
| §3.1 Phase 4 | 增加 Planning 阶段标记 | §七 |
| §3.3 回答格式 | 增加 SSE 流式响应说明 | §三 |
| §8.4 Verifier | 增加 Planning 前置规划 | §七 |
| §13.1 Query Understanding | 增加 Planning 步骤分解 | §七 |
| §14.1 评估指标 | 7 维指标扩展 | §十一 |
| §14.2 评估流程 | 4 层评估架构 + 退化检测 | §四 |
| §14.3 LLM-as-Judge | 增加偏差校准 + 人工抽检 | §四 |
| §15.3 反馈闭环 | 增加反馈投毒防护 | §九 |
| §16.1 性能预算 | 增加 CoT 推理额外预算 | §二 |
| §16.2b 语义缓存 | 多实例一致性迁移 Redis | §十 |
| §16.3 可观测性 | 增加 SSE 指标 | §三 |
| §16.4 降级策略 | 增加索引背压降级 | §十 |
| §17 前端交互 | 增加 CoT 折叠面板 + SSE 流式展示 | §二/§三 |