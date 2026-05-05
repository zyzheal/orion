/**
 * CostOptimizationService - 成本优化建议服务
 *
 * Phase 2: 分析资源利用率，生成成本优化建议，
 * 帮助识别闲置资源、过度配置等优化机会。
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../../services/database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export enum OptimizationCategory {
  RIGHT_SIZING = 'right-sizing',
  UNUSED_RESOURCES = 'unused-resources',
  SCHEDULING = 'scheduling',
  RESERVED_INSTANCES = 'reserved-instances',
  STORAGE_OPTIMIZATION = 'storage-optimization',
}

export enum OptimizationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface ResourceUtilization {
  resourceId: string;
  resourceType: string;
  resourceName: string;
  cpuUtilization: number;       // percentage 0-100
  memoryUtilization: number;    // percentage 0-100
  storageUtilization: number;   // percentage 0-100
  monthlyCost: number;
  tenantId?: string;
  environment?: string;
}

export interface OptimizationSuggestion {
  id: string;
  tenantId: string;
  category: OptimizationCategory;
  priority: OptimizationPriority;
  resourceId: string;
  resourceType: string;
  resourceName: string;
  description: string;
  currentCost: number;
  estimatedSavings: number;
  estimatedSavingsPercent: number;
  effort: 'low' | 'medium' | 'high';
  status: 'identified' | 'accepted' | 'rejected' | 'implemented';
  createdAt: Date;
}

export interface UtilizationAnalysis {
  tenantId: string;
  totalResources: number;
  utilizedResources: number;
  underutilizedResources: number;
  unusedResources: number;
  totalMonthlyCost: number;
  potentialMonthlySavings: number;
  suggestions: OptimizationSuggestion[];
  analyzedAt: Date;
}

export class CostOptimizationService {
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
    this.ensureTable();
  }

  /**
   * 获取优化建议
   * 基于资源利用率分析生成优化建议
   */
  async getOptimizationSuggestions(
    tenantId: string,
    options?: { category?: OptimizationCategory; minSavings?: number },
  ): Promise<OptimizationSuggestion[]> {
    // Analyze current utilization
    const analysis = await this.analyzeResourceUtilization(tenantId);
    let suggestions = analysis.suggestions;

    if (options?.category) {
      suggestions = suggestions.filter(s => s.category === options.category);
    }

    if (options?.minSavings) {
      suggestions = suggestions.filter(s => s.estimatedSavings >= options.minSavings!);
    }

    return suggestions;
  }

  /**
   * 分析资源利用率
   * 扫描所有资源，识别闲置、低利用率资源
   */
  async analyzeResourceUtilization(tenantId: string): Promise<UtilizationAnalysis> {
    const resources = await this.getResourceUtilizations(tenantId);
    const suggestions: OptimizationSuggestion[] = [];

    let totalCost = 0;
    let totalSavings = 0;
    let utilizedCount = 0;
    let underutilizedCount = 0;
    let unusedCount = 0;

    for (const resource of resources) {
      totalCost += resource.monthlyCost;

      if (this.isUnused(resource)) {
        unusedCount++;
        const suggestion = this.createUnusedResourceSuggestion(tenantId, resource);
        suggestions.push(suggestion);
        totalSavings += suggestion.estimatedSavings;
      } else if (this.isUnderutilized(resource)) {
        underutilizedCount++;
        const suggestion = this.createRightSizingSuggestion(tenantId, resource);
        suggestions.push(suggestion);
        totalSavings += suggestion.estimatedSavings;
      } else {
        utilizedCount++;
      }

      // Check for scheduling opportunities (non-production, moderate utilization)
      if (this.isSchedulingCandidate(resource)) {
        const suggestion = this.createSchedulingSuggestion(tenantId, resource);
        suggestions.push(suggestion);
        totalSavings += suggestion.estimatedSavings;
      }
    }

    // Store suggestions
    for (const suggestion of suggestions) {
      await this.storeSuggestion(suggestion);
    }

    return {
      tenantId,
      totalResources: resources.length,
      utilizedResources: utilizedCount,
      underutilizedResources: underutilizedCount,
      unusedResources: unusedCount,
      totalMonthlyCost: Math.round(totalCost * 100) / 100,
      potentialMonthlySavings: Math.round(totalSavings * 100) / 100,
      suggestions,
      analyzedAt: new Date(),
    };
  }

  /**
   * 记录资源利用率数据
   */
  async recordUtilization(
    tenantId: string,
    utilization: ResourceUtilization,
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO resource_utilization (id, tenant_id, resource_id, resource_type, resource_name, cpu_utilization, memory_utilization, storage_utilization, monthly_cost, environment, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          uuidv4(),
          tenantId,
          utilization.resourceId,
          utilization.resourceType,
          utilization.resourceName,
          utilization.cpuUtilization,
          utilization.memoryUtilization,
          utilization.storageUtilization,
          utilization.monthlyCost,
          utilization.environment || null,
          new Date(),
        ],
      );
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to record resource utilization');
    }
  }

  // ==================== Private Helpers ====================

  private async getResourceUtilizations(tenantId: string): Promise<ResourceUtilization[]> {
    // Try to read from DB, fall back to empty if table doesn't exist
    try {
      const result = await this.db.query(
        `SELECT * FROM resource_utilization WHERE tenant_id = $1 ORDER BY recorded_at DESC`,
        [tenantId],
      );

      return result.rows.map(row => ({
        resourceId: row.resource_id,
        resourceType: row.resource_type,
        resourceName: row.resource_name,
        cpuUtilization: row.cpu_utilization,
        memoryUtilization: row.memory_utilization,
        storageUtilization: row.storage_utilization,
        monthlyCost: row.monthly_cost,
        tenantId: row.tenant_id,
        environment: row.environment,
      }));
    } catch {
      return [];
    }
  }

  private isUnused(resource: ResourceUtilization): boolean {
    return resource.cpuUtilization < 5 && resource.memoryUtilization < 5 && resource.storageUtilization < 5;
  }

  private isUnderutilized(resource: ResourceUtilization): boolean {
    return resource.cpuUtilization < 30 || resource.memoryUtilization < 30;
  }

  private isSchedulingCandidate(resource: ResourceUtilization): boolean {
    return resource.environment !== 'production' &&
           resource.cpuUtilization < 50 &&
           resource.memoryUtilization < 50 &&
           resource.cpuUtilization >= 5; // Not unused
  }

  private createUnusedResourceSuggestion(tenantId: string, resource: ResourceUtilization): OptimizationSuggestion {
    return {
      id: `opt_${uuidv4()}`,
      tenantId,
      category: OptimizationCategory.UNUSED_RESOURCES,
      priority: OptimizationPriority.CRITICAL,
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      resourceName: resource.resourceName,
      description: `Resource "${resource.resourceName}" is unused (CPU: ${resource.cpuUtilization}%, Memory: ${resource.memoryUtilization}%, Storage: ${resource.storageUtilization}%). Consider terminating or releasing this resource.`,
      currentCost: resource.monthlyCost,
      estimatedSavings: resource.monthlyCost,
      estimatedSavingsPercent: 100,
      effort: 'low',
      status: 'identified',
      createdAt: new Date(),
    };
  }

  private createRightSizingSuggestion(tenantId: string, resource: ResourceUtilization): OptimizationSuggestion {
    const avgUtilization = (resource.cpuUtilization + resource.memoryUtilization) / 2;
    // Estimate 30-50% savings based on underutilization
    const savingsPercent = Math.min(50, (100 - avgUtilization) * 0.5);
    const estimatedSavings = resource.monthlyCost * (savingsPercent / 100);

    return {
      id: `opt_${uuidv4()}`,
      tenantId,
      category: OptimizationCategory.RIGHT_SIZING,
      priority: estimatedSavings > 100 ? OptimizationPriority.HIGH : OptimizationPriority.MEDIUM,
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      resourceName: resource.resourceName,
      description: `Resource "${resource.resourceName}" is underutilized (CPU: ${resource.cpuUtilization}%, Memory: ${resource.memoryUtilization}%). Right-sizing could save ~$${estimatedSavings.toFixed(2)}/month.`,
      currentCost: resource.monthlyCost,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      estimatedSavingsPercent: Math.round(savingsPercent * 100) / 100,
      effort: 'medium',
      status: 'identified',
      createdAt: new Date(),
    };
  }

  private createSchedulingSuggestion(tenantId: string, resource: ResourceUtilization): OptimizationSuggestion {
    // Scheduling during business hours can save ~40% (non-business hours)
    const estimatedSavings = resource.monthlyCost * 0.4;

    return {
      id: `opt_${uuidv4()}`,
      tenantId,
      category: OptimizationCategory.SCHEDULING,
      priority: OptimizationPriority.MEDIUM,
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      resourceName: resource.resourceName,
      description: `Resource "${resource.resourceName}" in ${resource.environment || 'unknown'} environment has moderate utilization. Consider scheduling to run only during business hours to save ~$${estimatedSavings.toFixed(2)}/month.`,
      currentCost: resource.monthlyCost,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      estimatedSavingsPercent: 40,
      effort: 'low',
      status: 'identified',
      createdAt: new Date(),
    };
  }

  private async storeSuggestion(suggestion: OptimizationSuggestion): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO optimization_suggestions (id, tenant_id, category, priority, resource_id, resource_type, resource_name, description, current_cost, estimated_savings, estimated_savings_percent, effort, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          suggestion.id,
          suggestion.tenantId,
          suggestion.category,
          suggestion.priority,
          suggestion.resourceId,
          suggestion.resourceType,
          suggestion.resourceName,
          suggestion.description,
          suggestion.currentCost,
          suggestion.estimatedSavings,
          suggestion.estimatedSavingsPercent,
          suggestion.effort,
          suggestion.status,
          suggestion.createdAt,
        ],
      );
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Failed to store optimization suggestion');
    }
  }

  private async ensureTable(): Promise<void> {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS resource_utilization (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          resource_id VARCHAR(64) NOT NULL,
          resource_type VARCHAR(64) NOT NULL,
          resource_name VARCHAR(255) NOT NULL,
          cpu_utilization NUMERIC(5, 2) NOT NULL,
          memory_utilization NUMERIC(5, 2) NOT NULL,
          storage_utilization NUMERIC(5, 2) NOT NULL,
          monthly_cost NUMERIC(12, 2) NOT NULL,
          environment VARCHAR(64),
          recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS optimization_suggestions (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          category VARCHAR(40) NOT NULL,
          priority VARCHAR(20) NOT NULL,
          resource_id VARCHAR(64) NOT NULL,
          resource_type VARCHAR(64) NOT NULL,
          resource_name VARCHAR(255) NOT NULL,
          description TEXT,
          current_cost NUMERIC(12, 2) NOT NULL,
          estimated_savings NUMERIC(12, 2) NOT NULL,
          estimated_savings_percent NUMERIC(5, 2) NOT NULL,
          effort VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'identified',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      logger.info('resource_utilization and optimization_suggestions tables ensured');
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Could not ensure optimization tables (may need migration)');
    }
  }
}
