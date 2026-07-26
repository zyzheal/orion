import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as TenantService from '../services/TenantService.js';

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  settings: z.object({
    maxProjects: z.number().int().positive().optional(),
    maxUsersPerProject: z.number().int().positive().optional(),
    features: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
});

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.post('/tenants', {
    schema: {
      tags: ['Tenants'],
      description: 'Create a new tenant',
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          slug: { type: 'string', minLength: 1, maxLength: 50, pattern: '^[a-z0-9-]+$' },
          plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
          settings: {
            type: 'object',
            properties: {
              maxProjects: { type: 'integer', minimum: 1 },
              maxUsersPerProject: { type: 'integer', minimum: 1 },
              features: { type: 'array', items: { type: 'string' } },
              metadata: { type: 'object' },
            },
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                slug: { type: 'string' },
                status: { type: 'string' },
                plan: { type: 'string' },
                settings: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = CreateTenantSchema.parse(request.body);
    const tenant = await TenantService.createTenant(input);
    reply.code(201).send({ success: true, data: tenant });
  });

  app.get('/tenants', {
    schema: {
      tags: ['Tenants'],
      description: 'List tenants',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          status: { type: 'string', enum: ['active', 'suspended', 'deleted'] },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string; status?: string } }>, reply: FastifyReply) => {
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);
    const status = request.query.status;

    const { tenants, total } = await TenantService.listTenants({ page, limit, status });

    reply.send({
      success: true,
      data: tenants,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });

  app.get('/tenants/:id', {
    schema: {
      tags: ['Tenants'],
      description: 'Get a tenant by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenant = await TenantService.getTenant(request.params.id);
    if (!tenant) {
      return reply.code(404).send({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
    }
    reply.send({ success: true, data: tenant });
  });

  app.patch('/tenants/:id', {
    schema: {
      tags: ['Tenants'],
      description: 'Update a tenant',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenant = await TenantService.updateTenant(request.params.id, request.body as any);
    if (!tenant) {
      return reply.code(404).send({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } });
    }
    reply.send({ success: true, data: tenant });
  });

  app.post('/tenants/:id/suspend', {
    schema: {
      tags: ['Tenants'],
      description: 'Suspend a tenant',
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const success = await TenantService.suspendTenant(request.params.id);
    if (!success) {
      return reply.code(404).send({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found or already suspended' } });
    }
    reply.send({ success: true });
  });
}
