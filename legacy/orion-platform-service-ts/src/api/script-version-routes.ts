/**
 * ScriptVersion API Routes
 *
 * Routes under /api/v1/script-versions/:scriptId/versions
 * Script content version tracking with diff comparison.
 *
 * Endpoints:
 *   POST   /:scriptId/versions                    — Create version
 *   GET    /:scriptId/versions                    — List versions
 *   GET    /:scriptId/versions/latest             — Get latest version
 *   GET    /:scriptId/versions/:version           — Get specific version
 *   GET    /:scriptId/versions/:v1/diff/:v2      — Diff two versions
 *   DELETE /:scriptId/versions/:version           — Delete version
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { DatabasePool } from '../services/database';
import { ScriptVersionService } from '../services/pipeline/ScriptVersionService';
import { createLogger } from '../utils/logger';
import { ConflictError, handleError } from '../errors';

const logger = createLogger('script-version-routes');

interface ScriptVersionRoutesOptions {
  database: DatabasePool;
}

export default async function scriptVersionRoutes(
  app: FastifyInstance,
  options: ScriptVersionRoutesOptions,
): Promise<void> {
  const service = new ScriptVersionService({ db: options.database });
  const tenantId = getCurrentTenantId();

  // POST /:scriptId/versions — Create version
  app.post('/:scriptId/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-version', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scriptId } = request.params as { scriptId: string };
      const body = request.body as any;
      if (!body.version || !body.content) {
        return badRequest(reply, request, undefined, 'version and content are required');
      }
      const version = await service.createVersion({
        tenantId: body.tenantId || tenantId,
        scriptId,
        version: body.version,
        content: body.content,
        parameters: body.parameters,
        changeDescription: body.changeDescription,
        createdBy: body.createdBy || 'system',
      });
      return created(reply, request, version);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create script version');
      if (err.code === 'DUPLICATE_VERSION') {
        return handleError(reply, new ConflictError('CONFLICT'));
      }
      return internalError(reply, request, err.message);
    }
  });

  // GET /:scriptId/versions — List versions
  app.get('/:scriptId/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scriptId } = request.params as { scriptId: string };
      const query = request.query as any;
      if (query.latest === 'true') {
        const latest = await service.getLatestVersion(tenantId, scriptId);
        return latest
          ? success(reply, request, latest)
          : notFound(reply, request);
      }
      const versions = await service.getVersions(tenantId, scriptId);
      return success(reply, request, versions);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list script versions');
      return internalError(reply, request, err.message);
    }
  });

  // GET /:scriptId/versions/:version — Get specific version
  app.get('/:scriptId/versions/:version', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scriptId, version } = request.params as { scriptId: string; version: string };
      const v = await service.getVersion(tenantId, scriptId, version);
      if (!v) {
        return notFound(reply, request);
      }
      return success(reply, request, v);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get script version');
      return internalError(reply, request, err.message);
    }
  });

  // GET /:scriptId/versions/:v1/diff/:v2 — Diff two versions
  app.get('/:scriptId/versions/:v1/diff/:v2', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-version', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scriptId, v1, v2 } = request.params as { scriptId: string; v1: string; v2: string };
      const diff = await service.diff(tenantId, scriptId, v1, v2);
      return success(reply, request, diff);
    } catch (err: any) {
      logger.error({ err }, 'Failed to diff script versions');
      return internalError(reply, request, err.message);
    }
  });

  // DELETE /:scriptId/versions/:version — Delete version
  app.delete('/:scriptId/versions/:version', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-version', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scriptId, version } = request.params as { scriptId: string; version: string };
      await service.deleteVersion(tenantId, scriptId, version);
      return reply.status(204).send();
    } catch (err: any) {
      logger.error({ err }, 'Failed to delete script version');
      return internalError(reply, request, err.message);
    }
  });
}
