/**
 * Task Timeout API Routes
 * 任务超时管理 REST API 路由
 *
 * Prefix: /v1/task-timeouts (handled by register)
 *
 * Endpoints:
 * - GET /v1/task-timeouts/timed-out - 获取当前超时任务列表
 * - POST /v1/task-timeouts/check-now - 手动触发超时检查
 * - GET /v1/task-timeouts/status - 获取超时检查器状态
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { WorkflowTaskRepository } from '../repositories/WorkflowTaskRepository';
import { TaskTimeoutChecker, TimeoutAction } from '../services/lowcode/TaskTimeoutChecker';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

/**
 * 路由选项接口
 */
interface TaskTimeoutRoutesOptions {
  database?: DatabasePool;
  taskTimeoutChecker?: TaskTimeoutChecker;
}

/**
 * 手动触发检查请求体
 */
interface CheckNowBody {
  action?: 'remind' | 'escalate' | 'auto_complete' | 'cancel';
}

/**
 * 默认导出函数
 */
export default async function taskTimeoutRoutes(
  app: FastifyInstance,
  options: TaskTimeoutRoutesOptions
): Promise<void> {
  const database = options.database;
  let taskRepo: WorkflowTaskRepository | null = null;
  let timeoutChecker: TaskTimeoutChecker | null = options.taskTimeoutChecker || null;

  if (database) {
    taskRepo = new WorkflowTaskRepository(database);
    if (!timeoutChecker) {
      timeoutChecker = new TaskTimeoutChecker(taskRepo);
    }
  }

  // ==================== GET /v1/task-timeouts/timed-out - 超时任务列表 ====================
  app.get(
    '/timed-out',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        if (!timeoutChecker) {
          return reply.status(503).send({
            success: false,
            error: 'Task timeout checker not available',
          });
        }

        const timedOutTasks = await timeoutChecker.getTimedOutTasks();

        return reply.send({
          success: true,
          data: timedOutTasks.map((t) => ({
            task: t.task,
            overdueHours: Math.round(t.overdueHours * 100) / 100,
            timeoutAction: t.timeoutAction,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== POST /v1/task-timeouts/check-now - 手动触发检查 ====================
  app.post<{ Body: CheckNowBody }>(
    '/check-now',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'write' }),
      ],
    },
    async (
      request: FastifyRequest<{ Body: CheckNowBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!timeoutChecker) {
          return reply.status(503).send({
            success: false,
            error: 'Task timeout checker not available',
          });
        }

        const timedOutTasks = await timeoutChecker.checkNow();

        return reply.send({
          success: true,
          data: {
            checkedTasks: timedOutTasks.length,
            tasks: timedOutTasks.map((t) => ({
              taskId: t.task.id,
              title: t.task.title,
              overdueHours: Math.round(t.overdueHours * 100) / 100,
              action: t.timeoutAction,
            })),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== GET /v1/task-timeouts/status - 检查器状态 ====================
  app.get(
    '/status',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'read' }),
      ],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        if (!timeoutChecker) {
          return reply.status(503).send({
            success: false,
            error: 'Task timeout checker not available',
          });
        }

        const status = timeoutChecker.getStatus();

        return reply.send({
          success: true,
          data: status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );
}
