/**
 * Version Archive API Routes
 *
 * Archive, list, view, and restore versioned resources.
 *
 * Prefix: /api/v1/version-archives
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { VersionArchiveRepository } from '../services/version-archive/VersionArchiveRepository';
import { VersionArchiveService } from '../services/version-archive/VersionArchiveService';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'version-archive-routes' });

interface VersionArchiveRoutesOptions {
  database: DatabasePool;
}

export default async function versionArchiveRoutes(
  app: FastifyInstance,
  options: VersionArchiveRoutesOptions,
): Promise<void> {
  const archiveRepo = new VersionArchiveRepository(options.database);
  const service = new VersionArchiveService(archiveRepo);

  // ── POST / — Archive a version ──────────────────────────────────────────
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'version-archive', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.resourceType || !body.resourceId || !body.snapshot) {
        return badRequest(reply, request, undefined, 'resourceType, resourceId, and snapshot are required');
      }
      const archive = await service.archive(body);
      return created(reply, request, archive);
    } catch (err: any) {
      logger.error({ err }, 'Failed to archive version');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET / — List archives ───────────────────────────────────────────────
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'version-archive', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const archives = await service.list({ resourceType: query.resourceType });
      return success(reply, request, archives);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list version archives');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id — Get archive details ──────────────────────────────────────
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'version-archive', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const archive = await service.getArchive(id);
      return success(reply, request, archive);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, archiveId: (request.params as any).id }, 'Failed to get archive details');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /history/:resourceType/:resourceId — Get archive history ────────
  app.get('/history/:resourceType/:resourceId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'version-archive', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { resourceType, resourceId } = request.params as { resourceType: string; resourceId: string };
      const query = request.query as any;
      const history = await service.getHistory(resourceType, resourceId, query.limit ? parseInt(query.limit, 10) : 20);
      return success(reply, request, history);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get archive history');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/restore — Restore from archive ───────────────────────────
  app.post('/:id/restore', {
    onRequest: [authenticateUser, requirePermission({ resource: 'version-archive', action: 'restore' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const snapshot = await service.restore({
        archiveId: id,
        restoredBy: body.restoredBy ?? 'api',
      });
      return success(reply, request, { snapshot });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, archiveId: (request.params as any).id }, 'Failed to restore from archive');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /:id — Delete archive ────────────────────────────────────────
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'version-archive', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.delete(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, archiveId: (request.params as any).id }, 'Failed to delete archive');
      return internalError(reply, request, err.message);
    }
  });
}
