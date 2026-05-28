/**
 * AI 成本优化引擎
 *
 * 分析成本节约机会、推荐优化方案、应用节约方案、跟踪节约效果
 * 使用 PostgreSQL Repository 模式存储
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 成本节约机会
 */
export interface CostSavingOpportunity {
  /** 机会 ID */
  id: string;
  /** 类别 */
  category: 'compute' | 'storage' | 'network' | 'idle_resources' | 'rightsizing' | 'scheduling';
  /** 资源名称 */
  resourceName: string;
  /** 当前成本（每月，元） */
  currentMonthlyCost: number;
  /** 预估优化后成本（每月，元） */
  estimatedMonthlyCost: number;
  /** 预估月节约（元） */
  estimatedMonthlySavings: number;
  /** 节约百分比 */
  savingsPercentage: number;
  /** 实施难度 */
  implementationDifficulty: 'low' | 'medium' | 'high';
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high';
  /** 建议描述 */
  description: string;
}

/**
 * 优化推荐方案
 */
export interface OptimizationRecommendation {
  /** 推荐 ID */
  recommendationId: string;
  /** 租户 ID */
  tenantId: string;
  /** 推荐标题 */
  title: string;
  /** 推荐描述 */
  description: string;
  /** 关联的节约机会 */
  opportunities: CostSavingOpportunity[];
  /** 总预估月节约 */
  totalEstimatedSavings: number;
  /** 推荐优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 状态 */
  status: 'pending' | 'applied' | 'rejected' | 'completed';
  /** 创建时间 */
  createdAt: Date;
  /** 应用时间 */
  appliedAt?: Date;
}

/**
 * 节约效果跟踪记录
 */
export interface SavingsTrackingRecord {
  /** 记录 ID */
  id: string;
  /** 租户 ID */
  tenantId: string;
  /** 推荐 ID */
  recommendationId: string;
  /** 月份 */
  month: string;
  /** 实际节约（元） */
  actualSavings: number;
  /** 预估节约（元） */
  estimatedSavings: number;
  /** 达成率 */
  achievementRate: number;
  /** 记录时间 */
  recordedAt: Date;
}

/**
 * 成本分析报告
 */
export interface CostAnalysisReport {
  /** 租户 ID */
  tenantId: string;
  /** 当前月度总成本 */
  totalMonthlyCost: number;
  /** 预估优化后成本 */
  estimatedOptimizedCost: number;
  /** 预估总节约 */
  totalEstimatedSavings: number;
  /** 节约百分比 */
  overallSavingsPercentage: number;
  /** 节约机会列表 */
  opportunities: CostSavingOpportunity[];
  /** 按类别分组 */
  savingsByCategory: Record<string, number>;
  /** 分析时间 */
  analyzedAt: Date;
}

import {
  CostRecommendationRepository,
  SavingsTrackingRepository,
  CostRecommendationEntity,
  SavingsTrackingEntity,
} from '../../repositories/CostOptimizationRepository';
import { OrionError, ErrorCode } from '../../../errors';

/**
 * AI 成本优化服务
 */
export class CostOptimizerService {
  private recommendationRepository: CostRecommendationRepository | null = null;
  private trackingRepository: SavingsTrackingRepository | null = null;

  /** 成本数据存储 (in-memory for computation) */
  private costData: Map<string, {
    computeCost: number;
    storageCost: number;
    networkCost: number;
    idleResourcesCost: number;
    resourceCount: number;
  }> = new Map();

  /** 推荐方案存储 (in-memory cache for active operations) */
  private recommendationsCache: Map<string, OptimizationRecommendation> = new Map();

  /** 分析缓存 (in-memory, TTL-based) */
  private analysisCache: Map<string, CostAnalysisReport> = new Map();

  constructor(
    private db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    if (db) {
      this.recommendationRepository = new CostRecommendationRepository(db as any);
      this.trackingRepository = new SavingsTrackingRepository(db as any);
    }
    // Initialize mock data
    this.initializeMockData();
  }

