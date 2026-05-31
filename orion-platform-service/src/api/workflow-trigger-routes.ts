/**
 * Workflow Trigger API Routes
 * 工作流触发器 REST API 路由
 *
 * Prefix: /v1/workflow-triggers (handled by register)
 *
 * Endpoints:
 * - GET /v1/workflow-triggers - 获取触发器列表
 * - GET /v1/workflow-triggers/:id - 获取单个触发器
 * - POST /v1/workflow-triggers - 创建触发器
 * - PUT /v1/workflow-triggers/:id - 更新触发器
 * - DELETE /v1/workflow-triggers/:id - 删除触发器
 * - POST /v1/workflow-triggers/:id/enable - 启用触发器
 * - POST /v1/workflow-triggers/:id/disable - 禁用触发器
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { WorkflowTriggerRepository } from '../repositories/WorkflowTriggerRepository';
import { TriggerManager } from '../services/lowcode/TriggerManager';
import { WorkflowScheduler } from '../services/lowcode/WorkflowScheduler';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'workflow-trigger-routes' });
import type {
  WorkflowTrigger,
  CreateWorkflowTriggerInput,
  UpdateWorkflowTriggerInput,
} from '../repositories/WorkflowTriggerRepository';

/**
 * 路由选项接口
 */
interface WorkflowTriggerRoutesOptions {
  database?: DatabasePool;
  triggerManager?: TriggerManager;
  scheduler?: WorkflowScheduler;
}

/**
 * URL 参数类型
 */
interface TriggerParams {
  id: string;
}

/**
 * 查询参数类型
 */
