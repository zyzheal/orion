/**
 * FinOpsOptimizer - 成本优化建议
 *
 * 职责：分析资源利用率、生成优化建议、管理优化方案
 */
import { FinOpsRepository } from './FinOpsRepository';
import { ResourceUtilization, OptimizationCategory, OptimizationPriority, OptimizationStatus, RightSizingRecommendation, CostEntityType } from './types';
import { createLogger } from '../../utils/logger';

export interface OptimizationQuery {
  category?: OptimizationCategory;
  priority?: OptimizationPriority;
  status?: OptimizationStatus;
  entityType?: CostEntityType;
  entityId?: string;
}

export class FinOpsOptimizer {
  private repository: FinOpsRepository;
  private readonly logger = createLogger('finops-optimizer');

  constructor(repository: FinOpsRepository) {
    this.repository = repository;
  }

  async analyzeOptimization(utilizations: ResourceUtilization[]): Promise<any[]> {
    const suggestions: any[] = [];

    for (const util of utilizations) {
      if (this.isUnused(util)) {
        suggestions.push(this.createUnusedResourceSuggestion(util));
      }
      if (this.isUnderutilized(util)) {
        suggestions.push(this.createRightSizingSuggestion(util));
      }
      if (this.isSchedulable(util)) {
        suggestions.push(this.createSchedulingSuggestion(util));
      }
    }

    return this.repository.batchInsertOptimizations(suggestions);
  }

  async getRightSizingRecommendations(filter?: { tenantId?: string; environment?: string }): Promise<RightSizingRecommendation[]> {
    const opts = await this.repository.getOptimizations({ category: 'right-sizing' });
    const recommendations: RightSizingRecommendation[] = [];

    for (const opt of opts) {
      if (filter?.tenantId && opt.entity_id !== filter.tenantId) continue;

      recommendations.push({
        id: opt.id,
        resourceId: opt.resource_ids?.[0] || opt.id,
        resourceType: opt.category,
        currentSpec: {},
        recommendedSpec: {},
        currentCost: 0,
        estimatedCost: 0,
        estimatedSavings: opt.estimated_savings,
        reason: opt.description,
        tenantId: opt.entity_id || undefined,
      });
    }

    return recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  async detectUnusedResources(filter?: { tenantId?: string; environment?: string }): Promise<any[]> {
    const opts = await this.repository.getOptimizations({ category: 'unused-resources' });

    if (filter?.tenantId) {
      return opts.filter(o => o.entity_id === filter.tenantId);
    }
    return opts;
  }

  async estimateSavings(filter?: { category?: OptimizationCategory; status?: OptimizationStatus }): Promise<{
    totalMonthlySavings: number;
    totalAnnualSavings: number;
    byCategory: Record<string, number>;
    suggestionCount: number;
  }> {
    const suggestions = await this.repository.getOptimizations(filter);

    const byCategory: Record<string, number> = {};
    let totalMonthlySavings = 0;

    for (const opt of suggestions) {
      totalMonthlySavings += opt.estimated_savings;
      byCategory[opt.category] = (byCategory[opt.category] || 0) + opt.estimated_savings;
    }

    const rounded = Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100]));

    return {
      totalMonthlySavings: Math.round(totalMonthlySavings * 100) / 100,
      totalAnnualSavings: Math.round(totalMonthlySavings * 12 * 100) / 100,
      byCategory: rounded,
      suggestionCount: suggestions.length,
    };
  }

  async getOptimizations(query?: OptimizationQuery): Promise<any[]> {
    return this.repository.getOptimizations(query);
  }

  async getServiceOptimizationSuggestions(serviceId: string, entityType: CostEntityType = 'project'): Promise<any[]> {
    this.logger.debug({ serviceId, entityType }, '[FinOpsOptimizer] Getting service optimization suggestions');
    return this.getOptimizations({ entityType, entityId: serviceId });
  }

  async updateOptimizationStatus(optimizationId: string, status: OptimizationStatus): Promise<any> {
    return this.repository.updateOptimizationStatus(optimizationId, status);
  }

  async deleteOptimization(optimizationId: string): Promise<boolean> {
    return this.repository.deleteOptimization(optimizationId);
  }

  // ==================== Private helpers ====================

  private isUnused(util: ResourceUtilization): boolean {
    return util.cpuUtilization < 5 && util.memoryUtilization < 5 && util.storageUtilization < 5;
  }

  private isUnderutilized(util: ResourceUtilization): boolean {
    return util.cpuUtilization < 30 || util.memoryUtilization < 30;
  }

  private isSchedulable(util: ResourceUtilization): boolean {
    return util.environment !== 'production' && util.cpuUtilization < 50 && util.memoryUtilization < 50;
  }

  private createUnusedResourceSuggestion(util: ResourceUtilization): any {
    return {
      category: 'unused-resources',
      description: `Resource "${util.resourceName}" (${util.resourceId}) is unused. CPU: ${util.cpuUtilization}%, Memory: ${util.memoryUtilization}%, Storage: ${util.storageUtilization}%. Consider terminating or releasing this resource.`,
      estimatedSavings: util.monthlyCost,
      effort: 1,
      priority: 'critical',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      notes: `Environment: ${util.environment || 'unknown'}`,
    };
  }

  private createRightSizingSuggestion(util: ResourceUtilization): any {
    const savings = util.monthlyCost * 0.3;
    return {
      category: 'right-sizing',
      description: `Resource "${util.resourceName}" (${util.resourceId}) is underutilized. CPU: ${util.cpuUtilization}%, Memory: ${util.memoryUtilization}%. Right-sizing could save ~$${Math.round(savings)}/month.`,
      estimatedSavings: Math.round(savings * 100) / 100,
      effort: 2,
      priority: savings > 100 ? 'high' : 'medium',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      notes: undefined,
    };
  }

  private createSchedulingSuggestion(util: ResourceUtilization): any {
    const estimatedSavings = util.monthlyCost * 0.4;
    return {
      category: 'scheduling',
      description: `Resource "${util.resourceName}" in ${util.environment} environment has low utilization. Consider scheduling to run only during business hours.`,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      effort: 3,
      priority: 'medium',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      notes: `Estimated savings: ${Math.round(estimatedSavings)} USD/month by scheduling to business hours only.`,
    };
  }
}
