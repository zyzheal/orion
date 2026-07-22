/**
 * Approval Agent Plugin - AI 自动审批插件接口
 *
 * 提供 Agent 自动分析审批能力：
 * 1. 风险分析 (analyzeRisk)
 * 2. 审批人建议 (suggestApprover)
 * 3. 自动审批决策 (evaluate)
 *
 * 设计原则：
 * - 不做强依赖，LLM 不可用时自动降级到规则模式
 * - 置信度阈值：confidence >= 0.8 → 自动通过
 * - AI 失败时切换到规则模式
 */

/**
 * Agent 审批决策
 */
export interface ApprovalDecision {
  /** 决策动作 */
  action: 'approve' | 'reject' | 'escalate' | 'delegate';
  /** 置信度 0-1 */
  confidence: number;
  /** 决策理由 */
  reason: string;
  /** 风险评分 0-100 */
  riskScore?: number;
  /** 风险因素列表 */
  riskFactors?: string[];
  /** 建议转交的审批人 */
  suggestedApprover?: string;
}

/**
 * Agent 审批上下文
 */
export interface ApprovalContext {
  /** 操作类型（如 "deploy", "delete", "create"） */
  operation: string;
  /** 操作资源（如 "prod/api-gateway"） */
  resource: string;
  /** 申请人 ID */
  requester: string;
  /** 申请人历史记录 */
  requesterHistory: {
    totalOperations: number;
    rejectionRate: number;
    recentIncidents: number;
  };
  /** 环境（dev/staging/prod） */
  environment: 'dev' | 'staging' | 'prod';
  /** 预定义风险等级 1-4 */
  riskLevel: number;
  /** 操作元数据 */
  metadata?: Record<string, any>;
}

/**
 * Agent 插件配置
 */
export interface ApprovalAgentConfig {
  /** 置信度阈值配置 */
  threshold?: {
    /** >= 此值自动批准 */
    autoApproveConfidence: number;
    /** >= 此值且风险分高时自动拒绝 */
    autoRejectConfidence: number;
    /** 风险分阈值，超过此值且高置信度时自动拒绝 */
    autoRejectRiskScore: number;
  };
  /** 低置信度时的处理方式 */
  onLowConfidence?: 'escalate-to-next' | 'reject' | 'approve';
  /** Agent 失败时的处理方式 */
  onAgentFailure?: 'fallback-to-rules' | 'escalate-to-next' | 'reject';
  /** Agent 调用超时（秒） */
  timeoutSeconds?: number;
  /** AI 服务 URL */
  aiServiceUrl?: string;
}

/**
 * Agent 风险分析请求
 */
export interface RiskAnalysisRequest {
  context: ApprovalContext;
  /** 额外分析维度 */
  analysisDimensions?: string[];
}

/**
 * Agent 风险分析结果
 */
export interface RiskAnalysisResult {
  /** 总体风险评分 0-100 */
  riskScore: number;
  /** 风险等级 1-4 */
  riskLevel: number;
  /** 风险因素列表 */
  riskFactors: string[];
  /** 详细分析 */
  analysis: string;
  /** 置信度 */
  confidence: number;
  /** 建议动作 */
  recommendedAction: 'approve' | 'reject' | 'escalate';
}

/**
 * 审批人建议请求
 */
export interface ApproverSuggestionRequest {
  context: ApprovalContext;
  /** 当前审批人列表 */
  currentApprovers?: string[];
  /** 偏好审批人类型 */
  preferApproverType?: 'role' | 'user' | 'manager' | 'department-head';
}

/**
 * 审批人建议结果
 */
export interface ApproverSuggestionResult {
  /** 建议的审批人列表 */
  suggestedApprovers: string[];
  /** 建议理由 */
  reason: string;
  /** 置信度 */
  confidence: number;
  /** 是否需要专家审批 */
  requiresExpertReview: boolean;
}

