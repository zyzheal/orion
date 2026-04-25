/**
 * EnvironmentController - API handler for Environment management
 *
 * Handles HTTP requests for environment CRUD operations.
 * Environments define deployment targets (dev, staging, prod) for projects.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { EnvironmentService, CreateEnvironmentInput, UpdateEnvironmentInput } from '../../services/environment/EnvironmentService';
import { EnvironmentServiceError } from '../../services/environment/EnvironmentService';

export class EnvironmentController {
  private service: EnvironmentService;

  constructor(service: EnvironmentService) {
    this.service = service;
  }

  /**
   * POST /api/v1/environments - Create a new environment
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as CreateEnvironmentInput;

    if (!body.projectId || !body.name || !body.type) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'projectId, name, and type are required',
      });
      return;
    }

    try {
      const env = await this.service.createEnvironment(body);
      reply.status(201).send({
        id: env.id,
        project_id: env.project_id,
        name: env.name,
        type: env.type,
        cluster: env.cluster,
        namespace: env.namespace,
        config: env.config,
        status: env.status,
        created_at: env.created_at,
        updated_at: env.updated_at,
      });
    } catch (error) {
      if (error instanceof EnvironmentServiceError && error.code === 'INVALID_INPUT') {
        reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
      } else {
        reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create environment' });
      }
    }
  }

  /**
   * GET /api/v1/environments - List all environments (with optional project filter)
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { projectId?: string };

    try {
      let envs;
      if (query.projectId) {
        envs = await this.service.listByProject(query.projectId);
      } else {
        envs = await this.service.listAll();
      }
      reply.send(envs.map(e => ({
        id: e.id,
        project_id: e.project_id,
        name: e.name,
        type: e.type,
        cluster: e.cluster,
        namespace: e.namespace,
        config: e.config,
        status: e.status,
        created_at: e.created_at,
        updated_at: e.updated_at,
      })));
    } catch (error) {
      reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to list environments' });
    }
  }

  /**
   * GET /api/v1/environments/:id - Get environment detail
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const env = await this.service.getEnvironment(id);
      reply.send({
        id: env.id,
        project_id: env.project_id,
        name: env.name,
        type: env.type,
        cluster: env.cluster,
        namespace: env.namespace,
        config: env.config,
        status: env.status,
        created_at: env.created_at,
        updated_at: env.updated_at,
      });
    } catch (error) {
      if (error instanceof EnvironmentServiceError && error.code === 'NOT_FOUND') {
        reply.status(404).send({ error: 'NOT_FOUND', message: error.message });
      } else {
        reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to get environment' });
      }
    }
  }

  /**
   * PUT /api/v1/environments/:id - Update environment
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateEnvironmentInput;

    try {
      const env = await this.service.updateEnvironment(id, body);
      reply.send({
        id: env.id,
        project_id: env.project_id,
        name: env.name,
        type: env.type,
        cluster: env.cluster,
        namespace: env.namespace,
        config: env.config,
        status: env.status,
        created_at: env.created_at,
        updated_at: env.updated_at,
      });
    } catch (error) {
      if (error instanceof EnvironmentServiceError) {
        if (error.code === 'NOT_FOUND') {
          reply.status(404).send({ error: 'NOT_FOUND', message: error.message });
        } else if (error.code === 'INVALID_INPUT') {
          reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
        } else {
          reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update environment' });
        }
      } else {
        reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update environment' });
      }
    }
  }

  /**
   * DELETE /api/v1/environments/:id - Delete environment
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      await this.service.deleteEnvironment(id);
      reply.status(204).send();
    } catch (error) {
      if (error instanceof EnvironmentServiceError) {
        if (error.code === 'NOT_FOUND') {
          reply.status(404).send({ error: 'NOT_FOUND', message: error.message });
        } else {
          reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to delete environment' });
        }
      } else {
        reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to delete environment' });
      }
    }
  }

  /**
   * POST /api/v1/environments/:id/status - Update environment status
   */
  async updateStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const body = request.body as { status: string };

    if (!body.status) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'status is required',
      });
      return;
    }

    try {
      const env = await this.service.updateStatus(id, body.status);
      reply.send({
        id: env.id,
        project_id: env.project_id,
        name: env.name,
        type: env.type,
        status: env.status,
        updated_at: env.updated_at,
      });
    } catch (error) {
      if (error instanceof EnvironmentServiceError) {
        if (error.code === 'NOT_FOUND') {
          reply.status(404).send({ error: 'NOT_FOUND', message: error.message });
        } else if (error.code === 'INVALID_INPUT') {
          reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
        } else {
          reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update status' });
        }
      } else {
        reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update status' });
      }
    }
  }
}
