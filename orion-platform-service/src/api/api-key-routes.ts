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
    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'API Key management requires database connection',
    });
  };

  // GET /api/v1/api-keys?tenantId=xxx — list API keys
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api_key', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const { tenantId } = request.query as { tenantId: string };
    if (!tenantId) return reply.status(400).send({ error: 'MISSING_TENANT_ID', message: 'tenantId query parameter is required' });
    try {
      const keys = await service.listKeys(tenantId);
      return reply.send({ data: keys, total: keys.length });
    } catch (error: any) {
      return reply.status(500).send({ error: 'LIST_ERROR', message: error.message });
    }
  });

  // POST /api/v1/api-keys — create API key
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api_key', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return unavailableHandler(request, reply);
    const body = request.body as Record<string, unknown>;
    if (!body.tenantId || !body.name || !body.userId) return reply.status(400).send({ error: 'INVALID_INPUT', message: 'tenantId, name, and userId are required' });
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
      return reply.status(500).send({ error: 'CREATE_ERROR', message: error.message });
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
      if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'API key not found' });
      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(500).send({ error: 'DELETE_ERROR', message: error.message });
    }
  });
}
