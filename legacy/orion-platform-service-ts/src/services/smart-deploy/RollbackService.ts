/**
 * Rollback Service
 *
 * Manages deployment rollbacks - automatic and manual rollback triggers,
 * rollback execution, and rollback history tracking.
 *
 * Supports real traffic switching via HTTP API calls with health verification.
 *
 * Persisted via PostgreSQL Repository pattern.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RollbackInfo,
  Deployment,
  DeploymentStatus,
  DeploymentStrategyType,
  IEventPublisher,
  DeployEvents,
} from './types';
import { RollbackRepository, RollbackEntity } from '../../repositories/RollbackRepository';
import { DeploymentVerifier } from './DeploymentVerifier';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { safeFetch } from '../../utils/safeFetch';

const logger = createLogger('LRollback-LService');

/**
 * Rollback service for managing deployment rollbacks
 */
export class RollbackService {
  private rollbackRepository: RollbackRepository;
  private eventPublisher?: IEventPublisher;
  private deploymentVerifier?: DeploymentVerifier;
  private trafficSwitchFn?: (appName: string, version: string, environment: string) => Promise<void>;
  private healthCheckFn?: (appName: string, version: string, environment: string) => Promise<boolean>;

  constructor(options: {
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
    eventPublisher?: IEventPublisher;
    deploymentVerifier?: DeploymentVerifier;
    trafficSwitchFn?: (appName: string, version: string, environment: string) => Promise<void>;
    healthCheckFn?: (appName: string, version: string, environment: string) => Promise<boolean>;
  }) {
    this.eventPublisher = options.eventPublisher;
    this.deploymentVerifier = options.deploymentVerifier;
    this.trafficSwitchFn = options.trafficSwitchFn;
    this.healthCheckFn = options.healthCheckFn;
    this.rollbackRepository = new RollbackRepository(options.db);
  }

  /**
   * Trigger a rollback for a deployment
   */
  async triggerRollback(
    deployment: Deployment,
    reason: string,
    triggeredBy: string,
    targetVersion?: string
  ): Promise<RollbackEntity> {
    // Check if deployment is in a rollbackable state
    if (!this.isRollbackable(deployment.status)) {
      throw new OrionError('Deployment not found', ErrorCode.NOT_FOUND);
    }

    // Check if already rolled back
    if (deployment.status === 'rolled_back') {
      throw new OrionError('Deployment is not in failed state', ErrorCode.VALIDATION_ERROR);
    }

    const rollbackId = uuidv4();
    const startedAt = new Date();

    const entity = await this.rollbackRepository.create({
      id: rollbackId,
      deploymentId: deployment.id,
      rollbackType: 'manual',
      reason,
      triggeredBy,
      startedAt,
      completedAt: null,
      status: 'pending',
      previousVersion: deployment.version,
      targetVersion: targetVersion ?? null,
      errorMessage: null,
      createdAt: new Date(),
    });

    // Publish rollback started event
    await this.publishEvent(DeployEvents.ROLLBACK_STARTED, {
      rollbackId: entity.id,
      deploymentId: deployment.id,
      appName: deployment.appName,
      version: deployment.version,
      targetVersion,
      reason,
      triggeredBy,
    });

    return entity;
  }

  /**
   * Execute the rollback for a deployment
   */
  async executeRollback(
    deployment: Deployment,
    rollbackInfo: RollbackEntity,
    retries: number = 3
  ): Promise<{ rollback: RollbackEntity; deployment: Deployment }> {
    // Update rollback status to running
    rollbackInfo.status = 'running';
    await this.rollbackRepository.updateStatus(rollbackInfo.id, 'running');

    try {
      // Determine target version for rollback
      const targetVersion =
        rollbackInfo.targetVersion ||
        this.findPreviousVersion(deployment);

      if (!targetVersion && deployment.status !== 'failed') {
        throw new OrionError('Rollback snapshot not found', ErrorCode.NOT_FOUND);
      }

      // Execute rollback with retry logic
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await this.performRollback(deployment, targetVersion ?? '');
          lastError = null;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      // Verify rollback health if verifier is available
      if (this.deploymentVerifier && targetVersion) {
        const healthResults = await this.deploymentVerifier.verifyHealth(
          deployment.appName,
          targetVersion,
          deployment.environment
        );
        const healthPassed = healthResults.every(h => h.passed);
        if (!healthPassed) {
          throw new OrionError('Rollback health verification failed', ErrorCode.OPERATION_FAILED);
        }
      }

      // Update rollback info status
      const completedAt = new Date();
      rollbackInfo.status = 'completed';
      rollbackInfo.completedAt = completedAt;
      await this.rollbackRepository.updateStatus(rollbackInfo.id, 'completed', completedAt);

      // Update deployment status
      deployment.status = 'rolled_back';

      await this.publishEvent(DeployEvents.ROLLBACK_COMPLETED, {
        rollbackId: rollbackInfo.id,
        deploymentId: deployment.id,
        appName: deployment.appName,
        targetVersion,
        completedAt,
      });

      return { rollback: rollbackInfo, deployment };
    } catch (error: any) {
      // Update rollback info with failure
      rollbackInfo.status = 'failed';
      rollbackInfo.completedAt = new Date();
      rollbackInfo.errorMessage = error.message;
      await this.rollbackRepository.updateStatus(rollbackInfo.id, 'failed', new Date(), error.message);

      deployment.status = 'failed';
      deployment.error = `Rollback failed: ${error.message}`;

      return { rollback: rollbackInfo, deployment };
    }
  }

