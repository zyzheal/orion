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

/**
 * Rollback service for managing deployment rollbacks
 */
export class RollbackService {
  private rollbacks: Map<string, RollbackInfo> = new Map();
  private rollbackHistory: Map<string, RollbackInfo[]> = new Map(); // deploymentId -> history
  private eventPublisher?: IEventPublisher;

  constructor(options?: { eventPublisher?: IEventPublisher }) {
    this.eventPublisher = options?.eventPublisher;
  }

  /**
   * Trigger a rollback for a deployment
   */
  async triggerRollback(
    deployment: Deployment,
    reason: string,
    triggeredBy: string,
    targetVersion?: string
  ): Promise<RollbackInfo> {
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

    const rollbackInfo: RollbackInfo = {
      id: uuidv4(),
      deploymentId: deployment.id,
      reason,
      triggeredBy,
      status: 'pending',
      targetVersion,
      startedAt: new Date(),
    };

    // Store rollback info
    this.rollbacks.set(rollbackInfo.id, rollbackInfo);

    // Add to history
    const history = this.rollbackHistory.get(deployment.id) || [];
    history.push(rollbackInfo);
    this.rollbackHistory.set(deployment.id, history);

    // Publish rollback started event
    await this.publishEvent(DeployEvents.ROLLBACK_STARTED, {
      rollbackId: rollbackInfo.id,
      deploymentId: deployment.id,
      appName: deployment.appName,
      version: deployment.version,
      targetVersion,
      reason,
      triggeredBy,
    });

    return rollbackInfo;
  }

  /**
   * Execute the rollback for a deployment
   */
  async executeRollback(
    deployment: Deployment,
    rollbackInfo: RollbackInfo
  ): Promise<{ rollback: RollbackInfo; deployment: Deployment }> {
    // Update rollback status to running
    rollbackInfo.status = 'running';

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
      await this.performRollback(deployment, targetVersion);

      // Update rollback info
      rollbackInfo.status = 'completed';
      rollbackInfo.completedAt = new Date();
      rollbackInfo.targetVersion = targetVersion;

      // Update deployment status
      deployment.status = 'rolled_back';
      deployment.rollbackInfo = rollbackInfo;
      deployment.completedAt = new Date();
      deployment.updatedAt = new Date();

      // Publish rollback completed event
      await this.publishEvent(DeployEvents.ROLLBACK_COMPLETED, {
        rollbackId: rollbackInfo.id,
        deploymentId: deployment.id,
        appName: deployment.appName,
        targetVersion,
        completedAt: rollbackInfo.completedAt,
      });

      return { rollback: rollbackInfo, deployment };
    } catch (error: any) {
      // Update rollback info with failure
      rollbackInfo.status = 'failed';
      rollbackInfo.error = error.message;
      rollbackInfo.completedAt = new Date();

      // Update deployment status
      deployment.status = 'failed';
      deployment.error = `Rollback failed: ${error.message}`;
      deployment.updatedAt = new Date();

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
  getRollbackHistory(deploymentId: string): RollbackInfo[] {
    return this.rollbackHistory.get(deploymentId) || [];
  }

  /**
   * Get rollback by ID
   */
  getRollbackById(rollbackId: string): RollbackInfo | null {
    return this.rollbacks.get(rollbackId) || null;
  }

  /**
   * Get all rollbacks
   */
  getAllRollbacks(): RollbackInfo[] {
    return Array.from(this.rollbacks.values());
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
      // If patch is 0, try decrementing minor version
      const minor = parseInt(versionParts[versionParts.length - 2]);
      if (minor > 0) {
        versionParts[versionParts.length - 2] = (minor - 1).toString();
        versionParts[versionParts.length - 1] = '0';
        return versionParts.join('.');
      }
    }

    // Fallback: simulate a previous version
    return '0.9.0';
  }

  /**
   * Clear all stored data (for testing)
   */
  static clearAll(): void {
    // Since we can't access private members statically,
    // this is handled in tests by creating new instances
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
