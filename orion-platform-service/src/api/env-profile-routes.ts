/**
 * EnvProfile API Routes
 *
 * Routes under /api/v1/env-profiles
 * Environment-specific configuration profiles with variable resolution.
 *
 * Endpoints:
 *   POST   /env-profiles                    — Create profile
 *   GET    /env-profiles                    — List profiles
 *   GET    /env-profiles/:id                — Get profile by ID
 *   PUT    /env-profiles/:id                — Update profile
 *   DELETE /env-profiles/:id                — Delete profile
 *   GET    /env-profiles/:id/environments   — List environments for profile
 *   POST   /env-profiles/resolve            — Resolve variables
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { DatabasePool } from '../services/database';
import { EnvProfileService } from '../services/pipeline/EnvProfileService';
import { EnvProfileRepository } from '../repositories/EnvProfileRepository';
import { createLogger } from '../utils/logger';
import { ConflictError, handleError } from '../errors';

const logger = pino({ name: 'env-profile-routes' });

interface EnvProfileRoutesOptions {
  database: DatabasePool;
}

export default async function envProfileRoutes(
  app: FastifyInstance,
  options: EnvProfileRoutesOptions,
): Promise<void> {
  const repo = new EnvProfileRepository(options.database);
  const service = new EnvProfileService({ db: options.database });
  const tenantId = getCurrentTenantId();

  // POST /env-profiles — Create profile
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'env-profile', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.environment) {
        return badRequest(reply, request, undefined, 'name and environment are required');
      }
      const profile = await service.createProfile({
        tenantId: body.tenantId || tenantId,
        name: body.name,
        environment: body.environment,
        variables: body.variables || {},
        description: body.description,
      });
      return created(reply, request, profile);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create env profile');
      if (err.code === 'DUPLICATE_PROFILE') {
        return handleError(reply, new ConflictError('CONFLICT'));
      }
      return internalError(reply, request, err.message);
    }
  });

  // GET /env-profiles — List profiles
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'env-profile', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const profiles = await service.findProfiles({
        tenantId: query.tenantId || tenantId,
        name: query.name,
        environment: query.environment,
      });
      return success(reply, request, profiles);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list env profiles');
      return internalError(reply, request, err.message);
    }
  });

  // GET /env-profiles/:id — Get by ID
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'env-profile', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const entity = await service.getById(id, tenantId);
      if (!entity) {
        return notFound(reply, request, undefined, `Env profile not found: ${id}`);
      }
      return success(reply, request, entity);
    } catch (err: any) {
      logger.error({ err, id: (request.params as any).id }, 'Failed to get env profile');
      return internalError(reply, request, err.message);
    }
  });

  // PUT /env-profiles/:id — Update
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'env-profile', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const profile = await service.updateProfile(id, {
        name: body.name,
        environment: body.environment,
        variables: body.variables,
        description: body.description,
      });
      return success(reply, request, profile);
    } catch (err: any) {
      logger.error({ err, id: (request.params as any).id }, 'Failed to update env profile');
      if (err.code === 'NOT_FOUND') {
        return notFound(reply, request, (request.params as any).id);
      }
      return internalError(reply, request, err.message);
    }
  });

  // DELETE /env-profiles/:id — Delete
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'env-profile', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteProfile(id);
      return reply.status(204).send();
    } catch (err: any) {
      logger.error({ err, id: (request.params as any).id }, 'Failed to delete env profile');
      return internalError(reply, request, err.message);
    }
  });

  // GET /env-profiles/:name/environments — List environments for a profile name
  app.get('/:name/environments', {
    onRequest: [authenticateUser, requirePermission({ resource: 'env-profile', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name } = request.params as { name: string };
      const environments = await service.findEnvironmentsForProfile(tenantId, name);
      return success(reply, request, environments);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list environments');
      return internalError(reply, request, err.message);
    }
  });

  // POST /env-profiles/resolve — Resolve variables
  app.post('/resolve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'env-profile', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.environment) {
        return badRequest(reply, request, undefined, 'name and environment are required');
      }
      const variables = await service.resolveVariables(
        tenantId,
        body.name,
        body.environment,
        body.overrides,
      );
      return success(reply, request, variables);
    } catch (err: any) {
      logger.error({ err }, 'Failed to resolve env variables');
      return internalError(reply, request, err.message);
    }
  });
}
