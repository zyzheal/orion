/**
 * Script Library API Routes
 *
 * CRUD for script definitions, version management, parameter management, and execution.
 *
 * Prefix: /api/v1/script-library
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { ScriptLibraryRepository } from '../services/script-library/ScriptLibraryRepository';
import { ScriptVersionRepository } from '../services/script-library/ScriptVersionRepository';
import { ScriptParameterRepository } from '../services/script-library/ScriptParameterRepository';
import { ScriptExecutionRepository } from '../services/script-library/ScriptExecutionRepository';
import { ScriptLibraryService } from '../services/script-library/ScriptLibraryService';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'script-library-routes' });

interface ScriptLibraryRoutesOptions {
  database: DatabasePool;
}

export default async function scriptLibraryRoutes(
  app: FastifyInstance,
  options: ScriptLibraryRoutesOptions,
): Promise<void> {
  const libraryRepo = new ScriptLibraryRepository(options.database);
  const versionRepo = new ScriptVersionRepository(options.database);
  const paramRepo = new ScriptParameterRepository(options.database);
  const executionRepo = new ScriptExecutionRepository(options.database);
  const service = new ScriptLibraryService(libraryRepo, versionRepo, paramRepo, executionRepo);

  // ── GET / — List scripts ─────────────────────────────────────────────────
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const scripts = await service.listScripts({
        category: query.category,
        enabled: query.enabled === 'true' ? true : query.enabled === 'false' ? false : undefined,
      });
      return success(reply, request, scripts);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list scripts');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST / — Create script ───────────────────────────────────────────────
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.scriptType || !body.content) {
        return badRequest(reply, request, undefined, 'name, scriptType and content are required');
      }
      const userId = (request as any).userId;
      const script = await service.createScript({
        ...body,
        createdBy: userId,
      });
      return created(reply, request, script);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create script');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id — Get script detail ─────────────────────────────────────────
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const script = await service.getScript(id);
      return success(reply, request, script);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to get script');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /:id — Update script ─────────────────────────────────────────────
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const script = await service.updateScript(id, body);
      return success(reply, request, script);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to update script');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /:id — Delete script ──────────────────────────────────────────
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteScript(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to delete script');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/versions — List versions ────────────────────────────────────
  app.get('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const versions = await service.getVersions(id);
      return success(reply, request, versions);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to list versions');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/versions — Create new version ──────────────────────────────
  app.post('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      if (!body.content) {
        return badRequest(reply, request, undefined, 'content is required');
      }
      const userId = (request as any).userId;
      const version = await service.createVersion(id, {
        content: body.content,
        changelog: body.changelog,
        createdBy: userId,
      });
      return created(reply, request, version);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to create version');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/versions/:version/rollback — Rollback to version ───────────
  app.post('/:id/versions/:version/rollback', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, version } = request.params as { id: string; version: string };
      const targetVersion = parseInt(version, 10);
      if (isNaN(targetVersion) || targetVersion < 1) {
        return badRequest(reply, request, undefined, 'Invalid version number');
      }
      const newVersion = await service.rollbackVersion(id, targetVersion);
      return success(reply, request, newVersion);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to rollback version');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/parameters — List parameters ────────────────────────────────
  app.get('/:id/parameters', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const parameters = await service.getParameters(id);
      return success(reply, request, parameters);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to list parameters');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/execute — Execute script ───────────────────────────────────
  app.post('/:id/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      if (!body.targets) {
        return badRequest(reply, request, undefined, 'targets is required');
      }
      const userId = (request as any).userId;
      const execution = await service.executeScript(id, {
        version: body.version,
        targets: body.targets,
        params: body.params,
        executedBy: userId,
      });
      return created(reply, request, execution);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      if (err.code === 'VALIDATION_ERROR') return badRequest(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to execute script');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/executions — Execution history ──────────────────────────────
  app.get('/:id/executions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'script-library', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as any;
      const executions = await service.getExecutionHistory(id, query.limit ? parseInt(query.limit, 10) : 20);
      return success(reply, request, executions);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, scriptId: (request.params as any).id }, 'Failed to get execution history');
      return internalError(reply, request, err.message);
    }
  });

  logger.info('Script library routes registered');
}
