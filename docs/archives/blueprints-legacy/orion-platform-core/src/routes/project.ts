import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as ProjectService from '../services/ProjectService.js';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.post('/tenants/:tenantId/projects', {
    schema: {
      tags: ['Projects'],
      description: 'Create a new project within a tenant',
      params: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          slug: { type: 'string', minLength: 1, maxLength: 50, pattern: '^[a-z0-9-]+$' },
          description: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { tenantId: string }; Body: { name: string; slug: string; description?: string } }>,
    reply: FastifyReply,
  ) => {
    const input = CreateProjectSchema.parse(request.body);
    const project = await ProjectService.createProject(request.params.tenantId, input);
    reply.code(201).send({ success: true, data: project });
  });

  app.get('/tenants/:tenantId/projects', {
    schema: {
      tags: ['Projects'],
      description: 'List projects for a tenant',
    },
  }, async (
    request: FastifyRequest<{ Params: { tenantId: string }; Querystring: { page?: string; limit?: string } }>,
    reply: FastifyReply,
  ) => {
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);

    const { projects, total } = await ProjectService.listProjects(request.params.tenantId, { page, limit });

    reply.send({
      success: true,
      data: projects,
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

  app.get('/projects/:id', {
    schema: {
      tags: ['Projects'],
      description: 'Get a project by ID',
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const project = await ProjectService.getProject(request.params.id);
    if (!project) {
      return reply.code(404).send({ success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } });
    }
    reply.send({ success: true, data: project });
  });

  app.patch('/projects/:id', {
    schema: {
      tags: ['Projects'],
      description: 'Update a project',
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const project = await ProjectService.updateProject(request.params.id, request.body as any);
    if (!project) {
      return reply.code(404).send({ success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } });
    }
    reply.send({ success: true, data: project });
  });

  app.delete('/projects/:id', {
    schema: {
      tags: ['Projects'],
      description: 'Delete (soft) a project',
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const success = await ProjectService.deleteProject(request.params.id);
    if (!success) {
      return reply.code(404).send({ success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found or already deleted' } });
    }
    reply.send({ success: true });
  });
}
