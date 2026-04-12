/**
 * TASK-502: 成本优化建议引擎
 *
 * 识别未充分利用资源、推荐调整大小、检测闲置资源
 * 提供节省预估和优化建议
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CostOptimization,
  OptimizationCategory,
  OptimizationPriority,
  OptimizationStatus,
  ResourceUtilization,
  RightSizingRecommendation,
  CostEntityType,
} from './types';

/**
 * 优化建议查询参数
 */
export interface OptimizationQuery {
  category?: OptimizationCategory;
  priority?: OptimizationPriority;
  status?: OptimizationStatus;
  entityType?: CostEntityType;
  entityId?: string;
}

/**
 * 资源规格定义
 */
interface ResourceSpec {
  cpu: number; // 核数
  memory: number; // GB
  storage?: number; // GB
}

/**
 * 预设实例类型（用于推荐）
 */
const INSTANCE_TYPES: Record<string, ResourceSpec> = {
  'small': { cpu: 1, memory: 2 },
  'medium': { cpu: 2, memory: 4 },
  'large': { cpu: 4, memory: 8 },
  'xlarge': { cpu: 8, memory: 16 },
  '2xlarge': { cpu: 16, memory: 32 },
  '4xlarge': { cpu: 32, memory: 64 },
};

/**
 * 实例类型成本（月/美元）
 */
const INSTANCE_COSTS: Record<string, number> = {
  'small': 30,
  'medium': 60,
  'large': 120,
  'xlarge': 240,
  '2xlarge': 480,
  '4xlarge': 960,
};

/**
 * 成本优化引擎
 *
 * 分析资源利用率，识别优化机会，提供具体建议
 */
export class CostOptimizer {
  /** 优化建议记录 */
  private optimizations: CostOptimization[] = [];

  /** 资源利用率数据 */
  private resourceUtilizations: ResourceUtilization[] = [];

  /**
   * 分析优化机会
   *
   * 基于资源利用率数据生成优化建议
   *
   * @param utilizations 资源利用率数据
   * @returns 生成的优化建议列表
   */
  analyzeOptimization(
    utilizations: ResourceUtilization[]
  ): CostOptimization[] {
    this.resourceUtilizations = utilizations;
    const suggestions: CostOptimization[] = [];

    for (const util of utilizations) {
      // 检测未使用资源
      if (this.isUnused(util)) {
        suggestions.push(
          this.createUnusedResourceSuggestion(util)
        );
      }

      // 检测低利用率资源
      if (this.isUnderutilized(util)) {
        suggestions.push(
          this.createRightSizingSuggestion(util)
        );
      }

      // 检测可调度资源
      if (this.isSchedulable(util)) {
        suggestions.push(
          this.createSchedulingSuggestion(util)
        );
      }
    }

    this.optimizations.push(...suggestions);
    return suggestions;
  }

