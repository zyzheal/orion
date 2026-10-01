/**
 * AI 决策解释 API 路由
 *
 * 提供 AI 决策可解释性功能：
 * - GET /api/v1/ai/decisions - 获取决策列表
 * - POST /api/v1/ai/decisions - 记录新决策
 * - GET /api/v1/ai/decisions/:id - 获取决策详情
 * - GET /api/v1/ai/decisions/:id/explanation - 获取决策解释
 * - POST /api/v1/ai/decisions/:id/feedback - 提交决策反馈
 * - GET /api/v1/ai/decisions/:id/trace - 获取决策追踪
 * - GET /api/v1/ai/decisions/stats - 获取决策统计
 * - POST /api/v1/ai/decisions/analyze - 批量分析决策
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 决策类型枚举
 */
export enum DecisionType {
  PIPELINE_SELECTION = 'pipeline_selection',
  RESOURCE_ALLOCATION = 'resource_allocation',
  SCHEDULING = 'scheduling',
  SCALING = 'scaling',
  OPTIMIZATION = 'optimization',
  ANOMALY_DETECTION = 'anomaly_detection',
  RISK_ASSESSMENT = 'risk_assessment',
  COST_PREDICTION = 'cost_prediction',
  QUALITY_GATE = 'quality_gate',
  CUSTOM = 'custom',
}

/**
 * 决策状态枚举
 */
export enum DecisionStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  OVERRIDDEN = 'overridden',
  FAILED = 'failed',
}

/**
 * 反馈类型枚举
 */
export enum FeedbackType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
}

/**
 * 决策记录
 */
export interface AIDecision {
  id: string;
  type: DecisionType;
  status: DecisionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number;
  modelId?: string;
  modelVersion?: string;
  reasoning: DecisionReasoning;
  context: Record<string, unknown>;
  impact?: DecisionImpact;
  feedback?: DecisionFeedback[];
  createdBy: string;
  createdAt: string;
  executedAt?: string;
  expiresAt?: string;
}

/**
 * 决策推理
 */
export interface DecisionReasoning {
  summary: string;
  factors: DecisionFactor[];
  alternatives: DecisionAlternative[];
  constraints: string[];
  assumptions: string[];
}

/**
 * 决策因素
 */
export interface DecisionFactor {
  name: string;
  value: unknown;
  weight: number;
  description: string;
  category: string;
}

/**
 * 决策备选方案
 */
export interface DecisionAlternative {
  option: string;
  score: number;
  reason: string;
}

/**
 * 决策影响
 */
export interface DecisionImpact {
  costSavings?: number;
  timeSavings?: number;
  riskReduction?: number;
  qualityImprovement?: number;
  resourceUtilization?: number;
}

/**
 * 决策反馈
 */
export interface DecisionFeedback {
  id: string;
  type: FeedbackType;
  comment?: string;
  outcome?: string;
  actualImpact?: DecisionImpact;
  createdBy: string;
  createdAt: string;
}

/**
 * 决策追踪记录
 */
export interface DecisionTrace {
  id: string;
  decisionId: string;
  step: number;
  action: string;
  description: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration: number;
  timestamp: string;
}

/**
 * 决策统计
 */
export interface DecisionStats {
  total: number;
  byStatus: Record<DecisionStatus, number>;
  byType: Record<DecisionType, number>;
  avgConfidence: number;
  acceptanceRate: number;
  positiveFeedbackRate: number;
  avgImpact: {
    costSavings: number;
    timeSavings: number;
    riskReduction: number;
  };
}

/**
 * 记录决策请求
 */
export interface RecordDecisionRequest {
  type: DecisionType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number;
  modelId?: string;
  modelVersion?: string;
  reasoning: DecisionReasoning;
  context?: Record<string, unknown>;
  expiresAt?: string;
}

/**
 * 提交反馈请求
 */
