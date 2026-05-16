/**
 * ProgressiveDeploymentService - Simplified progressive deployment with traffic control
 *
 * Provides real-time traffic percentage control, automatic rollback based on error rates,
 * and support for different deployment strategies (canary, blue-green, rolling, shadow).
 */

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

/**
 * ProgressiveDeploymentService - handles real-time traffic shifting and auto-rollback
 */
export class ProgressiveDeploymentService {
  private activeDeployments: Map<string, ProgressiveDeployStatus> = new Map();

  /**
   * Start a progressive deployment
   */
  async startProgressiveDeploy(
    deploymentId: string,
    config: ProgressiveDeployConfig
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
    if (this.activeDeployments.has(deploymentId)) {
      throw new ProgressiveDeploymentServiceError(
        `Deployment ${deploymentId} already has an active progressive deployment`,
        'DEPLOYMENT_ALREADY_EXISTS'
      );
    }

    const status: ProgressiveDeployStatus = {
      deploymentId,
      phase: 'initial',
      currentTrafficPercent: config.initialTrafficPercent,
      targetTrafficPercent: 100,
      errorRate: 0,
      startedAt: new Date(),
    };

    this.activeDeployments.set(deploymentId, status);

    return {
      success: true,
      deploymentId,
      status,
    };
  }

  /**
   * Increment traffic for a deployment
   */
  async incrementTraffic(
    deploymentId: string,
    config: ProgressiveDeployConfig
  ): Promise<ProgressiveDeployStatus | null> {
    const status = this.activeDeployments.get(deploymentId);
    if (!status) return null;

    // Don't increment if already complete or rolled back
    if (status.phase === 'complete' || status.phase === 'rolled_back') {
      return status;
    }

    // Check minimum interval between increments
    if (status.lastIncrementAt && config.incrementIntervalSeconds) {
      const elapsed = (Date.now() - status.lastIncrementAt.getTime()) / 1000;
      if (elapsed < config.incrementIntervalSeconds) {
        const remaining = Math.ceil(config.incrementIntervalSeconds - elapsed);
        throw new ProgressiveDeploymentServiceError(
          `Must wait ${remaining}s before next traffic increment`,
          'INCREMENT_COOLDOWN'
        );
      }
    }

    const newPercent = Math.min(
      status.currentTrafficPercent + config.incrementPercent,
      status.targetTrafficPercent
    );

    status.currentTrafficPercent = newPercent;
    status.lastIncrementAt = new Date();

    if (newPercent >= 100) {
      status.phase = 'complete';
      status.completedAt = new Date();
    } else {
      status.phase = 'progressing';
    }

    this.activeDeployments.set(deploymentId, status);
    return status;
  }

  /**
   * Check error rate and trigger auto-rollback if threshold is exceeded
   */
  async checkAndAutoRollback(
    deploymentId: string,
    config: ProgressiveDeployConfig,
    currentErrorRate: number
  ): Promise<boolean> {
    const status = this.activeDeployments.get(deploymentId);
    if (!status || !config.autoRollback) return false;

    // Update error rate
    status.errorRate = currentErrorRate;

    if (currentErrorRate >= config.rollbackThreshold) {
      status.phase = 'rolled_back';
      this.activeDeployments.set(deploymentId, status);
      return true;
    }

    this.activeDeployments.set(deploymentId, status);
    return false;
  }

  /**
   * Get status of a progressive deployment
   */
  async getStatus(deploymentId: string): Promise<ProgressiveDeployStatus | null> {
    return this.activeDeployments.get(deploymentId) || null;
  }

  /**
   * Abort a deployment and mark as rolled back
   */
  async abortDeployment(deploymentId: string): Promise<boolean> {
    const status = this.activeDeployments.get(deploymentId);
    if (!status) return false;

    status.phase = 'rolled_back';
    this.activeDeployments.set(deploymentId, status);
    return true;
  }

  /**
   * List all active (not complete) deployments
   */
  async listActiveDeployments(): Promise<ProgressiveDeployStatus[]> {
    return Array.from(this.activeDeployments.values()).filter(
      (s) => s.phase !== 'complete' && s.phase !== 'rolled_back'
    );
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
  async cleanupCompletedDeployments(olderThanMs?: number): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [deploymentId, status] of this.activeDeployments.entries()) {
      if (status.phase === 'complete' || status.phase === 'rolled_back') {
        if (olderThanMs) {
          const statusTime = status.completedAt || status.startedAt;
          const age = now.getTime() - statusTime.getTime();
          if (age > olderThanMs) {
            this.activeDeployments.delete(deploymentId);
            cleaned++;
          }
        } else {
          this.activeDeployments.delete(deploymentId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }
}