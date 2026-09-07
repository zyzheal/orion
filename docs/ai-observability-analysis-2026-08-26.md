# AI 系统可观测性建设缺口分析

> 日期：2026-08-26
> 作者：领域专家评审
> 状态：Analysis / 待实施

## 引言

AI 系统的调试难点不只来自代码复杂度，更来自结果不稳定和难以可靠复现。要解决这个问题，系统需要在请求发生时捕获必要的诊断现场，而不是等到用户反馈以后再尝试重现同一个回答。

Logs、Metrics 和 Traces 是可观测性的基础信号：
- **Logs** 负责补充离散事件
- **Metrics** 用来观察系统整体状态
- **Trace** 保存单次请求的调用关系、耗时和诊断属性

Trace 能帮助我们检查当时发生了什么，但**不是能够确定性重放模型输出的执行录像**。除了 OpenTelemetry 标准的 Span 状态，还需要通过 `app.ai.outcome=degraded` 等业务属性记录降级。系统即使没有报错，也可能因为持续进入降级路径而让回复质量逐渐下降。把降级比例、原因和节点纳入监控，才能更早发现这种不易察觉的体验变化。

---

## 一、调查范围

在 `orion-frontend/src` 下全仓 grep 完成。

### 1.1 AI 相关页面清单（约 20 个）

| 页面 | 文件数 | 最大文件行数 | 定位 |
|---|---|---|---|
| LLMTraceDashboard | 5 | 291 (TraceList) | AI Trace 主看板 |
| AICostDashboard | 1 | - | 成本/token 指标 |
| AISecurity | 1 | - | 幻觉率/安全指标 |
| AIAgents | 1 | - | Agent 管理 |
| AgentDashboard | 1 | - | Agent 指标 |
| AgentRunDetail | 1 | - | 单次运行详情 |
| PromptCanary | 1 | - | Prompt 金丝雀 |
| AIGateway | 1 | 302 | 网关管控 |
| AIDashboard | 1 | 279 | AI 综合看板 |
| ai-decision-explanation | 1 | - | 决策解释 |
| ai-decision | 1 | - | 决策管理 |
| AIDocManagement | 1 | - | AI 文档 |
| AICMDBRecommendation | 2 | - | CMDB AI 推荐 |

### 1.2 API 层分布

- `src/api/trace.ts` — 分布式 Trace 查询（**mock 状态**）
- `src/api/llm-trace.ts` — LLM 调用日志（**mock 状态**）
- `src/api/ai.ts`、`src/api/aiCost.ts` — AI 相关聚合数据

---

## 二、调查结果（按缺口严重度排序）

### 2.1 【P0】OpenTelemetry 埋点：几乎为零

- `grep -rE "opentelemetry|OpenTelemetry|otel\." orion-frontend/src` → **仅 1 处命中**
- 命中位置：`src/api/trace.ts:2` 文件头注释 `Trace API - Distributed tracing / OpenTelemetry trace queries`
- **无 `@opentelemetry/*` 导入**
- **无 `apiClient.get('/trace/search')` 的实际调用**

### 2.2 【P0】`src/api/trace.ts` 是空壳

- 定义了 Span / SpanEvent / SpanAttribute 三个 TS 类型
- 第 101 行关键代码被注释：
  ```typescript
  // const response = await apiClient.get('/trace/search', { params });
  ```
- 全部由 mock 数据返回 → **前端 UI 展示的都是假数据**

### 2.3 【P0】`app.ai.outcome=degraded` 业务属性：完全不存在

- `grep -rE "app\.ai\.outcome"` → **0 命中**
- `grep -rE "degraded|outcome"` → 约 20 个文件，但**全部是通用 UI 文案**（pending/completed/failed/timeout），**没有任何一处作为 span 属性键使用**

### 2.4 【P0】LLMTrace schema 缺失关键字段

当前 `src/api/llm-trace.ts` 的 LLMTrace 类型字段：
```
traceId, scenarioId, modelId, providerId,
inputTokens, outputTokens, estimatedCost,
responseLatencyMs, status, requestStartedAt
```

`status` 枚举：`pending | completed | failed | timeout` — **无 degraded 状态**

