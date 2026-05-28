/**
 * Deployment Workflow
 *
 * Orchestrates the multi-step deployment workflow including
 * pre-checks, deployment execution, post-checks, and progress tracking.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Deployment,
  DeploymentStatus,
  DeploymentStage,
  DeployConfig,
  DeploymentStageStatus,
  DeploymentStepStatus,
  VerificationReport,
  IEventPublisher,
  DeployEvents,
} from './types';
import { DeploymentStrategyEngine } from './DeploymentStrategyEngine';
import { DeploymentVerifier } from './DeploymentVerifier';
import { DeploymentHistoryService } from './DeploymentHistoryService';
import { RollbackService } from './RollbackService';
import { EnvironmentLockService } from '../environment/EnvironmentLockService';
import pino from 'pino';

const logger = pino({ name: 'LDeployment-LWorkflow' });

/**
 * Deployment workflow orchestration
 */
export class DeploymentWorkflow {
  private strategyEngine: DeploymentStrategyEngine;
  private verifier: DeploymentVerifier;
  private historyService: DeploymentHistoryService;
  private rollbackService: RollbackService;
  private eventPublisher?: IEventPublisher;
  private lockService?: EnvironmentLockService;

  constructor(options?: {
    eventPublisher?: IEventPublisher;
    strategyEngine?: DeploymentStrategyEngine;
    verifier?: DeploymentVerifier;
    historyService?: DeploymentHistoryService;
    rollbackService?: RollbackService;
    lockService?: EnvironmentLockService;
  }) {
    this.eventPublisher = options?.eventPublisher;
    this.strategyEngine =
      options?.strategyEngine || new DeploymentStrategyEngine({ eventPublisher: options?.eventPublisher });
    this.verifier = options?.verifier || new DeploymentVerifier();
    this.historyService =
      options?.historyService || new DeploymentHistoryService();
    this.rollbackService =
      options?.rollbackService || new RollbackService({ eventPublisher: options?.eventPublisher });
    this.lockService = options?.lockService;
  }

