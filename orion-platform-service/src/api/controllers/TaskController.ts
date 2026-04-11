/**
 * Task Controller - Task 管理 API
 */

import { Request, Response } from 'express';
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
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const task = await this.runService.getTask(id);

      if (!task) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Task '${id}' not found`,
        });
        return;
      }

      res.json({
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
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get task',
      });
    }
  }

  /**
   * 获取 Task 日志
   * GET /api/v1/tasks/:id/log
   */
  async getLog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const task = await this.runService.getTask(id);

      if (!task) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Task '${id}' not found`,
        });
        return;
      }

      res.json({
        taskId: task.id,
        log: task.log || '',
      });
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get task log',
      });
    }
  }

  /**
   * 重试 Task
   * POST /api/v1/tasks/:id/retry
   */
  async retry(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const task = await this.runService.getTask(id);
      if (!task) {
        res.status(404).json({
          error: 'NOT_FOUND',
          message: `Task '${id}' not found`,
        });
        return;
      }

      if (task.status !== 'failed') {
        res.status(400).json({
          error: 'INVALID_STATE',
          message: `Cannot retry task with status '${task.status}'`,
        });
        return;
      }

      if (task.retryCount >= task.maxRetries) {
        res.status(400).json({
          error: 'MAX_RETRIES_EXCEEDED',
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

      res.json({
        id: retriedTask.id,
        status: retriedTask.status,
        retryCount: retriedTask.retryCount,
      });
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to retry task',
      });
    }
  }
}
