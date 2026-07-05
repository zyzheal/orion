/**
 * Distributed Tracing API Routes
 *
 * Routes under /api/v1/tracing
 * Manages trace spans, sampling configs, and OTel collector configs.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { TraceSpanRepository } from '../repositories/TraceSpanRepository';
import { TraceSamplingConfigRepository } from '../repositories/TraceSamplingConfigRepository';
import { OtelCollectorConfigRepository } from '../repositories/OtelCollectorConfigRepository';
import { DistributedTracingService } from '../services/observability/DistributedTracingService';
import { handleError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('tracing-routes');

interface TracingRoutesOptions {
  database: DatabasePool;
}

export default async function tracingRoutes(
  app: FastifyInstance,
  options: TracingRoutesOptions,
): Promise<void> {
  const { database } = options;

  const spanRepo = new TraceSpanRepository(database);
  const samplingRepo = new TraceSamplingConfigRepository(database);
  const otelConfigRepo = new OtelCollectorConfigRepository(database);
  const tracingService = new DistributedTracingService(spanRepo, samplingRepo, otelConfigRepo);

  // ==================== Traces ====================

  // GET /api/v1/tracing/traces - List traces
  app.get('/traces', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const traces = await tracingService.getTraceList({
        limit: parseInt(query.limit, 10) || 50,
        serviceName: query.serviceName,
      });
      return reply.status(200).send({ success: true, data: traces, total: traces.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to list traces');
      handleError(reply, error);
    }
  });

  // GET /api/v1/tracing/traces/:traceId - Get trace detail
  app.get('/traces/:traceId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { traceId } = request.params as any;
      const trace = await tracingService.getTrace(traceId);
      return reply.status(200).send({ success: true, data: trace });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get trace detail');
      handleError(reply, error);
    }
  });

  // GET /api/v1/tracing/traces/:traceId/spans - Get spans for a trace
  app.get('/traces/:traceId/spans', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { traceId } = request.params as any;
      const trace = await tracingService.getTrace(traceId);
      return reply.status(200).send({ success: true, data: trace.spans, total: trace.spans.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get trace spans');
      handleError(reply, error);
    }
  });

  // POST /api/v1/tracing/traces/search - Search traces
  app.post('/traces/search', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const traces = await tracingService.searchTraces({
        serviceName: body.serviceName,
        operationName: body.operationName,
        minDuration: body.minDuration,
        maxDuration: body.maxDuration,
        statusCode: body.statusCode,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        limit: body.limit || 50,
        offset: body.offset || 0,
      });
      return reply.status(200).send({ success: true, data: traces, total: traces.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to search traces');
      handleError(reply, error);
    }
  });

  // ==================== Sampling Config ====================

  // GET /api/v1/tracing/config - Get all sampling configs
  app.get('/config', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const configs = await tracingService.getSamplingConfigs();
      return reply.status(200).send({ success: true, data: configs, total: configs.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get sampling configs');
      handleError(reply, error);
    }
  });

  // PUT /api/v1/tracing/config - Update sampling config
  app.put('/config', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const config = await tracingService.upsertSamplingConfig({
        serviceName: body.serviceName,
        sampleRate: body.sampleRate,
        maxSpansPerSecond: body.maxSpansPerSecond,
        enabled: body.enabled,
      });
      return reply.status(200).send({ success: true, data: config });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to update sampling config');
      handleError(reply, error);
    }
  });

  // ==================== OTel Collector Configs ====================

  // GET /api/v1/tracing/otel/configs - Get OTel collector configs
  app.get('/otel/configs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      let configs;
      if (query.configType) {
        configs = await tracingService.getOtelConfigsByType(query.configType);
      } else {
        configs = await tracingService.getOtelConfigs();
      }
      return reply.status(200).send({ success: true, data: configs, total: configs.length });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to get OTel configs');
      handleError(reply, error);
    }
  });

  // POST /api/v1/tracing/otel/configs - Create OTel collector config
  app.post('/otel/configs', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const config = await tracingService.createOtelConfig({
        name: body.name,
        description: body.description,
        configType: body.configType,
        configYaml: body.configYaml,
        enabled: body.enabled,
      });
      return reply.status(201).send({ success: true, data: config });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to create OTel config');
      handleError(reply, error);
    }
  });

  // PUT /api/v1/tracing/otel/configs/:id - Update OTel collector config
  app.put('/otel/configs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const config = await tracingService.updateOtelConfig(id, body);
      return reply.status(200).send({ success: true, data: config });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to update OTel config');
      handleError(reply, error);
    }
  });

  // DELETE /api/v1/tracing/otel/configs/:id - Delete OTel collector config
  app.delete('/otel/configs/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'tracing', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await tracingService.deleteOtelConfig(id);
      return reply.status(200).send({ success: true, message: 'OTel config deleted' });
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to delete OTel config');
      handleError(reply, error);
    }
  });
}