  /**
   * Start a deployment workflow
   */
  async startDeployment(config: DeployConfig): Promise<Deployment> {
    // Create deployment record
    const deployment: Deployment = {
      id: uuidv4(),
      appName: config.appName,
      version: config.version,
      environment: config.environment,
      strategy: config.strategy || 'rolling',
      status: 'pending',
      stages: [],
      currentStageIndex: 0,
      initiatedBy: config.initiatedBy,
      image: config.image,
      notes: config.notes,
      changeRequestId: config.changeRequestId,
      riskAssessmentId: config.riskAssessmentId,
      commitSha: config.commitSha,
      commitCommittedAt: config.commitCommittedAt,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Record deployment
    await this.historyService.recordDeployment(deployment);

    // Publish deployment started event
    await this.publishEvent(DeployEvents.DEPLOYMENT_STARTED, {
      deploymentId: deployment.id,
      appName: config.appName,
      version: config.version,
      environment: config.environment,
      strategy: deployment.strategy,
      initiatedBy: config.initiatedBy,
    });

    // Execute workflow stages
    try {
      // Stage 1: Pre-deployment checks
      deployment.status = 'preparing';
      await this.historyService.updateDeployment(deployment.id, {
        status: deployment.status,
      });

      const preCheckResult = await this.executePreDeploymentChecks(
        deployment,
        config
      );
      if (!preCheckResult.success) {
        deployment.status = 'failed';
        deployment.error = preCheckResult.error;
        deployment.completedAt = new Date();
        deployment.updatedAt = new Date();
        await this.historyService.updateDeployment(deployment.id, {
          status: deployment.status,
          error: deployment.error,
          completedAt: deployment.completedAt,
          updatedAt: deployment.updatedAt,
        });
        await this.publishEvent(DeployEvents.DEPLOYMENT_FAILED, {
          deploymentId: deployment.id,
          error: deployment.error,
          stage: 'pre-deployment-checks',
        });
        return deployment;
      }

      // Stage 2: Execute deployment strategy
      deployment.status = 'deploying';
      await this.historyService.updateDeployment(deployment.id, {
        status: deployment.status,
      });

      const deployResult = await this.executeDeployment(deployment, config);
      deployment.stages = deployResult.stages;

      if (!deployResult.success) {
        // Check if auto-rollback is enabled
        if (config.rollbackPolicy?.autoRollback) {
          deployment.status = 'deploying';
          await this.historyService.updateDeployment(deployment.id, {
            status: deployment.status,
          });

          const rollbackResult = await this.handleDeploymentFailure(
            deployment,
            config
          );
          return rollbackResult.deployment;
        }

        deployment.status = 'failed';
        deployment.error = 'Deployment strategy execution failed';
        deployment.completedAt = new Date();
        deployment.updatedAt = new Date();
        await this.historyService.updateDeployment(deployment.id, {
          status: deployment.status,
          error: deployment.error,
          completedAt: deployment.completedAt,
          updatedAt: deployment.updatedAt,
        });
        await this.publishEvent(DeployEvents.DEPLOYMENT_FAILED, {
          deploymentId: deployment.id,
          error: deployment.error,
          stage: 'deployment-strategy',
        });
        return deployment;
      }

      // Stage 3: Post-deployment verification
      deployment.status = 'verifying';
      await this.historyService.updateDeployment(deployment.id, {
        status: deployment.status,
      });

      const verifyResult = await this.executePostDeploymentVerification(
        deployment,
        config
      );

      if (!verifyResult.success) {
        // Check if auto-rollback is enabled on verification failure
        if (config.rollbackPolicy?.autoRollback && config.rollbackPolicy.rollbackOnHealthCheckFailure) {
          const rollbackResult = await this.handleDeploymentFailure(
            deployment,
            config
          );
          return rollbackResult.deployment;
        }

        deployment.status = 'failed';
        deployment.error = 'Post-deployment verification failed';
        deployment.completedAt = new Date();
        deployment.updatedAt = new Date();
        await this.historyService.updateDeployment(deployment.id, {
          status: deployment.status,
          error: deployment.error,
          completedAt: deployment.completedAt,
          updatedAt: deployment.updatedAt,
        });
        await this.publishEvent(DeployEvents.DEPLOYMENT_FAILED, {
          deploymentId: deployment.id,
          error: deployment.error,
          stage: 'post-deployment-verification',
        });
        return deployment;
      }

      // Stage 4: Complete deployment
      deployment.status = 'completed';
      deployment.completedAt = new Date();
      deployment.updatedAt = new Date();
      await this.historyService.updateDeployment(deployment.id, {
        status: deployment.status,
        completedAt: deployment.completedAt,
        updatedAt: deployment.updatedAt,
      });
      await this.publishEvent(DeployEvents.DEPLOYMENT_COMPLETED, {
        deploymentId: deployment.id,
        appName: deployment.appName,
        version: deployment.version,
        environment: deployment.environment,
        duration: deployment.completedAt.getTime() - deployment.startedAt.getTime(),
      });

      return deployment;
    } catch (error: any) {
      deployment.status = 'failed';
      deployment.error = error.message;
      deployment.completedAt = new Date();
      deployment.updatedAt = new Date();
      await this.historyService.updateDeployment(deployment.id, {
        status: deployment.status,
        error: deployment.error,
        completedAt: deployment.completedAt,
        updatedAt: deployment.updatedAt,
      });
      await this.publishEvent(DeployEvents.DEPLOYMENT_FAILED, {
        deploymentId: deployment.id,
        error: deployment.error,
      });
      return deployment;
    }
  }

  /**
   * Execute a specific stage
   */
  async executeStage(
    deploymentId: string,
    stageIndex: number
  ): Promise<{ success: boolean; stage?: DeploymentStage }> {
    const deployment = await this.historyService.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' not found`);
    }

    if (stageIndex < 0 || stageIndex >= deployment.stages.length) {
      throw new Error(
        `Stage index ${stageIndex} out of range. Valid range: 0-${deployment.stages.length - 1}`
      );
    }

    const stage = deployment.stages[stageIndex];

    // Update stage status
    stage.status = 'running';
    stage.startedAt = new Date();
    deployment.currentStageIndex = stageIndex;
    await this.historyService.updateDeployment(deploymentId, {
      stages: deployment.stages,
      currentStageIndex: deployment.currentStageIndex,
    });

    // Execute stage steps
    for (const step of stage.steps) {
      step.status = 'running';
      step.startedAt = new Date();

      try {
        // Simulate step execution
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 50) + 10)
        );
        step.status = 'completed';
        step.completedAt = new Date();
      } catch (error: any) {
        step.status = 'failed';
        step.error = error.message;
        step.completedAt = new Date();
        stage.status = 'failed';
        stage.error = error.message;
        stage.completedAt = new Date();
        await this.historyService.updateDeployment(deploymentId, {
          stages: deployment.stages,
        });
        return { success: false, stage };
      }
    }

    stage.status = 'completed';
    stage.completedAt = new Date();
    await this.historyService.updateDeployment(deploymentId, {
      stages: deployment.stages,
    });

    // Publish stage completed event
    await this.publishEvent(DeployEvents.DEPLOYMENT_STAGE_COMPLETED, {
      deploymentId,
      stageName: stage.name,
      stageIndex,
    });

    return { success: true, stage };
  }

  /**
   * Verify a deployment
   */
  async verifyDeployment(
    deploymentId: string
  ): Promise<{ success: boolean; report?: VerificationReport }> {
    const deployment = await this.historyService.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' not found`);
    }

    const report = await this.verifier.generateVerificationReport(deployment);

    // Update stages with verification info
    const verifyStage: DeploymentStage = {
      name: 'verification',
      status: report.overallStatus === 'pass' ? 'completed' : 'failed',
      steps: [
        {
          name: 'health-check',
          status: (report.healthChecks.every((h) => h.passed)
            ? 'completed'
            : 'failed') as DeploymentStepStatus,
          message: `Health checks: ${report.healthChecks.filter((h) => h.passed).length}/${report.healthChecks.length} passed`,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        {
          name: 'metric-verification',
          status: (report.metrics.every((m) => m.passed)
            ? 'completed'
            : 'failed') as DeploymentStepStatus,
          message: `Metrics: ${report.metrics.filter((m) => m.passed).length}/${report.metrics.length} passed`,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ],
      startedAt: new Date(),
      completedAt: new Date(),
    };

    deployment.stages.push(verifyStage);
    await this.historyService.updateDeployment(deploymentId, {
      stages: deployment.stages,
    });

    return {
      success: report.overallStatus === 'pass',
      report,
    };
  }

  /**
   * Complete a deployment
   */
  async completeDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.historyService.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' not found`);
    }

    deployment.status = 'completed';
    deployment.completedAt = new Date();
    deployment.updatedAt = new Date();

    await this.historyService.updateDeployment(deploymentId, {
      status: deployment.status,
      completedAt: deployment.completedAt,
      updatedAt: deployment.updatedAt,
    });

    await this.publishEvent(DeployEvents.DEPLOYMENT_COMPLETED, {
      deploymentId,
      appName: deployment.appName,
      version: deployment.version,
      environment: deployment.environment,
    });

    return deployment;
  }

  // ==================== Private Methods ====================

  /**
   * Execute pre-deployment checks
   */
  private async executePreDeploymentChecks(
    deployment: Deployment,
    config: DeployConfig
  ): Promise<{ success: boolean; error?: string }> {
    // Step 0: Check if target environment is locked
    if (this.lockService) {
      try {
        const lockCheck = await this.lockService.checkDeploymentAllowed(deployment.environment);
        if (!lockCheck.allowed) {
          return {
            success: false,
            error: `Deployment blocked: ${lockCheck.reason}`,
          };
        }
      } catch (error: any) {
        // If the environment lookup fails, log but don't block
        logger.warn(`[DeploymentWorkflow] Environment lock check failed: ${error.message}`);
      }
    }

    // Create pre-check stage
    const preCheckStage: DeploymentStage = {
      name: 'pre-deployment-checks',
      status: 'running',
      steps: [
        {
          name: 'validate-configuration',
          status: 'running' as DeploymentStepStatus,
          startedAt: new Date(),
        },
        {
          name: 'check-dependencies',
          status: 'pending' as DeploymentStepStatus,
        },
        {
          name: 'check-resource-availability',
          status: 'pending' as DeploymentStepStatus,
        },
      ],
      startedAt: new Date(),
    };

    deployment.stages.push(preCheckStage);
    await this.historyService.updateDeployment(deployment.id, {
      stages: deployment.stages,
    });

    // Step 1: Validate configuration
    try {
      const configValid = this.validateConfig(config);
      if (!configValid) {
        preCheckStage.steps[0].status = 'failed';
        preCheckStage.steps[0].error = 'Invalid deployment configuration';
        preCheckStage.steps[0].completedAt = new Date();
        preCheckStage.status = 'failed';
        preCheckStage.error = 'Invalid deployment configuration';
        preCheckStage.completedAt = new Date();
        await this.historyService.updateDeployment(deployment.id, {
          stages: deployment.stages,
        });
        return {
          success: false,
          error: 'Invalid deployment configuration',
        };
      }

      preCheckStage.steps[0].status = 'completed';
      preCheckStage.steps[0].completedAt = new Date();
    } catch (error: any) {
      preCheckStage.steps[0].status = 'failed';
      preCheckStage.steps[0].error = error.message;
      preCheckStage.steps[0].completedAt = new Date();
      preCheckStage.status = 'failed';
      preCheckStage.error = error.message;
      preCheckStage.completedAt = new Date();
      await this.historyService.updateDeployment(deployment.id, {
        stages: deployment.stages,
      });
      return { success: false, error: error.message };
    }

    // Step 2: Check dependencies
    preCheckStage.steps[1].status = 'running';
    preCheckStage.steps[1].startedAt = new Date();

    try {
      // In production, this would check CMDB for dependency health
      await new Promise((resolve) =>
        setTimeout(resolve, Math.floor(Math.random() * 30) + 10)
      );
      preCheckStage.steps[1].status = 'completed';
      preCheckStage.steps[1].completedAt = new Date();
    } catch (error: any) {
      preCheckStage.steps[1].status = 'failed';
      preCheckStage.steps[1].error = error.message;
      preCheckStage.steps[1].completedAt = new Date();
      preCheckStage.status = 'failed';
      preCheckStage.error = error.message;
      preCheckStage.completedAt = new Date();
      await this.historyService.updateDeployment(deployment.id, {
        stages: deployment.stages,
      });
      return { success: false, error: `Dependency check failed: ${error.message}` };
    }

    // Step 3: Check resource availability
    preCheckStage.steps[2].status = 'running';
    preCheckStage.steps[2].startedAt = new Date();

    try {
      // In production, this would check Kubernetes/infrastructure resources
      await new Promise((resolve) =>
        setTimeout(resolve, Math.floor(Math.random() * 30) + 10)
      );
      preCheckStage.steps[2].status = 'completed';
      preCheckStage.steps[2].completedAt = new Date();
    } catch (error: any) {
      preCheckStage.steps[2].status = 'failed';
      preCheckStage.steps[2].error = error.message;
      preCheckStage.steps[2].completedAt = new Date();
      preCheckStage.status = 'failed';
      preCheckStage.error = error.message;
      preCheckStage.completedAt = new Date();
      await this.historyService.updateDeployment(deployment.id, {
        stages: deployment.stages,
      });
      return { success: false, error: `Resource check failed: ${error.message}` };
    }

    // All pre-checks passed
    preCheckStage.status = 'completed';
    preCheckStage.completedAt = new Date();
    await this.historyService.updateDeployment(deployment.id, {
      stages: deployment.stages,
    });

    return { success: true };
  }

  /**
   * Execute the deployment strategy
   */
  private async executeDeployment(
    deployment: Deployment,
    config: DeployConfig
  ): Promise<{ stages: DeploymentStage[]; success: boolean }> {
    const strategyConfig = config.strategyConfig || {
      type: deployment.strategy,
    };

    return this.strategyEngine.executeStrategy(
      deployment.strategy,
      strategyConfig,
      deployment.appName,
      deployment.version,
      deployment.environment,
      config.healthCheck
    );
  }

  /**
   * Execute post-deployment verification
   */
  private async executePostDeploymentVerification(
    deployment: Deployment,
    config: DeployConfig
  ): Promise<{ success: boolean }> {
    const { success, report } = await this.verifyDeployment(deployment.id);

    if (!success) {
      return { success: false };
    }

    return { success: true };
  }

  /**
   * Handle deployment failure with potential auto-rollback
   */
  private async handleDeploymentFailure(
    deployment: Deployment,
    config: DeployConfig
  ): Promise<{ deployment: Deployment; rolledBack: boolean }> {
    try {
      // Trigger rollback
      const rollbackInfo = await this.rollbackService.triggerRollback(
        deployment,
        `Auto-rollback triggered: deployment failed at stage '${deployment.stages[deployment.stages.length - 1]?.name || 'unknown'}'`,
        config.initiatedBy
      );

      // Execute rollback
      const rollbackResult = await this.rollbackService.executeRollback(
        deployment,
        rollbackInfo
      );

      deployment = rollbackResult.deployment;

      await this.publishEvent(DeployEvents.DEPLOYMENT_ROLLED_BACK, {
        deploymentId: deployment.id,
        rollbackId: rollbackInfo.id,
        reason: rollbackInfo.reason,
      });

      return { deployment, rolledBack: true };
    } catch (error: any) {
      deployment.status = 'failed';
      deployment.error = `Deployment failed and rollback also failed: ${error.message}`;
      deployment.completedAt = new Date();
      deployment.updatedAt = new Date();
      await this.historyService.updateDeployment(deployment.id, {
        status: deployment.status,
        error: deployment.error,
        completedAt: deployment.completedAt,
        updatedAt: deployment.updatedAt,
      });
      return { deployment, rolledBack: false };
    }
  }

  /**
   * Validate deployment configuration
   */
  private validateConfig(config: DeployConfig): boolean {
    if (!config.appName || !config.version || !config.environment) {
      return false;
    }

    const validStrategies = ['blue-green', 'canary', 'rolling', 'recreate'];
    if (config.strategy && !validStrategies.includes(config.strategy)) {
      return false;
    }

    return true;
  }

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
          `[DeploymentWorkflow] Failed to publish event ${type}:`,
          error
        );
      }
    }
  }

  /**
   * Get the history service (for external access)
   */
  getHistoryService(): DeploymentHistoryService {
    return this.historyService;
  }

  /**
   * Get the rollback service (for external access)
   */
  getRollbackService(): RollbackService {
    return this.rollbackService;
  }
}
