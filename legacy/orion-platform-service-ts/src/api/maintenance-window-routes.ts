/**
 * Maintenance Window API 路由
 *
 * POST   /maintenance-windows          - 创建维护窗口
 * GET    /maintenance-windows          - 列出所有窗口（支持 tenantId 过滤）
 * GET    /maintenance-windows/active   - 获取当前活跃的窗口
 * GET    /maintenance-windows/upcoming - 获取即将到来的窗口
 * DELETE /maintenance-windows/:id      - 删除窗口
 * GET    /maintenance-windows/check/:serviceName - 检查服务是否在维护窗口内
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MaintenanceWindowService } from '../services/MaintenanceWindowService';
import { MaintenanceWindowRepository } from '../repositories/MaintenanceWindowRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { NotFoundError, handleError } from '../errors';

const logger = createLogger('maintenance-window-routes');

export interface MaintenanceWindowRouteDeps {
  database?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export async function registerMaintenanceWindowRoutes(
  app: FastifyInstance,
  deps: MaintenanceWindowRouteDeps,
): Promise<void> {
  if (!deps.database) {
    logger.warn('[MaintenanceWindowRoutes] Database not available, routes will not be registered');
    return;
  }

  const repository = new MaintenanceWindowRepository(deps.database);
  const service = new MaintenanceWindowService(repository);

  /**
   * POST /maintenance-windows - 创建维护窗口
   * Body: { name, startTime, endTime, timezone?, description?, affectedServices? }
   */
  app.post('/maintenance-windows', {
    onRequest: [authenticateUser, requirePermission({ resource: 'maintenance', action: 'write' })],
    schema: {
      tags: ['maintenance'],
      summary: 'Create a maintenance window',
      description: 'Creates a new maintenance window for the specified time range',
      body: {
        type: 'object',
        required: ['name', 'startTime', 'endTime'],
        properties: {
          name: { type: 'string', description: 'Window name' },
          startTime: { type: 'string', format: 'date-time', description: 'Start time (ISO 8601)' },
          endTime: { type: 'string', format: 'date-time', description: 'End time (ISO 8601)' },
          timezone: { type: 'string', default: 'UTC', description: 'Timezone identifier' },
          description: { type: 'string', description: 'Optional description' },
          affectedServices: { type: 'array', items: { type: 'string' }, description: 'List of affected service names' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, any>;
    const result = await service.createWindow({
      name: body.name,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      timezone: body.timezone,
      description: body.description,
      affectedServices: body.affectedServices,
    });
    return reply.code(201).send({ success: true, data: result });
  });

  /**
   * GET /maintenance-windows - 列出所有窗口
   * Query: tenantId (optional filter)
   */
  app.get('/maintenance-windows', {
    onRequest: [authenticateUser, requirePermission({ resource: 'maintenance', action: 'read' })],
    schema: {
      tags: ['maintenance'],
      summary: 'List maintenance windows',
      description: 'Returns a list of upcoming maintenance windows, optionally filtered by tenantId',
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', description: 'Filter by tenant ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    let windows: any[];
    if (query.tenantId) {
      windows = await service.getWindowsByTenant(query.tenantId);
    } else {
      // Fallback: get all via active + upcoming combined approach
      // Since repository doesn't have a "findAll" specific method,
      // we use the tenant-based query with system tenant or get all active + upcoming
      windows = await service.getUpcomingWindows(100);
    }
    return reply.send({ success: true, data: windows });
  });

  /**
   * GET /maintenance-windows/active - 获取当前活跃的窗口
   */
  app.get('/maintenance-windows/active', {
    onRequest: [authenticateUser, requirePermission({ resource: 'maintenance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const windows = await service.getActiveWindows();
    return reply.send({ success: true, data: windows });
  });

  /**
   * GET /maintenance-windows/upcoming - 获取即将到来的窗口
   * Query: limit (optional, default 10)
   */
  app.get('/maintenance-windows/upcoming', {
    onRequest: [authenticateUser, requirePermission({ resource: 'maintenance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const windows = await service.getUpcomingWindows(limit);
    return reply.send({ success: true, data: windows });
  });

  /**
   * DELETE /maintenance-windows/:id - 删除窗口
   */
  app.delete('/maintenance-windows/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'maintenance', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const deleted = await service.deleteWindow(params.id);
    if (!deleted) {
      return handleError(reply, new NotFoundError('NOT_FOUND'));
    }
    return reply.send({ success: true });
  });

  /**
   * GET /maintenance-windows/check/:serviceName - 检查服务是否在维护窗口内
   */
  app.get('/maintenance-windows/check/:serviceName', {
    onRequest: [authenticateUser, requirePermission({ resource: 'maintenance', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const inMaintenance = await service.isServiceInMaintenanceWindow(params.serviceName);
    return reply.send({ success: true, data: { serviceName: params.serviceName, inMaintenance } });
  });
}
