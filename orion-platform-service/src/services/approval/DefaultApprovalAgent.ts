/**
 * Default Approval Agent - 默认 AI 审批代理实现
 *
 * 实现 ApprovalAgentPlugin 接口，提供：
 * 1. 风险分析 (analyzeRisk)
 * 2. 审批人建议 (suggestApprover)
 * 3. 自动审批 (autoApprove)
 *
 * 设计原则：
 * - 规则优先：高风险操作直接拒绝，低风险操作自动批准
 * - LLM 降级：AI 服务不可用时切换到规则模式
 * - 安全约束：生产环境永不自动批准高风险操作
 */

import { createLogger } from '../../utils/logger';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { OrionError } from '../../errors';
import {
  ApprovalAgentPlugin,
  ApprovalContext,
  ApprovalDecision,
  ApprovalAgentConfig,
  createDefaultAgentConfig,
  RiskAnalysisRequest,
  RiskAnalysisResult,
  ApproverSuggestionRequest,
  ApproverSuggestionResult,
  AutoApproveRequest,
  AutoApproveResult,
} from './ApprovalAgentPlugin';

const logger = createLogger('DefaultApprovalAgent');

/** 最小数据库查询接口，避免强依赖 DatabasePool */
interface DbQuery {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

/**
 * 风险因素定义
 */
const RISK_FACTORS = {
  production: '生产环境操作',
  delete: '删除操作',
  high_risk_operation: '高风险操作',
  privileged_access: '特权访问',
  data_modification: '数据修改',
  config_change: '配置变更',
  external_access: '外部访问',
  sensitive_data: '敏感数据访问',
  bulk_operation: '批量操作',
  schedule_change: '变更计划外',
};

/**
 * 高风险操作列表
 */
const HIGH_RISK_OPERATIONS = [
  'delete',
  'drop',
  'truncate',
  'terminate',
  'kill',
  'revoke',
  'shutdown',
  'restart',
  'disable',
];

/**
 * 中等风险操作列表
 */
const MEDIUM_RISK_OPERATIONS = [
  'update',
  'modify',
  'deploy',
  'scale',
  'config',
  'set',
];

/**
 * 默认审批代理实现
 */
export class DefaultApprovalAgent implements ApprovalAgentPlugin {
  name = 'default-approval-agent';

  private config: ApprovalAgentConfig;
  private aiServiceUrl: string;
  private db?: DbQuery;

  constructor(config: Partial<ApprovalAgentConfig> = {}, db?: DbQuery) {
    this.config = { ...createDefaultAgentConfig(), ...config };
    this.aiServiceUrl = this.config.aiServiceUrl || 'http://localhost:5000';
    this.db = db;
  }

  /**
   * 评估审批决策
   * 核心方法：整合规则引擎和 LLM 分析
   */
  async evaluate(context: ApprovalContext): Promise<ApprovalDecision> {
    logger.debug({ context }, 'Evaluating approval decision');

    // Step 1: 检查 AI 服务健康状态
    const isHealthy = await this.isHealthy();

    if (!isHealthy) {
      // AI 不可用，降级到规则模式
      logger.warn({ context }, 'AI service unavailable, falling back to rules');
      return this.fallbackToRules(context);
    }

    // Step 2: 规则优先 - 极高风险直接拒绝
    const highRiskDecision = this.evaluateHighRiskRules(context);
    if (highRiskDecision) {
      return highRiskDecision;
    }

    // Step 3: 规则优先 - 极低风险自动通过
    const lowRiskDecision = this.evaluateLowRiskRules(context);
    if (lowRiskDecision) {
      return lowRiskDecision;
    }

    // Step 4: 中间风险：调用 LLM 分析
    try {
      const llmResult = await this.callLLM(context);
      return {
        action: llmResult.action,
        confidence: llmResult.confidence,
        reason: llmResult.reason,
        riskScore: llmResult.riskScore,
        riskFactors: llmResult.riskFactors,
        suggestedApprover: llmResult.suggestedApprover,
      };
    } catch (error) {
      // LLM 调用失败，降级到规则模式
      logger.error({ error, context }, 'LLM call failed, falling back to rules');
      return this.fallbackToRules(context);
    }
  }

