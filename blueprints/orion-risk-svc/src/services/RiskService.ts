/**
 * Orion Risk Assessment Service
 * 风险评估核心服务 — 基于 PostgreSQL Repository 模式
 */

import {
  RiskAssessment,
  RiskScore,
  RiskEvent,
  RiskQuery,
  RiskCategory,
  RiskStatus,
  AssessmentStatus,
  RiskLevel,
} from '../types/risk';
import {
  AssessmentRepository,
  RiskEventRepository,
  RiskScoreRepository,
} from '../repositories/RiskRepository.js';
import { RiskAssessmentService } from './RiskAssessmentService.js';

export class RiskService {
  private assessmentService: RiskAssessmentService;

  constructor() {
    this.assessmentService = new RiskAssessmentService();
  }

  /**
   * 创建风险评估
   * @param data - 风险评估数据
   * @returns 创建的评估对象
   */
  async createAssessment(
    data: Omit<RiskAssessment, 'id' | 'createdAt' | 'updatedAt' | 'events' | 'overallScore' | 'completedAt'>
  ): Promise<RiskAssessment> {
    const assessment = await AssessmentRepository.create({
      name: data.name,
      description: data.description,
      entityType: data.entityType,
      entityId: data.entityId,
      status: data.status || AssessmentStatus.DRAFT,
      assessorId: data.assessorId,
      tenantId: data.tenantId,
      metadata: data.metadata,
    });

    return assessment;
  }

  /**
   * 获取风险评分
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @returns 风险评分
   */
  async getRiskScore(entityType: string, entityId: string): Promise<RiskScore | null> {
    const score = await RiskScoreRepository.findByEntity(entityType, entityId);

    // 如果没有现成评分，执行真实风险评估
    if (!score) {
      try {
        const result = await this.assessmentService.assessRisk({
          entityType,
          entityId,
          tenantId: '',
        });
        return result.riskScore;
      } catch {
        // 如果评估失败，回退到基于事件的方法
        return this.calculateRiskScore(entityType, entityId);
      }
    }

    return score;
  }

  /**
   * 执行完整的风险评估并返回详细结果
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param tenantId - 租户 ID
   * @returns 完整的风险评估结果
   */
  async performRiskAssessment(
    entityType: string,
    entityId: string,
    tenantId: string
  ): Promise<{
    riskScore: RiskScore;
    factors: Array<{ name: string; category: string; value: number; maxValue: number; weight: number; description: string }>;
    recommendations: string[];
    trend: 'increasing' | 'stable' | 'decreasing';
    previousScore?: number;
  }> {
    return this.assessmentService.assessRisk({
      entityType,
      entityId,
      tenantId,
    });
  }

  /**
   * 获取风险趋势
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param days - 查询天数
   * @returns 风险趋势数据
   */
  async getRiskTrend(
    entityType: string,
    entityId: string,
    days: number = 30
  ): Promise<{ date: string; score: number; level: RiskLevel }[]> {
    return this.assessmentService.getRiskTrend(entityType, entityId, days);
  }

  /**
   * 基于已有风险事件动态计算风险评分
   */
  private async calculateRiskScore(entityType: string, entityId: string): Promise<RiskScore | null> {
    // 找到该实体最近的评估
    const assessments = await AssessmentRepository.findMany({ entityType, entityId });
    if (assessments.items.length === 0) {
      // 尝试使用默认评估
      try {
        const result = await this.assessmentService.assessWithDefaults(entityType, entityId, '');
        return result.riskScore;
      } catch {
        return null;
      }
    }

    // 收集所有事件
    const allEvents: RiskEvent[] = [];
    for (const a of assessments.items) {
      const events = await RiskEventRepository.findByAssessmentId(a.id);
      allEvents.push(...events);
    }

    if (allEvents.length === 0) {
      // 没有事件，使用默认评估
      try {
        const result = await this.assessmentService.assessWithDefaults(entityType, entityId, '');
        return result.riskScore;
      } catch {
        return null;
      }
    }

    // 按类别汇总
    const dimensionScores: Record<string, number> = {};
    let totalRaw = 0;
    const categoryTotals: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    for (const event of allEvents) {
      totalRaw += event.riskValue;
      categoryTotals[event.category] = (categoryTotals[event.category] || 0) + event.riskValue;
      categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
    }

    // 计算各维度平均分 (归一化到 0-100)
    for (const category of Object.keys(categoryTotals)) {
      const avg = categoryTotals[category] / categoryCounts[category];
      dimensionScores[category] = Math.min(100, Math.round((avg / 25) * 100)); // 25 = max riskValue (5*5)
    }

    // 总体分数 (0-100)
    const avgRisk = totalRaw / allEvents.length;
    const totalScore = Math.min(100, Math.round((avgRisk / 25) * 100));

    // 确定风险等级
    const riskLevel = this.scoreToLevel(totalScore);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 天过期

    return RiskScoreRepository.upsert({
      entityType,
      entityId,
      totalScore,
      dimensionScores,
      riskLevel,
      comment: 'Auto-calculated from risk events',
      expiresAt,
    });
  }

  /**
   * 分数转等级
   */
  private scoreToLevel(score: number): RiskLevel {
    if (score >= 80) return RiskLevel.CRITICAL;
    if (score >= 60) return RiskLevel.HIGH;
    if (score >= 40) return RiskLevel.MEDIUM;
    if (score >= 20) return RiskLevel.LOW;
    return RiskLevel.INFO;
  }

  /**
   * 列表风险事件 / 风险评估
   * @param query - 查询参数
   * @returns 风险事件列表
   */
  async listRisks(q: RiskQuery): Promise<{ items: RiskEvent[]; total: number }> {
    return RiskEventRepository.findMany(q);
  }

  /**
   * 获取风险评估详情（含关联事件和评分）
   * @param assessmentId - 评估 ID
   * @returns 风险评估详情
   */
  async getRiskDetail(assessmentId: string): Promise<RiskAssessment | null> {
    return AssessmentRepository.findWithEvents(assessmentId);
  }

  /**
   * 更新风险状态
   * @param eventId - 事件 ID
   * @param status - 新状态
   * @returns 更新后的事件
   */
  async updateRiskStatus(eventId: string, status: RiskStatus): Promise<RiskEvent | null> {
    return RiskEventRepository.updateStatus(eventId, status);
  }

  /**
   * 更新评估状态
   * @param assessmentId - 评估 ID
   * @param status - 新状态
   * @returns 更新后的评估
   */
  async updateAssessmentStatus(
    assessmentId: string,
    status: AssessmentStatus
  ): Promise<RiskAssessment | null> {
    const updates: { status: AssessmentStatus; completedAt?: Date } = { status };
    if (status === AssessmentStatus.COMPLETED) {
      updates.completedAt = new Date();
    }
    return AssessmentRepository.update(assessmentId, updates);
  }
}
