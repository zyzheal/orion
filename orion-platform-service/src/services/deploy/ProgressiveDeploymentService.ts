/**
 * ProgressiveDeploymentService - Simplified progressive deployment with traffic control
 *
 * Provides real-time traffic percentage control, automatic rollback based on error rates,
 * and support for different deployment strategies (canary, blue-green, rolling, shadow).
 *
 * Persisted via PostgreSQL Repository pattern.
 */

import { ProgressiveDeploymentRepository, ProgressiveDeploymentEntity } from '../../repositories/ProgressiveDeploymentRepository';

export type DeploymentStrategy = 'canary' | 'blue-green' | 'rolling' | 'shadow';
export type DeploymentPhase = 'preparing' | 'initial' | 'progressing' | 'complete' | 'rolled_back';

export interface ProgressiveDeployConfig {
  strategy: DeploymentStrategy;
  initialTrafficPercent: number;
  incrementPercent: number;
  incrementIntervalSeconds: number;
  autoRollback: boolean;
  rollbackThreshold: number;
  healthCheckEndpoint?: string;
}

export interface ProgressiveDeployStatus {
  deploymentId: string;
  phase: DeploymentPhase;
  currentTrafficPercent: number;
  targetTrafficPercent: number;
  errorRate: number;
  startedAt: Date;
  lastIncrementAt?: Date;
  completedAt?: Date;
}

export interface ProgressiveDeployResult {
  success: boolean;
  deploymentId: string;
  status: ProgressiveDeployStatus;
  error?: string;
}

export class ProgressiveDeploymentServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ProgressiveDeploymentServiceError';
  }
}

function entityToStatus(entity: ProgressiveDeploymentEntity): ProgressiveDeployStatus {
  return {
    deploymentId: entity.deploymentId,
    phase: entity.phase as DeploymentPhase,
    currentTrafficPercent: entity.currentTrafficPercent,
    targetTrafficPercent: entity.targetTrafficPercent,
    errorRate: entity.errorRate,
    startedAt: entity.startedAt,
    lastIncrementAt: entity.lastIncrementAt ?? undefined,
    completedAt: entity.completedAt ?? undefined,
  };
}

/**
 * ProgressiveDeploymentService - handles real-time traffic shifting and auto-rollback
 */
