/**
 * Pipeline Controller - Pipeline CRUD API
 */

import { Request, Response } from 'express';
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
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, version, description, yamlDefinition, createdBy } = req.body;

      if (!name || !version || !yamlDefinition) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, version, yamlDefinition',
        });
        return;
      }

      const pipeline = await this.pipelineService.create({
        name,
        version,
        description,
        yamlDefinition,
        createdBy,
      });

      res.status(201).json({
        id: pipeline.id,
        name: pipeline.name,
        version: pipeline.version,
        description: pipeline.description,
        status: pipeline.status,
        createdAt: pipeline.createdAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({
            error: 'CONFLICT',
            message: error.message,
          });
          return;
        }
        if (error.message.includes('validation')) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: error.message,
          });
          return;
        }
      }
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create pipeline',
      });
    }
  }

  /**
   * 获取 Pipeline 列表
   * GET /api/v1/pipelines
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { name, status, limit, offset } = req.query;

      const pipelines = await this.pipelineService.list({
        name: name as string,
        status: status as PipelineStatus,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        data: pipelines.map(p => ({
          id: p.id,
          name: p.name,
          version: p.version,
          description: p.description,
          status: p.status,
          createdAt: p.createdAt,
        })),
        total: pipelines.length,
      });
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list pipelines',
      });
    }
  }

  /**
   * 获取 Pipeline 详情
   * GET /api/v1/pipelines/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const pipeline = await this.pipelineService.getById(id);

      if (!pipeline) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      res.json({
        id: pipeline.id,
        name: pipeline.name,
        version: pipeline.version,
        description: pipeline.description,
        yamlDefinition: pipeline.yamlDefinition,
        status: pipeline.status,
        spec: pipeline.spec,
        createdBy: pipeline.createdBy,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
      });
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get pipeline',
      });
    }
  }

  /**
   * 获取 Pipeline 所有版本
   * GET /api/v1/pipelines/:id/versions
   */
  async getVersions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const pipeline = await this.pipelineService.getById(id);

      if (!pipeline) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      const versions = await this.pipelineService.getVersions(pipeline.name);

      res.json({
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
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get pipeline versions',
      });
    }
  }

  /**
   * 更新 Pipeline
   * PUT /api/v1/pipelines/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { description, yamlDefinition, status } = req.body;

      const pipeline = await this.pipelineService.update(id, {
        description,
        yamlDefinition,
        status,
      });

      if (!pipeline) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      res.json({
        id: pipeline.id,
        name: pipeline.name,
        version: pipeline.version,
        description: pipeline.description,
        yamlDefinition: pipeline.yamlDefinition,
        status: pipeline.status,
        updatedAt: pipeline.updatedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update pipeline',
      });
    }
  }

  /**
   * 删除 Pipeline
   * DELETE /api/v1/pipelines/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.pipelineService.delete(id);

      if (!deleted) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Pipeline '${id}' not found`,
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete pipeline',
      });
    }
  }

  /**
   * 验证 Pipeline YAML
   * POST /api/v1/pipelines/validate
   */
  async validate(req: Request, res: Response): Promise<void> {
    try {
      const { yamlDefinition } = req.body;

      if (!yamlDefinition) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Missing yamlDefinition',
        });
        return;
      }

      const result = await this.pipelineService.validate(yamlDefinition);

      res.json({
        valid: result.valid,
        errors: result.errors,
      });
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to validate pipeline',
      });
    }
  }
}
