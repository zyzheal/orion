/**
 * Manual Confirmation API Routes (P0-6)
 *
 * Provides endpoints for the confirmation workbench:
 * - List/view confirmation requests
 * - Approve/reject confirmations
 * - Batch operations
 * - Audit logs
 * - Notification settings
 *
 * Prefix: /api/v1/confirmations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ConfirmationService } from '../services/confirmation/ConfirmationService';
import { ConfirmationController } from './controllers/ConfirmationController';

export default async function confirmationRoutes(app: FastifyInstance): Promise<void> {
  // Initialize service and controller
  const service = new ConfirmationService();
  const controller = new ConfirmationController(service);

  // GET /confirmations - List confirmations
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /confirmations/stats - Get statistics
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStats(request, reply);
  });

  // GET /confirmations/audit - Get audit logs
  app.get('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditLogs(request, reply);
  });

  // GET /confirmations/settings - Get notification settings
  app.get('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSettings(request, reply);
  });

  // PUT /confirmations/settings - Update notification settings
  app.put('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateSettings(request, reply);
  });

  // POST /confirmations - Create confirmation
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // POST /confirmations/batch-approve - Batch approve
  app.post('/batch-approve', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.batchApprove(request, reply);
  });

  // GET /confirmations/:id - Get confirmation detail
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // POST /confirmations/:id/approve - Approve confirmation
  app.post('/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.approve(request, reply);
  });

  // POST /confirmations/:id/reject - Reject confirmation
  app.post('/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.reject(request, reply);
  });
}
