/**
 * Data Lineage API Routes
 *
 * Endpoints for data lineage graph, nodes, edges, impact analysis.
 * Routes under /data-lineage
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DataLineageService } from '../services/data-lineage';
import { DatabasePool } from '../services/database';
import { handleError, OrionError, ErrorCode } from '../errors';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface DataLineageRoutesOptions {
  database?: DatabasePool;
}

export default async function dataLineageRoutes(
  app: FastifyInstance,
  options: DataLineageRoutesOptions,
): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[DataLineageRoutes] Database not available, routes will return 503');
  }

  const service = pool ? new DataLineageService(pool) : null;

  // ---- Graph Endpoints ----

  // GET /data-lineage/graph - Get full lineage graph with stats
  app.get('/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const tenantId = getCurrentTenantId();
      const result = await service.getLineageGraph(tenantId);
      return reply.send({ success: true, data: result });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /data-lineage/graph/:pipelineId - Get lineage graph for a pipeline
  app.get<{ Params: { pipelineId: string } }>('/graph/:pipelineId', async (request, reply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const tenantId = getCurrentTenantId();
      const graph = await service.getLineage(request.params.pipelineId, tenantId);
      if (!graph) {
        return reply.status(404).send({
          success: false,
          error: 'NOT_FOUND',
          message: `No lineage found for pipeline ${request.params.pipelineId}`,
        });
      }
      return reply.send({ success: true, data: graph });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ---- Lineage Recording Endpoints ----

  // POST /data-lineage/record - Record lineage for a pipeline execution
  app.post('/record', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = getCurrentTenantId();

      if (!body.pipelineId || !body.executionId) {
        throw new OrionError('pipelineId and executionId are required', ErrorCode.VALIDATION_ERROR);
      }

      const record = await service.recordLineage(
        tenantId,
        body.pipelineId as string,
        body.executionId as string,
        (body.nodes as any[]) || [],
        (body.edges as any[]) || [],
      );

      return reply.status(201).send({ success: true, data: record });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /data-lineage/history/:pipelineId - Get lineage history for a pipeline
  app.get<{ Params: { pipelineId: string }; Querystring: { limit?: string } }>(
    '/history/:pipelineId',
    async (request, reply) => {
      if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
      try {
        const tenantId = getCurrentTenantId();
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
        const history = await service.getLineageHistory(request.params.pipelineId, limit, tenantId);
        return reply.send({ success: true, data: history, total: history.length });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  // ---- Node Endpoints ----

  // POST /data-lineage/nodes - Add a lineage node
  app.post('/nodes', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = getCurrentTenantId();

      if (!body.id || !body.name || !body.type) {
        throw new OrionError('id, name, and type are required', ErrorCode.VALIDATION_ERROR);
      }

      await service.addNode(body as any, tenantId);
      return reply.status(201).send({ success: true, message: 'Node added' });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ---- Edge Endpoints ----

  // POST /data-lineage/edges - Add a lineage edge
  app.post('/edges', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const body = request.body as Record<string, unknown>;
      const tenantId = getCurrentTenantId();

      if (!body.id || !body.from || !body.to || !body.relationship) {
        throw new OrionError('id, from, to, and relationship are required', ErrorCode.VALIDATION_ERROR);
      }

      await service.addEdge(body as any, tenantId);
      return reply.status(201).send({ success: true, message: 'Edge added' });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ---- Analysis Endpoints ----

  // GET /data-lineage/upstream/:nodeId - Get upstream nodes
  app.get<{ Params: { nodeId: string } }>('/upstream/:nodeId', async (request, reply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const tenantId = getCurrentTenantId();
      const nodes = await service.getUpstream(request.params.nodeId, tenantId);
      return reply.send({ success: true, data: nodes });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /data-lineage/downstream/:nodeId - Get downstream nodes
  app.get<{ Params: { nodeId: string } }>('/downstream/:nodeId', async (request, reply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const tenantId = getCurrentTenantId();
      const nodes = await service.getDownstream(request.params.nodeId, tenantId);
      return reply.send({ success: true, data: nodes });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /data-lineage/impact/:nodeId - Impact analysis for a node
  app.get<{ Params: { nodeId: string } }>('/impact/:nodeId', async (request, reply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const tenantId = getCurrentTenantId();
      const analysis = await service.getImpactAnalysis(request.params.nodeId, tenantId);
      return reply.send({ success: true, data: analysis });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
