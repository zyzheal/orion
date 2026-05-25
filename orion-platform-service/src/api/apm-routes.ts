/**
 * APM (Application Performance Monitoring) API Routes
 *
 * Provides endpoints for:
 *   - Distributed tracing (query traces, spans, slow traces)
 *   - Database profiling (slow queries, pattern stats)
 *   - Performance metrics
 *
 * Routes:
 *   GET    /api/v1/apm/traces                     - List recent traces
 *   GET    /api/v1/apm/traces/:traceId             - Get trace detail
 *   GET    /api/v1/apm/traces/:traceId/summary     - Get trace summary
 *   GET    /api/v1/apm/traces/slow                 - Get slow traces
 *   GET    /api/v1/apm/slow-queries               - List recent slow queries
 *   GET    /api/v1/apm/slow-queries/patterns       - Get query pattern stats
 *   GET    /api/v1/apm/services                   - List traced services
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { TracingService } from '../services/monitoring/TracingService';
import { DatabaseProfiler } from '../services/monitoring/DatabaseProfiler';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface ApmRoutesOptions {
  database?: DatabasePool;
}

export default async function apmRoutes(
  app: FastifyInstance,
  options: ApmRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[ApmRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const tracingService = new TracingService(options.database);
  const dbProfiler = new DatabaseProfiler(options.database);

  // ==================== Distributed Tracing ====================

  // GET /api/v1/apm/traces - List recent traces
  app.get('/traces', { onRequest: [authenticateUser, requirePermission({ resource: 'apm', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        serviceName?: string;
        status?: 'ok' | 'error';
        tenantId?: string;
        limit?: string;
        since?: string;
      };

      const traces = await tracingService.listTraces({
        serviceName: query.serviceName,
        status: query.status,
        tenantId: query.tenantId,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        since: query.since ? new Date(query.since) : undefined,
      });

      return reply.send({ success: true, data: traces });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  });

  // GET /api/v1/apm/traces/:traceId - Get trace detail (all spans)
  app.get('/traces/:traceId', { onRequest: [authenticateUser, requirePermission({ resource: 'apm', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { traceId } = request.params as { traceId: string };
      const spans = await tracingService.getTrace(traceId);

      if (spans.length === 0) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Trace not found' });
      }

      return reply.send({ success: true, data: { traceId, spans } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'GET_ERROR';
      return reply.status(500).send({ error: 'GET_ERROR', message });
    }
  });

  // GET /api/v1/apm/traces/:traceId/summary - Get trace summary
  app.get('/traces/:traceId/summary', { onRequest: [authenticateUser, requirePermission({ resource: 'apm', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { traceId } = request.params as { traceId: string };
      const summary = await tracingService.getTraceSummary(traceId);

      if (!summary) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Trace not found' });
      }

      return reply.send({ success: true, data: summary });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'GET_ERROR';
      return reply.status(500).send({ error: 'GET_ERROR', message });
    }
  });

  // GET /api/v1/apm/traces/slow - Get slow traces
  app.get('/traces/slow', { onRequest: [authenticateUser, requirePermission({ resource: 'apm', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { thresholdMs?: string; limit?: string };
      const thresholdMs = query.thresholdMs ? parseInt(query.thresholdMs, 10) : 1000;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const traces = await tracingService.getSlowTraces(thresholdMs, limit);
      return reply.send({ success: true, data: traces });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  });

  // GET /api/v1/apm/services - List traced services
  app.get('/services', { onRequest: [authenticateUser, requirePermission({ resource: 'apm', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await options.database!.query(
        `SELECT DISTINCT service_name, COUNT(*) as trace_count, MAX(duration_ms) as max_duration_ms
         FROM spans
         GROUP BY service_name
         ORDER BY service_name`
      );
      return reply.send({ success: true, data: result.rows });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  });

  // ==================== Database Profiling ====================

  // GET /api/v1/apm/slow-queries - List recent slow queries
  app.get('/slow-queries', { onRequest: [authenticateUser, requirePermission({ resource: 'apm', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        limit?: string;
        since?: string;
        tenantId?: string;
      };

      const slowQueries = await dbProfiler.getRecentSlowQueries({
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        since: query.since ? new Date(query.since) : undefined,
        tenantId: query.tenantId,
      });

      return reply.send({ success: true, data: slowQueries });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  });

  // GET /api/v1/apm/slow-queries/patterns - Get query pattern stats
  app.get('/slow-queries/patterns', { onRequest: [authenticateUser, requirePermission({ resource: 'apm', action: 'read' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { since?: string };
      const stats = await dbProfiler.getPatternStats(
        query.since ? new Date(query.since) : undefined
      );
      return reply.send({ success: true, data: stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'LIST_ERROR';
      return reply.status(500).send({ error: 'LIST_ERROR', message });
    }
  });
}
