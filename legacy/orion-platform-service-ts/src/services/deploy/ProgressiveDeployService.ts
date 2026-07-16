/**
 * ProgressiveDeployService - Business logic for Progressive (staged) deployments
 *
 * Manages multi-stage deployments with increasing traffic percentages,
 * stage advancement, rollback, and progress tracking.
 */

import {
  ProgressiveDeployRepository,
  ProgressiveStage,
  CreateProgressiveStageInput,
} from './ProgressiveDeployRepository';
import { DeployRepository } from './DeployRepository';

export interface ProgressiveStageInput {
  stage_name: string;
  stage_order: number;
  traffic_percent: number;
  instance_count?: number;
  auto_promote?: boolean;
}

export interface CreateProgressiveDeployInput {
  tenant_id: string;
  deployment_id: string;
  stages: ProgressiveStageInput[];
}

export interface DeployProgress {
  deploymentId: string;
  totalStages: number;
  currentStage: ProgressiveStage | null;
  completedStages: number;
  failedStages: number;
  stages: ProgressiveStage[];
  overallPercent: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
}

export class ProgressiveDeployServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ProgressiveDeployServiceError';
  }
}

export class ProgressiveDeployService {
  private repository: ProgressiveDeployRepository;
  private deployRepository: DeployRepository | null;

  constructor(
    repository: ProgressiveDeployRepository,
    deployRepository?: DeployRepository
  ) {
    this.repository = repository;
    this.deployRepository = deployRepository || null;
  }

  // ==================== Progressive Deploy Lifecycle ====================

  /**
   * Create a progressive deployment with multiple stages
   */
  async createProgressiveDeploy(input: CreateProgressiveDeployInput): Promise<{
    deploymentId: string;
    stages: ProgressiveStage[];
  }> {
    const { tenant_id, deployment_id, stages } = input;

    if (!stages || stages.length === 0) {
      throw new ProgressiveDeployServiceError(
        'At least one stage is required',
        'NO_STAGES'
      );
    }

    // Verify deployment exists
    if (this.deployRepository) {
      const deployment = await this.deployRepository.findById(deployment_id);
      if (!deployment) {
        throw new ProgressiveDeployServiceError(
          `Deployment not found: ${deployment_id}`,
          'DEPLOY_NOT_FOUND'
        );
      }

      // Verify tenant owns the deployment
      if (deployment.tenant_id !== tenant_id) {
        throw new ProgressiveDeployServiceError(
          'Deployment does not belong to this tenant',
          'TENANT_MISMATCH'
        );
      }
    }

    // Validate stage ordering
    const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);
    for (let i = 0; i < sortedStages.length; i++) {
      if (sortedStages[i].stage_order !== i) {
        // Auto-correct stage order
        sortedStages[i].stage_order = i;
      }
    }

    // Validate traffic percentages are increasing
    for (let i = 1; i < sortedStages.length; i++) {
      if (sortedStages[i].traffic_percent < sortedStages[i - 1].traffic_percent) {
        throw new ProgressiveDeployServiceError(
          `Stage ${sortedStages[i].stage_name} traffic_percent (${sortedStages[i].traffic_percent}%) must be >= previous stage (${sortedStages[i - 1].traffic_percent}%)`,
          'INVALID_TRAFFIC_ORDER'
        );
      }
    }

    // Create all stages
    const createInputs: CreateProgressiveStageInput[] = sortedStages.map(stage => ({
      tenant_id,
      deployment_id,
      stage_name: stage.stage_name,
      stage_order: stage.stage_order,
      traffic_percent: stage.traffic_percent,
      instance_count: stage.instance_count,
      auto_promote: stage.auto_promote,
    }));

    const createdStages = await this.repository.createMany(createInputs);

    // Auto-start the first stage
    if (createdStages.length > 0) {
      await this.repository.update(createdStages[0].id, {
        status: 'running',
        started_at: new Date(),
      });
    }

