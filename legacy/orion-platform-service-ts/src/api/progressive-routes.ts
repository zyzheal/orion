/**
 * Progressive Service API Routes
 *
 * Public REST API for stage-based progressive deployments.
 * Maps "feature" terminology to progressive deployment concepts:
 *   feature = progressive deployment (deployment_id)
 *
 * Routes (mounted under /api/v1/progressive):
 *   GET    /features              - List progressive deployments (features)
 *   POST   /features              - Create a progressive deployment (feature)
 *   GET    /features/:id/status   - Get rollout status
 *   DELETE /features/:id          - Delete feature
 *   POST   /features/:id/advance  - Advance to the next stage
 *   POST   /features/:id/rollback - Rollback deployment
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ProgressiveDeployRepository, ProgressiveDeployService } from '../services/deploy';
import { DeployRepository } from '../services/deploy/DeployRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { ValidationError, NotFoundError, handleError } from '../errors';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { Deployment } from '../services/deploy/DeployRepository';

const logger = createLogger('progressive-routes');

interface ProgressiveRoutesOptions {
  database?: DatabasePool;
}

export default async function progressiveRoutes(
  app: FastifyInstance,
  options: ProgressiveRoutesOptions
): Promise<void> {
  const db = options.database;
  if (!db) {
    logger.warn('[ProgressiveRoutes] No database pool provided, routes will not be functional');
    return;
  }

  // Initialize services
  const progressiveRepo = new ProgressiveDeployRepository(db);
  const deployRepo = new DeployRepository(db);
  const stageBasedService = new ProgressiveDeployService(progressiveRepo, deployRepo);

  // ==================== Feature CRUD ====================

  /**
   * GET /features - List all progressive deployments (features) for the current tenant
   */
  app.get('/features', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getCurrentTenantId();
      const limit = parseInt((request.query as any).limit as string) || 50;

      const stageDeployments = await deployRepo.findAll({ tenantId, limit });

      const features = await Promise.all(
        stageDeployments.map(async (stage: Deployment) => {
          const progress = await stageBasedService.getProgress(stage.id, stage.id);
          return {
            id: stage.id,
            type: 'stage-based',
            phase: progress.status,
            strategy: 'staged',
            currentTrafficPercent: progress.overallPercent,
            targetTrafficPercent: 100,
            totalStages: progress.totalStages,
            completedStages: progress.completedStages,
            failedStages: progress.failedStages,
            status: progress.status,
            startedAt: stage.created_at,
            stages: progress.stages.map((s) => ({
              id: s.id,
              name: s.stage_name,
              order: s.stage_order,
              trafficPercent: s.traffic_percent,
              status: s.status,
            })),
          };
        })
      );

      return reply.send({ features });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /features - Create a progressive deployment (feature flag rollout)
   * Body: { deploymentId, stages?: Array<{ stage_name, stage_order, traffic_percent, instance_count?, auto_promote? }> }
   */
  app.post('/features', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getCurrentTenantId();
      const body = request.body as {
        deploymentId: string;
        stages: Array<{
          stage_name: string;
          stage_order: number;
          traffic_percent: number;
          instance_count?: number;
          auto_promote?: boolean;
        }>;
      };

      if (!body.deploymentId) {
        throw new ValidationError('deploymentId is required');
      }

      if (!body.stages || body.stages.length === 0) {
        throw new ValidationError('stages array is required');
      }

      const result = await stageBasedService.createProgressiveDeploy({
        tenant_id: tenantId,
        deployment_id: body.deploymentId,
        stages: body.stages,
      });

      return reply.status(201).send({
        feature: {
          id: result.deploymentId,
          type: 'stage-based',
          strategy: 'staged',
          stages: result.stages,
        },
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * GET /features/:id/status - Get rollout status
   */
  app.get('/features/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const featureId = (request.params as any).id;

      const stages = await progressiveRepo.findByDeployment(featureId);
      if (stages.length === 0) {
        throw new NotFoundError('Feature', featureId);
      }

      const progress = await stageBasedService.getProgress(
        getCurrentTenantId(),
        featureId
      );

      return reply.send({
        feature: {
          id: featureId,
          type: 'stage-based',
          status: progress.status,
          overallPercent: progress.overallPercent,
          totalStages: progress.totalStages,
          completedStages: progress.completedStages,
          failedStages: progress.failedStages,
          currentStage: progress.currentStage,
          stages: progress.stages,
        },
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * DELETE /features/:id - Delete feature (cancel progressive deployment)
   */
  app.delete('/features/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getCurrentTenantId();
      const featureId = (request.params as any).id;

      const stages = await progressiveRepo.findByDeployment(featureId);
      for (const stage of stages) {
        if (stage.status === 'pending' || stage.status === 'running') {
          await progressiveRepo.update(stage.id, { status: 'skipped' });
        }
      }

      return reply.send({ message: `Feature ${featureId} deleted successfully` });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ==================== Stage Operations ====================

  /**
   * POST /features/:id/advance - Advance to the next stage (stage-based progressive deployment)
   * Body: { validationResult? }
   */
  app.post('/features/:id/advance', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getCurrentTenantId();
      const featureId = (request.params as any).id;
      const body = request.body as { validationResult?: Record<string, any>; stageId?: string };

      const stages = await progressiveRepo.findByDeployment(featureId);
      if (stages.length === 0) {
        throw new NotFoundError('Feature', featureId);
      }

      const targetStageId = body.stageId || stages.find((s) => s.status === 'running')?.id;
      if (!targetStageId) {
        throw new ValidationError('No running stage found to advance');
      }

      const result = await stageBasedService.advanceStage(
        tenantId,
        featureId,
        targetStageId,
        body.validationResult
      );

      return reply.send({
        message: result.message,
        previousStage: result.previousStage,
        nextStage: result.nextStage,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  /**
   * POST /features/:id/rollback - Rollback deployment
   * Body: { reason? }
   */
  app.post('/features/:id/rollback', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = getCurrentTenantId();
      const featureId = (request.params as any).id;
      const body = request.body as { reason?: string; stageId?: string };
      const reason = body.reason || 'Manual rollback triggered by user';

      const stages = await progressiveRepo.findByDeployment(featureId);
      if (stages.length === 0) {
        throw new NotFoundError('Feature', featureId);
      }

      const runningStage = stages.find((s) => s.status === 'running') || stages[stages.length - 1];

      const result = await stageBasedService.rollback(
        tenantId,
        featureId,
        runningStage.id,
        reason
      );

      return reply.send({
        message: result.message,
        rolledBackStage: result.rolledBackStage,
        targetStage: result.targetStage,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
