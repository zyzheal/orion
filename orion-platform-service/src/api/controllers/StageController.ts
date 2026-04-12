/**
 * Stage Controller - Stage 管理 API (Fastify 版本)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';
import { StageExecutor } from '../../engine/StageExecutor';
import { StageStatus } from '../../models/Stage';
import { TaskStatus } from '../../models/Task';

export class StageController {
  private runService: PipelineRunService;
  private stageExecutor: StageExecutor;

  constructor(runService: PipelineRunService, stageExecutor: StageExecutor) {
    this.runService = runService;
    this.stageExecutor = stageExecutor;
  }

  /**
   * 获取 Stage 详情
   * GET /api/v1/stages/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const stage = await this.runService.getStage(id);

      if (!stage) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Stage '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: stage.id,
        runId: stage.runId,
        name: stage.name,
        sequence: stage.sequence,
        status: stage.status,
        dependsOn: stage.dependsOn,
        condition: stage.condition,
        timeoutSeconds: stage.timeoutSeconds,
        retryCount: stage.retryCount,
        maxRetries: stage.maxRetries,
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
        durationMs: stage.durationMs,
        result: stage.result,
        error: stage.error,
        createdAt: stage.createdAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get stage',
      });
    }
  }

  /**
   * 获取 Stage 下的 Tasks
   * GET /api/v1/stages/:id/tasks
   */
  async getTasks(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const stage = await this.runService.getStage(id);
      if (!stage) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Stage '${id}' not found`,
        });
        return;
      }

      const tasks = await this.runService.getTasks(stage.id);

      await reply.send({
        data: tasks.map(t => ({
          id: t.id,
          stageId: t.stageId,
          name: t.name,
          type: t.type,
          sequence: t.sequence,
          status: t.status,
          config: t.config,
          parameters: t.parameters,
          retryCount: t.retryCount,
          maxRetries: t.maxRetries,
          timeoutSeconds: t.timeoutSeconds,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          durationMs: t.durationMs,
          result: t.result,
          log: t.log,
          error: t.error,
        })),
        total: tasks.length,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get stage tasks',
      });
    }
  }

  /**
   * 重试 Stage
   * POST /api/v1/stages/:id/retry
   */
  async retry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const stage = await this.runService.getStage(id);
      if (!stage) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Stage '${id}' not found`,
        });
        return;
      }

      if (stage.status !== 'failed') {
        await reply.status(400).send({
          error: 'INVALID_STATE',
          code: '30301',
          message: `Cannot retry stage with status '${stage.status}'`,
        });
        return;
      }

      if (stage.retryCount >= stage.maxRetries) {
        await reply.status(400).send({
          error: 'MAX_RETRIES_EXCEEDED',
          code: '30501',
          message: `Stage has reached maximum retry count (${stage.maxRetries})`,
        });
        return;
      }

      // 重置 Stage 状态
      const retriedStage = {
        ...stage,
        retryCount: stage.retryCount + 1,
        status: StageStatus.PENDING,
        startedAt: undefined,
        completedAt: undefined,
        durationMs: undefined,
        error: undefined,
        result: undefined,
      };

      await this.runService.updateStage(retriedStage);

      // 重置该 Stage 的所有 Tasks
      const tasks = await this.runService.getTasks(stage.id);
      for (const task of tasks) {
        if (task.status !== TaskStatus.SUCCESS) {
          const resetTask = {
            ...task,
            status: TaskStatus.PENDING,
            retryCount: 0,
            startedAt: undefined,
            completedAt: undefined,
            durationMs: undefined,
            error: undefined,
            result: undefined,
            log: undefined,
          };
          await this.runService.updateTask(resetTask as any);
        }
      }

      await reply.send({
        id: retriedStage.id,
        status: retriedStage.status,
        retryCount: retriedStage.retryCount,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to retry stage',
      });
    }
  }
}