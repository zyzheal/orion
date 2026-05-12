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

export class RiskService {
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

    // 如果没有现成评分，基于最近的风险事件动态计算
    if (!score) {
      return this.calculateRiskScore(entityType, entityId);
    }

    return score;
  }

  /**
   * 基于已有风险事件动态计算风险评分
   */
  private async calculateRiskScore(entityType: string, entityId: string): Promise<RiskScore | null> {
    // 找到该实体最近的评估
    const assessments = await AssessmentRepository.findMany({ entityType, entityId });
    if (assessments.items.length === 0) {
      return null;
    }

    // 收集所有事件
    const allEvents: RiskEvent[] = [];
    for (const a of assessments.items) {
      const events = await RiskEventRepository.findByAssessmentId(a.id);
      allEvents.push(...events);
    }

    if (allEvents.length === 0) {
      return null;
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