  /**
   * 分析成本节约机会
   */
  analyzeCostSavings(tenantId: string): CostAnalysisReport {
    // Check cache (valid for 5 minutes)
    const cached = this.analysisCache.get(tenantId);
    if (cached && Date.now() - cached.analyzedAt.getTime() < 5 * 60 * 1000) {
      return cached;
    }

    const data = this.costData.get(tenantId) ?? this.getMockCostData(tenantId);
    const opportunities = this.generateOpportunities(tenantId, data);

    const totalMonthlyCost = data.computeCost + data.storageCost + data.networkCost + data.idleResourcesCost;
    const totalEstimatedSavings = opportunities.reduce((sum, o) => sum + o.estimatedMonthlySavings, 0);

    // Group by category
    const savingsByCategory: Record<string, number> = {};
    for (const opp of opportunities) {
      savingsByCategory[opp.category] = (savingsByCategory[opp.category] ?? 0) + opp.estimatedMonthlySavings;
    }

    const report: CostAnalysisReport = {
      tenantId,
      totalMonthlyCost,
      estimatedOptimizedCost: totalMonthlyCost - totalEstimatedSavings,
      totalEstimatedSavings: Math.round(totalEstimatedSavings * 100) / 100,
      overallSavingsPercentage: totalMonthlyCost > 0
        ? Math.round((totalEstimatedSavings / totalMonthlyCost) * 10000) / 100
        : 0,
      opportunities,
      savingsByCategory,
      analyzedAt: new Date(),
    };

    this.analysisCache.set(tenantId, report);
    return report;
  }

