/**
 * Disaster Recovery API Routes
 *
 * Routes under /v1/disaster-recovery
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DisasterRecoveryController } from './controllers/DisasterRecoveryController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

const controller = new DisasterRecoveryController();

export default async function disasterRecoveryRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/disaster-recovery/plans - Create DR plan
  app.post('/plans', {
    onRequest: [authenticateUser, requirePermission({ resource: 'disaster-recovery', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createDRPlan(request, reply);
  });

  // GET /v1/disaster-recovery/plans - List DR plans
  app.get('/plans', {
    onRequest: [authenticateUser, requirePermission({ resource: 'disaster-recovery', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listDRPlans(request, reply);
  });

  // POST /v1/disaster-recovery/plans/:id/failover-test - Execute failover test
  app.post('/plans/:id/failover-test', {
    onRequest: [authenticateUser, requirePermission({ resource: 'disaster-recovery', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeFailoverTest(request, reply);
  });

  // POST /v1/disaster-recovery/backups - Create backup
  app.post('/backups', {
    onRequest: [authenticateUser, requirePermission({ resource: 'disaster-recovery', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createBackup(request, reply);
  });

  // POST /v1/disaster-recovery/plans/:id/failover - Execute failover
  app.post('/plans/:id/failover', {
    onRequest: [authenticateUser, requirePermission({ resource: 'disaster-recovery', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeFailover(request, reply);
  });

  // GET /v1/disaster-recovery/status - Get DR status
  app.get('/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'disaster-recovery', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDRStatus(request, reply);
  });
}
