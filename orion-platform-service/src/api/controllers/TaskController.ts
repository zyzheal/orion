/**
 * Task Controller - Task 管理 API (Fastify 版本)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PipelineRunService } from '../../services/pipeline/PipelineRunService';
import { TaskStatus } from '../../models/Task';

export class TaskController {
  private runService: PipelineRunService;

  constructor(runService: PipelineRunService) {
    this.runService = runService;
  }

  /**
   * 获取 Task 详情
   * GET /api/v1/tasks/:id
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const task = await this.runService.getTask(id);

      if (!task) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Task '${id}' not found`,
        });
        return;
      }

      await reply.send({
        id: task.id,
        stageId: task.stageId,
        name: task.name,
        type: task.type,
        sequence: task.sequence,
        status: task.status,
        config: task.config,
        parameters: task.parameters,
        resourceQuota: task.resourceQuota,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
        timeoutSeconds: task.timeoutSeconds,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        durationMs: task.durationMs,
        result: task.result,
        log: task.log,
        error: task.error,
        createdAt: task.createdAt,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get task',
      });
    }
  }

  /**
   * 获取 Task 日志
   * GET /api/v1/tasks/:id/log
   */
  async getLog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const task = await this.runService.getTask(id);

      if (!task) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Task '${id}' not found`,
        });
        return;
      }

      await reply.send({
        taskId: task.id,
        log: task.log || '',
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to get task log',
      });
    }
  }

  /**
   * 重试 Task
   * POST /api/v1/tasks/:id/retry
   */
  async retry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { id } = params;

      const task = await this.runService.getTask(id);
      if (!task) {
        await reply.status(404).send({
          error: 'NOT_FOUND',
          code: '30201',
          message: `Task '${id}' not found`,
        });
        return;
      }

      if (task.status !== 'failed') {
        await reply.status(400).send({
          error: 'INVALID_STATE',
          code: '30301',
          message: `Cannot retry task with status '${task.status}'`,
        });
        return;
      }

      if (task.retryCount >= task.maxRetries) {
        await reply.status(400).send({
          error: 'MAX_RETRIES_EXCEEDED',
          code: '30501',
          message: `Task has reached maximum retry count (${task.maxRetries})`,
        });
        return;
      }

      // 重置 Task 状态
      const retriedTask = {
        ...task,
        retryCount: task.retryCount + 1,
        status: TaskStatus.PENDING,
        startedAt: undefined,
        completedAt: undefined,
        durationMs: undefined,
        error: undefined,
        result: undefined,
        log: undefined,
      };

      await this.runService.updateTask(retriedTask as any);

      await reply.send({
        id: retriedTask.id,
        status: retriedTask.status,
        retryCount: retriedTask.retryCount,
      });
    } catch (error) {
      await reply.status(500).send({
        error: 'INTERNAL_ERROR',
        code: '50000',
        message: error instanceof Error ? error.message : 'Failed to retry task',
      });
    }
  }
}