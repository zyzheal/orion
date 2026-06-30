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
 * D7 Fix: Migrated to PostgreSQL Repository pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ConfirmationRepository } from '../repositories/ConfirmationRepository';
import { ConfirmationService } from '../services/confirmation/ConfirmationService';
import { ConfirmationController } from './controllers/ConfirmationController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface ConfirmationRoutesOptions {
  database?: DatabasePool;
}

export default async function confirmationRoutes(app: FastifyInstance, options: ConfirmationRoutesOptions = {}): Promise<void> {
  if (!options.database) {
    return;
  }
  // D7 Fix: Initialize with PostgreSQL Repository
  const repository = new ConfirmationRepository(options.database);
  const service = new ConfirmationService(repository);
  const controller = new ConfirmationController(service);

  // GET /confirmations - List confirmations
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /confirmations/stats - Get statistics
  app.get('/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStats(request, reply);
  });

  // GET /confirmations/audit - Get audit logs
  app.get('/audit', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAuditLogs(request, reply);
  });

  // GET /confirmations/settings - Get notification settings
  app.get('/settings', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getSettings(request, reply);
  });

  // PUT /confirmations/settings - Update notification settings
  app.put('/settings', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateSettings(request, reply);
  });

  // POST /confirmations - Create confirmation
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // POST /confirmations/batch-approve - Batch approve
  app.post('/batch-approve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.batchApprove(request, reply);
  });

  // GET /confirmations/:id - Get confirmation detail
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getById(request, reply);
  });

  // POST /confirmations/:id/approve - Approve confirmation
  app.post('/:id/approve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.approve(request, reply);
  });

  // POST /confirmations/:id/reject - Reject confirmation
  app.post('/:id/reject', {
    onRequest: [authenticateUser, requirePermission({ resource: 'confirmation', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.reject(request, reply);
  });
}
