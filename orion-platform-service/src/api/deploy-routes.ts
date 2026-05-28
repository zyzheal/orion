/**
 * Smart Deploy API Routes
 *
 * Routes under /api/v1/deploy
 * Handles deployment execution, history, metrics, and rollback
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { DeployController } from './controllers/DeployController';
import { SmartDeployService } from '../services/smart-deploy/SmartDeployService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'deploy-routes' });

interface DeployRoutesOptions {
  database?: DatabasePool;
}

export default async function deployRoutes(
  app: FastifyInstance,
  options: DeployRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[DeployRoutes] No database pool provided, routes will not be functional');
    return;
  }

  // Initialize service (SmartDeployService creates repositories internally)
  const smartDeployService = new SmartDeployService(options.database);

  // Initialize controller
  const controller = new DeployController(smartDeployService);

  // ==================== Deployment Execution ====================

  app.post('/deploy', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deploy(request, reply);
  });

  // ==================== Deployment Status ====================

  app.get('/deploy/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStatus(request, reply);
  });

  // ==================== Deployment History ====================

  app.get('/deploy/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getHistory(request, reply);
  });

  app.get('/deploy/latest/:appName/:environment', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })],
    schema: {
      params: {
        type: 'object',
        required: ['appName', 'environment'],
        properties: {
          appName: { type: 'string', minLength: 1, maxLength: 100 },
          environment: { type: 'string', enum: ['dev', 'staging', 'prod', 'development', 'production', 'pre-prod'] }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getLatestDeployment(request, reply);
  });

  // ==================== Deployment Metrics ====================

  app.get('/deploy/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getMetrics(request, reply);
  });

  // ==================== Rollback ====================

  app.post('/deploy/:id/rollback', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.rollback(request, reply);
  });

  app.get('/deploy/:id/rollbacks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRollbackHistory(request, reply);
  });

  // ==================== Cancel ====================

  app.post('/deploy/:id/cancel', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'write' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cancel(request, reply);
  });

  // ==================== Audit Trail ====================

  app.get('/deploy/:id/audit', {
    onRequest: [authenticateUser, requirePermission({ resource: 'deploy', action: 'read' })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditTrail(request, reply);
  });

  logger.info('[DeployRoutes] Registered all deployment routes');
}