export interface SubmitFeedbackRequest {
  type: FeedbackType;
  comment?: string;
  outcome?: string;
  actualImpact?: DecisionImpact;
}

/**
 * 批量分析请求
 */
export interface AnalyzeDecisionsRequest {
  decisionIds?: string[];
  types?: DecisionType[];
  dateRange?: {
    start: string;
    end: string;
  };
  analysisType: 'pattern' | 'trend' | 'anomaly' | 'correlation';
}

/**
 * 批量分析结果
 */
export interface AnalyzeDecisionsResult {
  analysisType: string;
  insights: {
    type: string;
    title: string;
    description: string;
    significance: number;
    data: Record<string, unknown>;
  }[];
  recommendations: string[];
}

/**
 * AI 决策服务类
 */
export class AIDecisionsService {
  private decisions: Map<string, AIDecision> = new Map();
  private traces: Map<string, DecisionTrace[]> = new Map();
  private decisionCounter = 0;
  private traceCounter = 0;

  /**
   * 生成决策 ID
   */
  private generateDecisionId(): string {
    this.decisionCounter++;
    return `decision_${Date.now()}_${this.decisionCounter}`;
  }

  /**
   * 生成追踪 ID
   */
  private generateTraceId(): string {
    this.traceCounter++;
    return `trace_${Date.now()}_${this.traceCounter}`;
  }

  /**
   * 记录决策
   */
  async recordDecision(data: RecordDecisionRequest, userId: string): Promise<AIDecision> {
    const id = this.generateDecisionId();
    const now = new Date().toISOString();

    const decision: AIDecision = {
      id,
      type: data.type,
      status: DecisionStatus.PENDING,
      input: data.input,
      output: data.output,
      confidence: data.confidence,
      modelId: data.modelId,
      modelVersion: data.modelVersion,
      reasoning: data.reasoning,
      context: data.context || {},
      createdBy: userId,
      createdAt: now,
      expiresAt: data.expiresAt,
    };

    this.decisions.set(id, decision);

    // 自动生成追踪记录
    this.generateDefaultTraces(id);

    return decision;
  }

  /**
   * 获取决策列表
   */
  async listDecisions(
    params: OffsetPaginationParams,
    filters?: {
      type?: DecisionType;
      status?: DecisionStatus;
      modelId?: string;
      dateRange?: { start: string; end: string };
    }
  ): Promise<{ data: AIDecision[]; total: number }> {
    let decisions = Array.from(this.decisions.values());

    if (filters?.type) {
      decisions = decisions.filter(d => d.type === filters.type);
    }
    if (filters?.status) {
      decisions = decisions.filter(d => d.status === filters.status);
    }
    if (filters?.modelId) {
      decisions = decisions.filter(d => d.modelId === filters.modelId);
    }
    if (filters?.dateRange) {
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      decisions = decisions.filter(d => {
        const createdAt = new Date(d.createdAt);
        return createdAt >= start && createdAt <= end;
      });
    }

    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    decisions.sort((a, b) => {
      const aVal = a[sortField as keyof AIDecision];
      const bVal = b[sortField as keyof AIDecision];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = decisions.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    decisions = decisions.slice(offset, offset + limit);

    return { data: decisions, total };
  }

  /**
   * 获取决策详情
   */
  async getDecision(id: string): Promise<AIDecision | null> {
    return this.decisions.get(id) || null;
  }

  /**
   * 更新决策状态
   */
  async updateDecisionStatus(id: string, status: DecisionStatus): Promise<AIDecision> {
    const decision = await this.getDecision(id);
    if (!decision) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'decision',
        identifier: id,
      });
    }

