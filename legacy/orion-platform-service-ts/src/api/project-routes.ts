/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/project/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

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
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = createLogger('project-routes');

interface ProjectRoutesOptions {
  database?: DatabasePool;
}

interface CreateProjectBody {
  name: string;
  tenantId: string;
  description?: string;
}

interface UpdateProjectBody {
  name?: string;
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
    logger.warn('[ProjectRoutes] No database pool provided, project routes will not be functional');
    return;
  }

  const service = new ProjectService(repository);

  // ==================== Project CRUD ====================

  // GET /api/v1/projects?tenantId=xxx — list projects for a tenant
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({
      resource: 'project',
      action: 'read',
    })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.query as { tenantId: string };

    if (!tenantId) {
      return handleError(reply, new ValidationError('MISSING_TENANT_ID'))
    }

    try {
      const projects = await service.listProjects(tenantId);
      return reply.send({ data: projects, total: projects.length });
    } catch (error: any) {
      return handleError(reply, new OrionError('LIST_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // GET /api/v1/projects/:id — project detail
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({
      resource: 'project',
      action: 'read',
      extractResourceId: (req) => (req.params as { id: string }).id,
    })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const project = await service.getProject(id);
      return reply.send(project);
    } catch (error: any) {
      if (error instanceof ProjectServiceError && error.code === 'NOT_FOUND') {
        return handleError(reply, new NotFoundError('PROJECT_NOT_FOUND'))
      }
      return handleError(reply, new OrionError('GET_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // POST /api/v1/projects — create project
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({
      resource: 'project',
      action: 'write',
    })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateProjectBody;

    if (!body.tenantId || !body.name) {
      return handleError(reply, new ValidationError('INVALID_INPUT'))
    }

    try {
      const project = await service.createProject(body.tenantId, body.name, body.description);
      return reply.status(201).send(project);
    } catch (error: any) {
      if (error instanceof ProjectServiceError && error.code === 'INVALID_INPUT') {
        return handleError(reply, new ValidationError(error.message))
      }
      return handleError(reply, new OrionError('CREATE_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // DELETE /api/v1/projects/:id — delete project
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({
      resource: 'project',
      action: 'delete',
      extractResourceId: (req) => (req.params as { id: string }).id,
      requiredImpact: 'high',
    })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const deleted = await service.deleteProject(id);
      if (!deleted) {
        return handleError(reply, new NotFoundError('PROJECT_NOT_FOUND'))
      }
      return reply.status(204).send();
    } catch (error: any) {
      return handleError(reply, new OrionError('DELETE_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });

  // PUT /api/v1/projects/:id — update project
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({
      resource: 'project',
      action: 'write',
      extractResourceId: (req) => (req.params as { id: string }).id,
    })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateProjectBody;

    try {
      const project = await service.updateProject(id, body);
      return reply.send(project);
    } catch (error: any) {
      if (error instanceof ProjectServiceError && error.code === 'NOT_FOUND') {
        return handleError(reply, new NotFoundError('PROJECT_NOT_FOUND'))
      }
      return handleError(reply, new OrionError('UPDATE_ERROR', ErrorCode.INTERNAL_ERROR))
    }
  });
}