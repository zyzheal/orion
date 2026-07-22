/**
 * AI 成本优化引擎
 *
 * 分析成本节约机会、推荐优化方案、应用节约方案、跟踪节约效果
 * 使用 Map 内存存储
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

/**
 * AI 成本优化服务
 */
export class CostOptimizerService {
  /** 成本数据存储 */
  private costData: Map<string, {
    computeCost: number;
    storageCost: number;
    networkCost: number;
    idleResourcesCost: number;
    resourceCount: number;
  }> = new Map();

  /** 推荐方案存储 */
  private recommendations: Map<string, OptimizationRecommendation> = new Map();

  /** 节约跟踪存储 */
  private trackingRecords: Map<string, SavingsTrackingRecord[]> = new Map();

  /** 分析缓存 */
  private analysisCache: Map<string, CostAnalysisReport> = new Map();

  constructor() {
    // 初始化模拟数据
    this.initializeMockData();
  }

  /**
   * 分析成本节约机会
   */
  analyzeCostSavings(tenantId: string): CostAnalysisReport {
    // 检查缓存（5 分钟内有效）
    const cached = this.analysisCache.get(tenantId);
    if (cached && Date.now() - cached.analyzedAt.getTime() < 5 * 60 * 1000) {
      return cached;
    }

    const data = this.costData.get(tenantId) ?? this.getMockCostData(tenantId);
    const opportunities = this.generateOpportunities(tenantId, data);

    const totalMonthlyCost = data.computeCost + data.storageCost + data.networkCost + data.idleResourcesCost;
    const totalEstimatedSavings = opportunities.reduce((sum, o) => sum + o.estimatedMonthlySavings, 0);

    // 按类别分组
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
  recommendOptimization(tenantId: string): OptimizationRecommendation[] {
    const analysis = this.analyzeCostSavings(tenantId);

    // 按节约金额排序
    const sorted = [...analysis.opportunities].sort(
      (a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings
    );

    // 分组生成推荐方案
    const recommendations: OptimizationRecommendation[] = [];

    // 高优先级：大金额节约
    const highPriorityOpps = sorted.filter((o) => o.estimatedMonthlySavings > 500);
    if (highPriorityOpps.length > 0) {
      recommendations.push(this.createRecommendation(tenantId, 'high', highPriorityOpps));
    }

    // 中优先级：中等金额
    const mediumPriorityOpps = sorted.filter(
      (o) => o.estimatedMonthlySavings > 100 && o.estimatedMonthlySavings <= 500
    );
    if (mediumPriorityOpps.length > 0) {
      recommendations.push(this.createRecommendation(tenantId, 'medium', mediumPriorityOpps));
    }

    // 低优先级：小额节约
    const lowPriorityOpps = sorted.filter((o) => o.estimatedMonthlySavings <= 100);
    if (lowPriorityOpps.length > 0) {
      recommendations.push(this.createRecommendation(tenantId, 'low', lowPriorityOpps));
    }

    return recommendations;
  }

  /**
   * 应用节约方案
   */
  applyCostSavings(recommendationId: string): OptimizationRecommendation {
    const recommendation = this.recommendations.get(recommendationId);
    if (!recommendation) {
      throw new Error(`Recommendation ${recommendationId} not found`);
    }

    if (recommendation.status === 'applied') {
      return recommendation;
    }

    recommendation.status = 'applied';
    recommendation.appliedAt = new Date();

    // 更新成本数据（模拟应用后的效果）
    const data = this.costData.get(recommendation.tenantId);
    if (data) {
      const totalSavings = recommendation.totalEstimatedSavings;
      // 模拟成本降低
      data.computeCost = Math.max(0, data.computeCost - totalSavings * 0.6);
      data.storageCost = Math.max(0, data.storageCost - totalSavings * 0.2);
      data.idleResourcesCost = Math.max(0, data.idleResourcesCost - totalSavings * 0.2);
      this.costData.set(recommendation.tenantId, data);
    }

    // 清除缓存
    this.analysisCache.delete(recommendation.tenantId);

    return recommendation;
  }

  /**
   * 跟踪节约效果
   */
  trackSavings(tenantId: string): SavingsTrackingRecord[] {
    const existingRecords = this.trackingRecords.get(tenantId) ?? [];

    // 获取所有已应用的推荐
    const appliedRecommendations = Array.from(this.recommendations.values())
      .filter((r) => r.tenantId === tenantId && r.status === 'applied');

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const newRecords: SavingsTrackingRecord[] = [];

    for (const rec of appliedRecommendations) {
      // 检查是否已有当月记录
      const existingMonthRecord = existingRecords.find(
        (r) => r.recommendationId === rec.recommendationId && r.month === currentMonth
      );
      if (existingMonthRecord) {
        newRecords.push(existingMonthRecord);
        continue;
      }

      // 模拟实际节约效果（通常是预估的 80%-110%）
      const actualRatio = 0.8 + Math.random() * 0.3; // 0.8 ~ 1.1
      const actualSavings = Math.round(rec.totalEstimatedSavings * actualRatio * 100) / 100;
      const achievementRate = Math.round(actualRatio * 100);

      const record: SavingsTrackingRecord = {
        id: uuidv4(),
        tenantId,
        recommendationId: rec.recommendationId,
        month: currentMonth,
        actualSavings,
        estimatedSavings: rec.totalEstimatedSavings,
        achievementRate,
        recordedAt: new Date(),
      };

      existingRecords.push(record);
      newRecords.push(record);
    }

    this.trackingRecords.set(tenantId, existingRecords);
    return newRecords;
  }

  /**
   * 获取租户的节约历史
   */
  getSavingsHistory(tenantId: string): SavingsTrackingRecord[] {
    return this.trackingRecords.get(tenantId) ?? [];
  }

  /**
   * 获取租户累计节约金额
   */
  getTotalSavings(tenantId: string): number {
    const records = this.trackingRecords.get(tenantId) ?? [];
    return records.reduce((sum, r) => sum + r.actualSavings, 0);
  }

  // ==================== 私有方法 ====================

  /**
   * 初始化模拟数据
   */
  private initializeMockData(): void {
    // 不自动创建模拟租户数据，按需生成
  }

  /**
   * 获取模拟成本数据
   */
  private getMockCostData(tenantId: string): {
    computeCost: number;
    storageCost: number;
    networkCost: number;
    idleResourcesCost: number;
    resourceCount: number;
  } {
    // 基于 tenantId 生成可预测的模拟数据
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
   * 生成节约机会
   */
  private generateOpportunities(
    tenantId: string,
    data: { computeCost: number; storageCost: number; networkCost: number; idleResourcesCost: number; resourceCount: number }
  ): CostSavingOpportunity[] {
    const opportunities: CostSavingOpportunity[] = [];

    // Compute: 推荐资源缩容
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
        description: '通过资源监控分析，计算资源平均利用率仅 45%，建议缩容以节约成本',
      });
    }

    // Compute: 推荐定时调度
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
        description: '非生产环境可配置定时启停，非工作时间自动缩容',
      });
    }

    // Storage: 清理未使用存储
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
        description: '发现 30% 的持久化存储卷未被任何 Pod 挂载，建议清理',
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
        description: `检测到 ${Math.round(data.resourceCount * 0.15)} 个空闲实例超过 7 天无流量，建议释放`,
      });
    }

    // Network: 优化网络配置
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
        description: '跨区域流量可通过 CDN 和内网优化减少出网费用',
      });
    }

    // Compute: 抢占式实例
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
        description: '批处理和可中断任务可使用抢占式实例，成本降低约 60-70%',
      });
    }

    return opportunities;
  }

  /**
   * 创建推荐方案
   */
  private createRecommendation(
    tenantId: string,
    priority: 'high' | 'medium' | 'low',
    opportunities: CostSavingOpportunity[]
  ): OptimizationRecommendation {
    const totalSavings = opportunities.reduce((sum, o) => sum + o.estimatedMonthlySavings, 0);

    const titles: Record<string, string> = {
      high: '高优先级成本优化方案',
      medium: '中优先级成本优化方案',
      low: '低优先级成本优化方案',
    };

    const descriptions: Record<string, string> = {
      high: `包含 ${opportunities.length} 个高价值优化机会，预计每月可节约 ￥${Math.round(totalSavings)} 元`,
      medium: `包含 ${opportunities.length} 个中等价值优化机会，预计每月可节约 ￥${Math.round(totalSavings)} 元`,
      low: `包含 ${opportunities.length} 个长尾优化机会，预计每月可节约 ￥${Math.round(totalSavings)} 元`,
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

    this.recommendations.set(recommendation.recommendationId, recommendation);
    return recommendation;
  }
}