  /**
   * 健康检查
   */
  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.aiServiceUrl}/healthz`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      logger.debug('AI service health check failed');
      return false;
    }
  }

  /**
   * 风险分析
   */
  async analyzeRisk(request: RiskAnalysisRequest): Promise<RiskAnalysisResult> {
    const { context, analysisDimensions = [] } = request;

    // 基础风险评分
    let riskScore = this.calculateBaseRiskScore(context);
    let riskLevel = this.calculateRiskLevel(riskScore);
    const riskFactors: string[] = [];

    // 分析各维度
    if (analysisDimensions.includes('history')) {
      // 申请人历史分析
      const historyFactor = this.analyzeRequesterHistory(context);
      if (historyFactor) {
        riskFactors.push(historyFactor);
        riskScore += 10;
      }
    }

    if (analysisDimensions.includes('operation')) {
      // 操作类型分析
      const operationFactor = this.analyzeOperationType(context.operation);
      if (operationFactor) {
        riskFactors.push(operationFactor);
      }
    }

    if (analysisDimensions.includes('resource')) {
      // 资源敏感性分析
      const resourceFactor = this.analyzeResourceSensitivity(context.resource);
      if (resourceFactor) {
        riskFactors.push(resourceFactor);
        riskScore += 15;
      }
    }

    // 重新计算风险等级
    riskLevel = this.calculateRiskLevel(riskScore);
    riskScore = Math.min(riskScore, 100); // 上限 100

    return {
      riskScore,
      riskLevel,
      riskFactors,
      analysis: this.generateRiskAnalysis(riskScore, riskFactors, context),
      confidence: 0.85,
      recommendedAction: this.determineRecommendedAction(riskLevel, context),
    };
  }

  /**
   * 审批人建议
   */
  async suggestApprover(request: ApproverSuggestionRequest): Promise<ApproverSuggestionResult> {
    const { context, currentApprovers = [], preferApproverType } = request;

    // 基于风险等级建议审批人
    const riskAnalysis = await this.analyzeRisk({
      context,
      analysisDimensions: ['operation', 'resource'],
    });

    // 高风险 → 需要专家审批
    if (riskAnalysis.riskLevel >= 3) {
      return {
        suggestedApprovers: await this.getExpertApprovers(context),
        reason: '高风险操作，需要专家审批',
        confidence: 0.9,
        requiresExpertReview: true,
      };
    }

    // 中等风险 → 部门负责人审批
    if (riskAnalysis.riskLevel >= 2) {
      return {
        suggestedApprovers: await this.getDepartmentHeadApprovers(context),
        reason: '中等风险操作，需部门负责人审批',
        confidence: 0.8,
        requiresExpertReview: false,
      };
    }

    // 低风险 → 直接主管审批
    return {
      suggestedApprovers: await this.getManagerApprovers(context),
      reason: '低风险操作，直接主管审批即可',
      confidence: 0.85,
      requiresExpertReview: false,
    };
  }

  /**
   * 自动审批
   */
  async autoApprove(request: AutoApproveRequest): Promise<AutoApproveResult> {
    const { context, riskAnalysis } = request;

    // 获取风险分析结果
    const analysis = riskAnalysis ?? await this.analyzeRisk({ context });

    // 安全约束：生产环境永不自动批准高风险操作
    if (context.environment === 'prod' && analysis.riskLevel >= 3) {
      return {
        approved: false,
        action: 'escalate',
        confidence: 1.0,
        reason: '生产环境高风险操作，必须人工审批',
        riskScore: analysis.riskScore,
      };
    }

    // 置信度 >= 0.8 且风险分 < 50 → 自动批准
    const threshold = this.config.threshold || createDefaultAgentConfig().threshold!;
    if (analysis.riskScore < 50 && analysis.riskLevel <= 2) {
      return {
        approved: true,
        action: 'approve',
        confidence: 0.9,
        reason: '低风险操作，自动批准',
        riskScore: analysis.riskScore,
      };
    }

    // 其他情况转人工
    return {
      approved: false,
      action: 'escalate',
      confidence: analysis.confidence,
      reason: '中等风险或高置信度风险评估，需人工审批',
      riskScore: analysis.riskScore,
    };
  }

  /**
   * 获取插件配置
   */
  getConfig(): ApprovalAgentConfig {
    return { ...this.config };
  }

  // ==================== 私有方法 ====================

  /**
   * 计算基础风险评分
   */
  private calculateBaseRiskScore(context: ApprovalContext): number {
    let score = 0;

    // 环境风险
    if (context.environment === 'prod') score += 30;
    else if (context.environment === 'staging') score += 15;

    // 预定义风险等级
    score += (context.riskLevel - 1) * 15;

    // 操作类型风险
    if (HIGH_RISK_OPERATIONS.includes(context.operation.toLowerCase())) {
      score += 25;
    } else if (MEDIUM_RISK_OPERATIONS.includes(context.operation.toLowerCase())) {
      score += 10;
    }

    // 资源敏感性
    if (context.resource.includes('prod')) score += 15;
    if (context.resource.includes('db') || context.resource.includes('database')) score += 20;
    if (context.resource.includes('secret') || context.resource.includes('key')) score += 25;

    return Math.min(score, 100);
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(riskScore: number): number {
    if (riskScore >= 70) return 4; // 极高风险
    if (riskScore >= 50) return 3; // 高风险
    if (riskScore >= 25) return 2; // 中等风险
    return 1; // 低风险
  }

  /**
   * 评估高风险规则
   */
  private evaluateHighRiskRules(context: ApprovalContext): ApprovalDecision | null {
    // 生产环境 + 极高风险等级 → 直接拒绝
    if (context.riskLevel >= 4 && context.environment === 'prod') {
      return {
        action: 'reject',
        confidence: 0.95,
        reason: '生产环境高风险操作，需人工审批',
        riskScore: 90,
        riskFactors: [RISK_FACTORS.production, 'risk_level_4'],
      };
    }

    // 高风险操作 + 生产环境 → 直接拒绝
    if (
      HIGH_RISK_OPERATIONS.includes(context.operation.toLowerCase()) &&
      context.environment === 'prod'
    ) {
      return {
        action: 'reject',
        confidence: 0.9,
        reason: '生产环境高风险操作，需人工审批',
        riskScore: 85,
        riskFactors: [RISK_FACTORS.production, RISK_FACTORS.high_risk_operation],
      };
    }

    return null;
  }

  /**
   * 评估低风险规则
   */
  private evaluateLowRiskRules(context: ApprovalContext): ApprovalDecision | null {
    // 开发环境 + 低风险等级 → 自动通过
    if (context.riskLevel <= 1 && context.environment === 'dev') {
      return {
        action: 'approve',
        confidence: 0.9,
        reason: '开发环境低风险操作，自动批准',
        riskScore: 10,
      };
    }

    // 读取操作 + 低风险 → 自动通过
    if (['get', 'list', 'view', 'read'].includes(context.operation.toLowerCase())) {
      return {
        action: 'approve',
        confidence: 0.95,
        reason: '读取操作，自动批准',
        riskScore: 5,
      };
    }

    return null;
  }

  /**
   * 规则模式降级
   */
  private fallbackToRules(context: ApprovalContext): ApprovalDecision {
    // 生产环境 → 转人工
    if (context.environment === 'prod') {
      return {
        action: 'escalate',
        confidence: 0,
        reason: 'AI 服务不可用，生产环境操作转人工审批',
        riskScore: 50,
      };
    }

    // 低风险 → 自动批准
    if (context.riskLevel <= 2) {
      return {
        action: 'approve',
        confidence: 0.7,
        reason: 'AI 服务不可用，低风险操作按规则自动批准',
        riskScore: 20,
      };
    }

    // 其他 → 转人工
    return {
      action: 'escalate',
      confidence: 0,
      reason: 'AI 服务不可用，中等风险操作转人工审批',
      riskScore: 40,
    };
  }

  /**
   * 调用 LLM 分析
   */
  private async callLLM(context: ApprovalContext): Promise<ApprovalDecision> {
    const timeout = (this.config.timeoutSeconds || 10) * 1000;

    const response = await fetch(`${this.aiServiceUrl}/api/v1/approval/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: context.operation,
        resource: context.resource,
        requester: context.requester,
        environment: context.environment,
        riskLevel: context.riskLevel,
        metadata: context.metadata,
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new OrionError(`LLM API error: ${response.status}`, 'OPERATION_FAILED')
    }

    const result = await response.json() as any;
    return {
      action: result.action || 'escalate',
      confidence: result.confidence || 0.5,
      reason: result.reason || 'LLM 分析完成',
      riskScore: result.riskScore,
      riskFactors: result.riskFactors,
      suggestedApprover: result.suggestedApprover,
    };
  }

  /**
   * 分析申请人历史
   */
  private analyzeRequesterHistory(context: ApprovalContext): string | null {
    const { requesterHistory } = context;
    if (!requesterHistory) return null;

    if (requesterHistory.rejectionRate > 0.5) {
      return '申请人历史审批拒绝率高';
    }

    if (requesterHistory.recentIncidents > 2) {
      return '申请人近期有操作事故';
    }

    return null;
  }

  /**
   * 分析操作类型
   */
  private analyzeOperationType(operation: string): string | null {
    const op = operation.toLowerCase();
    if (HIGH_RISK_OPERATIONS.includes(op)) {
      return RISK_FACTORS.high_risk_operation;
    }
    return null;
  }

  /**
   * 分析资源敏感性
   */
  private analyzeResourceSensitivity(resource: string): string | null {
    const res = resource.toLowerCase();
    if (res.includes('secret') || res.includes('key') || res.includes('password')) {
      return RISK_FACTORS.sensitive_data;
    }
    if (res.includes('db') || res.includes('database')) {
      return RISK_FACTORS.data_modification;
    }
    return null;
  }

  /**
   * 生成风险分析文本
   */
  private generateRiskAnalysis(
    riskScore: number,
    riskFactors: string[],
    context: ApprovalContext
  ): string {
    const parts: string[] = [
      `综合风险评分: ${riskScore}/100 (等级 ${this.calculateRiskLevel(riskScore)})`,
    ];

    if (riskFactors.length > 0) {
      parts.push(`风险因素: ${riskFactors.join(', ')}`);
    }

    parts.push(`操作: ${context.operation} ${context.resource}`);
    parts.push(`环境: ${context.environment}`);

    return parts.join('；');
  }

  /**
   * 确定建议动作
   */
  private determineRecommendedAction(
    riskLevel: number,
    context: ApprovalContext
  ): 'approve' | 'reject' | 'escalate' {
    if (riskLevel <= 1 && context.environment !== 'prod') {
      return 'approve';
    }
    if (riskLevel >= 4 || (riskLevel >= 3 && context.environment === 'prod')) {
      return 'reject';
    }
    return 'escalate';
  }

  /**
   * 获取专家审批人列表
   * 查询具有 expert 角色的活跃用户
   */
  private async getExpertApprovers(context: ApprovalContext): Promise<string[]> {
    if (!this.db) return ['super_admin'];

    const tenantId = (context.metadata?.tenantId as string) || getCurrentTenantId();
    try {
      const result = await this.db.query(
        `SELECT user_id FROM user_roles
         WHERE role = 'expert' AND tenant_id = $1`,
        [tenantId],
      );
      const approvers = result.rows.map((r: any) => r.user_id);
      return approvers.length > 0 ? approvers : ['super_admin'];
    } catch (error) {
      logger.warn({ error }, 'Failed to query expert approvers, falling back to default');
      return ['super_admin'];
    }
  }

  /**
   * 获取部门负责人审批人列表
   * 查询请求者所在部门的负责人/经理
   */
  private async getDepartmentHeadApprovers(context: ApprovalContext): Promise<string[]> {
    if (!this.db) return ['dept_head'];

    const tenantId = (context.metadata?.tenantId as string) || getCurrentTenantId();
    try {
      const result = await this.db.query(
        `SELECT dm.user_id FROM department_members dm
         INNER JOIN department_members requester_dm
           ON dm.department = requester_dm.department
           AND dm.tenant_id = requester_dm.tenant_id
         WHERE requester_dm.user_id = $1
           AND dm.tenant_id = $2
           AND dm.role IN ('head', 'manager')`,
        [context.requester, tenantId],
      );
      const approvers = result.rows.map((r: any) => r.user_id);
      return approvers.length > 0 ? approvers : ['dept_head'];
    } catch (error) {
      logger.warn({ error }, 'Failed to query department head approvers, falling back to default');
      return ['dept_head'];
    }
  }

  /**
   * 获取直接主管审批人列表
   * 查询请求者的直属领导
   */
  private async getManagerApprovers(context: ApprovalContext): Promise<string[]> {
    if (!this.db) return ['manager'];

    const tenantId = (context.metadata?.tenantId as string) || getCurrentTenantId();
    try {
      const result = await this.db.query(
        `SELECT manager_id FROM user_reporting_lines
         WHERE user_id = $1 AND tenant_id = $2
         LIMIT 1`,
        [context.requester, tenantId],
      );
      const approvers = result.rows.map((r: any) => r.manager_id).filter(Boolean);
      return approvers.length > 0 ? approvers : ['manager'];
    } catch (error) {
      logger.warn({ error }, 'Failed to query manager approvers, falling back to default');
      return ['manager'];
    }
  }
}

/**
 * 创建默认审批代理实例
 */
export function createDefaultApprovalAgent(
  config?: Partial<ApprovalAgentConfig>
): ApprovalAgentPlugin {
  return new DefaultApprovalAgent(config);
}