    return {
      deploymentId: deployment_id,
      stages: createdStages,
    };
  }

  /**
   * Advance to the next stage
   */
  async advanceStage(
    tenantId: string,
    deployId: string,
    stageId: string,
    validationResult?: Record<string, any>
  ): Promise<{
    previousStage: ProgressiveStage;
    nextStage: ProgressiveStage | null;
    message: string;
  }> {
    // Verify the current stage belongs to this deployment and tenant
    const currentStage = await this.repository.findById(stageId);
    if (!currentStage) {
      throw new ProgressiveDeployServiceError(
        `Stage not found: ${stageId}`,
        'STAGE_NOT_FOUND'
      );
    }

    if (currentStage.deployment_id !== deployId) {
      throw new ProgressiveDeployServiceError(
        'Stage does not belong to this deployment',
        'STAGE_MISMATCH'
      );
    }

    if (currentStage.tenant_id !== tenantId) {
      throw new ProgressiveDeployServiceError(
        'Stage does not belong to this tenant',
        'TENANT_MISMATCH'
      );
    }

    if (currentStage.status !== 'running') {
      throw new ProgressiveDeployServiceError(
        `Stage is not running (current status: ${currentStage.status})`,
        'STAGE_NOT_RUNNING'
      );
    }

    // Mark current stage as completed
    await this.repository.update(stageId, {
      status: 'completed',
      completed_at: new Date(),
      validation_result: validationResult || {},
    });

    const completedStage = (await this.repository.findById(stageId))!;

    // Find and start the next pending stage
    const nextStage = await this.repository.findNextPendingStage(deployId);
    if (nextStage) {
      await this.repository.update(nextStage.id, {
        status: 'running',
        started_at: new Date(),
      });

      return {
        previousStage: completedStage,
        nextStage: await this.repository.findById(nextStage.id)!,
        message: `Advanced from "${completedStage.stage_name}" to "${nextStage.stage_name}" (${nextStage.traffic_percent}% traffic)`,
      };
    }

    return {
      previousStage: completedStage,
      nextStage: null,
      message: `Stage "${completedStage.stage_name}" completed. No more stages remaining.`,
    };
  }

  /**
   * Rollback to previous stage or mark deployment as failed
   */
  async rollback(
    tenantId: string,
    deployId: string,
    stageId: string,
    reason: string
  ): Promise<{
    rolledBackStage: ProgressiveStage;
    targetStage: ProgressiveStage | null;
    message: string;
  }> {
    // Verify stage
    const currentStage = await this.repository.findById(stageId);
    if (!currentStage) {
      throw new ProgressiveDeployServiceError(
        `Stage not found: ${stageId}`,
        'STAGE_NOT_FOUND'
      );
    }

    if (currentStage.deployment_id !== deployId) {
      throw new ProgressiveDeployServiceError(
        'Stage does not belong to this deployment',
        'STAGE_MISMATCH'
      );
    }

    if (currentStage.tenant_id !== tenantId) {
      throw new ProgressiveDeployServiceError(
        'Stage does not belong to this tenant',
        'TENANT_MISMATCH'
      );
    }

    // Mark current stage as failed
    await this.repository.update(stageId, {
      status: 'failed',
      validation_result: { rollback_reason: reason },
      completed_at: new Date(),
    });

    const failedStage = (await this.repository.findById(stageId))!;

    // Find previous completed stage to rollback to
    const previousStage = await this.repository.findPreviousCompletedStage(
      deployId,
      currentStage.stage_order
    );

    if (previousStage) {
      // Re-activate previous stage
      await this.repository.update(previousStage.id, {
        status: 'running',
        started_at: new Date(),
      });

      // Skip all stages after the previous one
      const allStages = await this.repository.findByDeployment(deployId);
      for (const stage of allStages) {
        if (stage.stage_order > previousStage.stage_order && stage.id !== stageId) {
          await this.repository.update(stage.id, { status: 'skipped' });
        }
      }

      const reactivatedStage = await this.repository.findById(previousStage.id)!;
      return {
        rolledBackStage: failedStage,
        targetStage: reactivatedStage,
        message: `Rolled back from "${failedStage.stage_name}" to "${previousStage.stage_name}". Reason: ${reason}`,
      };
    }

    // No previous stage to rollback to - mark deployment as rolled back
    // Skip all pending stages
    const allStages = await this.repository.findByDeployment(deployId);
    for (const stage of allStages) {
      if (stage.status === 'pending' || stage.status === 'running') {
        await this.repository.update(stage.id, { status: 'skipped' });
      }
    }

    return {
      rolledBackStage: failedStage,
      targetStage: null,
      message: `Stage "${failedStage.stage_name}" failed. No previous stage to rollback to. Reason: ${reason}`,
    };
  }

  /**
   * Get deployment progress
   */
  async getProgress(tenantId: string, deployId: string): Promise<DeployProgress> {
    const stages = await this.repository.findByDeployment(deployId);

    if (stages.length === 0) {
      throw new ProgressiveDeployServiceError(
        `No progressive stages found for deployment: ${deployId}`,
        'NO_STAGES'
      );
    }

    const counts = await this.repository.countByDeployment(deployId);
    const currentStage = await this.repository.findCurrentStage(deployId);

    // Calculate overall progress
    let overallPercent = 0;
    if (stages.length > 0) {
      const lastStage = stages[stages.length - 1];
      if (currentStage) {
        overallPercent = currentStage.traffic_percent;
      } else if (counts.completed === counts.total) {
        overallPercent = lastStage.traffic_percent;
      } else if (counts.completed > 0) {
        const lastCompleted = stages.find(s => s.status === 'completed');
        if (lastCompleted) {
          overallPercent = lastCompleted.traffic_percent;
        }
      }
    }

    // Determine overall status
    let status: DeployProgress['status'] = 'pending';
    if (counts.failed > 0) {
      status = 'failed';
    } else if (counts.completed === counts.total) {
      status = 'completed';
    } else if (counts.running > 0) {
      status = 'in_progress';
    }

    return {
      deploymentId: deployId,
      totalStages: counts.total,
      currentStage,
      completedStages: counts.completed,
      failedStages: counts.failed,
      stages,
      overallPercent,
      status,
    };
  }
}
