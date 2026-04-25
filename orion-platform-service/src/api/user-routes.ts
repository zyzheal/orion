/**
 * User Management API Routes
 *
 * Routes under /api/v1/users
 * Uses PostgreSQL Repository pattern via UserService + UserRepository
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { UserRepository } from '../services/user/UserRepository';
import { UserService } from '../services/user/UserService';
import { UserController } from './controllers/UserController';

interface UserRoutesOptions {
  database?: DatabasePool;
}

export default async function userRoutes(
  app: FastifyInstance,
  options: UserRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new UserRepository(options.database)
    : undefined;

  if (!repository) {
    console.warn('[UserRoutes] No database pool provided, user routes will not be functional');
    return;
  }

  const service = new UserService(repository);
  const controller = new UserController(service);

  // ==================== User CRUD ====================

  // GET /api/v1/users — List users with pagination
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/users/:id — Get user detail
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDetail(request, reply);
  });

  // POST /api/v1/users — Create user
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.create(request, reply);
  });

  // PUT /api/v1/users/:id — Update user
  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.update(request, reply);
  });

  // DELETE /api/v1/users/:id — Soft delete user
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.delete(request, reply);
  });

  // ==================== Authentication ====================

  // POST /api/v1/users/authenticate — Authenticate user (internal use)
  app.post('/authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.authenticate(request, reply);
  });

  // POST /api/v1/users/:id/change-password — Change user password
  app.post('/:id/change-password', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.changePassword(request, reply);
  });

  // ==================== Tenant Management ====================

  // GET /api/v1/users/by-tenant/:tenantId — Get users by tenant
  app.get('/by-tenant/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getUsersByTenant(request, reply);
  });

  // POST /api/v1/users/:userId/tenants/:tenantId — Add user to tenant
  app.post('/:userId/tenants/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.addUserToTenant(request, reply);
  });

  // DELETE /api/v1/users/:userId/tenants/:tenantId — Remove user from tenant
  app.delete('/:userId/tenants/:tenantId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.removeUserFromTenant(request, reply);
  });
}
