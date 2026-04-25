/**
 * Metrics API Routes
 *
 * Routes under /api/v1/metrics
 * Uses PostgreSQL Repository pattern for metrics storage
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { MetricsRepository } from '../services/metrics/MetricsRepository';
import { MetricsService } from '../services/metrics/MetricsService';
import { MetricsController } from './controllers/MetricsController';

interface MetricsRoutesOptions {
  database?: DatabasePool;
}

export default async function metricsRoutes(
  app: FastifyInstance,
  options: MetricsRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new MetricsRepository(options.database)
    : undefined;

  if (!repository) {
    console.warn('[MetricsRoutes] No database pool provided, metrics routes will not be functional');
    return;
  }

  const service = new MetricsService(repository);
  const controller = new MetricsController(service);

  // ==================== Record Metric ====================

  // POST /api/v1/metrics/record - Record a metric data point
  app.post('/record', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.record(request, reply);
  });

  // ==================== Query Metrics ====================

  // POST /api/v1/metrics/query - Query metrics by name and time range
  app.post('/query', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.query(request, reply);
  });

  // ==================== Aggregate Stats ====================

  // POST /api/v1/metrics/stats - Get aggregated stats (avg/min/max/count)
  app.post('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStats(request, reply);
  });
}