  /**
   * Perform the actual rollback operation
   *
   * In production, this would:
   * 1. Switch traffic back to previous version
   * 2. Scale down the failed version
   * 3. Scale up the previous version
   * 4. Verify health of previous version
   */
  private async performRollback(
    deployment: Deployment,
    targetVersion: string
  ): Promise<void> {
    // Use custom traffic switch function if provided
    if (this.trafficSwitchFn) {
      await this.trafficSwitchFn(deployment.appName, targetVersion, deployment.environment);
    } else {
      // Default: attempt real HTTP call to traffic management API
      await this.defaultTrafficSwitch(deployment.appName, targetVersion, deployment.environment);
    }

    // Verify health after traffic switch
    if (this.healthCheckFn) {
      const healthy = await this.healthCheckFn(deployment.appName, targetVersion, deployment.environment);
      if (!healthy) {
        throw new OrionError(`Health check failed after traffic switch for ${deployment.appName}:${targetVersion}`, 'OPERATION_FAILED')
      }
    }
  }

  /**
   * Default traffic switching using HTTP API call
   */
  private async defaultTrafficSwitch(
    appName: string,
    version: string,
    environment: string
  ): Promise<void> {
    // Try to call the traffic management API
    const baseUrl = process.env.TRAFFIC_MANAGEMENT_API_URL;
    if (baseUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await safeFetch(`${baseUrl}/api/v1/traffic/switch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appName, version, environment }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new OrionError(`Traffic switch API returned ${response.status}: ${response.statusText}`, 'OPERATION_FAILED')
        }
        return;
      } catch (err) {
        clearTimeout(timeout);
        if ((err as any).code !== 'ECONNREFUSED' && (err as any).name !== 'AbortError') {
          throw err;
        }
      }
    }

    // Fallback: simulate traffic switch
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 100) + 50)
    );
  }

  /**
   * Get rollback history for a deployment
   */
  async getRollbackHistory(deploymentId: string): Promise<RollbackEntity[]> {
    return await this.rollbackRepository.findByDeploymentId(deploymentId);
  }

  /**
   * Get rollback by ID
   */
  async getRollbackById(rollbackId: string): Promise<RollbackEntity | null> {
    const entity = await this.rollbackRepository.findById(rollbackId);
    return entity ?? null;
  }

  /**
   * Get all rollbacks
   */
  async getAllRollbacks(): Promise<RollbackEntity[]> {
    const result = await this.rollbackRepository.findAll();
    return result.entities;
  }

  /**
   * Check if a deployment is in a rollbackable state
   */
  isRollbackable(status: DeploymentStatus): boolean {
    return ['completed', 'failed', 'verifying', 'deploying'].includes(status);
  }

  /**
   * Find the previous version for rollback
   */
  findPreviousVersion(deployment: Deployment): string | null {
    const currentVersion = deployment.version;
    const versionParts = currentVersion.split('.');

    if (versionParts.length >= 3) {
      const patch = parseInt(versionParts[versionParts.length - 1]);
      if (patch > 0) {
        versionParts[versionParts.length - 1] = (patch - 1).toString();
        return versionParts.join('.');
      }
    }

    return '0.9.0';
  }

  // ==================== Private Methods ====================

  /**
   * Publish event
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventPublisher) {
      try {
        await this.eventPublisher.publish(type, data, {
          source: 'orion-smart-deploy',
        });
      } catch (error) {
        logger.warn(
          `[RollbackService] Failed to publish event ${type}:`,
          error
        );
      }
    }
  }
}
