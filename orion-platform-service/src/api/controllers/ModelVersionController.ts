/**
 * Model Version Controller — 模型版本管理控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  ModelVersionService,
  ModelRegistrationInput,
  ABTestVariant,
} from '../../services/ai/ModelVersionService';

export class ModelVersionController {
  private service: ModelVersionService;

  constructor(service: ModelVersionService) {
    this.service = service;
  }

  /**
   * POST /api/v1/ai-models
   * 注册模型
   */
  async registerModel(
    request: FastifyRequest<{ Body: ModelRegistrationInput }>,
    reply: FastifyReply
  ) {
    const body = request.body;

    if (!body.name || !body.version || !body.framework) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'name, version, and framework are required',
      });
    }

    try {
      const model = this.service.registerModel(body);

      return reply.status(201).send({
        data: model,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes('already exists')) {
        return reply.status(409).send({
          error: 'CONFLICT',
          message: err.message,
        });
      }
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-models
   * 模型列表
   */
  async listModels(
    request: FastifyRequest<{
      Querystring: {
        status?: string;
        framework?: string;
        name?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const { status, framework, name } = request.query;

    try {
      const models = this.service.listModels({
        status: status as any,
        framework: framework as any,
        name,
      });

      return reply.send({
        data: models,
        meta: {
          total: models.length,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-models/:modelName/versions
   * 获取版本列表
   */
  async getModelVersions(
    request: FastifyRequest<{
      Params: { modelName: string };
      Querystring: { include_deprecated?: string };
    }>,
    reply: FastifyReply
  ) {
    const { modelName } = request.params;
    const includeDeprecated = request.query.include_deprecated === 'true';

    try {
      const versions = this.service.getModelVersions(modelName, includeDeprecated);

      if (versions.length === 0) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `No versions found for model: ${modelName}`,
        });
      }

      const active = this.service.getActiveModel(modelName);

      return reply.send({
        data: versions,
        meta: {
          total: versions.length,
          activeVersion: active?.version,
        },
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/ai-models/:modelId/activate
   * 激活模型
   */
  async activateModel(
    request: FastifyRequest<{ Params: { modelId: string } }>,
    reply: FastifyReply
  ) {
    const { modelId } = request.params;

    try {
      const model = this.service.activateModel(modelId);

      return reply.send({
        data: model,
        message: `Model ${model.name}@${model.version} is now active`,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes('not found')) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/ai-models/:modelId/deprecate
   * 废弃模型
   */
  async deprecateModel(
    request: FastifyRequest<{ Params: { modelId: string } }>,
    reply: FastifyReply
  ) {
    const { modelId } = request.params;

    try {
      const model = this.service.deprecateModel(modelId);

      return reply.send({
        data: model,
        message: `Model ${model.name}@${model.version} has been deprecated`,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes('not found')) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-models/:modelName/ab-test
   * A/B 测试结果
   */
  async getABTestResults(
    request: FastifyRequest<{
      Params: { modelName: string };
      Querystring: { action?: string; variants?: string; traffic_split?: string; target_metrics?: string };
      Body?: any;
    }>,
    reply: FastifyReply
  ) {
    const { modelName } = request.params;
    const { action } = request.query;

    try {
      // 支持通过 query 操作 A/B 测试
      if (action === 'create') {
        return this.createABTest(request, reply);
      }
      if (action === 'complete') {
        return this.completeABTest(request, reply);
      }
      if (action === 'pause') {
        return this.pauseABTest(request, reply);
      }

      // 默认：获取 A/B 测试结果
      const results = this.service.getABTestResults(modelName);

      if (!results) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `No AB test found for model: ${modelName}`,
        });
      }

      return reply.send({
        data: results,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes('not found')) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/ai-models/:modelName/ab-test (via action=create)
   * 创建 A/B 测试
   */
  private async createABTest(
    request: FastifyRequest<{
      Params: { modelName: string };
      Body?: any;
    }>,
    reply: FastifyReply
  ) {
    const body = (request as any).body;
    if (!body || !body.variants || !body.traffic_split) {
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'variants (array of {modelId, name}) and traffic_split are required',
      });
    }

    try {
      const variants: ABTestVariant[] = body.variants;
      const trafficSplit: Record<string, number> = body.traffic_split;
      const targetMetrics: string[] = body.target_metrics || ['accuracy', 'errorRate', 'avgLatency'];

      const abTest = this.service.createABTest({
        modelName: request.params.modelName,
        variants,
        trafficSplit,
        targetMetrics,
        durationHours: body.duration_hours,
      });

      return reply.status(201).send({
        data: abTest,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: err.message,
      });
    }
  }

  /**
   * POST (via action=complete)
   * 完成 A/B 测试
   */
  private async completeABTest(
    request: FastifyRequest<{
      Params: { modelName: string };
      Body?: any;
    }>,
    reply: FastifyReply
  ) {
    const body = (request as any).body;

    try {
      const result = this.service.completeABTest(request.params.modelName, body?.winner);

      return reply.send({
        data: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: err.message,
      });
    }
  }

  /**
   * POST (via action=pause)
   * 暂停 A/B 测试
   */
  private async pauseABTest(
    request: FastifyRequest<{ Params: { modelName: string } }>,
    reply: FastifyReply
  ) {
    try {
      const abTest = this.service.pauseABTest(request.params.modelName);

      return reply.send({
        data: abTest,
        message: 'AB test paused',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-models/:modelName/performance
   * 模型性能概览
   */
  async getModelPerformance(
    request: FastifyRequest<{ Params: { modelName: string } }>,
    reply: FastifyReply
  ) {
    const { modelName } = request.params;

    try {
      const overview = this.service.getModelPerformanceOverview(modelName);

      return reply.send({
        data: overview,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * GET /api/v1/ai-models/:modelId
   * 获取模型详情
   */
  async getModelById(
    request: FastifyRequest<{ Params: { modelId: string } }>,
    reply: FastifyReply
  ) {
    const { modelId } = request.params;

    try {
      const model = this.service.getModelById(modelId);

      if (!model) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Model not found: ${modelId}`,
        });
      }

      return reply.send({
        data: model,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/v1/ai-models/:modelId/rollback
   * 回滚模型到上一个版本或指定版本
   */
  async rollbackModel(
    request: FastifyRequest<{
      Params: { modelId: string };
      Body?: { targetVersion?: string };
    }>,
    reply: FastifyReply
  ) {
    const { modelId } = request.params;
    const targetVersion = (request.body as any)?.targetVersion;

    try {
      const model = this.service.rollbackModel(modelId, targetVersion);

      return reply.send({
        data: model,
        message: `Model ${model.name} rolled back to version ${model.version}`,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes('not found')) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: err.message,
        });
      }
      return reply.status(400).send({
        error: 'BAD_REQUEST',
        message: err.message,
      });
    }
  }
}
