/**
 * CostOptimizationService - 成本优化服务
 *
 * Provides cost analysis, optimization recommendations, and utilization tracking
 * using PostgreSQL-backed cost records repository.
 *
 * TASK-502: 成本优化建议引擎
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import {
  CostRecordRepository,
  CostRecordEntity,
  CostSummaryParams,
} from '../../repositories/CostRepositories';
import type { DatabasePool } from '../database';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Domain Types ====================

export type OptimizationCategory =
  | 'unused-resources'
  | 'right-sizing'
  | 'scheduling'
  | 'reserved-instances'
  | 'spot-instances'
  | 'storage-optimization'
  | 'network-optimization';

export type OptimizationPriority = 'critical' | 'high' | 'medium' | 'low';

export type OptimizationStatus = 'identified' | 'pending' | 'applied' | 'rejected' | 'completed';

export interface UtilizationRecord {
  resourceId: string;
  resourceType: string;
  resourceName: string;
  cpuUtilization: number;
  memoryUtilization: number;
  storageUtilization: number;
  monthlyCost: number;
  tenantId: string;
  environment?: string;
}

export interface UtilizationAnalysis {
  tenantId: string;
  totalResources: number;
  underutilizedResources: number;
  unusedResources: number;
  optimalResources: number;
  potentialMonthlySavings: number;
  byCategory: Record<OptimizationCategory, number>;
  analyzedAt: Date;
}

export interface OptimizationSuggestion {
  id: string;
  tenantId: string;
  category: OptimizationCategory;
  priority: OptimizationPriority;
  status: OptimizationStatus;
  resourceIds: string[];
  description: string;
  estimatedSavings: number;
  effort: number;
  createdAt: Date;
  updatedAt?: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CostMetrics {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  costByModel: Record<string, number>;
  costByProvider: Record<string, number>;
  costByTenant: Record<string, number>;
  costByModule: Record<string, number>;
}

// ==================== In-memory stores ====================

const utilizationRecords = new Map<string, UtilizationRecord[]>();
const optimizationSuggestions = new Map<string, OptimizationSuggestion[]>();

/**
 * Preset instance types for right-sizing recommendations.
 */
const INSTANCE_TYPES: Record<string, { cpu: number; memory: number; storage?: number }> = {
  small: { cpu: 1, memory: 2 },
  medium: { cpu: 2, memory: 4 },
  large: { cpu: 4, memory: 8 },
  xlarge: { cpu: 8, memory: 16 },
  '2xlarge': { cpu: 16, memory: 32 },
  '4xlarge': { cpu: 32, memory: 64 },
};

const INSTANCE_COSTS: Record<string, number> = {
  small: 30,
  medium: 60,
  large: 120,
  xlarge: 240,
  '2xlarge': 480,
  '4xlarge': 960,
};

export class CostOptimizationService {
  private costRecordRepository: CostRecordRepository | null;

  /**
   * @param db - DatabasePool, or null for in-memory mode.
   */
  constructor(db: DatabasePool | null) {
    this.costRecordRepository = db ? new CostRecordRepository(db) : null;
  }

  // ==================== Utilization Tracking ====================

  /**
   * Record a resource utilization snapshot.
   */
  async recordUtilization(
    tenantId: string,
    record: UtilizationRecord
  ): Promise<UtilizationRecord> {
    const records = utilizationRecords.get(tenantId) ?? [];

    // Remove existing record for same resource (update)
    const existingIdx = records.findIndex((r) => r.resourceId === record.resourceId);
    if (existingIdx >= 0) {
      records[existingIdx] = { ...record, tenantId };
    } else {
      records.push({ ...record, tenantId });
    }

    utilizationRecords.set(tenantId, records);

    logger.info(
      { tenantId, resourceId: record.resourceId },
      '[CostOptimization] Utilization recorded'
    );

    return record;
  }

