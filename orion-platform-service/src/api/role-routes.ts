/**
 * Role Management API Routes
 *
 * Routes under /api/v1/roles
 * Migrated to PostgreSQL Repository pattern (RBAC)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { RoleRepository } from '../services/role/RoleRepository';
import { RoleService } from '../services/role/RoleService';
import { RoleController } from './controllers/RoleController';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission, getAuthzEngine } from '../middleware/requirePermission';

interface RoleRoutesOptions {
  database?: DatabasePool;
}

export default async function roleRoutes(
  app: FastifyInstance,
  options: RoleRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new RoleRepository(options.database)
    : undefined;

  let controller: RoleController | null = null;
  if (repository) {
    const service = new RoleService(repository);
    controller = new RoleController(service);
  } else {
    console.warn('[RoleRoutes] No database pool provided, role routes will return 503');
  }

  // Handler for when DB is unavailable
  const unavailableHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Role management requires database connection',
    });
  };

  const listHandler = controller
    ? (request: FastifyRequest, reply: FastifyReply) => controller!.list(request, reply)
    : unavailableHandler;
  const getHandler = controller
    ? (request: FastifyRequest, reply: FastifyReply) => controller!.getDetail(request, reply)
    : unavailableHandler;

  // Wrapped handlers that invalidate cache after write operations
  const createHandler = controller
    ? async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await controller!.create(request, reply);
        // Invalidate tenant cache after role creation
        const authz = getAuthzEngine();
        if (authz && request.user?.tenantId) {
          authz.invalidateTenantCache(request.user.tenantId).catch(() => {});
        }
        return result;
      }
    : unavailableHandler;

  const deleteHandler = controller
    ? async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await controller!.delete(request, reply);
        // Invalidate tenant cache after role deletion
        const authz = getAuthzEngine();
        if (authz && request.user?.tenantId) {
          authz.invalidateTenantCache(request.user.tenantId).catch(() => {});
        }
        return result;
      }
    : unavailableHandler;

  const updateHandler = controller
    ? async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await controller!.update(request, reply);
        // Invalidate tenant cache after role update
        const authz = getAuthzEngine();
        if (authz && request.user?.tenantId) {
          authz.invalidateTenantCache(request.user.tenantId).catch(() => {});
        }
        return result;
      }
    : unavailableHandler;

  // ==================== Role CRUD ====================

  // GET /api/v1/roles?tenantId=xxx — list roles for a tenant
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'role', action: 'read' })],
  }, listHandler);

  // GET /api/v1/roles/:id — role detail
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'role', action: 'read' })],
  }, getHandler);

  // POST /api/v1/roles — create role
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'role', action: 'write' })],
  }, createHandler);

  // DELETE /api/v1/roles/:id — delete role
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'role', action: 'delete' })],
  }, deleteHandler);

  // PUT /api/v1/roles/:id — update role
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'role', action: 'write' })],
  }, updateHandler);
}