interface ListQuery {
  workflowId?: string;
  type?: 'event' | 'cron' | 'manual' | 'webhook';
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 创建触发器请求体
 */
interface CreateTriggerBody extends CreateWorkflowTriggerInput {}

/**
 * 更新触发器请求体
 */
interface UpdateTriggerBody extends UpdateWorkflowTriggerInput {}

/**
 * 默认导出函数
 */
export default async function workflowTriggerRoutes(
  app: FastifyInstance,
  options: WorkflowTriggerRoutesOptions
): Promise<void> {
  // 从 options 中获取依赖
  const database = options.database;
  let triggerManager = options.triggerManager;
  let scheduler = options.scheduler;

  // 初始化 Repository（如果提供了 database）
  let triggerRepo: WorkflowTriggerRepository | null = null;
  if (database) {
    triggerRepo = new WorkflowTriggerRepository(database);

    // 如果没有外部传入 Manager，则创建并初始化
    if (!triggerManager) {
      const eventBus = undefined; // EventBusService not available in Fastify 4.x DI
      const { WorkflowInstanceManager } = await import('../services/lowcode/WorkflowInstance');
      const instanceManager = new WorkflowInstanceManager(null as any);

      triggerManager = new TriggerManager(triggerRepo, eventBus, instanceManager);
    }

    if (!scheduler) {
      const { WorkflowInstanceManager } = await import('../services/lowcode/WorkflowInstance');
      const instanceManager = new WorkflowInstanceManager(null as any);
      scheduler = new WorkflowScheduler(triggerRepo, instanceManager);
    }

    // 初始化触发器系统
    try {
      await triggerManager.initialize();
      await scheduler.start();
      logger.info('[WorkflowTriggerRoutes] TriggerManager and WorkflowScheduler initialized');
    } catch (error) {
      logger.error('[WorkflowTriggerRoutes] Failed to initialize triggers:', error);
    }
  }

  // ==================== GET /v1/workflow-triggers - 获取触发器列表 ====================
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
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const { workflowId, type, enabled, limit, offset } = request.query;

        let triggers: WorkflowTrigger[];
        let total: number;

        // 根据参数过滤
        if (workflowId) {
          triggers = await triggerRepo.findByWorkflowId(workflowId);
          total = triggers.length;
        } else if (type) {
          triggers = await triggerRepo.findByType(type as any);
          total = triggers.length;
        } else if (enabled !== undefined) {
          triggers = enabled
            ? await triggerRepo.findEnabled()
            : await triggerRepo.findAll().then((r) => r.entities.filter((t) => !t.enabled));
          total = triggers.length;
        } else {
          const result = await triggerRepo.findAll();
          triggers = result.entities;
          total = result.total;
        }

        // 应用分页
        const pageLimit = Math.min(limit || 50, 100);
        const pageOffset = offset || 0;
        const paginatedTriggers = triggers.slice(pageOffset, pageOffset + pageLimit);

        return reply.send({
          success: true,
          data: paginatedTriggers,
          pagination: {
            total,
            limit: pageLimit,
            offset: pageOffset,
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

  // ==================== GET /v1/workflow-triggers/:id - 获取单个触发器 ====================
  app.get<{ Params: TriggerParams }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({
          resource: 'workflow',
          action: 'read',
          extractResourceId: (req) => (req.params as TriggerParams).id,
        }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TriggerParams }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const { id } = request.params;
        const trigger = await triggerRepo.findById(id);

        if (!trigger) {
          return reply.status(404).send({
            success: false,
            error: `Trigger '${id}' not found`,
          });
        }

        return reply.send({
          success: true,
          data: trigger,
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

  // ==================== POST /v1/workflow-triggers - 创建触发器 ====================
  app.post<{ Body: CreateTriggerBody }>(
    '/',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'write' }),
      ],
    },
    async (
      request: FastifyRequest<{ Body: CreateTriggerBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const data = request.body;

        // 验证必填字段
        if (!data.workflowId || !data.name || !data.type) {
          return reply.status(400).send({
            success: false,
            error: 'Missing required fields: workflowId, name, type',
          });
        }

        // 验证类型
        const validTypes = ['event', 'cron', 'manual', 'webhook'];
        if (!validTypes.includes(data.type)) {
          return reply.status(400).send({
            success: false,
            error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
          });
        }

        // 创建触发器（通过 TriggerManager 如果可用，否则直接用 repo）
        let trigger: WorkflowTrigger;
        if (triggerManager) {
          trigger = await triggerManager.createTrigger(data);
        } else {
          trigger = await triggerRepo.create(data);
        }

        // 如果是 Cron 类型且有调度器，重新加载调度器
        if (trigger.type === 'cron' && scheduler) {
          await scheduler.stop();
          await scheduler.start();
        }

        return reply.status(201).send({
          success: true,
          data: trigger,
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

  // ==================== PUT /v1/workflow-triggers/:id - 更新触发器 ====================
  app.put<{ Params: TriggerParams; Body: UpdateTriggerBody }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({
          resource: 'workflow',
          action: 'write',
          extractResourceId: (req) => (req.params as TriggerParams).id,
        }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TriggerParams; Body: UpdateTriggerBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const { id } = request.params;
        const data = request.body;

        // 检查触发器是否存在
        const existing = await triggerRepo.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: `Trigger '${id}' not found`,
          });
        }

        // 验证类型（如果提供）
        if (data.type) {
          const validTypes = ['event', 'cron', 'manual', 'webhook'];
          if (!validTypes.includes(data.type)) {
            return reply.status(400).send({
              success: false,
              error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
            });
          }
        }

        // 更新触发器（通过 TriggerManager 如果可用）
        let trigger: WorkflowTrigger | null;
        if (triggerManager) {
          trigger = await triggerManager.updateTrigger(id, data);
        } else {
          trigger = await triggerRepo.update(id, data);
        }

        if (!trigger) {
          return reply.status(404).send({
            success: false,
            error: `Trigger '${id}' not found`,
          });
        }

        // 如果是 Cron 类型且有调度器，重新加载调度器
        if (trigger.type === 'cron' && scheduler) {
          await scheduler.stop();
          await scheduler.start();
        }

        return reply.send({
          success: true,
          data: trigger,
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

  // ==================== DELETE /v1/workflow-triggers/:id - 删除触发器 ====================
  app.delete<{ Params: TriggerParams }>(
    '/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({
          resource: 'workflow',
          action: 'delete',
          extractResourceId: (req) => (req.params as TriggerParams).id,
        }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TriggerParams }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const { id } = request.params;

        // 检查触发器是否存在
        const existing = await triggerRepo.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: `Trigger '${id}' not found`,
          });
        }

        // 删除触发器（通过 TriggerManager 如果可用）
        if (triggerManager) {
          await triggerManager.deleteTrigger(id);
        } else {
          await triggerRepo.delete(id);
        }

        // 如果是 Cron 类型且有调度器，重新加载调度器
        if (existing.type === 'cron' && scheduler) {
          await scheduler.stop();
          await scheduler.start();
        }

        return reply.send({
          success: true,
          message: `Trigger '${id}' deleted successfully`,
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

  // ==================== POST /v1/workflow-triggers/:id/enable - 启用触发器 ====================
  app.post<{ Params: TriggerParams }>(
    '/:id/enable',
    {
      onRequest: [
        authenticateUser,
        requirePermission({
          resource: 'workflow',
          action: 'write',
          extractResourceId: (req) => (req.params as TriggerParams).id,
        }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TriggerParams }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const { id } = request.params;

        // 检查触发器是否存在
        const existing = await triggerRepo.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: `Trigger '${id}' not found`,
          });
        }

        // 设置启用状态
        await triggerRepo.setEnabled(id, true);

        // 获取更新后的触发器
        const trigger = await triggerRepo.findById(id);

        // 如果是 Cron 类型且有调度器，重新加载调度器
        if (trigger?.type === 'cron' && scheduler) {
          await scheduler.stop();
          await scheduler.start();
        }

        return reply.send({
          success: true,
          data: trigger,
          message: `Trigger '${id}' enabled successfully`,
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

  // ==================== POST /v1/workflow-triggers/:id/disable - 禁用触发器 ====================
  app.post<{ Params: TriggerParams }>(
    '/:id/disable',
    {
      onRequest: [
        authenticateUser,
        requirePermission({
          resource: 'workflow',
          action: 'write',
          extractResourceId: (req) => (req.params as TriggerParams).id,
        }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TriggerParams }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({
            success: false,
            error: 'Database not available',
          });
        }

        const { id } = request.params;

        // 检查触发器是否存在
        const existing = await triggerRepo.findById(id);
        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: `Trigger '${id}' not found`,
          });
        }

        // 设置禁用状态
        await triggerRepo.setEnabled(id, false);

        // 获取更新后的触发器
        const trigger = await triggerRepo.findById(id);

        // 如果是 Cron 类型且有调度器，重新加载调度器
        if (trigger?.type === 'cron' && scheduler) {
          await scheduler.stop();
          await scheduler.start();
        }

        return reply.send({
          success: true,
          data: trigger,
          message: `Trigger '${id}' disabled successfully`,
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

  // ==================== POST /v1/workflow-triggers/:id/trigger - 手动触发触发器 ====================
  app.post<{ Params: TriggerParams; Body: Record<string, any> }>(
    '/:id/trigger',
    {
      onRequest: [
        authenticateUser,
        requirePermission({
          resource: 'workflow',
          action: 'write',
          extractResourceId: (req) => (req.params as TriggerParams).id,
        }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: TriggerParams; Body: Record<string, any> }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo || !scheduler) {
          return reply.status(503).send({
            success: false,
            error: 'Workflow engine not available',
          });
        }

        const { id } = request.params;
        const trigger = await triggerRepo.findById(id);

        if (!trigger) {
          return reply.status(404).send({
            success: false,
            error: `Trigger '${id}' not found`,
          });
        }

        if (!trigger.enabled) {
          return reply.status(400).send({
            success: false,
            error: `Trigger '${id}' is disabled`,
          });
        }

        // 记录触发日志
        await triggerRepo.createLog?.({
          trigger_id: id,
          event_type: 'manual',
          event_payload: request.body || {},
          status: 'pending',
        });

        // 创建工作流实例
        const { WorkflowEngine } = await import('../services/lowcode/WorkflowEngine');
        const engine = new WorkflowEngine();
        const userId = (request as any).user?.id || 'system';
        const instance = await engine.createInstance(trigger.workflowId, request.body || {}, userId);

        // 异步执行
        engine.execute(instance.id).catch(err => {
          logger.error(`[Manual Trigger] Workflow execution failed: ${err}`);
        });

        return reply.status(202).send({
          success: true,
          instanceId: instance.id,
          message: `Workflow triggered manually via trigger '${id}'`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );

  // ==================== POST /v1/workflow-triggers/workflow/:definitionId/execute - 通用手动触发工作流 ====================
  app.post<{ Params: { definitionId: string }; Body: Record<string, any> }>(
    '/workflow/:definitionId/execute',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'workflow', action: 'write' }),
      ],
    },
    async (
      request: FastifyRequest<{ Params: { definitionId: string }; Body: Record<string, any> }>,
      reply: FastifyReply
    ) => {
      try {
        if (!triggerRepo) {
          return reply.status(503).send({ success: false, error: 'Database not available' });
        }

        const { definitionId } = request.params;
        const { WorkflowEngine } = await import('../services/lowcode/WorkflowEngine');
        const engine = new WorkflowEngine();
        const userId = (request as any).user?.id || 'system';

        const instance = await engine.createInstance(definitionId, request.body || {}, userId);
        const result = await engine.execute(instance.id);

        return reply.status(201).send({
          success: true,
          instanceId: instance.id,
          execution: result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    }
  );
}