/**
 * Queue Management API Routes
 *
 * Provides endpoints for queue job operations backed by PostgreSQL.
 * Registered under /api/v1/queue.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { QueueRepository } from '../services/queue/QueueRepository';
import { QueueService } from '../services/queue/QueueService';
import { QueueController } from './controllers/QueueController';

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
    console.warn('[QueueRoutes] No database pool provided, queue routes will not be functional');
    return;
  }

  const queueService = new QueueService(repository);
  const controller = new QueueController(queueService);

  // ==================== Job Operations ====================

  // POST /queue/:queueName/jobs - Enqueue a job
  app.post('/:queueName/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.enqueue(request, reply);
  });

  // POST /queue/:queueName/dequeue - Dequeue jobs for processing
  app.post('/:queueName/dequeue', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.dequeue(request, reply);
  });

  // ==================== Job State Management ====================

  // POST /queue/jobs/:id/complete - Mark job as completed
  app.post('/jobs/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.complete(request, reply);
  });

  // POST /queue/jobs/:id/fail - Mark job as failed
  app.post('/jobs/:id/fail', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.fail(request, reply);
  });

  // ==================== Query Operations ====================

  // GET /queue/jobs - List jobs (with optional filters)
  app.get('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listJobs(request, reply);
  });

  // GET /queue/jobs/:id - Get job by ID
  app.get('/jobs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getJob(request, reply);
  });

  // GET /queue/stats - Queue statistics
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStats(request, reply);
  });
}
