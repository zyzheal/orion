/**
 * Project Management API Routes
 *
 * Routes under /api/v1/projects
 * Uses PostgreSQL Repository pattern via ProjectRepository + ProjectService
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ProjectRepository } from '../services/project/ProjectRepository';
import { ProjectService, ProjectServiceError } from '../services/project/ProjectService';

interface ProjectRoutesOptions {
  database?: DatabasePool;
}

interface CreateProjectBody {
  name: string;
  tenantId: string;
  description?: string;
}

export default async function projectRoutes(
  app: FastifyInstance,
  options: ProjectRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new ProjectRepository(options.database)
    : undefined;

  if (!repository) {
    console.warn('[ProjectRoutes] No database pool provided, project routes will not be functional');
    return;
  }

  const service = new ProjectService(repository);

  // ==================== Project CRUD ====================

  // GET /api/v1/projects?tenantId=xxx — list projects for a tenant
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.query as { tenantId: string };

    if (!tenantId) {
      return reply.status(400).send({
        error: 'MISSING_TENANT_ID',
        message: 'tenantId query parameter is required',
      });
    }

    try {
      const projects = await service.listProjects(tenantId);
      return reply.send({ data: projects, total: projects.length });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'LIST_ERROR',
        message: error.message,
      });
    }
  });

  // GET /api/v1/projects/:id — project detail
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const project = await service.getProject(id);
      return reply.send(project);
    } catch (error: any) {
      if (error instanceof ProjectServiceError && error.code === 'NOT_FOUND') {
        return reply.status(404).send({
          error: 'PROJECT_NOT_FOUND',
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'GET_ERROR',
        message: error.message,
      });
    }
  });

  // POST /api/v1/projects — create project
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateProjectBody;

    if (!body.tenantId || !body.name) {
      return reply.status(400).send({
        error: 'INVALID_INPUT',
        message: 'tenantId and name are required',
      });
    }

    try {
      const project = await service.createProject(body.tenantId, body.name, body.description);
      return reply.status(201).send(project);
    } catch (error: any) {
      if (error instanceof ProjectServiceError && error.code === 'INVALID_INPUT') {
        return reply.status(400).send({
          error: error.code,
          message: error.message,
        });
      }
      return reply.status(500).send({
        error: 'CREATE_ERROR',
        message: error.message,
      });
    }
  });

  // DELETE /api/v1/projects/:id — delete project
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const deleted = await service.deleteProject(id);
      if (!deleted) {
        return reply.status(404).send({
          error: 'PROJECT_NOT_FOUND',
          message: `Project not found: ${id}`,
        });
      }
      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(500).send({
        error: 'DELETE_ERROR',
        message: error.message,
      });
    }
  });
}