**缺失字段（共 15 项）**：
| 缺失字段 | 用途 |
|---|---|
| `parentSpanId` / `spanId` | span 层级关系 |
| W3C `traceparent` (32-hex traceId) | 跨服务传播 |
| `seed` | 确定性重放 |
| `temperature` / `topP` / `topK` | 采样参数复现 |
| `systemPromptHash` | 提示词版本追踪 |
| `promptVersion` / `modelVersion` | 版本回溯 |
| `toolCallIds[]` | 工具调用链路 |
| `retrievalIds[]` | RAG 检索链路 |
| `evaluatorScore` | 质量评估 |
| `errorCode` | 错误分类 |
| `userId` / `sessionId` | 用户/会话关联 |
| `embeddingModelId` | 嵌入模型追踪 |
| `outcome: 'success'\|'degraded'\|'failed'\|'timeout'\|'policy_blocked'` | **降级状态枚举** |
| `degradeReason` / `degradeNode` | 降级原因/节点 |

### 2.5 【P0】Trace 模型扁平、无父子层级

- 每次调用只有一条平铺记录，无 parent-child 关系
- **本质不是分布式 Trace，是一条调用日志**

### 2.6 【P1】Metrics 只是聚合、非流式打点

AICostDashboard / AISecurity / AIDashboard 作为看板存在，但都是**调用记录的后置聚合**，而非在请求时刻实时打点的计数器。

**缺失维度**：
- 错误率
- p50 / p95 / p99 延迟分位
- 超时率
- 重试率
- 降级/回退比例
- 各 model/provider 的独立错误率

### 2.7 【P1】Logs 层缺失

无专门的 AI 事件日志页面。**以下离散事件在当前 UI 中完全无处可见**：
- `prompt_rejected`
- `tool_call_failed`
- `context_overflow`
- `safety_block`
- `cache_miss`
- `fallback_triggered`
- `policy_violation`

### 2.8 【P1】确定性重放：不支持

- 无 `seed` / `temperature` / `top_p` / `top_k` / `system_prompt_version` / `prompt_hash` 存储
- **同一用户 + 同一 query 不会得到同一回答**
- 前端 schema 未暴露采样参数 → **工程师无法在 UI 上触发"以相同输入重放此 trace"的操作**

### 2.9 【P0】静默降级：无人监管

- 前端 trace schema 里**没有 degraded 结果分支**
- 命中回退模型、命中陈旧缓存、上下文被截断的请求 → **静默地显示为 `completed`**
- 回复质量的持续劣化在调用日志和指标看板里**都无可见信号**

### 2.10 【P1】安全指标与 Trace 不打通

AISecurity 页有幻觉率看板数字，但**和单条 trace 不打通**：
- 无法定位"今天幻觉率飙升到底是哪几条调用造成的"
- 无法反查触发高幻觉率的 prompt 版本 / model 版本 / 提示词 hash

---

## 三、缺口对照矩阵

| 简报中的要求 | 当前状态 | 严重度 |
|---|---|---|
| 请求发生时捕获诊断现场 | 部分（token/延迟/成本），缺 prompt/seed/tool-call | P0 |
| OpenTelemetry 标准 Span 状态 | 缺失 | P0 |
| `app.ai.outcome=degraded` 业务属性 | 缺失 | P0 |
| Trace 记录调用关系（父子层级） | 缺失，仅平铺记录 | P0 |
| 模型输出的确定性重放 | 无法实现，seed/params 未存储 | P1 |
| 降级比例 / 原因 / 节点进入指标 | 缺失 | P0 |
| 离散事件的 Logs | 缺失 | P1 |
| 系统整体状态的 Metrics | 有，但只是静态聚合 | P1 |
| 安全指标与 Trace 关联 | 缺失 | P1 |

**结论：9 项要求中 4 项 P0 完全缺失，5 项 P1 部分缺失。**

---

## 四、优先级修复建议

### 建议 1（P0）：扩展 `LLMTrace` schema

在 `src/api/llm-trace.ts` 中新增字段：

