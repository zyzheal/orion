import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as RBACService from '../services/RBACService.js';

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).min(1),
});

const UpdatePermissionsSchema = z.object({
  permissions: z.array(z.string()).min(0),
});

export async function rbacRoutes(app: FastifyInstance): Promise<void> {
  app.get('/roles', {
    schema: {
      tags: ['RBAC'],
      description: 'List all roles',
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
    reply: FastifyReply,
  ) => {
    const roles = await RBACService.listRoles(request.query.tenantId);
    reply.send({ success: true, data: roles });
  });

  app.post('/roles', {
    schema: {
      tags: ['RBAC'],
      description: 'Create a new role',
      body: {
        type: 'object',
        required: ['name', 'permissions'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          description: { type: 'string', maxLength: 200 },
          permissions: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { name: string; description?: string; permissions: string[] }; Querystring: { tenantId: string } }>,
    reply: FastifyReply,
  ) => {
    const input = CreateRoleSchema.parse(request.body);
    const tenantId = request.query.tenantId;
    const role = await RBACService.createRole(tenantId, input);
    reply.code(201).send({ success: true, data: role });
  });

  app.get('/roles/:id', {
    schema: {
      tags: ['RBAC'],
      description: 'Get a role by ID',
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const role = await RBACService.getRole(request.params.id);
    if (!role) {
      return reply.code(404).send({ success: false, error: { code: 'ROLE_NOT_FOUND', message: 'Role not found' } });
    }
    reply.send({ success: true, data: role });
  });

  app.post('/roles/:id/permissions', {
    schema: {
      tags: ['RBAC'],
      description: 'Update permissions for a role',
      body: {
        type: 'object',
        required: ['permissions'],
        properties: {
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: { permissions: string[] } }>,
    reply: FastifyReply,
  ) => {
    const input = UpdatePermissionsSchema.parse(request.body);
    const role = await RBACService.updatePermissions(request.params.id, input);
    if (!role) {
      return reply.code(404).send({ success: false, error: { code: 'ROLE_NOT_FOUND', message: 'Role not found or is a system role' } });
    }
    reply.send({ success: true, data: role });
  });

  app.post('/roles/assign', {
    schema: {
      tags: ['RBAC'],
      description: 'Assign a role to a user',
      body: {
        type: 'object',
        required: ['userId', 'roleId', 'scope'],
        properties: {
          userId: { type: 'string' },
          roleId: { type: 'string', format: 'uuid' },
          scope: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { userId: string; roleId: string; scope: string } }>,
    reply: FastifyReply,
  ) => {
    const { userId, roleId, scope } = request.body;
    const success = await RBACService.assignRole(userId, roleId, scope);
    reply.send({ success, data: { userId, roleId, scope } });
  });

  app.post('/permissions/check', {
    schema: {
      tags: ['RBAC'],
      description: 'Check if a user has a specific permission',
      body: {
        type: 'object',
        required: ['userId', 'permission', 'scope'],
        properties: {
          userId: { type: 'string' },
          permission: { type: 'string' },
          scope: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { userId: string; permission: string; scope: string } }>,
    reply: FastifyReply,
  ) => {
    const { userId, permission, scope } = request.body;
    const hasPermission = await RBACService.checkPermission(userId, permission, scope);
    reply.send({ success: true, data: { userId, permission, scope, hasPermission } });
  });
}
