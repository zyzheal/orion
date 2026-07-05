/**
 * RunnerController — Runner 管理 API 控制器
 *
 * 处理 Runner Agent 的注册、心跳、注销和 Job 结果回报。
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { RunnerPoolService } from '../../services/pipeline/RunnerPoolService';
import { RunnerCreateInput } from '../../models/Runner';

export class RunnerController extends BaseController {
  private poolService: RunnerPoolService;

  constructor(db: any) {
    super();
    this.poolService = new RunnerPoolService(db);
  }

  /**
   * POST /api/v1/runners — 注册 Runner
   */
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = request.body as RunnerCreateInput;

    if (!input.tenantId || !input.name || !input.labels || !input.maxConcurrent) {
      reply.code(400).send({
        error: 'Missing required fields: tenantId, name, labels, maxConcurrent',
      });
      return;
    }

    try {
      const runner = await this.poolService.registerRunner(input);
      reply.code(201).send(runner);
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to register runner',
        detail: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/runners/:id/heartbeat — Runner 心跳
   */
  async heartbeat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const updated = await this.poolService.heartbeat(id);
      if (!updated) {
        reply.code(404).send({ error: 'Runner not found' });
        return;
      }
      reply.send({ status: 'ok', runnerId: id });
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to update heartbeat',
        detail: (error as Error).message,
      });
    }
  }

  /**
   * DELETE /api/v1/runners/:id — 注销 Runner
   */
  async deregister(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      await this.poolService.deregisterRunner(id);
      reply.send({ status: 'ok', runnerId: id });
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to deregister runner',
        detail: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/runners — 获取 Runner 列表
   */
  async listRunners(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { tenantId?: string };
    const tenantId = query.tenantId || this.getTenantId(request);

    try {
      const runners = await this.poolService.listRunners(tenantId);
      reply.send(runners);
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to list runners',
        detail: (error as Error).message,
      });
    }
  }

  /**
   * GET /api/v1/runners/:id — 获取 Runner 详情
   */
  async getRunner(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const runner = await this.poolService.getRunner(id);
      if (!runner) {
        reply.code(404).send({ error: 'Runner not found' });
        return;
      }
      reply.send(runner);
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to get runner',
        detail: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v1/runners/:id/jobs/:jobId/result — Runner 回报 Job 结果
   */
  async reportJobResult(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id: runnerId, jobId } = request.params as { id: string; jobId: string };
    const body = request.body as {
      status: string;
      result?: Record<string, unknown>;
      error?: string;
    };

    if (!body || !body.status) {
      reply.code(400).send({ error: 'Missing status field' });
      return;
    }

    try {
      if (body.status === 'completed' && body.result) {
        await this.poolService.markJobComplete(jobId, body.result, runnerId);
      } else if (body.status === 'failed') {
        await this.poolService.markJobFailed(jobId, body.error || 'Unknown error', runnerId);
      }

      reply.send({ status: 'ok', jobId });
    } catch (error) {
      reply.code(500).send({
        error: 'Failed to report job result',
        detail: (error as Error).message,
      });
    }
  }
}