    decision.status = status;
    if (status === DecisionStatus.EXECUTED) {
      decision.executedAt = new Date().toISOString();
    }
    this.decisions.set(id, decision);
    return decision;
  }

  /**
   * 获取决策解释
   */
  async getExplanation(id: string): Promise<{ decision: AIDecision; explanation: string }> {
    const decision = await this.getDecision(id);
    if (!decision) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'decision',
        identifier: id,
      });
    }

    // 生成人类可读的解释
    const explanation = this.generateExplanation(decision);

    return { decision, explanation };
  }

  /**
   * 生成解释文本
   */
  private generateExplanation(decision: AIDecision): string {
    const factorsText = decision.reasoning.factors
      .map(f => `- ${f.name} (${f.category}): 权重 ${f.weight.toFixed(2)}, ${f.description}`)
      .join('\n');

    const alternativesText = decision.reasoning.alternatives
      .map(a => `- ${a.option}: 评分 ${a.score.toFixed(2)}, ${a.reason}`)
      .join('\n');

    return `
决策类型: ${decision.type}
置信度: ${(decision.confidence * 100).toFixed(1)}%

决策摘要:
${decision.reasoning.summary}

影响因素:
${factorsText}

备选方案:
${alternativesText}

约束条件:
${decision.reasoning.constraints.map(c => `- ${c}`).join('\n')}

假设前提:
${decision.reasoning.assumptions.map(a => `- ${a}`).join('\n')}
    `.trim();
  }

  /**
   * 提交决策反馈
   */
  async submitFeedback(id: string, data: SubmitFeedbackRequest, userId: string): Promise<AIDecision> {
    const decision = await this.getDecision(id);
    if (!decision) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'decision',
        identifier: id,
      });
    }

    const feedback: DecisionFeedback = {
      id: `feedback_${Date.now()}`,
      type: data.type,
      comment: data.comment,
      outcome: data.outcome,
      actualImpact: data.actualImpact,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };

    if (!decision.feedback) {
      decision.feedback = [];
    }
    decision.feedback.push(feedback);

    // 根据反馈更新状态
    if (data.type === FeedbackType.POSITIVE) {
      decision.status = DecisionStatus.ACCEPTED;
    } else if (data.type === FeedbackType.NEGATIVE) {
      decision.status = DecisionStatus.REJECTED;
    }

    this.decisions.set(id, decision);
    return decision;
  }

  /**
   * 获取决策追踪
   */
  async getTraces(id: string): Promise<DecisionTrace[]> {
    return this.traces.get(id) || [];
  }

  /**
   * 获取决策统计
   */
  async getStats(dateRange?: { start: string; end: string }): Promise<DecisionStats> {
    let decisions = Array.from(this.decisions.values());

    if (dateRange) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      decisions = decisions.filter(d => {
        const createdAt = new Date(d.createdAt);
        return createdAt >= start && createdAt <= end;
      });
    }

    const total = decisions.length;
    const byStatus: Record<DecisionStatus, number> = {} as any;
    const byType: Record<DecisionType, number> = {} as any;

    for (const status of Object.values(DecisionStatus)) {
      byStatus[status] = decisions.filter(d => d.status === status).length;
    }

    for (const type of Object.values(DecisionType)) {
      byType[type] = decisions.filter(d => d.type === type).length;
    }

    const avgConfidence = total > 0
      ? decisions.reduce((sum, d) => sum + d.confidence, 0) / total
      : 0;

    const acceptedCount = byStatus[DecisionStatus.ACCEPTED] || 0;
    const acceptanceRate = total > 0 ? acceptedCount / total : 0;

    const feedbackCount = decisions.filter(d => d.feedback && d.feedback.length > 0).length;
    const positiveFeedbackCount = decisions.filter(d =>
      d.feedback?.some(f => f.type === FeedbackType.POSITIVE)
    ).length;
    const positiveFeedbackRate = feedbackCount > 0 ? positiveFeedbackCount / feedbackCount : 0;

    const impactSum = {
      costSavings: 0,
      timeSavings: 0,
      riskReduction: 0,
    };

    decisions.forEach(d => {
      if (d.impact) {
        impactSum.costSavings += d.impact.costSavings || 0;
        impactSum.timeSavings += d.impact.timeSavings || 0;
        impactSum.riskReduction += d.impact.riskReduction || 0;
      }
    });

    return {
      total,
      byStatus,
      byType,
      avgConfidence,
      acceptanceRate,
      positiveFeedbackRate,
      avgImpact: {
        costSavings: total > 0 ? impactSum.costSavings / total : 0,
        timeSavings: total > 0 ? impactSum.timeSavings / total : 0,
        riskReduction: total > 0 ? impactSum.riskReduction / total : 0,
      },
    };
  }

  /**
   * 批量分析决策
   */
  async analyzeDecisions(data: AnalyzeDecisionsRequest): Promise<AnalyzeDecisionsResult> {
    let decisions = Array.from(this.decisions.values());

    if (data.decisionIds) {
      decisions = decisions.filter(d => data.decisionIds!.includes(d.id));
    }
    if (data.types) {
      decisions = decisions.filter(d => data.types!.includes(d.type));
    }
    if (data.dateRange) {
      const start = new Date(data.dateRange.start);
      const end = new Date(data.dateRange.end);
      decisions = decisions.filter(d => {
        const createdAt = new Date(d.createdAt);
        return createdAt >= start && createdAt <= end;
      });
    }

    // 根据分析类型生成洞察
    const insights = this.generateInsights(decisions, data.analysisType);
    const recommendations = this.generateRecommendations(decisions, data.analysisType);

    return {
      analysisType: data.analysisType,
      insights,
      recommendations,
    };
  }

  /**
   * 生成洞察
   */
  private generateInsights(decisions: AIDecision[], analysisType: string): AnalyzeDecisionsResult['insights'] {
    const insights: AnalyzeDecisionsResult['insights'] = [];

    // 常见模式分析
    if (analysisType === 'pattern') {
      const typeCounts: Record<string, number> = {};
      decisions.forEach(d => {
        typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
      });

      const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
      if (topType) {
        insights.push({
          type: 'pattern',
          title: '最常见决策类型',
          description: `${topType[0]} 类型的决策最常见，共 ${topType[1]} 次`,
          significance: topType[1] / decisions.length,
          data: { type: topType[0], count: topType[1] },
        });
      }
    }

    // 趋势分析
    if (analysisType === 'trend') {
      const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;
      insights.push({
        type: 'trend',
        title: '置信度趋势',
        description: `平均置信度为 ${(avgConfidence * 100).toFixed(1)}%`,
        significance: avgConfidence,
        data: { avgConfidence },
      });
    }

    // 异常检测
    if (analysisType === 'anomaly') {
      const lowConfidence = decisions.filter(d => d.confidence < 0.5);
      if (lowConfidence.length > 0) {
        insights.push({
          type: 'anomaly',
          title: '低置信度决策',
          description: `发现 ${lowConfidence.length} 个低置信度决策`,
          significance: lowConfidence.length / decisions.length,
          data: { count: lowConfidence.length, decisions: lowConfidence.map(d => d.id) },
        });
      }
    }

    return insights;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(decisions: AIDecision[], analysisType: string): string[] {
    const recommendations: string[] = [];

    const rejectedCount = decisions.filter(d => d.status === DecisionStatus.REJECTED).length;
    const rejectedRate = decisions.length > 0 ? rejectedCount / decisions.length : 0;

    if (rejectedRate > 0.3) {
      recommendations.push('决策拒绝率较高，建议检查模型训练数据或调整决策阈值');
    }

    const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;
    if (avgConfidence < 0.7) {
      recommendations.push('平均置信度较低，建议优化模型或增加特征');
    }

    if (recommendations.length === 0) {
      recommendations.push('决策系统运行正常，继续保持监控');
    }

    return recommendations;
  }

  /**
   * 生成默认追踪记录
   */
  private generateDefaultTraces(decisionId: string): void {
    const now = new Date().toISOString();
    const traces: DecisionTrace[] = [
      {
        id: this.generateTraceId(),
        decisionId,
        step: 1,
        action: 'data_collection',
        description: '收集决策所需的数据',
        input: {},
        output: {},
        duration: 50,
        timestamp: now,
      },
      {
        id: this.generateTraceId(),
        decisionId,
        step: 2,
        action: 'feature_extraction',
        description: '提取特征',
        input: {},
        output: {},
        duration: 30,
        timestamp: new Date(Date.now() + 50).toISOString(),
      },
      {
        id: this.generateTraceId(),
        decisionId,
        step: 3,
        action: 'model_inference',
        description: '模型推理',
        input: {},
        output: {},
        duration: 100,
        timestamp: new Date(Date.now() + 80).toISOString(),
      },
      {
        id: this.generateTraceId(),
        decisionId,
        step: 4,
        action: 'result_generation',
        description: '生成决策结果',
        input: {},
        output: {},
        duration: 20,
        timestamp: new Date(Date.now() + 180).toISOString(),
      },
    ];

    this.traces.set(decisionId, traces);
  }
}

