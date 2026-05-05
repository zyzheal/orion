/**
 * AI 服务类型定义
 */

// ==================== AI Gateway 类型 ====================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface AIGatewayConfig {
  // 超时阈值（毫秒）
  timeoutThresholds: {
    [scenario: string]: number; // 场景 -> 超时阈值
    default: number;
  };
  // 错误率阈值
  errorRateThreshold: number; // 默认 0.15 (15%)
  // 置信度阈值
  confidenceThreshold: number; // 默认 0.5
  // 熔断器配置
  circuitBreaker: {
    failureThreshold: number; // 触发熔断的失败次数
    recoveryTimeout: number; // 熔断恢复超时（毫秒）
    halfOpenMaxCalls: number; // 半开状态最大尝试次数
  };
  // 滑动窗口大小
  windowSize: number; // 统计窗口大小（请求数）
}

export interface AIMetrics {
  scenario: string;
  totalRequests: number;
  failedRequests: number;
  totalLatency: number;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface AIGatewayHealth {
  scenario: string;
  circuitState: CircuitState;
  isHealthy: boolean;
  metrics: AIMetrics;
  lastCheckTime: Date;
  degradationActive: boolean;
}

// ==================== AI 请求/响应类型 ====================

export interface AIRequest {
  scenario: AIScenario;
  input: Record<string, unknown>;
  options?: {
    timeout?: number;
    priority?: 'high' | 'medium' | 'low';
    requireConfidence?: number;
    fallbackEnabled?: boolean;
    preferredProvider?: string;
  };
  context?: {
    userId?: string;
    tenantId?: string;
    traceId?: string;
  };
}

export interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  confidence?: number;
  source: 'llm' | 'degraded' | 'cache' | 'fallback';
  degradationReason?: string;
  latency: number;
  error?: string;
}

// ==================== AI 场景定义 ====================

// P0 场景（核心业务，必须降级）
export type AIScenarioP0 =
  | 'aegis-risk-assessment' // Aegis 风险评估
  | 'auto-scheduling' // AI 自动排单
  | 'root-cause-diagnosis'; // 根因诊断

// P1 场景（重要功能）
export type AIScenarioP1 =
  | 'code-review' // AI Code Review
  | 'test-selection' // 智能测试选择
  | 'changelog-generation' // 变更日志生成
  | 'incident-summary' // 事件摘要
  | 'runbook-suggestion' // Runbook 建议
  | 'metric-anomaly-detection' // 指标异常检测
  | 'log-pattern-analysis' // 日志模式分析
  | 'dependency-analysis' // 依赖分析
  | 'capacity-forecast' // 容量预测
  | 'sla-prediction' // SLA 预测
  | 'knowledge-extraction' // 知识提取
  | 'alert-correlation' // 告警关联
  | 'automation-suggestion'; // 自动化建议

export type AIScenario = AIScenarioP0 | AIScenarioP1;

export const AI_SCENARIO_PRIORITY: Record<AIScenario, 'P0' | 'P1'> = {
  // P0 场景
  'aegis-risk-assessment': 'P0',
  'auto-scheduling': 'P0',
  'root-cause-diagnosis': 'P0',
  // P1 场景
  'code-review': 'P1',
  'test-selection': 'P1',
  'changelog-generation': 'P1',
  'incident-summary': 'P1',
  'runbook-suggestion': 'P1',
  'metric-anomaly-detection': 'P1',
  'log-pattern-analysis': 'P1',
  'dependency-analysis': 'P1',
  'capacity-forecast': 'P1',
  'sla-prediction': 'P1',
  'knowledge-extraction': 'P1',
  'alert-correlation': 'P1',
  'automation-suggestion': 'P1',
};

// ==================== 降级策略类型 ====================

export type DegradationStrategy =
  | 'rule-engine' // 规则引擎
  | 'template' // 模板生成
  | 'cache' // 缓存结果
  | 'manual' // 人工确认
  | 'default' // 默认值
  | 'passthrough'; // 直接透传（无降级）

export interface DegradationConfig {
  strategy: DegradationStrategy;
  fallbackStrategies?: DegradationStrategy[]; // 备选策略
  cacheTTL?: number; // 缓存过期时间
  templateName?: string; // 模板名称
  ruleSet?: string; // 规则集名称
  defaultResponse?: unknown; // 默认响应
  notifyOnDegradation?: boolean; // 是否发送降级通知
}

export interface DegradationResult<T = unknown> {
  success: boolean;
  data?: T;
  source: DegradationStrategy;
  reason: string;
  confidence: number;
  appliedRule?: string;
  cachedAt?: Date;
  requiresManualAction?: boolean;
}

// ==================== 规则引擎类型 ====================

export interface Rule {
  id: string;
  name: string;
  scenario: AIScenario;
  description: string;
  priority: number; // 优先级，数字越小优先级越高
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    author?: string;
    tags?: string[];
  };
}

export interface RuleCondition {
  field: string;
  operator:
    | 'eq' // 等于
    | 'neq' // 不等于
    | 'gt' // 大于
    | 'gte' // 大于等于
    | 'lt' // 小于
    | 'lte' // 小于等于
    | 'in' // 包含在列表中
    | 'nin' // 不包含在列表中
    | 'contains' // 字符串包含
    | 'regex' // 正则匹配
    | 'exists' // 字段存在
    | 'nexists'; // 字段不存在
  value: unknown;
}

export interface RuleAction {
  type: 'set' | 'template' | 'function' | 'return';
  field?: string;
  value?: unknown;
  templateName?: string;
  functionName?: string;
}

export interface RuleSet {
  id: string;
  name: string;
  scenario: AIScenario;
  description: string;
  rules: Rule[];
  defaultAction?: RuleAction;
  enabled: boolean;
}

export interface RuleEngineConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  maxRulesPerScenario: number;
  enableAudit: boolean;
}

// ==================== 熔断器类型 ====================

export interface CircuitBreakerState {
  scenario: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastStateChangeTime: Date;
  halfOpenAttempts: number;
}

// ==================== 事件类型 ====================

export interface AIGatewayEvent {
  type: 'request' | 'response' | 'degradation' | 'circuit_open' | 'circuit_close' | 'circuit_half_open';
  scenario: AIScenario;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type AIGatewayEventHandler = (event: AIGatewayEvent) => void;

// ==================== VectorStore 类型 ====================

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding: number[];
}

export interface SearchQuery {
  query: string;
  topK?: number;
  filter?: Record<string, any>;
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
}

export interface VectorStoreConfig {
  host: string;
  port: number;
  collectionName: string;
  dimension: number;
  apiKey?: string;
  embeddingProvider?: 'hash' | 'openai' | 'custom';
  embeddingModel?: string;
  embeddingFn?: (text: string) => Promise<number[]>;
}