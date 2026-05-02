# Phase 2 设计：真实外部服务集成 (AI LLM + Prometheus)

> 日期：2026-04-30
> 状态：用户已批准

## 目标

将 AI Review 和 Canary Analysis 从纯 mock 升级为真实外部服务调用，同时保持无外部依赖时的可用降级。

## 子项目 A：AI Review LLM 集成

### 架构

```
AIReviewService.reviewPR()
  ├── DiffAnalyzer.parseDiff()      [现有，不变]
  ├── ReviewRuleEngine.runReview()  [现有，不变]
  ├── callAIReview()                [新增：调用 LLM API]
  │   ├── OpenAIClient.chat()       [新增：fetch → OpenAI API]
  │   └── AnthropicClient.message() [新增：fetch → Anthropic API]
  └── ReviewAggregator.generateResult() [现有，合并 rule + AI comments]
```

### 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/services/ai-review/LLMClient.ts` | LLM 客户端抽象 + OpenAI/Anthropic 实现 |
| 修改 | `src/services/ai-review/AIReviewService.ts` | 启用 `callAIReview()`，注入 LLMClient |
| 修改 | `src/services/ai-review/types.ts` | 新增 LLM 配置字段 |
| 新增 | `src/services/ai-review/__tests__/LLMClient.test.ts` | LLM 客户端测试 |
| 修改 | `src/services/ai-review/__tests__/AIReviewService.test.ts` | mock fetch 测试 AI 集成 |

### LLM 配置

```typescript
// 环境变量
LLM_PROVIDER=openai|anthropic|mock   // 默认 mock
LLM_API_KEY=sk-xxx                    // API Key
LLM_MODEL=gpt-4o|claude-sonnet-4-6   // 模型
LLM_TEMPERATURE=0.3                   // 温度 (0-1)
```

### callAIReview 实现

- Prompt: 将 diff 文本 + 审查规则作为 system prompt
- 要求 LLM 返回 JSON 格式的 `ReviewComment[]`
- 超时 30s，失败时返回空数组（降级为纯规则审查）
- 结果通过 `source: 'ai'` 标记

## 子项目 B：Canary Prometheus 指标集成

### 架构

```
CanaryAnalysisService.runAnalysis()
  ├── PrometheusClient.queryRange()  [新增：获取真实指标]
  │   └── fetch(PROMETHEUS_URL/api/v1/query_range)
  ├── StatisticalTestEngine          [现有：Mann-Whitney, KS, Cliff Delta]
  └── MLResultGenerator              [现有：XGBoost mock，保留]
```

### 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/services/canary-analysis/PrometheusClient.ts` | Prometheus HTTP API 客户端 |
| 新增 | `src/services/canary-analysis/__tests__/PrometheusClient.test.ts` | Prometheus 客户端测试 |
| 修改 | `src/services/canary-analysis/CanaryAnalysisService.ts` | 注入 PrometheusClient，实现真实指标采集 |
| 修改 | `src/services/canary-analysis/__tests__/CanaryAnalysisService.test.ts` | mock fetch 测试 |

### Prometheus 配置

```typescript
// 环境变量
PROMETHEUS_URL=http://prometheus:9090  // Prometheus 地址
PROMETHEUS_TIMEOUT=10000               // 请求超时 ms
```

### 指标查询

| 指标 | PromQL 示例 |
|------|------------|
| 延迟 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| 错误率 | `rate(http_requests_errors_total[5m]) / rate(http_requests_total[5m])` |
| 吞吐量 | `rate(http_requests_total[5m])` |
| CPU | `rate(process_cpu_seconds_total[5m])` |

### 降级策略

- `PROMETHEUS_URL` 未设置 → 使用 mock 数据（当前行为）
- Prometheus 不可达 → 使用 mock 数据，日志 warn
- 查询返回空 → 使用 mock 数据

## 测试策略

1. 两个子项目都使用 `global.fetch` mock 模拟外部 API 响应
2. 分别测试成功、超时、HTTP 错误、空响应场景
3. 确保降级逻辑正确（无外部服务时功能不变）
4. 所有测试在 CI 中无需外部依赖即可通过
