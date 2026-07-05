/**
 * Workflow Task API Routes
 * 工作流人工任务 REST API 路由
 *
 * Prefix: /v1/workflow-tasks (handled by register)
 *
 * Endpoints:
 * - GET /v1/workflow-tasks - 我的任务列表
 * - GET /v1/workflow-tasks/:id - 获取任务详情
 * - POST /v1/workflow-tasks/:id/claim - 认领任务
 * - POST /v1/workflow-tasks/:id/complete - 完成任务并唤醒工作流
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { WorkflowTaskRepository } from '../repositories/WorkflowTaskRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import type { WorkflowTask } from '../repositories/WorkflowTaskRepository';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

const logger = createLogger('workflow-task-routes');

/**
 * 路由选项接口
 */
interface WorkflowTaskRoutesOptions {
  database?: DatabasePool;
}

/**
 * URL 参数类型
 */
interface TaskParams {
  id: string;
}

/**
 * 查询参数类型
 */
interface ListQuery {
  assigneeId?: string;
  status?: 'pending' | 'assigned' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}

/**
 * 认领任务请求体
 */
interface ClaimTaskBody {
  comment?: string;
}

/**
 * 完成任务请求体
 */
interface CompleteTaskBody {
  comment?: string;
  formData?: Record<string, any>;
}

/**
 * 默认导出函数
 */
export default async function workflowTaskRoutes(
  app: FastifyInstance,
  options: WorkflowTaskRoutesOptions
): Promise<void> {
  const database = options.database;
  let taskRepo: WorkflowTaskRepository | null = null;

  if (database) {
    taskRepo = new WorkflowTaskRepository(database);
  }

  // ==================== GET /v1/workflow-tasks - 任务列表 ====================
  app.get<{ Querystring: ListQuery }>(
    '/',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest<{ Querystring: ListQuery }>,
      reply: FastifyReply
    ) => {
      try {
        if (!taskRepo) {
          return handleError(reply, new ServiceUnavailableError('Database not available'))
        }

        const { assigneeId, status, limit, offset } = request.query;

        let tasks: WorkflowTask[];

        if (assigneeId) {
          tasks = await taskRepo.findByAssignee(assigneeId, status);
        } else if (status) {
          tasks = await taskRepo.findByStatus(status);
        } else {
          tasks = await taskRepo.findAll();
        }

        // 应用分页
        const pageLimit = Math.min(limit || 50, 100);
        const pageOffset = offset || 0;
        const paginatedTasks = tasks.slice(pageOffset, pageOffset + pageLimit);

        return reply.send({
          success: true,
          data: paginatedTasks,
          pagination: {
            total: tasks.length,
            limit: pageLimit,
            offset: pageOffset,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== GET /v1/workflow-tasks/:id - 任务详情 ====================
  app.get<{ Params: TaskParams }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TaskParams }>,
      reply: FastifyReply
    ) => {
      try {
        if (!taskRepo) {
          return handleError(reply, new ServiceUnavailableError('Database not available'))
        }

        const { id } = request.params;
        const task = await taskRepo.findById(id);

        if (!task) {
          return handleError(reply, new NotFoundError('Unknown error'))
        }

        return reply.send({
          success: true,
          data: task,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== POST /v1/workflow-tasks/:id/claim - 认领任务 ====================
  app.post<{ Params: TaskParams; Body: ClaimTaskBody }>(
    '/:id/claim',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'write' }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TaskParams; Body: ClaimTaskBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!taskRepo) {
          return handleError(reply, new ServiceUnavailableError('Database not available'))
        }

        const { id } = request.params;
        const userId = (request as any).user?.id || 'system';

        // 检查任务是否存在
        const task = await taskRepo.findById(id);
        if (!task) {
          return handleError(reply, new NotFoundError('Unknown error'))
        }

        if (task.status !== 'pending') {
          return handleError(reply, new ValidationError('Unknown error'));
        }

        // 更新任务状态为已认领
        await taskRepo.updateStatus(id, 'assigned', userId, request.body?.comment);

        // 获取更新后的任务
        const updatedTask = await taskRepo.findById(id);

        return reply.send({
          success: true,
          data: updatedTask,
          message: `Task '${id}' claimed successfully`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // ==================== POST /v1/workflow-tasks/:id/complete - 完成任务 ====================
  app.post<{ Params: TaskParams; Body: CompleteTaskBody }>(
    '/:id/complete',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'write' }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TaskParams; Body: CompleteTaskBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!taskRepo) {
          return handleError(reply, new ServiceUnavailableError('Database not available'))
        }

        const { id } = request.params;
        const userId = (request as any).user?.id || 'system';
        const { comment, formData } = request.body || {};

        // 检查任务是否存在
        const task = await taskRepo.findById(id);
        if (!task) {
          return handleError(reply, new NotFoundError('Unknown error'))
        }

        if (task.status === 'completed') {
          return handleError(reply, new ValidationError('Unknown error'))
        }

        if (task.status === 'cancelled') {
          return handleError(reply, new ValidationError('Unknown error'))
        }

        // 完成任务并获取实例信息
        const result = await taskRepo.completeWithResult(id, userId, comment, formData);
        if (!result) {
          return handleError(reply, new OrionError('Failed to complete task', ErrorCode.INTERNAL_ERROR))
        }

        // 唤醒挂起的工作流实例
        try {
          const { WorkflowEngine } = await import('../services/lowcode/WorkflowEngine');
          const engine = new WorkflowEngine();
          await engine.resumeFromEvent(result.instanceId, {
            taskId: id,
            completedBy: userId,
            comment,
            formData: formData || {},
            completedAt: new Date().toISOString(),
          });

          return reply.send({
            success: true,
            data: await taskRepo.findById(id),
            message: `Task '${id}' completed, workflow resumed`,
          });
        } catch (resumeError) {
          const resumeMessage = resumeError instanceof Error ? resumeError.message : String(resumeError);
          // 任务已完成，但工作流唤醒失败
          logger.error(`[WorkflowTask] Task completed but workflow resume failed: ${resumeMessage}`);

          return reply.status(200).send({
            success: true,
            data: await taskRepo.findById(id),
            warning: `Task completed but workflow resume failed: ${resumeMessage}`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR))
      }
    }
  );
}
