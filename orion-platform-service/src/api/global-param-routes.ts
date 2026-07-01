/**
 * GlobalParam API Routes
 *
 * Routes under /api/v1/global-params
 * Cross-pipeline shared parameters with tenant/pipeline/global scope.
 *
 * Endpoints:
 *   POST   /global-params              — Create parameter
 *   GET    /global-params              — List parameters (by scope)
 *   GET    /global-params/:id          — Get parameter by ID
 *   PUT    /global-params/:id          — Update parameter
 *   DELETE /global-params/:id          — Delete parameter
 *   POST    /global-params/resolve     — Resolve multiple keys
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { DatabasePool } from '../services/database';
import { GlobalParamService } from '../services/pipeline/GlobalParamService';
import { GlobalParamRepository } from '../repositories/GlobalParamRepository';
import pino from 'pino';

const logger = pino({ name: 'global-param-routes' });

interface GlobalParamRoutesOptions {
  database: DatabasePool;
}

export default async function globalParamRoutes(
  app: FastifyInstance,
  options: GlobalParamRoutesOptions,
): Promise<void> {
  const repo = new GlobalParamRepository(options.database);
  const service = new GlobalParamService({ db: options.database });
  const tenantId = (options.database as any).tenantId || 'default';

  // POST /global-params — Create parameter
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'global-param', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.key) {
        return badRequest(reply, request, undefined, 'key is required');
      }
      const param = await service.create({
        tenantId: body.tenantId || tenantId,
        key: body.key,
        value: body.value,
        description: body.description,
        isSecret: body.isSecret,
        scope: body.scope || 'tenant',
        expiresAt: body.expiresAt,
      });
      return created(reply, request, param);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create global param');
      if (err.code === 'DUPLICATE_KEY') {
        return reply.code(409).send({ error: 'CONFLICT', message: err.message });
      }
      return internalError(reply, request, err.message);
    }
  });

  // GET /global-params — List parameters
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'global-param', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const params = await service.list(
        query.tenantId || tenantId,
        query.scope,
      );
      return success(reply, request, params);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list global params');
      return internalError(reply, request, err.message);
    }
  });

  // GET /global-params/:id — Get by ID
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'global-param', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const param = await repo.findById(id);
      if (!param) {
        return notFound(reply, request);
      }
      return success(reply, request, param);
    } catch (err: any) {
      logger.error({ err, id: (request.params as any).id }, 'Failed to get global param');
      return internalError(reply, request, err.message);
    }
  });

  // PUT /global-params/:id — Update
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'global-param', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const param = await service.update(id, {
        value: body.value,
        description: body.description,
        isSecret: body.isSecret,
        scope: body.scope,
        expiresAt: body.expiresAt,
      });
      return success(reply, request, param);
    } catch (err: any) {
      logger.error({ err, id: (request.params as any).id }, 'Failed to update global param');
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, (request.params as any).id);
      }
      return internalError(reply, request, err.message);
    }
  });

  // DELETE /global-params/:id — Delete
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'global-param', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.delete(id);
      return reply.status(204).send();
    } catch (err: any) {
      logger.error({ err, id: (request.params as any).id }, 'Failed to delete global param');
      return internalError(reply, request, err.message);
    }
  });

  // POST /global-params/resolve — Resolve multiple keys
  app.post('/resolve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'global-param', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { keys: Record<string, string> };
      if (!body || !body.keys) {
        return badRequest(reply, request, undefined, 'keys object is required');
      }
      const resolved = await service.resolve(tenantId, body.keys);
      return success(reply, request, resolved);
    } catch (err: any) {
      logger.error({ err }, 'Failed to resolve global params');
      return internalError(reply, request, err.message);
    }
  });
}