  /**
   * 获取资源调整大小建议
   *
   * 针对利用率不足的资源，推荐更合适的实例规格
   */
  getRightSizingRecommendations(
    filter?: { tenantId?: string; environment?: string }
  ): RightSizingRecommendation[] {
    const recommendations: RightSizingRecommendation[] = [];

    let resources = [...this.resourceUtilizations];
    if (filter?.tenantId) {
      resources = resources.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.environment) {
      resources = resources.filter((r) => r.environment === filter.environment);
    }

    for (const util of resources) {
      if (util.cpuUtilization < 40 || util.memoryUtilization < 40) {
        const rec = this.computeRightSizing(util);
        if (rec) {
          recommendations.push(rec);
        }
      }
    }

    return recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  /**
   * 检测闲置资源
   *
   * 识别长期未使用或使用率极低的资源
   */
  detectUnusedResources(
    filter?: { tenantId?: string; environment?: string }
  ): ResourceUtilization[] {
    let resources = [...this.resourceUtilizations];

    if (filter?.tenantId) {
      resources = resources.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.environment) {
      resources = resources.filter((r) => r.environment === filter.environment);
    }

    return resources.filter((r) => this.isUnused(r));
  }

  /**
   * 预估节省金额
   *
   * 计算实施所有优化建议后的总节省
   */
  estimateSavings(
    filter?: { category?: OptimizationCategory; status?: OptimizationStatus }
  ): {
    totalMonthlySavings: number;
    totalAnnualSavings: number;
    byCategory: Record<string, number>;
    suggestionCount: number;
  } {
    let suggestions = [...this.optimizations];

    if (filter?.category) {
      suggestions = suggestions.filter((s) => s.category === filter.category);
    }
    if (filter?.status) {
      suggestions = suggestions.filter((s) => s.status === filter.status);
    }

    const byCategory: Record<string, number> = {};
    let totalMonthlySavings = 0;

    for (const opt of suggestions) {
      totalMonthlySavings += opt.estimatedSavings;
      byCategory[opt.category] =
        (byCategory[opt.category] || 0) + opt.estimatedSavings;
    }

    // 四舍五入
    const rounded = Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])
    );

    return {
      totalMonthlySavings: Math.round(totalMonthlySavings * 100) / 100,
      totalAnnualSavings: Math.round(totalMonthlySavings * 12 * 100) / 100,
      byCategory: rounded,
      suggestionCount: suggestions.length,
    };
  }

  /**
   * 获取优化建议列表
   */
  getOptimizations(query?: OptimizationQuery): CostOptimization[] {
    let suggestions = [...this.optimizations];

    if (query?.category) {
      suggestions = suggestions.filter((s) => s.category === query.category);
    }
    if (query?.priority) {
      suggestions = suggestions.filter((s) => s.priority === query.priority);
    }
    if (query?.status) {
      suggestions = suggestions.filter((s) => s.status === query.status);
    }
    if (query?.entityType) {
      suggestions = suggestions.filter(
        (s) => s.entityType === query.entityType
      );
    }
    if (query?.entityId) {
      suggestions = suggestions.filter((s) => s.entityId === query.entityId);
    }

    // 按优先级排序
    const priorityOrder: Record<OptimizationPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return suggestions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * 更新优化建议状态
   */
  updateOptimizationStatus(
    optimizationId: string,
    status: OptimizationStatus
  ): CostOptimization | null {
    const opt = this.optimizations.find((o) => o.id === optimizationId);
    if (!opt) return null;

    opt.status = status;
    opt.updatedAt = new Date();
    return opt;
  }

  /**
   * 删除优化建议
   */
  deleteOptimization(optimizationId: string): boolean {
    const index = this.optimizations.findIndex((o) => o.id === optimizationId);
    if (index === -1) return false;
    this.optimizations.splice(index, 1);
    return true;
  }

  /**
   * 清空所有数据
   */
  clearAll(): void {
    this.optimizations = [];
    this.resourceUtilizations = [];
  }

  // ==================== 私有方法 ====================

  /**
   * 判断资源是否闲置（使用率低于 5%）
   */
  private isUnused(util: ResourceUtilization): boolean {
    return (
      util.cpuUtilization < 5 &&
      util.memoryUtilization < 5 &&
      util.storageUtilization < 5
    );
  }

  /**
   * 判断资源是否低效利用（CPU 或内存低于 30%）
   */
  private isUnderutilized(util: ResourceUtilization): boolean {
    return util.cpuUtilization < 30 || util.memoryUtilization < 30;
  }

  /**
   * 判断资源是否适合调度优化
   * （非生产环境、利用率波动大）
   */
  private isSchedulable(util: ResourceUtilization): boolean {
    return (
      util.environment !== 'production' &&
      util.cpuUtilization < 50 &&
      util.memoryUtilization < 50
    );
  }

  /**
   * 创建闲置资源建议
   */
  private createUnusedResourceSuggestion(
    util: ResourceUtilization
  ): CostOptimization {
    return {
      id: uuidv4(),
      category: 'unused-resources',
      description: `Resource "${util.resourceName}" (${util.resourceId}) is unused. CPU: ${util.cpuUtilization}%, Memory: ${util.memoryUtilization}%, Storage: ${util.storageUtilization}%. Consider terminating or releasing this resource.`,
      estimatedSavings: util.monthlyCost,
      effort: 1,
      priority: 'critical',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      createdAt: new Date(),
      notes: `Environment: ${util.environment || 'unknown'}`,
    };
  }

  /**
   * 创建资源调整大小建议
   */
  private createRightSizingSuggestion(
    util: ResourceUtilization
  ): CostOptimization {
    const rec = this.computeRightSizing(util);
    const savings = rec ? rec.estimatedSavings : util.monthlyCost * 0.3;

    return {
      id: uuidv4(),
      category: 'right-sizing',
      description: `Resource "${util.resourceName}" (${util.resourceId}) is underutilized. CPU: ${util.cpuUtilization}%, Memory: ${util.memoryUtilization}%. Right-sizing could save ~$${Math.round(savings)}/month.`,
      estimatedSavings: Math.round(savings * 100) / 100,
      effort: 2,
      priority: savings > 100 ? 'high' : 'medium',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      createdAt: new Date(),
      notes: rec
        ? `Recommend: ${JSON.stringify(rec.recommendedSpec)}`
        : undefined,
    };
  }

  /**
   * 创建调度优化建议
   */
  private createSchedulingSuggestion(
    util: ResourceUtilization
  ): CostOptimization {
    const estimatedSavings = util.monthlyCost * 0.4; // 假设节省 40%

    return {
      id: uuidv4(),
      category: 'scheduling',
      description: `Resource "${util.resourceName}" in ${util.environment} environment has low utilization. Consider scheduling to run only during business hours.`,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      effort: 3,
      priority: 'medium',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      createdAt: new Date(),
      notes: `Estimated savings: ${Math.round(estimatedSavings)} USD/month by scheduling to business hours only.`,
    };
  }

  /**
   * 计算具体的资源调整大小推荐
   */
  private computeRightSizing(
    util: ResourceUtilization
  ): RightSizingRecommendation | null {
    // 根据利用率找到合适的实例类型
    const targetCpu = Math.max(util.cpuUtilization * 2, 20); // 目标利用率 ~50%
    const targetMemory = Math.max(util.memoryUtilization * 2, 20);

    // 估算当前所需规格
    const currentCpuCores = Math.ceil(targetCpu / 50) * 2; // 简化估算
    const currentMemoryGB = Math.ceil(targetMemory / 50) * 4;

    // 找到当前最匹配的实例类型
    let currentType = 'medium';
    for (const [name, spec] of Object.entries(INSTANCE_TYPES)) {
      if (spec.cpu >= currentCpuCores && spec.memory >= currentMemoryGB) {
        currentType = name;
        break;
      }
    }

    // 基于实际利用率推荐更小的实例
    const actualCpuNeeded = Math.ceil(
      (util.cpuUtilization / 100) * currentCpuCores * 2
    ); // 保留 2x 缓冲
    const actualMemoryNeeded = Math.ceil(
      (util.memoryUtilization / 100) * currentMemoryGB * 2
    );

    let recommendedType = 'small';
    for (const [name, spec] of Object.entries(INSTANCE_TYPES)) {
      if (spec.cpu >= actualCpuNeeded && spec.memory >= actualMemoryNeeded) {
        recommendedType = name;
        break;
      }
    }

    // 如果没有更小的推荐，返回 null
    const currentCost = INSTANCE_COSTS[currentType] || util.monthlyCost;
    const recommendedCost = INSTANCE_COSTS[recommendedType] || currentCost * 0.5;
    const savings = currentCost - recommendedCost;

    if (savings <= 0) return null;

    return {
      id: uuidv4(),
      resourceId: util.resourceId,
      resourceType: util.resourceType,
      currentSpec: {
        type: currentType,
        ...INSTANCE_TYPES[currentType],
      },
      recommendedSpec: {
        type: recommendedType,
        ...INSTANCE_TYPES[recommendedType],
      },
      currentCost,
      estimatedCost: recommendedCost,
      estimatedSavings: savings,
      reason: `CPU utilization at ${util.cpuUtilization}%, memory at ${util.memoryUtilization}%. Can downsize from ${currentType} to ${recommendedType}.`,
      tenantId: util.tenantId,
    };
  }
}
