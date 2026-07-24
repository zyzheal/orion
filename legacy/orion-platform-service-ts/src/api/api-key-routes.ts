/**
 * API Key Management API Routes
 *
 * Routes under /api/v1/api-keys
 * Uses PostgreSQL Repository pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { ApiKeyRepository } from '../services/api-key/ApiKeyRepository';
import { ApiKeyService } from '../services/api-key/ApiKeyService';
import { OrionError, ValidationError, NotFoundError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

interface ApiKeyRoutesOptions {
  database?: DatabasePool;
}

export default async function apiKeyRoutes(
  app: FastifyInstance,
  options: ApiKeyRoutesOptions
): Promise<void> {
  const repository = options.database
    ? new ApiKeyRepository(options.database)
    : undefined;

  let service: ApiKeyService | null = null;
  if (repository) {
    service = new ApiKeyService(repository);
  }

  const unavailableHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'))
  };

  // GET /api/v1/api-keys?tenantId=xxx — list API keys
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api_key', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const { tenantId } = request.query as { tenantId: string };
    try {
      const keys = await service.listKeys(tenantId);
      return reply.send({ data: keys, total: keys.length });
    } catch (error: any) {
      return handleError(reply, new OrionError('LIST_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /api/v1/api-keys — create API key
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api_key', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const body = request.body as Record<string, unknown>;
    try {
      const result = await service.createKey(
        body.tenantId as string,
        body.userId as string,
        body.name as string,
        (body.permissions as string[]) ?? [],
        body.expiresInDays ? parseInt(body.expiresInDays as string, 10) : undefined
      );
      return reply.status(201).send(result);
    } catch (error: any) {
      return handleError(reply, new OrionError('CREATE_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /api/v1/api-keys/:id — delete API key
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api_key', action: 'delete', extractResourceId: (req) => (req.params as { id: string }).id, requiredImpact: 'high' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const { id } = request.params as { id: string };
    try {
      const deleted = await service.revokeKey(id);
      return handleError(reply, new NotFoundError('NOT_FOUND'));
      return reply.status(204).send();
    } catch (error: any) {
      return handleError(reply, new OrionError('DELETE_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}
