/**
 * Pipeline Controller - Pipeline CRUD API (Fastify 版本)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PipelineService } from '../../services/pipeline/PipelineService';
import { PipelineStatus } from '../../models/Pipeline';

export class PipelineController {
  private pipelineService: PipelineService;

  constructor(pipelineService: PipelineService) {
    this.pipelineService = pipelineService;
  }

  /**
   * 创建 Pipeline
   * POST /api/v1/pipelines
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const tenantId = (request.headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000000';
      const { name, version, description, yamlDefinition, createdBy } = body;

      if (!name || !version || !yamlDefinition) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing required fields: name, version, yamlDefinition',
        });
        return;
      }

      const pipeline = await this.pipelineService.create({
        tenant_id: tenantId,
        name,
        version: version.toString(),
        description,
        yamlDefinition,
        createdBy,
      });

      await reply.status(201).send({
        id: pipeline.id,
        name: pipeline.name,
        version: pipeline.version,
        description: pipeline.description,
        status: pipeline.status,
        createdAt: pipeline.created_at,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          await reply.status(409).send({
            error: 'CONFLICT',
            code: '30202',
            message: error.message,
          });
          return;
        }
        if (error.message.includes('validation')) {
          await reply.status(400).send({
            error: 'VALIDATION_ERROR',
            code: '30101',
            message: error.message,
          });
          return;
        }
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to create pipeline',
      });
    }
  }

  /**
   * 获取 Pipeline 列表
   * GET /api/v1/pipelines
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { name, status, limit, offset } = query;
      const tenantId = (request.headers['x-tenant-id'] as string) || undefined;

      const pipelines = await this.pipelineService.list(tenantId);

      await reply.send({
        data: pipelines.map(p => ({
          id: p.id,
          name: p.name,
          version: p.version,
          description: p.description,
          status: p.status,
          createdAt: p.created_at,
        })),
        total: pipelines.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to list pipelines',
      });
    }
  }

  /**
   * 获取 Pipeline 详情
   * GET /api/v1/pipelines/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const pipeline = await this.pipelineService.getById(id);

      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: pipeline.id,
        name: pipeline.name,
        version: pipeline.version,
        description: pipeline.description,
        yamlDefinition: pipeline.yamlDefinition,
        status: pipeline.status,
        spec: pipeline.spec,
        createdBy: pipeline.created_by,
        createdAt: pipeline.created_at,
        updatedAt: pipeline.updated_at,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get pipeline',
      });
    }
  }

  /**
   * 获取 Pipeline 所有版本
   * GET /api/v1/pipelines/:id/versions
   */
  async getVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const pipeline = await this.pipelineService.getById(id);

      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const versions = await this.pipelineService.getVersions(tenantId, pipeline.id);

      await reply.send({
        data: versions.map(v => ({
          id: v.id,
          name: v.name,
          version: v.version,
          description: v.description,
          status: v.status,
          createdAt: v.createdAt,
        })),
        total: versions.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get pipeline versions',
      });
    }
  }

  /**
   * 更新 Pipeline
   * PUT /api/v1/pipelines/:id
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { id } = params;
      const { description, yamlDefinition, status } = body;

      const pipeline = await this.pipelineService.update(id, {
        description,
        yamlDefinition,
        status: status as PipelineStatus | undefined,
      });

      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: pipeline.id,
        name: pipeline.name,
        version: pipeline.version,
        description: pipeline.description,
        yamlDefinition: pipeline.yamlDefinition,
        status: pipeline.status,
        updatedAt: pipeline.updated_at,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation')) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: error.message,
        });
        return;
      }
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to update pipeline',
      });
    }
  }

  /**
   * 删除 Pipeline
   * DELETE /api/v1/pipelines/:id
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;
      const deleted = await this.pipelineService.delete(id);

      if (!deleted) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      await reply.status(204).send();
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to delete pipeline',
      });
    }
  }

  /**
   * 验证 Pipeline YAML
   * POST /api/v1/pipelines/validate
   */
  async validate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { yamlDefinition } = body;

      if (!yamlDefinition) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing yamlDefinition',
        });
        return;
      }

      const result = await this.pipelineService.validate(yamlDefinition);

      await reply.send({
        valid: result.valid,
        errors: result.errors,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to validate pipeline',
      });
    }
  }

  /**
   * Batch start multiple pipelines
   * POST /api/v1/pipelines/batch/start
   */
  async batchStart(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { pipelineIds, branch, environment, parameters, triggeredBy } = body;

      if (!Array.isArray(pipelineIds) || pipelineIds.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'pipelineIds must be a non-empty array',
        });
        return;
      }

      if (pipelineIds.length > 50) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Maximum 50 pipelines can be started in a single batch',
        });
        return;
      }

      const results = await this.pipelineService.batchStart(pipelineIds, {
        branch,
        environment,
        parameters,
        triggeredBy,
      });

      await reply.send({
        data: results,
        total: results.length,
        succeeded: results.filter(r => r.status !== 'error').length,
        failed: results.filter(r => r.status === 'error').length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to batch start pipelines',
      });
    }
  }

  /**
   * Batch stop multiple pipeline runs (executions)
   * POST /api/v1/pipeline-runs/batch/stop
   */
  async batchStop(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { executionIds } = body;

      if (!Array.isArray(executionIds) || executionIds.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'executionIds must be a non-empty array',
        });
        return;
      }

      if (executionIds.length > 50) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Maximum 50 executions can be stopped in a single batch',
        });
        return;
      }

      const results = await this.pipelineService.batchStop(executionIds);

      await reply.send({
        data: results,
        total: results.length,
        succeeded: results.filter(r => r.status === 'cancelled').length,
        failed: results.filter(r => r.status === 'error').length,
        skipped: results.filter(r => r.status === 'skipped').length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to batch stop executions',
      });
    }
  }

  /**
   * Batch delete multiple pipelines
   * POST /api/v1/pipelines/batch/delete
   */
  async batchDelete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any || {};
      const { pipelineIds } = body;

      if (!Array.isArray(pipelineIds) || pipelineIds.length === 0) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'pipelineIds must be a non-empty array',
        });
        return;
      }

      if (pipelineIds.length > 50) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Maximum 50 pipelines can be deleted in a single batch',
        });
        return;
      }

      const results = await this.pipelineService.batchDelete(pipelineIds);

      await reply.send({
        data: results,
        total: results.length,
        succeeded: results.filter(r => r.deleted).length,
        failed: results.filter(r => !r.deleted).length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to batch delete pipelines',
      });
    }
  }
}