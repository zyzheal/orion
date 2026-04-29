/**
 * Rollback Service
 *
 * Manages deployment rollbacks - automatic and manual rollback triggers,
 * rollback execution, and rollback history tracking.
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

/**
 * Rollback service for managing deployment rollbacks
 */
export class RollbackService {
  private rollbackRepository?: RollbackRepository;
  private eventPublisher?: IEventPublisher;
  // Memory storage for rollbacks (when no database)
  private memoryRollbacks: Map<string, RollbackEntity[]> = new Map();

  constructor(options?: { eventPublisher?: IEventPublisher; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.eventPublisher = options?.eventPublisher;
    if (options?.db) {
      this.rollbackRepository = new RollbackRepository(options.db);
    }
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
      throw new Error(
        `Cannot rollback deployment in '${deployment.status}' state. Only completed, failed, or verifying deployments can be rolled back.`
      );
    }

    // Check if already rolled back
    if (deployment.status === 'rolled_back') {
      throw new Error(
        `Deployment '${deployment.id}' has already been rolled back`
      );
    }

    const rollbackId = uuidv4();
    const startedAt = new Date();

    if (this.rollbackRepository) {
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

    // Memory fallback - publish event here too
    const rollbackEntity: RollbackEntity = {
      id: rollbackId,
      deploymentId: deployment.id,
      reason,
      triggeredBy,
      status: 'pending',
      targetVersion: targetVersion ?? null,
      startedAt,
      rollbackType: 'manual',
      previousVersion: deployment.version,
      completedAt: null,
      errorMessage: null,
      createdAt: new Date(),
    };

    // Store in memory
    const existing = this.memoryRollbacks.get(deployment.id) || [];
    existing.push(rollbackEntity);
    this.memoryRollbacks.set(deployment.id, existing);

    // Publish rollback started event (even in memory mode)
    await this.publishEvent(DeployEvents.ROLLBACK_STARTED, {
      rollbackId: rollbackEntity.id,
      deploymentId: deployment.id,
      appName: deployment.appName,
      version: deployment.version,
      targetVersion,
      reason,
      triggeredBy,
    });

    return rollbackEntity;
  }

  /**
   * Execute the rollback for a deployment
   */
  async executeRollback(
    deployment: Deployment,
    rollbackInfo: RollbackEntity
  ): Promise<{ rollback: RollbackEntity; deployment: Deployment }> {
    // Update rollback status to running
    rollbackInfo.status = 'running';
    if (this.rollbackRepository) {
      await this.rollbackRepository.updateStatus(rollbackInfo.id, 'running');
    }

    try {
      // Determine target version for rollback
      const targetVersion =
        rollbackInfo.targetVersion ||
        this.findPreviousVersion(deployment);

      if (!targetVersion && deployment.status !== 'failed') {
        throw new Error(
          'No previous version found for rollback. Specify a target version.'
        );
      }

      // Execute rollback using the same strategy as the original deployment
      await this.performRollback(deployment, targetVersion ?? '');

      // Update rollback info status
      const completedAt = new Date();
      rollbackInfo.status = 'completed';
      rollbackInfo.completedAt = completedAt;
      if (this.rollbackRepository) {
        await this.rollbackRepository.updateStatus(rollbackInfo.id, 'completed', completedAt);
      }

      // Update deployment status
      deployment.status = 'rolled_back';

      // Publish rollback completed event
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
      if (this.rollbackRepository) {
        await this.rollbackRepository.updateStatus(rollbackInfo.id, 'failed', new Date(), error.message);
      }

      deployment.status = 'failed';
      deployment.error = `Rollback failed: ${error.message}`;

      return { rollback: rollbackInfo, deployment };
    }
  }

  /**
   * Perform the actual rollback operation
   */
  private async performRollback(
    deployment: Deployment,
    targetVersion: string
  ): Promise<void> {
    // In production, this would:
    // 1. Switch traffic back to previous version
    // 2. Scale down the failed version
    // 3. Scale up the previous version
    // 4. Verify health of previous version

    // Simulate rollback operation
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 100) + 50)
    );
  }

  /**
   * Get rollback history for a deployment
   */
  async getRollbackHistory(deploymentId: string): Promise<RollbackEntity[]> {
    if (this.rollbackRepository) {
      return await this.rollbackRepository.findByDeploymentId(deploymentId);
    }
    return this.memoryRollbacks.get(deploymentId) || [];
  }

  /**
   * Get rollback by ID
   */
  async getRollbackById(rollbackId: string): Promise<RollbackEntity | null> {
    if (this.rollbackRepository) {
      return await this.rollbackRepository.findById(rollbackId) ?? null;
    }
    return null;
  }

  /**
   * Get all rollbacks
   */
  async getAllRollbacks(): Promise<RollbackEntity[]> {
    if (this.rollbackRepository) {
      const result = await this.rollbackRepository.findAll();
      return result.entities;
    }
    return [];
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
    // In production, this would query the deployment history
    // to find the last successfully deployed version

    // Simulate finding previous version
    const currentVersion = deployment.version;
    const versionParts = currentVersion.split('.');

    if (versionParts.length >= 3) {
      // Try to decrement patch version
      const patch = parseInt(versionParts[versionParts.length - 1]);
      if (patch > 0) {
        versionParts[versionParts.length - 1] = (patch - 1).toString();
        return versionParts.join('.');
      }
    }

    // Fallback: simulate a previous version
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
        console.warn(
          `[RollbackService] Failed to publish event ${type}:`,
          error
        );
      }
    }
  }
}
