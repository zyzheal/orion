/**
 * CI Type Designer API Routes
 *
 * Routes under /api/v1/ci-types
 * Manages CI type definitions, attributes, validation, and versioning.
 *
 * Prefix: /ci-types
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { CITypeRepository } from '../services/cmdb/ci-type/CITypeRepository';
import { CIAttributeRepository } from '../services/cmdb/ci-type/CIAttributeRepository';
import { CITypeVersionRepository } from '../services/cmdb/ci-type/CITypeVersionRepository';
import { CITypeService } from '../services/cmdb/ci-type/CITypeService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ci-type-routes');

interface CITypeRoutesOptions {
  database: DatabasePool;
}

export default async function ciTypeRoutes(
  app: FastifyInstance,
  options: CITypeRoutesOptions,
): Promise<void> {
  const typeRepo = new CITypeRepository(options.database);
  const attributeRepo = new CIAttributeRepository(options.database);
  const versionRepo = new CITypeVersionRepository(options.database);
  const service = new CITypeService(typeRepo, attributeRepo, versionRepo);

  // ==================== CI Types ====================

  // ── GET /ci-types — List CI types ─────────────────────────────────────
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const result = await service.listTypes({
        status: query.status,
        search: query.search,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return success(reply, request, result.data, { total: result.total });
    } catch (err: any) {
      logger.error({ err }, 'Failed to list CI types');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /ci-types — Create CI type ───────────────────────────────────
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.displayName) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name and displayName are required');
      }
      const type = await service.createType({
        name: body.name,
        displayName: body.displayName,
        description: body.description,
        icon: body.icon,
        parentTypeId: body.parentTypeId,
        k8sType: body.k8sType,
        isSystem: body.isSystem,
        status: body.status,
        sortOrder: body.sortOrder,
        metadata: body.metadata,
        createdBy: body.createdBy,
      });
      return created(reply, request, type);
    } catch (err: any) {
      if (err.code === 'BIZ.RESOURCE.CONFLICT') {
        return badRequest(reply, request, ErrorCodes.CLIENT_CONFLICT, err.message);
      }
      logger.error({ err }, 'Failed to create CI type');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /ci-types/:id — Get CI type with attributes ───────────────────
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const schema = await service.getTypeWithSchema(id);
      return success(reply, request, schema);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to get CI type');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /ci-types/:id — Update CI type ────────────────────────────────
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const type = await service.updateType(id, body);
      return success(reply, request, type);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to update CI type');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /ci-types/:id — Delete CI type ─────────────────────────────
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.deleteType(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to delete CI type');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Attributes ====================

  // ── GET /ci-types/:id/attributes — Get attributes ─────────────────────
  app.get('/:id/attributes', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const attributes = await service.getAttributes(id);
      return success(reply, request, attributes);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to get attributes');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /ci-types/:id/attributes — Set attributes (bulk upsert) ──────
  app.put('/:id/attributes', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      if (!Array.isArray(body.attributes)) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'attributes must be an array');
      }
      const attributes = await service.setAttributes(id, body.attributes);
      return success(reply, request, attributes);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to set attributes');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Validation ====================

  // ── POST /ci-types/:id/validate — Validate instance data ──────────────
  app.post('/:id/validate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      if (!body.data || typeof body.data !== 'object') {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'data object is required');
      }
      const result = await service.validateInstance(id, body.data);
      return success(reply, request, result);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to validate instance');
      return internalError(reply, request, err.message);
    }
  });

  // ==================== Versions ====================

  // ── POST /ci-types/:id/versions — Create version snapshot ─────────────
  app.post('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as any;
      const version = await service.createVersion(id, body.changeSummary);
      return created(reply, request, version);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to create version');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /ci-types/:id/versions — List versions ────────────────────────
  app.get('/:id/versions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const versions = await service.getVersions(id);
      return success(reply, request, versions);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to list versions');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /ci-types/:id/versions/:versionId/rollback — Rollback ───────
  app.post('/:id/versions/:versionId/rollback', {
    onRequest: [authenticateUser, requirePermission({ resource: 'cmdb', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id, versionId } = request.params as { id: string; versionId: string };
      const type = await service.rollback(id, versionId);
      return success(reply, request, type);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, ErrorCodes.CLIENT_RESOURCE_NOT_FOUND, err.message);
      logger.error({ err, typeId: (request.params as any).id }, 'Failed to rollback');
      return internalError(reply, request, err.message);
    }
  });
}