```typescript
export interface LLMTrace {
  // 既有字段保留
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  scenarioId: string;
  modelId: string;
  modelVersion?: string;
  providerId: string;

  // 采样参数（用于确定性重放）
  seed?: number;
  temperature?: number;
  topP?: number;
  topK?: number;

  // Prompt 版本追踪
  systemPromptHash?: string;
  promptVersion?: string;

  // Token / 成本 / 延迟（既有）
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  responseLatencyMs: number;
  requestStartedAt: string;

  // 状态与降级（新增 outcome 枚举）
  status: 'pending' | 'completed' | 'failed' | 'timeout';
  outcome: 'success' | 'degraded' | 'failed' | 'timeout' | 'policy_blocked';
  degradeReason?: 'fallback_model' | 'stale_cache' | 'context_overflow' | 'safety_block' | 'tool_failed';
  degradeNode?: string;

  // 工具 / RAG 链路
  toolCallIds?: string[];
  retrievalIds?: string[];

  // 质量与错误
  evaluatorScore?: number;
  errorCode?: string;

  // 关联
  userId?: string;
  sessionId?: string;
  embeddingModelId?: string;
}
```

### 建议 2（P0）：真实化 `src/api/trace.ts`

- 用真实后端接入替换第 101 行的注释调用
- 引入镜像 OTel 语义约定的 `app.ai.*` 属性映射
- 与后端并行提案：新增 `/v1/traces/search`、`/v1/traces/:id`、`/v1/traces/:id/spans`

### 建议 3（P0）：Degrade Monitoring 标签页

在 `LLMTraceDashboard` 增加**降级监控**标签页：
- 降级比例时间序列（按 5 分钟粒度）
- Top 降级原因（`degradeReason` 分布饼图）
- Top 降级节点（`degradeNode` 排行榜）
- 告警规则：比例超阈值持续 N 分钟时告警

### 建议 4（P1）：Trace 详情抽屉

在 TraceList 增加详情抽屉：
- span 树（parent-child 可视化）
- prompt / response 片段
- 工具调用列表
- 评估分数
- 逐 span 延迟分解

### 建议 5（P1）：Replay 按钮

- 在每条 trace 行加 **Replay** 按钮
- 打开弹窗用相同 seed/params 重新发起
- 依赖后端 `/v1/llm-trace/:id/replay`

### 建议 6（P1）：AI Log Viewer 页面

新增 `AIEventLogViewer` 页面，展示离散事件：
- `prompt_rejected`
- `tool_call_failed`
- `context_overflow`
- `safety_block`
- `cache_miss`
- `fallback_triggered`
- `policy_violation`

---

## 五、工作量估算

| 建议 | 前端工作 | 后端契约 | 依赖 |
|---|---|---|---|
| 1. Schema 扩展 | 2 人日 | 2 人日 | 无 |
| 2. trace.ts 真实化 | 3 人日 | 4 人日 | 建议 1 |
| 3. Degrade Monitoring | 4 人日 | 2 人日 | 建议 1、2 |
| 4. Trace 详情抽屉 | 3 人日 | 1 人日 | 建议 1、2 |
| 5. Replay 按钮 | 2 人日 | 3 人日 | 建议 1、2 |
| 6. AI Log Viewer | 3 人日 | 2 人日 | 无 |
| **合计** | **17 人日** | **14 人日** | - |

**建议作为新 P2 工作流（P2-13：AI Observability）排到 Phase 146+ 重构全部完成之后**，因为超出了 P2-9 组件抽离的范畴。

---

## 六、结论

当前 AI 可观测性建设处于**"看板有、数据无、埋点零、重放不可"**的状态：

- ✅ UI 层面的看板（AICost / AISecurity / AIDashboard / LLMTraceDashboard）已建立
- ❌ 底层 API 全部 mock，无真实数据
- ❌ OpenTelemetry 语义约定 0 覆盖
- ❌ `app.ai.outcome=degraded` 等关键业务属性 0 覆盖
- ❌ 静默降级、幻觉率飙升、上下文截断等体验劣化**在监控里完全无信号**
- ❌ 采样参数缺失，无法确定性重放

**优先修复路径**：Schema 扩展 → API 真实化 → Degrade Monitoring → Trace 详情 → Replay → AI Log Viewer。

---

## 附录：调查命令

```bash
# OpenTelemetry 埋点覆盖
grep -rE "opentelemetry|OpenTelemetry|otel\." orion-frontend/src

# 业务属性
grep -rE "app\.ai\.outcome" orion-frontend/src
grep -rE "degraded|outcome" orion-frontend/src

# AI 相关页面
find orion-frontend/src/pages -type d | grep -iE "ai|llm|agent|prompt"

# Trace API mock 状态
grep -n "apiClient.get" orion-frontend/src/api/trace.ts
```
