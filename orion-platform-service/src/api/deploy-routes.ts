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
import { DeployRepository } from '../services/deploy/DeployRepository';
import { DeployService } from '../services/deploy/DeployService';
import { DeploymentHistoryService } from '../services/smart-deploy/DeploymentHistoryService';
import { RollbackService } from '../services/smart-deploy/RollbackService';
import { DeploymentVerifier } from '../services/smart-deploy/DeploymentVerifier';

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

  // Initialize history service with database for persistent deployment records
  const historyService = options.database
    ? new DeploymentHistoryService(options.database)
    : new DeploymentHistoryService();

  // Initialize rollback service with database for persistent rollback records
  const rollbackService = new RollbackService({ db: options.database });

  // Initialize verifier
  const verifier = new DeploymentVerifier();

  // Initialize smart deploy service with database-backed components
  const smartDeployService = new SmartDeployService({
    historyService,
    rollbackService,
    verifier,
  });
  const deployController = new DeployController(smartDeployService);

  // ==================== Smart Deployment Routes (existing) ====================

  // POST /deploy - Create and execute a deployment
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

  // GET /deploy/:deployId - Get deployment by ID (PostgreSQL-backed)
  app.get('/:deployId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    const { deployId } = request.params as { deployId: string };

    try {
      const deployment = await deployService.getDeployment(deployId);
      return reply.send(deployment);
    } catch (error: any) {
      if (error.code === 'DEPLOY_NOT_FOUND') {
        return reply.status(404).send({
          error: 'DEPLOY_NOT_FOUND',
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'GET_ERROR',
        message: error.message,
      });
    }
  });

  // POST /deploy - Create a new deployment record
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!deployService) {
      return reply.status(503).send({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not available',
      });
    }

    const body = request.body as {
      tenant_id: string;
      project_id?: string;
      pipeline_run_id?: string;
      build_id?: string;
      environment: string;
      strategy?: string;
      config?: Record<string, any>;
      deployed_by?: string;
    };

    try {
      const deployment = await deployService.createDeployment(body);
      return reply.status(201).send(deployment);
    } catch (error: any) {
      if (error.code === 'INVALID_INPUT') {
        return reply.status(400).send({
          error: error.code,
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'CREATE_ERROR',
        message: error.message,
      });
    }
  });

  // POST /deploy/:deployId/start - Start a pending deployment
  app.post(
    '/:deployId/start',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!deployService) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database not available',
        });
      }

      const { deployId } = request.params as { deployId: string };
      const body = request.body as { actorId?: string };

      try {
        const deployment = await deployService.startDeployment(
          deployId,
          body?.actorId
        );
        return reply.send(deployment);
      } catch (error: any) {
        if (error.code === 'DEPLOY_NOT_FOUND') {
          return reply.status(404).send({
            error: 'DEPLOY_NOT_FOUND',
            message: error.message,
          });
        }
        if (error.code === 'INVALID_STATE') {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'START_ERROR',
          message: error.message,
        });
      }
    }
  );

  // POST /deploy/:deployId/cancel - Cancel a deployment
  app.post(
    '/:deployId/cancel',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!deployService) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database not available',
        });
      }

      const { deployId } = request.params as { deployId: string };
      const body = request.body as { actorId?: string };

      try {
        const deployment = await deployService.cancelDeployment(
          deployId,
          body?.actorId
        );
        return reply.send(deployment);
      } catch (error: any) {
        if (error.code === 'DEPLOY_NOT_FOUND') {
          return reply.status(404).send({
            error: 'DEPLOY_NOT_FOUND',
            message: error.message,
          });
        }
        if (error.code === 'INVALID_STATE') {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'CANCEL_ERROR',
          message: error.message,
        });
      }
    }
  );

  // POST /deploy/:deployId/rollback - Rollback to previous deployment
  app.post(
    '/:deployId/rollback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!deployService) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database not available',
        });
      }

      const { deployId } = request.params as { deployId: string };
      const body = request.body as { actorId?: string };

      try {
        const deployment = await deployService.rollback(deployId, body?.actorId);
        return reply.send(deployment);
      } catch (error: any) {
        if (error.code === 'DEPLOY_NOT_FOUND') {
          return reply.status(404).send({
            error: 'DEPLOY_NOT_FOUND',
            message: error.message,
          });
        }
        if (error.code === 'INVALID_STATE' || error.code === 'NO_ROLLBACK_TARGET') {
          return reply.status(400).send({
            error: error.code,
            message: error.message,
          });
        }
        return reply.status(500).send({
          error: 'ROLLBACK_ERROR',
          message: error.message,
        });
      }
    }
  );

  // GET /deploy/:deployId/events - Get deployment events
  app.get(
    '/:deployId/events',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!deployService) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database not available',
        });
      }

      const { deployId } = request.params as { deployId: string };

      try {
        const events = await deployService.getDeploymentEvents(deployId);
        return reply.send({ data: events, total: events.length });
      } catch (error: any) {
        return reply.status(500).send({
          error: 'EVENTS_ERROR',
          message: error.message,
        });
      }
    }
  );

  // GET /deploy/latest/:tenantId/:environment - Get latest deployment by environment
  app.get(
    '/latest/:tenantId/:environment',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!deployService) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database not available',
        });
      }

      const { tenantId, environment } = request.params as {
        tenantId: string;
        environment: string;
      };

      try {
        const deployment = await deployService.getLatestDeployment(
          tenantId,
          environment
        );
        if (!deployment) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: `No deployments found for tenant '${tenantId}' in '${environment}'`,
          });
        }
        return reply.send(deployment);
      } catch (error: any) {
        return reply.status(500).send({
          error: 'GET_ERROR',
          message: error.message,
        });
      }
    }
  );

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
}
