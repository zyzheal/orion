/**
 * LLM Trace Service Module - LLM调用链追踪模块
 *
 * 功能：
 * 1. Prompt记录和追踪
 * 2. Token消耗追踪
 * 3. 成本计算（多模型定价）
 * 4. Trace ID关联（父子追踪）
 * 5. 日聚合统计
 */

export { LLMTraceService, MODEL_PRICING } from './LLMTraceService';
export { TokenCounter } from './TokenCounter';
export { CostCalculator } from './CostCalculator';

export type {
  LLMTrace,
  TraceStartParams,
  TraceCompleteParams,
  DailyStats,
} from './LLMTraceService';

export type { TokenUsage, APIResponse } from './TokenCounter';
export type { CostBreakdown, TraceCostInput } from './CostCalculator';