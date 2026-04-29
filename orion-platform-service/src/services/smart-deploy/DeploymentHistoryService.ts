/**
 * Deployment History Service
 *
 * Stores deployment records, provides query capabilities,
 * calculates deployment metrics, and maintains audit trails.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Deployment,
  DeploymentMetrics,
  AuditTrailEntry,
  HistoryQuery,
  HistoryQueryResponse,
  DeploymentStatus,
  DeploymentStrategyType,
} from './types';
import { DeploymentHistoryRepository, DeploymentHistoryEntity } from '../../repositories/DeploymentHistoryRepository';

/**
 * Convert a Deployment domain object to a DeploymentHistoryEntity for persistence.
 */
function toEntity(deployment: Deployment): Omit<DeploymentHistoryEntity, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<DeploymentHistoryEntity, 'id'>> & { createdAt: Date; updatedAt: Date } {
  const now = new Date();
  return {
    id: deployment.id,
    tenantId: 'default',
    projectId: null,
    pipelineRunId: null,
    buildId: null,
    environment: deployment.environment,
    status: deployment.status,
    strategy: deployment.strategy,
    config: {
      appName: deployment.appName,
      version: deployment.version,
      stages: deployment.stages,
      currentStageIndex: deployment.currentStageIndex,
      initiatedBy: deployment.initiatedBy,
      image: deployment.image,
      notes: deployment.notes,
      changeRequestId: deployment.changeRequestId,
      riskAssessmentId: deployment.riskAssessmentId,
      riskScore: deployment.riskScore,
      riskLevel: deployment.riskLevel,
      rollbackInfo: deployment.rollbackInfo,
      error: deployment.error,
    },
    deployedBy: deployment.initiatedBy,
    startedAt: deployment.startedAt,
    completedAt: deployment.completedAt ?? null,
    durationMs: deployment.completedAt
      ? deployment.completedAt.getTime() - deployment.startedAt.getTime()
      : null,
    errorMessage: deployment.error ?? null,
    rollbackTo: deployment.rollbackInfo?.id ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a DeploymentHistoryEntity back to a Deployment domain object.
 */
function toDomain(entity: DeploymentHistoryEntity): Deployment {
  const config = entity.config || {};
  const startedAt = entity.startedAt ?? new Date();
  return {
    id: entity.id,
    appName: config.appName ?? 'unknown',
    version: config.version ?? 'unknown',
    environment: entity.environment,
    strategy: (entity.strategy as DeploymentStrategyType) ?? 'rolling',
    status: (entity.status as DeploymentStatus) ?? 'pending',
    stages: config.stages ?? [],
    currentStageIndex: config.currentStageIndex ?? 0,
    rollbackInfo: config.rollbackInfo,
    riskScore: config.riskScore,
    riskLevel: config.riskLevel,
    startedAt,
    completedAt: entity.completedAt ?? undefined,
    initiatedBy: entity.deployedBy ?? config.initiatedBy ?? 'system',
    image: config.image,
    notes: config.notes,
    changeRequestId: config.changeRequestId,
    riskAssessmentId: config.riskAssessmentId,
    error: entity.errorMessage ?? undefined,
    createdAt: entity.createdAt,
    updatedAt: entity.completedAt ?? entity.createdAt,
  };
}

/**
 * Deployment history and audit service
 */
export class DeploymentHistoryService {
  private deploymentRepository?: DeploymentHistoryRepository;
  private auditTrail: AuditTrailEntry[] = [];
  // Memory storage for deployments (when no database)
  private memoryDeployments: Map<string, Deployment> = new Map();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.deploymentRepository = new DeploymentHistoryRepository(db);
    }
  }

  /**
   * Record a deployment
   */
  async recordDeployment(deployment: Deployment): Promise<Deployment> {
    if (this.deploymentRepository) {
      await this.deploymentRepository.create(toEntity(deployment));
    } else {
      // Store in memory
      this.memoryDeployments.set(deployment.id, deployment);
    }

    // Add audit trail entry
    await this.addAuditTrailEntry({
      deploymentId: deployment.id,
      action: 'deployment_created',
      performedBy: deployment.initiatedBy,
      details: {
        appName: deployment.appName,
        version: deployment.version,
        environment: deployment.environment,
        strategy: deployment.strategy,
        status: deployment.status,
      },
    });

    return deployment;
  }

  /**
   * Update a deployment record
   */
  async updateDeployment(
    deploymentId: string,
    updates: Partial<Deployment>
  ): Promise<Deployment | null> {
    if (this.deploymentRepository) {
      if (updates.status) {
        await this.deploymentRepository.updateStatus(
          deploymentId,
          updates.status,
          updates.completedAt,
          updates.error,
        );
      }
    } else {
      // Update in memory
      const deployment = this.memoryDeployments.get(deploymentId);
      if (deployment) {
        const updated = { ...deployment, ...updates };
        this.memoryDeployments.set(deploymentId, updated);
      }
    }

    // Add audit trail entry
    await this.addAuditTrailEntry({
      deploymentId,
      action: 'deployment_updated',
      performedBy: updates.initiatedBy || 'system',
      details: {
        updatedFields: Object.keys(updates),
        status: updates.status,
      },
    });

    // Return updated deployment
    return this.memoryDeployments.get(deploymentId) || null;
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    if (this.deploymentRepository) {
      const entity = await this.deploymentRepository.findById(deploymentId);
      return entity ? toDomain(entity) : null;
    }
    return this.memoryDeployments.get(deploymentId) || null;
  }

  /**
   * Get deployment history with filtering and pagination
   */
  async getHistory(query: HistoryQuery = {}): Promise<HistoryQueryResponse> {
    if (this.deploymentRepository) {
      const result = await this.deploymentRepository.findAll();
      let entities = result.entities;

      // Apply filters
      if (query.environment) {
        entities = entities.filter(d => d.environment === query.environment);
      }
      if (query.status) {
        entities = entities.filter(d => d.status === query.status);
      }
      if (query.strategy) {
        entities = entities.filter(d => d.strategy === query.strategy);
      }
      if (query.appName) {
        entities = entities.filter(e => (e.config?.appName as string | undefined) === query.appName);
      }

      // Sort by start time (most recent first)
      entities.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

      const total = entities.length;
      const limit = query.limit || 20;
      const offset = query.offset || 0;
      const data = entities.slice(offset, offset + limit);

      return {
        data: data.map(toDomain),
        total,
        limit,
        offset,
      };
    }

    // Memory mode
    let deployments = Array.from(this.memoryDeployments.values());

    // Apply filters
    if (query.environment) {
      deployments = deployments.filter(d => d.environment === query.environment);
    }
    if (query.status) {
      deployments = deployments.filter(d => d.status === query.status);
    }
    if (query.strategy) {
      deployments = deployments.filter(d => d.strategy === query.strategy);
    }
    if (query.appName) {
      deployments = deployments.filter(d => d.appName === query.appName);
    }

    // Sort by start time (most recent first)
    deployments.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const total = deployments.length;
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const data = deployments.slice(offset, offset + limit);

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get deployments by environment
   */
  async getByEnvironment(environment: string): Promise<Deployment[]> {
    if (this.deploymentRepository) {
      const entities = await this.deploymentRepository.findByEnvironment(environment);
      return entities.map(toDomain);
    }
    return [];
  }

  /**
   * Add audit trail entry
   */
  private async addAuditTrailEntry(
    entry: Omit<AuditTrailEntry, 'id' | 'timestamp'>
  ): Promise<AuditTrailEntry> {
    const auditEntry: AuditTrailEntry = {
      id: uuidv4(),
      ...entry,
      timestamp: new Date(),
    };

    this.auditTrail.push(auditEntry);
    return auditEntry;
  }

  /**
   * Get deployment metrics summary
   */
  async getMetrics(filters?: {
    appName?: string;
    environment?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DeploymentMetrics> {
    if (!this.deploymentRepository) {
      // Memory mode
      let deployments = Array.from(this.memoryDeployments.values());

      // Apply filters
      if (filters?.appName) {
        deployments = deployments.filter(d => d.appName === filters.appName);
      }
      if (filters?.environment) {
        deployments = deployments.filter(d => d.environment === filters.environment);
      }

      const total = deployments.length;
      const successful = deployments.filter(d => d.status === 'completed').length;
      const failed = deployments.filter(d => d.status === 'failed').length;
      const rolledBack = deployments.filter(d => d.status === 'rolled_back').length;

      const durations = deployments
        .filter(d => d.completedAt && d.startedAt)
        .map(d => d.completedAt!.getTime() - d.startedAt!.getTime());

      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
      const medianDuration = durations.length > 0
        ? this.calculateMedian(durations)
        : 0;

      const byStrategy: Record<string, number> = {};
      const byEnvironment: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      for (const d of deployments) {
        byStrategy[d.strategy] = (byStrategy[d.strategy] || 0) + 1;
        byEnvironment[d.environment] = (byEnvironment[d.environment] || 0) + 1;
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      }

      return {
        totalDeployments: total,
        successfulDeployments: successful,
        failedDeployments: failed,
        rolledBackDeployments: rolledBack,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
        averageDurationMs: Math.round(avgDuration),
        medianDurationMs: medianDuration,
        rollbackRate: total > 0 ? Math.round((rolledBack / total) * 100) : 0,
        byStrategy,
        byEnvironment,
        byStatus,
      };
    }
    const result = await this.deploymentRepository.findAll({ limit: 10000 });
    const deployments = result.entities.map(toDomain);

    const total = deployments.length;
    const successful = deployments.filter(d => d.status === 'completed').length;
    const failed = deployments.filter(d => d.status === 'failed').length;
    const rolledBack = deployments.filter(d => d.status === 'rolled_back').length;

    const durations = deployments
      .filter(d => d.completedAt && d.startedAt)
      .map(d => d.completedAt!.getTime() - d.startedAt!.getTime());

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const medianDuration = durations.length > 0
      ? this.calculateMedian(durations)
      : 0;

    const byStrategy: Record<string, number> = {};
    const byEnvironment: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const d of deployments) {
      byStrategy[d.strategy] = (byStrategy[d.strategy] || 0) + 1;
      byEnvironment[d.environment] = (byEnvironment[d.environment] || 0) + 1;
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    }

    return {
      totalDeployments: total,
      successfulDeployments: successful,
      failedDeployments: failed,
      rolledBackDeployments: rolledBack,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageDurationMs: Math.round(avgDuration),
      medianDurationMs: medianDuration,
      rollbackRate: total > 0 ? Math.round((rolledBack / total) * 100) : 0,
      byStrategy,
      byEnvironment,
      byStatus,
    };
  }

  private _emptyMetrics(): DeploymentMetrics {
    return {
      totalDeployments: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
      rolledBackDeployments: 0,
      successRate: 0,
      averageDurationMs: 0,
      medianDurationMs: 0,
      rollbackRate: 0,
      byStrategy: {},
      byEnvironment: {},
      byStatus: {},
    };
  }

  /**
   * Get audit trail for a deployment
   */
  async getAuditTrail(deploymentId: string): Promise<AuditTrailEntry[]> {
    return this.auditTrail.filter(entry => entry.deploymentId === deploymentId);
  }

  /**
   * Get deployments by app name (stored in config)
   */
  async getByAppName(appName: string): Promise<Deployment[]> {
    if (this.deploymentRepository) {
      const result = await this.deploymentRepository.findAll({ limit: 1000 });
      return result.entities
        .filter(e => (e.config?.appName as string | undefined) === appName)
        .map(toDomain);
    }
    // Memory mode
    return Array.from(this.memoryDeployments.values())
      .filter(d => d.appName === appName);
  }

  /**
   * Get latest deployment for an app in an environment
   */
  async getLatestDeployment(appName: string, environment: string): Promise<Deployment | null> {
    if (this.deploymentRepository) {
      const result = await this.deploymentRepository.findAll({ limit: 1000 });
      const matching = result.entities
        .filter(e =>
          (e.config?.appName as string | undefined) === appName &&
          e.environment === environment
        )
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

      return matching.length > 0 ? toDomain(matching[0]) : null;
    }
    // Memory mode
    const matching = Array.from(this.memoryDeployments.values())
      .filter(d => d.appName === appName && d.environment === environment)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return matching.length > 0 ? matching[0] : null;
  }

  /**
   * Get last successful deployment for an app in an environment
   */
  async getLastSuccessfulDeployment(appName: string, environment: string): Promise<Deployment | null> {
    if (this.deploymentRepository) {
      const result = await this.deploymentRepository.findAll({ limit: 1000 });
      const matching = result.entities
        .filter(e =>
          (e.config?.appName as string | undefined) === appName &&
          e.environment === environment &&
          e.status === 'completed'
        )
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

      return matching.length > 0 ? toDomain(matching[0]) : null;
    }
    // Memory mode
    const matching = Array.from(this.memoryDeployments.values())
      .filter(d => d.appName === appName && d.environment === environment && d.status === 'completed')
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return matching.length > 0 ? matching[0] : null;
  }

  /**
   * Calculate median of an array of numbers
   */
  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }

    return sorted[mid];
  }

  /**
   * Clear all stored data (for testing)
   */
  static clearAll(): void {
    // Handled in tests by creating new instances
  }
}
