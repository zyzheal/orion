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

  if (!repository) {
    console.warn('[RoleRoutes] No database pool provided, role routes will not be functional');
    return;
  }

  const service = new RoleService(repository);
  const controller = new RoleController(service);

  // ==================== Role CRUD ====================

  // GET /api/v1/roles?tenantId=xxx — list roles for a tenant
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/roles/:id — role detail
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDetail(request, reply);
  });

  // POST /api/v1/roles — create role
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // DELETE /api/v1/roles/:id — delete role
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });
}