/**
 * 自动审批请求
 */
export interface AutoApproveRequest {
  context: ApprovalContext;
  /** 风险分析结果（可选） */
  riskAnalysis?: RiskAnalysisResult;
}

/**
 * 自动审批结果
 */
export interface AutoApproveResult {
  /** 是否自动批准 */
  approved: boolean;
  /** 决策动作 */
  action: 'approve' | 'reject' | 'escalate' | 'delegate';
  /** 置信度 */
  confidence: number;
  /** 决策理由 */
  reason: string;
  /** 风险评分 */
  riskScore?: number;
}

/**
 * Agent 插件接口
 *
 * 用于扩展审批系统的 AI 分析能力
 */
export interface ApprovalAgentPlugin {
  /** 插件名称 */
  name: string;

  /**
   * 评估审批决策
   * @param context 审批上下文
   * @returns 审批决策结果
   */
  evaluate(context: ApprovalContext): Promise<ApprovalDecision>;

  /**
   * 健康检查 — 用于熔断判断
   * @returns 是否健康
   */
  isHealthy?(): Promise<boolean>;

  /**
   * 风险分析（可选实现）
   * @param request 风险分析请求
   * @returns 风险分析结果
   */
  analyzeRisk?(request: RiskAnalysisRequest): Promise<RiskAnalysisResult>;

  /**
   * 审批人建议（可选实现）
   * @param request 审批人建议请求
   * @returns 审批人建议结果
   */
  suggestApprover?(request: ApproverSuggestionRequest): Promise<ApproverSuggestionResult>;

  /**
   * 自动审批（可选实现）
   * @param request 自动审批请求
   * @returns 自动审批结果
   */
  autoApprove?(request: AutoApproveRequest): Promise<AutoApproveResult>;

  /**
   * 获取插件配置（可选实现）
   * @returns 插件配置
   */
  getConfig?(): ApprovalAgentConfig;
}

/**
 * 创建默认 Agent 配置
 */
export function createDefaultAgentConfig(): ApprovalAgentConfig {
  return {
    threshold: {
      autoApproveConfidence: 0.8,      // >= 0.8 自动批准
      autoRejectConfidence: 0.95,      // >= 0.95 且风险分高时自动拒绝
      autoRejectRiskScore: 90,         // 风险分 >= 90
    },
    onLowConfidence: 'escalate-to-next',
    onAgentFailure: 'fallback-to-rules',
    timeoutSeconds: 10,
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:5000',
  };
}

/**
 * 验证审批决策是否有效
 */
export function isValidApprovalDecision(decision: ApprovalDecision): boolean {
  const validActions = ['approve', 'reject', 'escalate', 'delegate'];
  return (
    validActions.includes(decision.action) &&
    typeof decision.confidence === 'number' &&
    decision.confidence >= 0 &&
    decision.confidence <= 1 &&
    typeof decision.reason === 'string'
  );
}

/**
 * 根据置信度和风险分判断自动动作
 */
export function determineAutoAction(
  decision: ApprovalDecision,
  config: ApprovalAgentConfig
): 'approve' | 'reject' | 'escalate' | 'delegate' {
  const threshold = config.threshold || createDefaultAgentConfig().threshold!;

  // 高置信度 + 低风险 → 自动批准
  if (decision.confidence >= threshold.autoApproveConfidence) {
    const riskScore = decision.riskScore || 0;
    if (riskScore < threshold.autoRejectRiskScore) {
      return 'approve';
    }
  }

  // 高置信度 + 高风险 → 自动拒绝
  if (
    decision.confidence >= threshold.autoRejectConfidence &&
    (decision.riskScore || 0) >= threshold.autoRejectRiskScore
  ) {
    return 'reject';
  }

  // 中等置信度 → 转人工
  if (decision.confidence < threshold.autoApproveConfidence) {
    return 'escalate';
  }

  // 默认返回原始决策
  return decision.action;
}