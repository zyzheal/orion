/**
 * User Management API Routes
 *
 * Routes under /api/v1/users
 * Uses PostgreSQL Repository pattern via UserService + UserRepository
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { RedisCache } from '../services/redis-cache';
import { UserRepository } from '../services/user/UserRepository';
import { UserService } from '../services/user/UserService';
import { UserController } from './controllers/UserController';
import { CacheService } from '../services/cache/CacheService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface UserRoutesOptions {
  database?: DatabasePool;
  redis?: RedisCache;
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

  const cache = new CacheService(options.redis || null, 300);
  const service = new UserService(repository, cache);
  const controller = new UserController(service);

  // ==================== User CRUD ====================

  // GET /api/v1/users — List users with pagination
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resourceType: 'user', action: 'read' })],
    schema: {
      tags: ['user'],
      summary: 'List users',
      description: 'Returns a paginated list of users with optional search filtering',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, description: 'Page number' },
          pageSize: { type: 'number', default: 20, description: 'Items per page' },
          search: { type: 'string', description: 'Search by name or email' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'number' },
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.list(request, reply);
  });

  // GET /api/v1/users/:id — Get user detail
  app.get('/:id', {
    schema: {
      tags: ['user'],
      summary: 'Get user by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDetail(request, reply);
  });

  // POST /api/v1/users — Create user
  app.post('/', {
    schema: {
      tags: ['user'],
      summary: 'Create a new user',
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', description: 'User display name' },
          email: { type: 'string', format: 'email', description: 'User email address' },
          role: { type: 'string', description: 'User role' },
          tenantId: { type: 'string', description: 'Associated tenant ID' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
