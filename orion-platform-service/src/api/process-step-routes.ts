/**
 * Process Step Engine API Routes (Migration 340)
 *
 * Workflow definition CRUD + instance management + step advancement
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ProcessDefinitionRepository, ProcessInstanceRepository, ProcessStepEngineService } from '../services/process-step';
import { handleError, ServiceUnavailableError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('process-step-routes');

interface ProcessStepRoutesOptions {
  database?: DatabasePool;
}

export default async function processStepRoutes(app: FastifyInstance, options: ProcessStepRoutesOptions): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[ProcessStepRoutes] Database not available, routes will return 503');
    return;
  }

  const defRepo = new ProcessDefinitionRepository(pool);
  const instRepo = new ProcessInstanceRepository(pool);
  const engineService = new ProcessStepEngineService(defRepo, instRepo);

  // ---- Definition Endpoints ----

  // GET /workflow/definitions - List definitions
  app.get('/definitions', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const query = request.query as Record<string, string>;
      const result = await engineService.listDefinitions({
        entityType: query.entityType,
        enabled: query.enabled !== undefined ? query.enabled === 'true' : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return reply.send({ success: true, data: result.rows, total: result.total });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /workflow/definitions - Create definition
  app.post('/definitions', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const body = request.body as Record<string, unknown>;
      const userId = (request as any).user?.userId;
      const def = await engineService.createDefinition(body as any, userId);
      return reply.status(201).send({ success: true, data: def });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /workflow/definitions/:id - Get definition by ID
  app.get<{ Params: { id: string } }>('/definitions/:id', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const def = await engineService.getDefinition(request.params.id);
      return reply.send({ success: true, data: def });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /workflow/definitions/:id - Update definition
  app.put<{ Params: { id: string } }>('/definitions/:id', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const def = await engineService.updateDefinition(request.params.id, request.body as any);
      return reply.send({ success: true, data: def });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /workflow/definitions/:id - Delete definition
  app.delete<{ Params: { id: string } }>('/definitions/:id', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      await engineService.deleteDefinition(request.params.id);
      return reply.send({ success: true, message: 'Process definition deleted' });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // ---- Instance Endpoints ----

  // GET /workflow/instances - List instances
  app.get('/instances', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const query = request.query as Record<string, string>;
      const result = await engineService.listInstances({
        definitionId: query.definitionId,
        entityType: query.entityType,
        entityId: query.entityId,
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });
      return reply.send({ success: true, data: result.rows, total: result.total });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /workflow/instances - Start a new instance
  app.post('/instances', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const body = request.body as Record<string, unknown>;
      const userId = (request as any).user?.userId;
      const instance = await engineService.startInstance(body.definitionId as string, {
        entityType: body.entityType as string,
        entityId: body.entityId as string,
        operator: userId,
        data: body.data as Record<string, unknown>,
      });
      return reply.status(201).send({ success: true, data: instance });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /workflow/instances/:id - Get instance detail
  app.get<{ Params: { id: string } }>('/instances/:id', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const instance = await engineService.getInstance(request.params.id);
      return reply.send({ success: true, data: instance });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /workflow/instances/:id/history - Get step history
  app.get<{ Params: { id: string } }>('/instances/:id/history', async (request, reply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const steps = await engineService.getStepHistory(request.params.id);
      return reply.send({ success: true, data: steps });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /workflow/instances/:id/steps/:stepId/advance - Advance a step
  app.post<{ Params: { id: string; stepId: string } }>(
    '/instances/:id/steps/:stepId/advance',
    async (request, reply) => {
      return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      try {
        const body = request.body as Record<string, unknown>;
        const userId = (request as any).user?.userId;
        const step = await engineService.advanceStep(
          request.params.id,
          request.params.stepId,
          body.action as string,
          {
            operator: userId,
            comment: body.comment as string,
            data: body.data as Record<string, unknown>,
          }
        );
        return reply.send({ success: true, data: step });
      } catch (error) {
        return handleError(reply, error);
      }
    }
  );
}