export class ProgressiveDeploymentService {
  private repo: ProgressiveDeploymentRepository;
  private defaultTenantId: string;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId: string = 'default'
  ) {
    this.repo = new ProgressiveDeploymentRepository(db);
    this.defaultTenantId = tenantId;
  }

  /**
   * Start a progressive deployment
   */
  async startProgressiveDeploy(
    deploymentId: string,
    config: ProgressiveDeployConfig,
    tenantId?: string
  ): Promise<ProgressiveDeployResult> {
    // Validate config
    if (config.initialTrafficPercent < 0 || config.initialTrafficPercent > 100) {
      throw new ProgressiveDeploymentServiceError(
        'initialTrafficPercent must be between 0 and 100',
        'INVALID_INITIAL_PERCENT'
      );
    }

    if (config.incrementPercent <= 0 || config.incrementPercent > 100) {
      throw new ProgressiveDeploymentServiceError(
        'incrementPercent must be between 1 and 100',
        'INVALID_INCREMENT_PERCENT'
      );
    }

    if (config.rollbackThreshold < 0 || config.rollbackThreshold > 100) {
      throw new ProgressiveDeploymentServiceError(
        'rollbackThreshold must be between 0 and 100',
        'INVALID_ROLLBACK_THRESHOLD'
      );
    }

    // Check if deployment already exists
    const existing = await this.repo.findByDeploymentId(deploymentId);
    if (existing) {
      throw new ProgressiveDeploymentServiceError(
        `Deployment ${deploymentId} already has an active progressive deployment`,
        'DEPLOYMENT_ALREADY_EXISTS'
      );
    }

    const entity = await this.repo.create({
      id: `pd-${deploymentId}`,
      deployment_id: deploymentId,
      tenant_id: tenantId ?? this.defaultTenantId,
      phase: 'initial',
      strategy: config.strategy,
      current_traffic_percent: config.initialTrafficPercent,
      target_traffic_percent: 100,
      error_rate: 0,
      started_at: new Date(),
      last_increment_at: null,
      completed_at: null,
      config,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return {
      success: true,
      deploymentId,
      status: entityToStatus(entity),
    };
  }

  /**
   * Increment traffic for a deployment
   */
  async incrementTraffic(
    deploymentId: string,
    config: ProgressiveDeployConfig
  ): Promise<ProgressiveDeployStatus | null> {
    const entity = await this.repo.findByDeploymentId(deploymentId);
    if (!entity) return null;

    // Don't increment if already complete or rolled back
    if (entity.phase === 'complete' || entity.phase === 'rolled_back') {
      return entityToStatus(entity);
    }

    // Check minimum interval between increments
    if (entity.lastIncrementAt && config.incrementIntervalSeconds) {
      const elapsed = (Date.now() - entity.lastIncrementAt.getTime()) / 1000;
      if (elapsed < config.incrementIntervalSeconds) {
        const remaining = Math.ceil(config.incrementIntervalSeconds - elapsed);
        throw new ProgressiveDeploymentServiceError(
          `Must wait ${remaining}s before next traffic increment`,
          'INCREMENT_COOLDOWN'
        );
      }
    }

    const newPercent = Math.min(
      entity.currentTrafficPercent + config.incrementPercent,
      entity.targetTrafficPercent
    );

    const now = new Date();
    let phase: string;
    let completedAt: Date | null = null;

    if (newPercent >= 100) {
      phase = 'complete';
      completedAt = now;
    } else {
      phase = 'progressing';
    }

    await this.repo.updatePhase(deploymentId, phase, {
      currentTrafficPercent: newPercent,
      lastIncrementAt: now,
      completedAt: completedAt ?? undefined,
    });

    return {
      deploymentId,
      phase: phase as DeploymentPhase,
      currentTrafficPercent: newPercent,
      targetTrafficPercent: entity.targetTrafficPercent,
      errorRate: entity.errorRate,
      startedAt: entity.startedAt,
      lastIncrementAt: now,
      completedAt: completedAt ?? undefined,
    };
  }

  /**
   * Check error rate and trigger auto-rollback if threshold is exceeded
   */
  async checkAndAutoRollback(
    deploymentId: string,
    config: ProgressiveDeployConfig,
    currentErrorRate: number
  ): Promise<boolean> {
    const entity = await this.repo.findByDeploymentId(deploymentId);
    if (!entity || !config.autoRollback) return false;

    if (currentErrorRate >= config.rollbackThreshold) {
      await this.repo.updatePhase(deploymentId, 'rolled_back', {
        errorRate: currentErrorRate,
      });
      return true;
    }

    // Update error rate even if not rolling back
    await this.repo.updatePhase(deploymentId, entity.phase, {
      errorRate: currentErrorRate,
    });
    return false;
  }

  /**
   * Get status of a progressive deployment
   */
  async getStatus(deploymentId: string): Promise<ProgressiveDeployStatus | null> {
    const entity = await this.repo.findByDeploymentId(deploymentId);
    return entity ? entityToStatus(entity) : null;
  }

  /**
   * Abort a deployment and mark as rolled back
   */
  async abortDeployment(deploymentId: string): Promise<boolean> {
    const entity = await this.repo.findByDeploymentId(deploymentId);
    if (!entity) return false;

    await this.repo.updatePhase(deploymentId, 'rolled_back');
    return true;
  }

  /**
   * List all active (not complete) deployments
   */
  async listActiveDeployments(tenantId?: string): Promise<ProgressiveDeployStatus[]> {
    const tid = tenantId ?? this.defaultTenantId;
    const entities = await this.repo.findActiveByTenant(tid);
    return entities.map(entityToStatus);
  }

  /**
   * Calculate traffic weights for routing
   */
  calculateTrafficWeights(currentPercent: number): { stable: number; canary: number } {
    return {
      stable: 100 - currentPercent,
      canary: currentPercent,
    };
  }

  /**
   * Clean up completed deployments
   */
  async cleanupCompletedDeployments(olderThanMs?: number, tenantId?: string): Promise<number> {
    const tid = tenantId ?? this.defaultTenantId;
    if (olderThanMs) {
      const cutoffDate = new Date(Date.now() - olderThanMs);
      return this.repo.deleteCompletedOlderThan(cutoffDate, tid);
    }

    // If no age specified, clean all completed/rolled_back
    const completed = await this.repo.findByPhase('complete', tid);
    const rolledBack = await this.repo.findByPhase('rolled_back', tid);
    let cleaned = 0;
    for (const entity of [...completed, ...rolledBack]) {
      await this.repo.delete(entity.id);
      cleaned++;
    }
    return cleaned;
  }
}
