/**
 * Lowcode Flow API Routes
 *
 * Prefix: /api/v1/lowcode (handled by register)
 *
 * Endpoints:
 * - GET    /api/v1/lowcode/flows            - List flows
 * - GET    /api/v1/lowcode/flows/:id        - Get flow detail
 * - POST   /api/v1/lowcode/flows            - Create flow
 * - PUT    /api/v1/lowcode/flows/:id        - Update flow
 * - DELETE /api/v1/lowcode/flows/:id        - Delete flow
 * - POST   /api/v1/lowcode/flows/:id/publish - Publish flow
 * - POST   /api/v1/lowcode/flows/:id/execute - Execute flow
 * - POST   /api/v1/lowcode/workflows/:id/versions  - Create version snapshot
 * - GET    /api/v1/lowcode/workflows/:id/versions  - List versions
 * - POST   /api/v1/lowcode/workflows/import        - Import workflow
 * - POST   /api/v1/lowcode/workflows/:id/export    - Export workflow
 * - GET    /api/v1/lowcode/templates               - List templates
 * - POST   /api/v1/lowcode/templates               - Create template
 * - POST   /api/v1/lowcode/templates/:id/apply     - Apply template
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';
import { LowcodeWorkflowDefinitionPgRepository } from '../repositories/LowcodeWorkflowDefinitionRepository';
import { LowcodeWorkflowInstancePgRepository } from '../repositories/LowcodeWorkflowInstanceRepository';
import { LowcodeWorkflowService } from '../services/lowcode/LowcodeWorkflowService';
import { createLogger } from '../utils/logger';

const logger = createLogger('lowcode-routes');

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

interface CreateVersionBody {
  changeLog?: string;
  snapshot?: {
    nodes?: Array<Record<string, unknown>>;
    edges?: Array<Record<string, unknown>>;
  };
}

interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: string;
  changeLog?: string;
  snapshot?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

interface ListVersionsQuery {
  limit?: number;
  offset?: number;
}

interface ImportWorkflowBody {
  name: string;
  description?: string;
  exportedAt: string;
  versions: WorkflowVersion[];
  currentDefinition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}

interface ExportResponse {
  workflow: {
    id: string;
    name: string;
    description?: string;
    version: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  exportedAt: string;
  versions: WorkflowVersion[];
}

interface CreateTemplateBody {
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  definition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  tags?: string[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  definition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  tags?: string[];
  usageCount?: number;
  createdBy: string;
  createdAt: string;
}

interface ApplyTemplateBody {
  workflowName: string;
  description?: string;
  variables?: Record<string, string>;
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
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to initialize lowcode repositories, routes will be disabled');
      return;
    }
  } else {
    logger.warn('lowcodeRoutes: database not provided, lowcode APIs will be disabled');
    return;
  }

  if (!workflowService) {
    logger.warn('lowcodeRoutes: workflowService not initialized, lowcode APIs will be disabled');
    return;
  }

  // 内存模板存储（简单实现，生产环境可迁移到 Repository）
  const templateStore = new Map<string, WorkflowTemplate>();

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

        const opts: Record<string, unknown> = {
          limit: Math.min(limit, 100),
          offset: Number(offset) || 0,
          orderBy: 'created_at',
          orderDir: 'DESC',
        };

        if (enabled !== undefined && enabled !== null) {
          const enabledBool = typeof enabled === 'string' ? enabled === 'true' : enabled;
          opts.enabled = enabledBool;
        }

        const result = await workflowService.listWorkflows(opts);

        let data = result.data;
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
          limit: opts.limit,
          offset: opts.offset,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to list flows');
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
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to get flow');
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
        logger.error({ error: message }, 'Failed to create flow');
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
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to update flow');
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
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to delete flow');
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

        const existing = await workflowService.getWorkflowById(id);
        if (!existing) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

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
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to publish flow');
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

        const flow = await workflowService.getWorkflowById(id);
        if (!flow) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        if (!flow.enabled) {
          return handleError(reply, new ValidationError('Flow is not enabled. Please publish it before executing.'));
        }

        const instance = await workflowService.createInstance({
          workflowId: id,
          workflowDefinitionId: id,
          status: 'pending',
          variables: {},
          input,
        });

        logger.info(
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
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to execute flow');
        return handleError(reply, new OrionError('Failed to execute flow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /workflows/:id/versions - Create version snapshot ====================
  app.post(
    '/workflows/:id/versions',
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
        const body = request.body as CreateVersionBody;

        const flow = await workflowService.getWorkflowById(id);
        if (!flow) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        const snapshot = body.snapshot || {
          nodes: flow.nodes,
          edges: flow.edges,
        };

        const version: WorkflowVersion = {
          id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          workflowId: id,
          version: flow.version,
          changeLog: body.changeLog,
          snapshot,
          createdBy: user?.username || user?.id || 'system',
          createdAt: new Date().toISOString(),
        };

        logger.info({ workflowId: id, versionId: version.id, version: version.version }, 'Workflow version snapshot created');

        return reply.status(201).send({ success: true, data: version });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to create version');
        return handleError(reply, new OrionError('Failed to create version', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== GET /workflows/:id/versions - List versions ====================
  app.get(
    '/workflows/:id/versions',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const { limit = 50, offset = 0 } = request.query as ListVersionsQuery;

        const flow = await workflowService.getWorkflowById(id);
        if (!flow) {
          return handleError(reply, new NotFoundError('Flow not found'));
        }

        const currentVersion: WorkflowVersion = {
          id: `ver-current-${id}`,
          workflowId: id,
          version: flow.version,
          snapshot: {
            nodes: flow.nodes,
            edges: flow.edges,
          },
          createdBy: flow.createdBy || 'system',
          createdAt: (flow.updatedAt || flow.createdAt).toISOString(),
        };

        const versions: WorkflowVersion[] = [currentVersion];
        const total = versions.length;

        return reply.send({
          success: true,
          data: versions.slice(Number(offset) || 0, (Number(offset) || 0) + Math.min(limit, 100)),
          total,
          limit: Math.min(limit, 100),
          offset: Number(offset) || 0,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to list versions');
        return handleError(reply, new OrionError('Failed to list versions', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /workflows/import - Import workflow ====================
  app.post(
    '/workflows/import',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const body = request.body as ImportWorkflowBody;

        if (!body.name || !body.currentDefinition || !Array.isArray(body.currentDefinition.nodes)) {
          return handleError(reply, new ValidationError('Missing required fields: name, currentDefinition.nodes'));
        }

        const flow = await workflowService.createWorkflow({
          name: body.name.trim(),
          description: body.description?.trim(),
          version: '1.0.0',
          nodes: body.currentDefinition.nodes,
          edges: body.currentDefinition.edges || [],
          createdBy: user?.username || user?.id || 'system',
        });

        logger.info({ workflowId: flow.id, name: flow.name, exportedAt: body.exportedAt }, 'Workflow imported');

        return reply.status(201).send({
          success: true,
          data: flow,
          message: `Workflow "${flow.name}" imported successfully`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to import workflow');
        return handleError(reply, new OrionError('Failed to import workflow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /workflows/:id/export - Export workflow ====================
  app.post(
    '/workflows/:id/export',
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

        const response: ExportResponse = {
          workflow: {
            id: flow.id,
            name: flow.name,
            description: flow.description,
            version: flow.version,
            nodes: flow.nodes,
            edges: flow.edges,
          },
          exportedAt: new Date().toISOString(),
          versions: [
            {
              id: `ver-current-${id}`,
              workflowId: id,
              version: flow.version,
              snapshot: {
                nodes: flow.nodes,
                edges: flow.edges,
              },
              createdBy: flow.createdBy || 'system',
              createdAt: (flow.updatedAt || flow.createdAt).toISOString(),
            } as WorkflowVersion,
          ],
        };

        logger.info({ workflowId: id }, 'Workflow exported');

        return reply.send({ success: true, data: response });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to export workflow');
        return handleError(reply, new OrionError('Failed to export workflow', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== GET /templates - List templates ====================
  app.get(
    '/templates',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'read' }),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const templates = Array.from(templateStore.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return reply.send({
          success: true,
          data: templates,
          total: templates.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to list templates');
        return handleError(reply, new OrionError('Failed to list templates', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /templates - Create template ====================
  app.post(
    '/templates',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'lowcode', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const body = request.body as CreateTemplateBody;

        if (!body.name || !body.definition || !Array.isArray(body.definition.nodes)) {
          return handleError(reply, new ValidationError('Missing required fields: name, definition.nodes'));
        }

        const template: WorkflowTemplate = {
          id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: body.name.trim(),
          description: body.description?.trim(),
          category: body.category,
          thumbnail: body.thumbnail,
          definition: body.definition,
          tags: body.tags,
          usageCount: 0,
          createdBy: user?.username || user?.id || 'system',
          createdAt: new Date().toISOString(),
        };

        templateStore.set(template.id, template);

        logger.info({ templateId: template.id, name: template.name }, 'Workflow template created');

        return reply.status(201).send({ success: true, data: template });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Failed to create template');
        return handleError(reply, new OrionError('Failed to create template', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // ==================== POST /templates/:id/apply - Apply template ====================
  app.post(
    '/templates/:id/apply',
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
        const body = request.body as ApplyTemplateBody;

        const template = templateStore.get(id);
        if (!template) {
          return handleError(reply, new NotFoundError('Template not found'));
        }

        if (!body.workflowName || typeof body.workflowName !== 'string' || body.workflowName.trim().length === 0) {
          return handleError(reply, new ValidationError('workflowName is required'));
        }

        const flow = await workflowService.createWorkflow({
          name: body.workflowName.trim(),
          description: body.description?.trim() || template.description,
          version: '1.0.0',
          nodes: template.definition.nodes,
          edges: template.definition.edges,
          createdBy: user?.username || user?.id || 'system',
        });

        template.usageCount = (template.usageCount || 0) + 1;

        logger.info({ templateId: id, workflowId: flow.id, name: flow.name }, 'Template applied to create workflow');

        return reply.status(201).send({
          success: true,
          data: flow,
          message: `Workflow "${flow.name}" created from template "${template.name}"`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: message, id: (request.params as { id: string }).id }, 'Failed to apply template');
        return handleError(reply, new OrionError('Failed to apply template', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
