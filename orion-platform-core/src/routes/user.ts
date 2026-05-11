import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CreateUserInput, UpdateUserInput } from '../types/core.js';
import * as UserService from '../services/UserService.js';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Params: { tenantId: string };
    Body: CreateUserInput;
  }>('/tenants/:tenantId/users', {
    schema: {
      description: 'Create a user in the specified tenant',
      tags: ['users'],
      params: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
        required: ['tenantId'],
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
          metadata: { type: 'object' },
        },
        required: ['email'],
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: { tenantId: string }; Body: CreateUserInput }>,
      reply,
    ) => {
      const { tenantId } = request.params;
      const user = await UserService.createUser(tenantId, request.body);
      return reply.code(201).send({ success: true, data: user });
    },
  });

  fastify.get<{ Params: { id: string } }>('/users/:id', {
    schema: {
      description: 'Get user by ID',
      tags: ['users'],
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const user = await UserService.getUser(request.params.id);
      if (!user) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return reply.send({ success: true, data: user });
    },
  });

  fastify.get<{
    Params: { tenantId: string };
    Querystring: { status?: string; page?: string; limit?: string };
  }>('/tenants/:tenantId/users', {
    schema: {
      description: 'List users in a tenant',
      tags: ['users'],
    },
    handler: async (
      request: FastifyRequest<{ Params: { tenantId: string }; Querystring: { status?: string; page?: string; limit?: string } }>,
      reply,
    ) => {
      const { tenantId } = request.params;
      const page = request.query.page ? parseInt(request.query.page, 10) : 1;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
      const status = request.query.status;

      const result = await UserService.listUsers({ tenantId, status, page, limit });
      return reply.send({ success: true, data: result.users, pagination: { page, limit, total: result.total } });
    },
  });

  fastify.patch<{
    Params: { id: string };
    Body: UpdateUserInput;
  }>('/users/:id', {
    schema: {
      description: 'Update user',
      tags: ['users'],
    },
    handler: async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserInput }>,
      reply,
    ) => {
      const user = await UserService.updateUser(request.params.id, request.body);
      if (!user) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return reply.send({ success: true, data: user });
    },
  });

  fastify.post<{ Params: { id: string } }>('/users/:id/disable', {
    schema: {
      description: 'Disable a user',
      tags: ['users'],
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const result = await UserService.disableUser(request.params.id);
      if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return reply.send({ success: true, data: { message: 'User disabled' } });
    },
  });
}