  /**
   * Analyze resource utilization for a tenant.
   */
  async analyzeResourceUtilization(tenantId: string): Promise<UtilizationAnalysis> {
    const records = utilizationRecords.get(tenantId) ?? [];

    let underutilized = 0;
    let unused = 0;
    let optimal = 0;
    let potentialSavings = 0;

    const byCategory: Record<OptimizationCategory, number> = {
      'unused-resources': 0,
      'right-sizing': 0,
      'scheduling': 0,
      'reserved-instances': 0,
      'spot-instances': 0,
      'storage-optimization': 0,
      'network-optimization': 0,
    };

    for (const record of records) {
      const isUnused =
        record.cpuUtilization < 5 &&
        record.memoryUtilization < 5 &&
        record.storageUtilization < 5;

      const isUnderutilized =
        record.cpuUtilization < 30 || record.memoryUtilization < 30;

      if (isUnused) {
        unused++;
        potentialSavings += record.monthlyCost;
        byCategory['unused-resources']++;
      } else if (isUnderutilized) {
        underutilized++;
        // Estimate 30% savings from right-sizing
        const estimatedSavings = record.monthlyCost * 0.3;
        potentialSavings += estimatedSavings;
        byCategory['right-sizing']++;
      } else {
        optimal++;
      }
    }

    return {
      tenantId,
      totalResources: records.length,
      underutilizedResources: underutilized,
      unusedResources: unused,
      optimalResources: optimal,
      potentialMonthlySavings: Math.round(potentialSavings * 100) / 100,
      byCategory,
      analyzedAt: new Date(),
    };
  }

  // ==================== Optimization Suggestions ====================

