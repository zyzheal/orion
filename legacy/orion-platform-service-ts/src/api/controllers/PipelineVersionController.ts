/**
 * PipelineVersionController - Pipeline version management API
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { PipelineVersionService } from '../../services/pipeline/PipelineVersionService';
import { PipelineService } from '../../services/pipeline/PipelineService';

export class PipelineVersionController extends BaseController {
  private versionService: PipelineVersionService;
  private pipelineService: PipelineService;

  constructor(versionService: PipelineVersionService, pipelineService: PipelineService) {
    super();
    this.versionService = versionService;
    this.pipelineService = pipelineService;
  }

  /**
   * List versions for a pipeline
   * GET /api/v1/pipelines/:pipelineId/versions
   */
  async listVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const { pipelineId } = params;
      const { page, limit, tag } = query;

      const pipeline = await this.pipelineService.getById(pipelineId);
      if (!pipeline) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Pipeline '${pipelineId}' not found`,
        });
        return;
      }

      const result = await this.versionService.listVersions(pipelineId, {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        tag,
      });

      await reply.send({
        data: result.data.map((v) => ({
          id: v.id,
          version: v.version,
          changeSummary: v.changeSummary,
          tags: v.tags,
          isBaseline: v.isBaseline,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
          durationMs: v.durationMs,
          successRate: v.successRate,
        })),
        total: result.total,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to list versions',
      });
    }
  }

  /**
   * Get version detail
   * GET /api/v1/pipelines/:pipelineId/versions/:versionId
   */
  async getVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pipelineId, versionId } = params;

      const version = await this.versionService.getVersionById(pipelineId, versionId);
      if (!version) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Version '${versionId}' not found`,
        });
        return;
      }

      await reply.send({
        id: version.id,
        pipelineId: version.pipelineId,
        version: version.version,
        yamlDefinition: version.yamlDefinition,
        spec: version.spec,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        changeSummary: version.changeSummary,
        tags: version.tags,
        isBaseline: version.isBaseline,
        parentVersionId: version.parentVersionId,
        durationMs: version.durationMs,
        successRate: version.successRate,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get version',
      });
    }
  }

  /**
   * Diff two versions
   * GET /api/v1/pipelines/:pipelineId/versions/:versionId/diff?target=:targetVersionId
   */
  async diffVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const { pipelineId, versionId } = params;
      const { target } = query;

      if (!target) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing required query parameter: target',
        });
        return;
      }

      const diff = await this.versionService.diffVersions(pipelineId, versionId, target);
      if (!diff) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: 'One or both versions not found',
        });
        return;
      }

      await reply.send({
        additions: diff.additions,
        deletions: diff.deletions,
        modifications: diff.modifications,
        summary: diff.summary,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to diff versions',
      });
    }
  }

  /**
   * Rollback to a specific version
   * POST /api/v1/pipelines/:pipelineId/versions/:versionId/rollback
   */
  async rollback(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { pipelineId, versionId } = params;
      const { reason } = body;

      const tenantId = this.getTenantId(request);
      const createdBy = (request.headers['x-user-id'] as string) || undefined;

      const newVersion = await this.versionService.rollbackToVersion(pipelineId, versionId, {
        reason,
        createdBy,
      });
      if (!newVersion) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Version '${versionId}' not found`,
        });
        return;
      }

      // Update the pipeline's current yamlDefinition to match the rolled-back version
      await this.pipelineService.update(pipelineId, {
        yamlDefinition: newVersion.yamlDefinition,
        spec: newVersion.spec,
      });

      await reply.status(201).send({
        id: newVersion.id,
        version: newVersion.version,
        yamlDefinition: newVersion.yamlDefinition,
        spec: newVersion.spec,
        changeSummary: newVersion.changeSummary,
        parentVersionId: newVersion.parentVersionId,
        createdAt: newVersion.createdAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to rollback version',
      });
    }
  }

  /**
   * Add a tag to a version
   * POST /api/v1/pipelines/:pipelineId/versions/:versionId/tag
   */
  async addTag(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { pipelineId, versionId } = params;
      const { tag } = body;

      if (!tag) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          code: '30101',
          message: 'Missing required field: tag',
        });
        return;
      }

      const tags = await this.versionService.addTag(pipelineId, versionId, tag);
      if (!tags) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Version '${versionId}' not found`,
        });
        return;
      }

      await reply.send({ success: true, tags });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to add tag',
      });
    }
  }

  /**
   * Remove a tag from a version
   * DELETE /api/v1/pipelines/:pipelineId/versions/:versionId/tag/:tag
   */
  async removeTag(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pipelineId, versionId, tag } = params;

      const tags = await this.versionService.removeTag(pipelineId, versionId, tag);
      if (!tags) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Version '${versionId}' not found`,
        });
        return;
      }

      await reply.send({ success: true, tags });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to remove tag',
      });
    }
  }

  /**
   * Set or unset baseline for a version
   * POST /api/v1/pipelines/:pipelineId/versions/:versionId/baseline
   */
  async setBaseline(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { pipelineId, versionId } = params;
      const { baseline } = body;

      const isBaseline = baseline !== false; // default to true if not specified

      const success = await this.versionService.setBaseline(pipelineId, versionId, isBaseline);
      if (!success) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Version '${versionId}' not found`,
        });
        return;
      }

      await reply.send({ success: true, isBaseline });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to set baseline',
      });
    }
  }
}