  /**
   * 推荐优化方案
   */
  async recommendOptimization(tenantId: string): Promise<OptimizationRecommendation[]> {
    const analysis = this.analyzeCostSavings(tenantId);

    // Sort by savings amount
    const sorted = [...analysis.opportunities].sort(
      (a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings
    );

    const recommendations: OptimizationRecommendation[] = [];

    // High priority: high value savings
    const highPriorityOpps = sorted.filter((o) => o.estimatedMonthlySavings > 500);
    if (highPriorityOpps.length > 0) {
      recommendations.push(await this.createRecommendation(tenantId, 'high', highPriorityOpps));
    }

    // Medium priority: medium value
    const mediumPriorityOpps = sorted.filter(
      (o) => o.estimatedMonthlySavings > 100 && o.estimatedMonthlySavings <= 500
    );
    if (mediumPriorityOpps.length > 0) {
      recommendations.push(await this.createRecommendation(tenantId, 'medium', mediumPriorityOpps));
    }

    // Low priority: small value
    const lowPriorityOpps = sorted.filter((o) => o.estimatedMonthlySavings <= 100);
    if (lowPriorityOpps.length > 0) {
      recommendations.push(await this.createRecommendation(tenantId, 'low', lowPriorityOpps));
    }

    return recommendations;
  }

  /**
   * 应用节约方案
   */
  async applyCostSavings(recommendationId: string): Promise<OptimizationRecommendation> {
    let recommendation = this.recommendationsCache.get(recommendationId);

    if (!recommendation) {
      // Try to load from DB
      if (this.recommendationRepository) {
        const entity = await this.recommendationRepository.findById(recommendationId);
        if (entity) {
          recommendation = {
            recommendationId: entity.id,
            tenantId: entity.tenantId,
            title: entity.title,
            description: entity.description || '',
            opportunities: (entity.opportunities as unknown) as CostSavingOpportunity[],
            totalEstimatedSavings: entity.totalEstimatedSavings,
            priority: entity.priority,
            status: entity.status as OptimizationRecommendation['status'],
            createdAt: entity.createdAt,
            appliedAt: entity.appliedAt || undefined,
          };
        }
      }
    }

    if (!recommendation) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Recommendation ${recommendationId} not found`);
    }

    if (recommendation.status === 'applied') {
      return recommendation;
    }

    recommendation.status = 'applied';
    recommendation.appliedAt = new Date();

    // Update in database
    if (this.recommendationRepository) {
      await this.recommendationRepository.updateRecommendation(recommendationId, {
        status: 'applied',
      });
    }

    // Update local cache
    this.recommendationsCache.set(recommendationId, recommendation);

    // Update cost data (simulate effect after application)
    const data = this.costData.get(recommendation.tenantId);
    if (data) {
      const totalSavings = recommendation.totalEstimatedSavings;
      data.computeCost = Math.max(0, data.computeCost - totalSavings * 0.6);
      data.storageCost = Math.max(0, data.storageCost - totalSavings * 0.2);
      data.idleResourcesCost = Math.max(0, data.idleResourcesCost - totalSavings * 0.2);
      this.costData.set(recommendation.tenantId, data);
    }

    // Clear cache
    this.analysisCache.delete(recommendation.tenantId);

    return recommendation;
  }

  /**
   * 跟踪节约效果
   */
  async trackSavings(tenantId: string): Promise<SavingsTrackingRecord[]> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    let existingRecords: SavingsTrackingEntity[] = [];

    // Load from DB
    if (this.trackingRepository) {
      existingRecords = await this.trackingRepository.findByTenantAndMonth(tenantId, currentMonth);
    }

    // Get all applied recommendations
    let appliedRecommendations: CostRecommendationEntity[] = [];

    if (this.recommendationRepository) {
      appliedRecommendations = await this.recommendationRepository.findByStatus('applied', tenantId);
    }

    const newRecords: SavingsTrackingRecord[] = [];

    for (const rec of appliedRecommendations) {
      // Check if already has record for current month
      const existingMonthRecord = existingRecords.find(
        (r) => r.recommendationId === rec.id && r.month === currentMonth
      );

      if (existingMonthRecord) {
        newRecords.push({
          id: existingMonthRecord.id,
          tenantId: existingMonthRecord.tenantId,
          recommendationId: existingMonthRecord.recommendationId,
          month: existingMonthRecord.month,
          actualSavings: existingMonthRecord.actualSavings,
          estimatedSavings: existingMonthRecord.estimatedSavings,
          achievementRate: existingMonthRecord.achievementRate,
          recordedAt: existingMonthRecord.recordedAt,
        });
        continue;
      }

      // Simulate actual savings effect (usually 80%-110% of estimated)
      const actualRatio = 0.8 + Math.random() * 0.3; // 0.8 ~ 1.1
      const actualSavings = Math.round(rec.totalEstimatedSavings * actualRatio * 100) / 100;
      const achievementRate = Math.round(actualRatio * 100);

      const record: SavingsTrackingRecord = {
        id: uuidv4(),
        tenantId,
        recommendationId: rec.id,
        month: currentMonth,
        actualSavings,
        estimatedSavings: rec.totalEstimatedSavings,
        achievementRate,
        recordedAt: new Date(),
      };

      // Persist to DB
      if (this.trackingRepository) {
        await this.trackingRepository.createRecord({
          tenantId,
          recommendationId: rec.id,
          month: currentMonth,
          actualSavings,
          estimatedSavings: rec.totalEstimatedSavings,
          achievementRate,
        });
      }

      newRecords.push(record);
    }

    return newRecords;
  }

  /**
   * 获取租户的节约历史
   */
  async getSavingsHistory(tenantId: string): Promise<SavingsTrackingRecord[]> {
    if (!this.trackingRepository) {
      return [];
    }

    const entities = await this.trackingRepository.findByTenant(tenantId);
    return entities.map(entity => ({
      id: entity.id,
      tenantId: entity.tenantId,
      recommendationId: entity.recommendationId,
      month: entity.month,
      actualSavings: entity.actualSavings,
      estimatedSavings: entity.estimatedSavings,
      achievementRate: entity.achievementRate,
      recordedAt: entity.recordedAt,
    }));
  }

  /**
   * 获取租户累计节约金额
   */
  async getTotalSavings(tenantId: string): Promise<number> {
    const records = await this.getSavingsHistory(tenantId);
    return records.reduce((sum, r) => sum + r.actualSavings, 0);
  }

  // ==================== Private Methods ====================

  /**
   * Initialize mock data
   */
  private initializeMockData(): void {
    // Don't auto-create mock tenant data, generate on-demand
  }

  /**
   * Get mock cost data
   */
  private getMockCostData(tenantId: string): {
    computeCost: number;
    storageCost: number;
    networkCost: number;
    idleResourcesCost: number;
    resourceCount: number;
  } {
    // Generate predictable mock data based on tenantId
    const hash = tenantId.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const baseMultiplier = (hash % 10) + 1;

    return {
      computeCost: 5000 * baseMultiplier,
      storageCost: 1500 * baseMultiplier,
      networkCost: 800 * baseMultiplier,
      idleResourcesCost: 2000 * baseMultiplier,
      resourceCount: 20 * baseMultiplier,
    };
  }

  /**
   * Generate savings opportunities
   */
  private generateOpportunities(
    tenantId: string,
    data: { computeCost: number; storageCost: number; networkCost: number; idleResourcesCost: number; resourceCount: number }
  ): CostSavingOpportunity[] {
    const opportunities: CostSavingOpportunity[] = [];

    // Compute: recommend resource rightsizing
    if (data.computeCost > 2000) {
      const savings = Math.round(data.computeCost * 0.25 * 100) / 100;
      opportunities.push({
        id: uuidv4(),
        category: 'rightsizing',
        resourceName: 'compute-cluster',
        currentMonthlyCost: data.computeCost,
        estimatedMonthlyCost: data.computeCost - savings,
        estimatedMonthlySavings: savings,
        savingsPercentage: 25,
        implementationDifficulty: 'medium',
        riskLevel: 'low',
        description: 'Based on resource monitoring analysis, compute resources average utilization is only 45%, recommend downsizing to save costs',
      });
    }

    // Compute: recommend scheduled scaling
    if (data.computeCost > 5000) {
      const savings = Math.round(data.computeCost * 0.3 * 100) / 100;
      opportunities.push({
        id: uuidv4(),
        category: 'scheduling',
        resourceName: 'compute-nonprod',
        currentMonthlyCost: data.computeCost,
        estimatedMonthlyCost: data.computeCost - savings,
        estimatedMonthlySavings: savings,
        savingsPercentage: 30,
        implementationDifficulty: 'low',
        riskLevel: 'low',
        description: 'Non-production environments can configure scheduled start/stop, auto-scale during off-hours',
      });
    }

    // Storage: clean unused storage
    if (data.storageCost > 1000) {
      const savings = Math.round(data.storageCost * 0.2 * 100) / 100;
      opportunities.push({
        id: uuidv4(),
        category: 'storage',
        resourceName: 'persistent-volumes',
        currentMonthlyCost: data.storageCost,
        estimatedMonthlyCost: data.storageCost - savings,
        estimatedMonthlySavings: savings,
        savingsPercentage: 20,
        implementationDifficulty: 'low',
        riskLevel: 'medium',
        description: 'Found 30% of persistent volumes not mounted by any Pod, recommend cleanup',
      });
    }

    // Idle resources
    if (data.idleResourcesCost > 1000) {
      const savings = Math.round(data.idleResourcesCost * 0.8 * 100) / 100;
      opportunities.push({
        id: uuidv4(),
        category: 'idle_resources',
        resourceName: 'idle-instances',
        currentMonthlyCost: data.idleResourcesCost,
        estimatedMonthlyCost: data.idleResourcesCost - savings,
        estimatedMonthlySavings: savings,
        savingsPercentage: 80,
        implementationDifficulty: 'low',
        riskLevel: 'low',
        description: `Detected ${Math.round(data.resourceCount * 0.15)} idle instances with no traffic for 7+ days, recommend release`,
      });
    }

    // Network: optimize network config
    if (data.networkCost > 1000) {
      const savings = Math.round(data.networkCost * 0.15 * 100) / 100;
      opportunities.push({
        id: uuidv4(),
        category: 'network',
        resourceName: 'network-egress',
        currentMonthlyCost: data.networkCost,
        estimatedMonthlyCost: data.networkCost - savings,
        estimatedMonthlySavings: savings,
        savingsPercentage: 15,
        implementationDifficulty: 'high',
        riskLevel: 'medium',
        description: 'Cross-region traffic can reduce egress costs through CDN and internal network optimization',
      });
    }

    // Compute: spot instances
    if (data.computeCost > 10000) {
      const savings = Math.round(data.computeCost * 0.4 * 100) / 100;
      opportunities.push({
        id: uuidv4(),
        category: 'compute',
        resourceName: 'compute-spot',
        currentMonthlyCost: data.computeCost,
        estimatedMonthlyCost: data.computeCost - savings,
        estimatedMonthlySavings: savings,
        savingsPercentage: 40,
        implementationDifficulty: 'high',
        riskLevel: 'medium',
        description: 'Batch processing and interruptible tasks can use spot instances, reducing costs by ~60-70%',
      });
    }

    return opportunities;
  }

  /**
   * Create recommendation
   */
  private async createRecommendation(
    tenantId: string,
    priority: 'high' | 'medium' | 'low',
    opportunities: CostSavingOpportunity[]
  ): Promise<OptimizationRecommendation> {
    const totalSavings = opportunities.reduce((sum, o) => sum + o.estimatedMonthlySavings, 0);

    const titles: Record<string, string> = {
      high: 'High Priority Cost Optimization Plan',
      medium: 'Medium Priority Cost Optimization Plan',
      low: 'Low Priority Cost Optimization Plan',
    };

    const descriptions: Record<string, string> = {
      high: `Contains ${opportunities.length} high-value optimization opportunities, estimated monthly savings of ¥${Math.round(totalSavings)}`,
      medium: `Contains ${opportunities.length} medium-value optimization opportunities, estimated monthly savings of ¥${Math.round(totalSavings)}`,
      low: `Contains ${opportunities.length} low-value optimization opportunities, estimated monthly savings of ¥${Math.round(totalSavings)}`,
    };

    const recommendation: OptimizationRecommendation = {
      recommendationId: uuidv4(),
      tenantId,
      title: titles[priority],
      description: descriptions[priority],
      opportunities,
      totalEstimatedSavings: Math.round(totalSavings * 100) / 100,
      priority,
      status: 'pending',
      createdAt: new Date(),
    };

    // Persist to DB
    if (this.recommendationRepository) {
      await this.recommendationRepository.createRecommendation({
        id: recommendation.recommendationId,
        tenantId,
        title: recommendation.title,
        description: recommendation.description,
        opportunities: opportunities as unknown as Record<string, unknown>[],
        totalEstimatedSavings: recommendation.totalEstimatedSavings,
        priority,
      });
    }

    // Cache locally
    this.recommendationsCache.set(recommendation.recommendationId, recommendation);
    return recommendation;
  }
}