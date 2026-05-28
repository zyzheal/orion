/**
 * Queue Management API Routes
 *
 * Provides endpoints for queue job operations backed by PostgreSQL.
 * Registered under /api/v1/queue.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { QueueRepository } from '../services/queue/QueueRepository';
import { QueueService } from '../services/queue/QueueService';
import { QueueController } from './controllers/QueueController';
import pino from 'pino';

const logger = pino({ name: 'queue-routes' });

interface QueueRoutesOptions {
  database?: DatabasePool;
}

export default async function queueRoutes(
  app: FastifyInstance,
  options: QueueRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new QueueRepository(options.database)
    : undefined;

  if (!repository) {
    logger.warn('[QueueRoutes] No database pool provided, queue routes will not be functional');
    return;
  }

  const queueService = new QueueService(repository);
  const controller = new QueueController(queueService);

  // ==================== Job Operations ====================

  // POST /queue/:queueName/jobs - Enqueue a job
  app.post('/:queueName/jobs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.enqueue(request, reply);
  });

  // POST /queue/:queueName/dequeue - Dequeue jobs for processing
  app.post('/:queueName/dequeue', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.dequeue(request, reply);
  });

  // ==================== Job State Management ====================

  // POST /queue/jobs/:id/complete - Mark job as completed
  app.post('/jobs/:id/complete', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'write', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.complete(request, reply);
  });

  // POST /queue/jobs/:id/fail - Mark job as failed
  app.post('/jobs/:id/fail', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'write', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.fail(request, reply);
  });

  // POST /queue/jobs/:id/retry - Retry a failed job
  app.post('/jobs/:id/retry', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'execute', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.retry(request, reply);
  });

  // ==================== Query Operations ====================

  // GET /queue/jobs - List jobs (with optional filters)
  app.get('/jobs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listJobs(request, reply);
  });

  // GET /queue/jobs/:id - Get job by ID
  app.get('/jobs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'read', extractResourceId: (req) => (req.params as { id: string }).id })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getJob(request, reply);
  });

  // GET /queue/stats - Queue statistics
  app.get('/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'queue', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStats(request, reply);
  });
}
