/**
 * Ephemeral Environment Controller
 *
 * 处理临时开发环境相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { EphemeralEnvService } from '../../services/ephemeral-env-service';
import { EphemeralEnvStatus } from '../../models/EphemeralEnvironment';

export class EphemeralEnvController {
  private service: EphemeralEnvService;

  constructor(service: EphemeralEnvService) {
    this.service = service;
  }

  /**
   * 创建临时环境
   * POST /api/v1/ephemeral-envs
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;

      if (!body.prId || !body.repoId || !body.branchName) {
        await reply.status(400).send({
          success: false,
          error: 'prId, repoId, and branchName are required',
        });
        return;
      }

      const env = await this.service.create({
        prId: body.prId,
        repoId: body.repoId,
        branchName: body.branchName,
        commitSha: body.commitSha,
        templateId: body.templateId,
        createdBy: body.createdBy,
      });

      await reply.status(201).send({
        success: true,
        data: env,
        message: `Ephemeral environment created: ${env.previewUrl}`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create environment',
      });
    }
  }

  /**
   * 列出环境
   * GET /api/v1/ephemeral-envs
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const envs = await this.service.list({
        prId: query.prId,
        repoId: query.repoId,
        statusFilter: query.status as EphemeralEnvStatus | undefined,
      });

      await reply.send({
        success: true,
        data: envs,
        total: envs.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list environments',
      });
    }
  }

  /**
   * 获取环境详情
   * GET /api/v1/ephemeral-envs/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const env = await this.service.getById(params.id);

      await reply.send({
        success: true,
        data: env,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Environment not found',
      });
    }
  }

  /**
   * 唤醒空闲环境
   * POST /api/v1/ephemeral-envs/:id/wake
   */
  async wake(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const env = await this.service.wake(params.id);

      await reply.send({
        success: true,
        data: env,
        message: 'Environment woken up',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to wake environment',
      });
    }
  }

  /**
   * 销毁环境
   * POST /api/v1/ephemeral-envs/:id/teardown
   */
  async teardown(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const env = await this.service.teardown(params.id, body?.reason || 'manual');

      await reply.send({
        success: true,
        data: env,
        message: 'Environment destroyed',
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to destroy environment',
      });
    }
  }

  /**
   * 获取 Preview URL
   * GET /api/v1/ephemeral-envs/:id/preview
   */
  async getPreviewUrl(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const url = await this.service.getPreviewUrl(params.id);

      await reply.send({
        success: true,
        data: { url },
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Preview URL not available',
      });
    }
  }

  /**
   * 健康检查
   * GET /api/v1/ephemeral-envs/:id/status
   */
  async checkHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const health = await this.service.checkHealth(params.id);

      await reply.send({
        success: true,
        data: health,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Environment not found',
      });
    }
  }

  /**
   * 获取环境使用成本
   * GET /api/v1/ephemeral-envs/:id/cost
   */
  async getCost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const cost = await this.service.getCost(params.id);

      await reply.send({
        success: true,
        data: cost,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to calculate cost',
      });
    }
  }
}