// 单例服务实例
export const aiDecisionsService = new AIDecisionsService();

/**
 * AI 决策路由类
 */
export class AIDecisionsRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/ai/decisions/stats - 获取决策统计
    this.app.get('/api/v1/ai/decisions/stats', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { start?: string; end?: string };
      const dateRange = query.start && query.end
        ? { start: query.start, end: query.end }
        : undefined;

      const stats = await aiDecisionsService.getStats(dateRange);
      return reply.send(stats);
    });

    // POST /api/v1/ai/decisions/analyze - 批量分析决策
    this.app.post('/api/v1/ai/decisions/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as AnalyzeDecisionsRequest;
      const result = await aiDecisionsService.analyzeDecisions(body);
      return reply.send(result);
    });

    // GET /api/v1/ai/decisions - 获取决策列表
    this.app.get('/api/v1/ai/decisions', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        type?: DecisionType;
        status?: DecisionStatus;
        modelId?: string;
        startDate?: string;
        endDate?: string;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await aiDecisionsService.listDecisions(
        paginationParams,
        {
          type: query.type,
          status: query.status,
          modelId: query.modelId,
          dateRange: query.startDate && query.endDate
            ? { start: query.startDate, end: query.endDate }
            : undefined,
        }
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/ai/decisions - 记录新决策
    this.app.post('/api/v1/ai/decisions', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as RecordDecisionRequest;
      const userId = (request as any).user?.id || 'system';

      const decision = await aiDecisionsService.recordDecision(body, userId);
      return reply.code(201).send(decision);
    });

    // GET /api/v1/ai/decisions/:id - 获取决策详情
    this.app.get('/api/v1/ai/decisions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const decision = await aiDecisionsService.getDecision(params.id);

      if (!decision) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'decision',
          identifier: params.id,
        });
      }

      return reply.send(decision);
    });

    // GET /api/v1/ai/decisions/:id/explanation - 获取决策解释
    this.app.get('/api/v1/ai/decisions/:id/explanation', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const result = await aiDecisionsService.getExplanation(params.id);
      return reply.send(result);
    });

    // POST /api/v1/ai/decisions/:id/feedback - 提交决策反馈
    this.app.post('/api/v1/ai/decisions/:id/feedback', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as SubmitFeedbackRequest;
      const userId = (request as any).user?.id || 'system';

      const decision = await aiDecisionsService.submitFeedback(params.id, body, userId);
      return reply.send(decision);
    });

    // GET /api/v1/ai/decisions/:id/trace - 获取决策追踪
    this.app.get('/api/v1/ai/decisions/:id/trace', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const traces = await aiDecisionsService.getTraces(params.id);
      return reply.send({ data: traces, total: traces.length });
    });
  }
}