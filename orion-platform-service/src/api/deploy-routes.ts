/**
 * Smart Deployment API Routes
 *
 * Provides endpoints for deployment execution, status tracking,
 * history queries, rollback operations, and metrics.
 *
 * TASK-701: Smart Deployment (智能部署)
 * Prefix: /api/v1/deploy
 *
 * Updated: Migrated DeployService to PostgreSQL Repository pattern.
 * DeployRepository + DeployService are used for CRUD operations,
 * while SmartDeployService handles complex deployment orchestration
 * with database-backed history tracking.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { SmartDeployService } from '../services/smart-deploy/SmartDeployService';
import { DeployController } from './controllers/DeployController';
import { DeployService } from '../services/deploy/DeployService';
import { DeployRepository } from '../services/deploy/DeployRepository';
import { ProgressiveDeploymentService, ProgressiveDeployConfig } from '../services/deploy/ProgressiveDeploymentService';

/**
 * Options passed to deploy routes via app.register()
 * Follows the same pattern as tenant-routes.ts, cost-routes.ts, etc.
 */
interface DeployRoutesOptions {
  database?: DatabasePool;
}

export default async function deployRoutes(
  app: FastifyInstance,
  options: DeployRoutesOptions
): Promise<void> {
  // ==================== PostgreSQL-backed DeployService ====================

  // Initialize database-backed DeployService via Repository pattern
  let deployService: DeployService | null = null;
  if (options.database) {
    const deployRepository = new DeployRepository(options.database);
    deployService = new DeployService(deployRepository);
    console.log('[DeployRoutes] Database-backed DeployService initialized');
  } else {
    console.warn('[DeployRoutes] Database not available, DeployService routes will not be functional');
  }

  // ==================== SmartDeployService with DB-backed history ====================

  // Initialize smart deploy service with database-backed components
  const smartDeployService = new SmartDeployService(options.database || null);
  const deployController = new DeployController(smartDeployService);

  // ==================== ProgressiveDeploymentService (Traffic-based) ====================

  // Initialize simplified progressive deployment service
  const progressiveDeploymentService = new ProgressiveDeploymentService();

  // ==================== Smart Deployment Routes (orchestration, history, rollback) ====================

  // POST /deploy - Create and execute a deployment (main entry point)
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.deploy(request, reply);
  });

  // GET /deploy/:id - Get deployment status
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.getStatus(request, reply);
  });

  // GET /deploy/history - Get deployment history
  app.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.getHistory(request, reply);
  });

  // GET /deploy/metrics - Get deployment metrics
  app.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.getMetrics(request, reply);
  });

  // GET /deploy/:id/audit - Get audit trail for a deployment
  app.get(
    '/:id/audit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.getAuditTrail(request, reply);
    }
  );

  // POST /deploy/:id/rollback - Trigger rollback
  app.post(
    '/:id/rollback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.rollback(request, reply);
    }
  );

  // GET /deploy/:id/rollbacks - Get rollback history
  app.get(
    '/:id/rollbacks',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.getRollbackHistory(request, reply);
    }
  );

  // POST /deploy/:id/cancel - Cancel a deployment
  app.post(
    '/:id/cancel',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.cancel(request, reply);
    }
  );

  // GET /deploy/latest/:appName/:environment - Get latest deployment
  app.get(
    '/latest/:appName/:environment',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.getLatestDeployment(request, reply);
    }
  );

  // ==================== PostgreSQL-backed DeployService CRUD Routes ====================
  // These routes use DeployService for direct CRUD operations on deployment records.
  // A2 Fix: Removed duplicate routes that conflicted with SmartDeploy routes above.
  // Only kept non-conflicting utility routes (list, search, stats).

  // GET /deploy/list - List deployments with pagination
  app.get('/list', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    const { page = '1', limit = '20', tenantId, projectId, environment, status } =
      request.query as Record<string, string>;

    try {
      const result = await deployService.listDeployments({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        tenantId,
        projectId,
        environment,
        status,
      });
      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'LIST_ERROR',
        message: error.message,
      });
    }
  });

  // GET /deploy/build/:buildId - Get deployments by build ID
  app.get(
    '/build/:buildId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!deployService) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database not available',
        });
      }

      const { buildId } = request.params as { buildId: string };

      try {
        const deployments = await deployService.getDeploymentsByBuild(buildId);
        return reply.send({ data: deployments, total: deployments.length });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'GET_ERROR',
          message: error.message,
        });
      }
    }
  );

  // GET /deploy/environments/:tenantId - Get environments with deployments
  app.get(
    '/environments/:tenantId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!deployService) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database not available',
        });
      }

      const { tenantId } = request.params as { tenantId: string };

      try {
        const environments = await deployService.getEnvironments(tenantId);
        return reply.send({ environments });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'GET_ERROR',
          message: error.message,
        });
      }
    }
  );

  // GET /deploy/stats - Get deployment statistics
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    const { tenantId } = request.query as { tenantId?: string };

    try {
      const stats = await deployService.getDeployStats(tenantId);
      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({
        error: 'STATS_ERROR',
        message: error.message,
      });
    }
  });

  // ==================== Progressive Deployment Routes (Traffic-based) ====================
  // Routes for real-time traffic control and auto-rollback

  // POST /deploy/:id/progressive/start - Start a progressive deployment
  app.post(
    '/:id/progressive/start',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<ProgressiveDeployConfig>;

      try {
        const config: ProgressiveDeployConfig = {
          strategy: body.strategy || 'canary',
          initialTrafficPercent: body.initialTrafficPercent || 10,
          incrementPercent: body.incrementPercent || 10,
          incrementIntervalSeconds: body.incrementIntervalSeconds || 60,
          autoRollback: body.autoRollback !== false,
          rollbackThreshold: body.rollbackThreshold || 5,
          healthCheckEndpoint: body.healthCheckEndpoint,
        };

        const result = await progressiveDeploymentService.startProgressiveDeploy(id, config);
        return reply.send(result);
      } catch (error: any) {
        const errorCode = error.code || 'PROGRESSIVE_START_ERROR';
        return reply.status(400).send({
          error: errorCode,
          message: error.message,
        });
      }
    }
  );

  // POST /deploy/:id/progressive/increment - Increment traffic
  app.post(
    '/:id/progressive/increment',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<ProgressiveDeployConfig>;

      try {
        const config: ProgressiveDeployConfig = {
          strategy: body.strategy || 'canary',
          initialTrafficPercent: body.initialTrafficPercent || 10,
          incrementPercent: body.incrementPercent || 10,
          incrementIntervalSeconds: body.incrementIntervalSeconds || 60,
          autoRollback: body.autoRollback !== false,
          rollbackThreshold: body.rollbackThreshold || 5,
          healthCheckEndpoint: body.healthCheckEndpoint,
        };

        const status = await progressiveDeploymentService.incrementTraffic(id, config);
        if (!status) {
          return reply.status(404).send({
            error: 'DEPLOYMENT_NOT_FOUND',
            message: `No active progressive deployment found for ${id}`,
          });
        }
        return reply.send(status);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'PROGRESSIVE_INCREMENT_ERROR',
          message: error.message,
        });
      }
    }
  );

  // GET /deploy/:id/progressive/status - Get progressive deployment status
  app.get(
    '/:id/progressive/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const status = await progressiveDeploymentService.getStatus(id);
      if (!status) {
        return reply.status(404).send({
          error: 'DEPLOYMENT_NOT_FOUND',
          message: `No active progressive deployment found for ${id}`,
        });
      }
      return reply.send(status);
    }
  );

  // POST /deploy/:id/progressive/abort - Abort and rollback deployment
  app.post(
    '/:id/progressive/abort',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const success = await progressiveDeploymentService.abortDeployment(id);
      if (!success) {
        return reply.status(404).send({
          error: 'DEPLOYMENT_NOT_FOUND',
          message: `No active progressive deployment found for ${id}`,
        });
      }
      return reply.send({ success: true, deploymentId: id, message: 'Deployment aborted and rolled back' });
    }
  );

  // GET /deploy/progressive/active - List all active progressive deployments
  app.get(
    '/progressive/active',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const active = await progressiveDeploymentService.listActiveDeployments();
      return reply.send({ deployments: active, total: active.length });
    }
  );
}
