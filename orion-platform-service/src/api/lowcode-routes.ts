/**
 * Lowcode Flow API Routes
 *
 * Prefix: /api/v1/lowcode/flows (handled by register)
 *
 * Endpoints:
 * - GET    /api/v1/lowcode/flows            - List flows
 * - GET    /api/v1/lowcode/flows/:id        - Get flow detail
 * - POST   /api/v1/lowcode/flows            - Create flow
 * - PUT    /api/v1/lowcode/flows/:id        - Update flow
 * - DELETE /api/v1/lowcode/flows/:id        - Delete flow
 * - POST   /api/v1/lowcode/flows/:id/publish - Publish flow
 * - POST   /api/v1/lowcode/flows/:id/execute - Execute flow
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';
import { LowcodeWorkflowDefinitionPgRepository } from '../repositories/LowcodeWorkflowDefinitionRepository';
import { LowcodeWorkflowInstancePgRepository } from '../repositories/LowcodeWorkflowInstanceRepository';
import { LowcodeWorkflowService } from '../services/lowcode/LowcodeWorkflowService';

// ==================== Types ====================

interface LowcodeRoutesOptions {
  database?: DatabasePool;
}

interface ListFlowsQuery {
  enabled?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

interface CreateFlowBody {
  name: string;
  description?: string;
  version?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
}

interface UpdateFlowBody {
  name?: string;
  description?: string;
  version?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  enabled?: boolean;
}

interface ExecuteFlowBody {
  input?: Record<string, unknown>;
  triggeredBy?: string;
}

// ==================== Route Module ====================

export default async function lowcodeRoutes(
  app: FastifyInstance,
  options: LowcodeRoutesOptions
): Promise<void> {
  const db = options.database;

  // 初始化 Repository 和 Service
  let defRepo: LowcodeWorkflowDefinitionPgRepository | null = null;
  let instRepo: LowcodeWorkflowInstancePgRepository | null = null;
  let workflowService: LowcodeWorkflowService | null = null;

  if (db) {
    try {
      defRepo = new LowcodeWorkflowDefinitionPgRepository(db);
      instRepo = new LowcodeWorkflowInstancePgRepository(db);
      workflowService = new LowcodeWorkflowService(defRepo, instRepo);
    } catch (error) {
      app.log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to initialize lowcode repositories, routes will be disabled');
      return;
    }
  } else {
    app.log.warn('lowcodeRoutes: database not provided, lowcode APIs will be disabled');
    return;
  }

  if (!workflowService) {
    app.log.warn('lowcodeRoutes: workflowService not initialized, lowcode APIs will be disabled');
    return;
  }

  // ==================== GET /flows - List flows ====================
  app.get(
    '/flows',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { enabled, limit = 50, offset = 0, search } = request.query as ListFlowsQuery;

        const options: Record<string, unknown> = {
          limit: Math.min(limit, 100),
          offset: Number(offset) || 0,
          orderBy: 'created_at',
          orderDir: 'DESC',
        };

        if (enabled !== undefined && enabled !== null) {
          const enabledBool = typeof enabled === 'string' ? enabled === 'true' : enabled;
          options.enabled = enabledBool;
        }

        const result = await workflowService.listWorkflows(options);

        let data = result.data;
        // 服务端简单搜索过滤
        if (search && typeof search === 'string') {
          const lowerSearch = search.toLowerCase();
          data = data.filter(
            (flow) =>
              flow.name.toLowerCase().includes(lowerSearch) ||
              flow.description?.toLowerCase().includes(lowerSearch)
          );
        }

        return reply.send({
          success: true,
          data,
          total: result.total,
          limit: options.limit,
          offset: options.offset,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        app.log.error({ error: message }, 'Failed to list flows');
        return handleError(reply, new OrionError('Failed to list flows', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== GET /flows/:id - Get flow detail ====================
  app.get(
    '/flows/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const flow = await workflowService.getWorkflowById(id);

        if (!flow) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        return reply.send({ success: true, data: flow });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        app.log.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to get flow');
        return handleError(reply, new OrionError('Failed to get flow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /flows - Create flow ====================
  app.post(
    '/flows',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const { name, description, version, nodes, edges } = request.body as CreateFlowBody;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return handleError(reply, new ValidationError('Flow name is required'));
        }

        const flow = await workflowService.createWorkflow({
          name: name.trim(),
          description: description?.trim(),
          version: version || '1.0.0',
          nodes: nodes || [],
          edges: edges || [],
          createdBy: user?.username || user?.id || 'system',
        });

        return reply.status(201).send({ success: true, data: flow });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        app.log.error({ error: message }, 'Failed to create flow');
        return handleError(reply, new OrionError('Failed to create flow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== PUT /flows/:id - Update flow ====================
  app.put(
    '/flows/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { name, description, version, nodes, edges, enabled } = request.body as UpdateFlowBody;

        const updates: Record<string, unknown> = {};

        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (version !== undefined) updates.version = version;
        if (nodes !== undefined) updates.nodes = nodes;
        if (edges !== undefined) updates.edges = edges;
        if (enabled !== undefined) updates.enabled = enabled;

        if (Object.keys(updates).length === 0) {
          return handleError(reply, new ValidationError('No fields to update'));
        }

        const flow = await workflowService.updateWorkflow(id, updates);

        if (!flow) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        return reply.send({ success: true, data: flow });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        app.log.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to update flow');
        return handleError(reply, new OrionError('Failed to update flow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== DELETE /flows/:id - Delete flow ====================
  app.delete(
    '/flows/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const deleted = await workflowService.deleteWorkflow(id);

        if (!deleted) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        return reply.send({ success: true, message: 'Flow deleted successfully' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        app.log.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to delete flow');
        return handleError(reply, new OrionError('Failed to delete flow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /flows/:id/publish - Publish flow ====================
  app.post(
    '/flows/:id/publish',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;

        // 发布操作：验证流程存在后，将其 enabled 设为 true 并更新版本号
        const existing = await workflowService.getWorkflowById(id);
        if (!existing) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        // 简单版本递增 (1.0.0 -> 1.0.1)
        const versionParts = (existing.version || '1.0.0').split('.');
        if (versionParts.length === 3) {
          const patch = parseInt(versionParts[2] || '0', 10) + 1;
          versionParts[2] = String(patch);
        }
        const newVersion = versionParts.join('.');

        const published = await workflowService.updateWorkflow(id, {
          enabled: true,
          version: newVersion,
        });

        return reply.send({
          success: true,
          data: published,
          message: `Flow published successfully with version ${newVersion}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        app.log.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to publish flow');
        return handleError(reply, new OrionError('Failed to publish flow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /flows/:id/execute - Execute flow ====================
  app.post(
    '/flows/:id/execute',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'execute' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;
        const { input = {}, triggeredBy } = request.body as ExecuteFlowBody;

        // 验证流程存在且已启用
        const flow = await workflowService.getWorkflowById(id);
        if (!flow) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        if (!flow.enabled) {
          return handleError(reply, new ValidationError('Flow is not enabled. Please publish it before executing.'));
        }

        // 创建执行实例
        const instance = await workflowService.createInstance({
          workflowId: id,
          workflowDefinitionId: id,
          status: 'pending',
          variables: {},
          input,
        });

        app.log.info(
          { instanceId: instance.id, flowId: id, triggeredBy: triggeredBy || user?.username },
          'Flow execution instance created'
        );

        return reply.status(201).send({
          success: true,
          data: instance,
          message: 'Flow execution started',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        app.log.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to execute flow');
        return handleError(reply, new OrionError('Failed to execute flow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