  /**
   * Get optimization suggestions for a tenant.
   */
  async getOptimizationSuggestions(
    tenantId: string,
    options?: {
      category?: OptimizationCategory;
      minSavings?: number;
    }
  ): Promise<OptimizationSuggestion[]> {
    const suggestions = optimizationSuggestions.get(tenantId) ?? [];

    let filtered = suggestions.filter((s) => s.status !== 'rejected');

    if (options?.category) {
      filtered = filtered.filter((s) => s.category === options.category);
    }
    if (options?.minSavings !== undefined) {
      filtered = filtered.filter((s) => s.estimatedSavings >= options.minSavings!);
    }

    // Sort by priority
    const priorityOrder: Record<OptimizationPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Generate optimization suggestions based on utilization.
   */
  async generateSuggestions(tenantId: string): Promise<OptimizationSuggestion[]> {
    const records = utilizationRecords.get(tenantId) ?? [];
    const suggestions: OptimizationSuggestion[] = [];

    for (const record of records) {
      const isUnused =
        record.cpuUtilization < 5 &&
        record.memoryUtilization < 5 &&
        record.storageUtilization < 5;

      const isUnderutilized =
        record.cpuUtilization < 30 || record.memoryUtilization < 30;

      if (isUnused) {
        // Generate unused resource suggestion
        suggestions.push({
          id: uuidv4(),
          tenantId,
          category: 'unused-resources',
          priority: 'critical',
          status: 'identified',
          resourceIds: [record.resourceId],
          description: `Resource "${record.resourceName}" (${record.resourceId}) is unused. CPU: ${record.cpuUtilization}%, Memory: ${record.memoryUtilization}%, Storage: ${record.storageUtilization}%. Consider terminating or releasing this resource.`,
          estimatedSavings: record.monthlyCost,
          effort: 1,
          createdAt: new Date(),
          metadata: { environment: record.environment },
        });
      } else if (isUnderutilized) {
        // Generate right-sizing suggestion
        const estimatedSavings = record.monthlyCost * 0.3;
        suggestions.push({
          id: uuidv4(),
          tenantId,
          category: 'right-sizing',
          priority: estimatedSavings > 100 ? 'high' : 'medium',
          status: 'identified',
          resourceIds: [record.resourceId],
          description: `Resource "${record.resourceName}" (${record.resourceId}) is underutilized. CPU: ${record.cpuUtilization}%, Memory: ${record.memoryUtilization}%. Right-sizing could save ~$${Math.round(estimatedSavings)}/month.`,
          estimatedSavings: Math.round(estimatedSavings * 100) / 100,
          effort: 2,
          createdAt: new Date(),
          metadata: { environment: record.environment },
        });
      }

      // Check for scheduling optimization (non-production, low utilization)
      if (record.environment !== 'production' && record.cpuUtilization < 50) {
        const estimatedSavings = record.monthlyCost * 0.4;
        suggestions.push({
          id: uuidv4(),
          tenantId,
          category: 'scheduling',
          priority: 'medium',
          status: 'identified',
          resourceIds: [record.resourceId],
          description: `Resource "${record.resourceName}" in ${record.environment || 'unknown'} environment has low utilization. Consider scheduling to run only during business hours.`,
          estimatedSavings: Math.round(estimatedSavings * 100) / 100,
          effort: 3,
          createdAt: new Date(),
          metadata: { environment: record.environment },
        });
      }
    }

    // Store suggestions
    const existing = optimizationSuggestions.get(tenantId) ?? [];
    optimizationSuggestions.set(tenantId, [...existing, ...suggestions]);

    logger.info({ tenantId, count: suggestions.length }, '[CostOptimization] Suggestions generated');

    return suggestions;
  }

  /**
   * Apply an optimization suggestion.
   */
  async applySuggestion(tenantId: string, suggestionId: string): Promise<OptimizationSuggestion | null> {
    const suggestions = optimizationSuggestions.get(tenantId) ?? [];
    const suggestion = suggestions.find((s) => s.id === suggestionId);

    if (!suggestion) {
      return null;
    }

    suggestion.status = 'applied';
    suggestion.updatedAt = new Date();

    logger.info({ tenantId, suggestionId }, '[CostOptimization] Suggestion applied');

    return suggestion;
  }

  /**
   * Reject an optimization suggestion.
   */
  async rejectSuggestion(tenantId: string, suggestionId: string): Promise<OptimizationSuggestion | null> {
    const suggestions = optimizationSuggestions.get(tenantId) ?? [];
    const suggestion = suggestions.find((s) => s.id === suggestionId);

    if (!suggestion) {
      return null;
    }

    suggestion.status = 'rejected';
    suggestion.updatedAt = new Date();

    return suggestion;
  }

  // ==================== Cost Metrics ====================

  /**
   * Get cost metrics from database.
   */
  async getCostMetrics(params: {
    tenantId?: string;
    projectId?: string;
    userId?: string;
    model?: string;
    provider?: string;
    moduleType?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<CostMetrics> {
    if (!this.costRecordRepository) {
      return {
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
        costByModel: {},
        costByProvider: {},
        costByTenant: {},
        costByModule: {},
      };
    }

    try {
      const summary = await this.costRecordRepository.getSummary(params);

      return {
        totalCost: summary.totalCost,
        totalInputTokens: summary.totalInputTokens,
        totalOutputTokens: summary.totalOutputTokens,
        totalRequests: summary.totalRequests,
        costByModel: summary.costByModel,
        costByProvider: summary.costByProvider,
        costByTenant: summary.costByTenant,
        costByModule: summary.costByModule,
      };
    } catch (error) {
      logger.warn({ traceId: getCurrentTraceId(), error }, '[CostOptimization] Failed to get cost metrics');
      return {
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalRequests: 0,
        costByModel: {},
        costByProvider: {},
        costByTenant: {},
        costByModule: {},
      };
    }
  }

  // ==================== Utilization History ====================

  /**
   * Get utilization records for a tenant.
   */
  async getUtilizationRecords(tenantId: string): Promise<UtilizationRecord[]> {
    return utilizationRecords.get(tenantId) ?? [];
  }

  /**
   * Clear utilization records for a tenant (for testing or data reset).
   */
  async clearUtilizationRecords(tenantId: string): Promise<void> {
    utilizationRecords.delete(tenantId);
  }

  /**
   * Clear optimization suggestions for a tenant (for testing or data reset).
   */
  async clearOptimizationSuggestions(tenantId: string): Promise<void> {
    optimizationSuggestions.delete(tenantId);
  }
}

export default CostOptimizationService;