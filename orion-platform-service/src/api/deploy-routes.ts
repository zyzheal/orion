/**
 * Smart Deployment API Routes
 *
 * Provides endpoints for deployment execution, status tracking,
 * history queries, rollback operations, and metrics.
 *
 * TASK-701: Smart Deployment (智能部署)
 * Prefix: /api/v1/deploy
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SmartDeployService } from '../services/smart-deploy/SmartDeployService';
import { DeployController } from './controllers/DeployController';

export default async function deployRoutes(app: FastifyInstance): Promise<void> {
  // Initialize service and controller
  const smartDeployService = new SmartDeployService();
  const deployController = new DeployController(smartDeployService);

  // ==================== Deployment Execution ====================

  // POST /deploy - Create and execute a deployment
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.deploy(request, reply);
  });

  // ==================== Deployment Status ====================

  // GET /deploy/:id - Get deployment status
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.getStatus(request, reply);
  });

  // ==================== Deployment History ====================

  // GET /deploy/history - Get deployment history
  app.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.getHistory(request, reply);
  });

  // ==================== Deployment Metrics ====================

  // GET /deploy/metrics - Get deployment metrics
  app.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    return deployController.getMetrics(request, reply);
  });

  // ==================== Audit Trail ====================

  // GET /deploy/:id/audit - Get audit trail for a deployment
  app.get(
    '/:id/audit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.getAuditTrail(request, reply);
    }
  );

  // ==================== Rollback ====================

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

  // ==================== Cancel ====================

  // POST /deploy/:id/cancel - Cancel a deployment
  app.post(
    '/:id/cancel',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.cancel(request, reply);
    }
  );

  // ==================== Latest Deployment ====================

  // GET /deploy/latest/:appName/:environment - Get latest deployment
  app.get(
    '/latest/:appName/:environment',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return deployController.getLatestDeployment(request, reply);
    }
  );
}
