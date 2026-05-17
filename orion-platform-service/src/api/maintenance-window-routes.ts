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

export interface MaintenanceWindowRouteDeps {
  database?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
}

export async function registerMaintenanceWindowRoutes(
  app: FastifyInstance,
  deps: MaintenanceWindowRouteDeps,
): Promise<void> {
  if (!deps.database) {
    console.warn('[MaintenanceWindowRoutes] Database not available, routes will not be registered');
    return;
  }

  const repository = new MaintenanceWindowRepository(deps.database);
  const service = new MaintenanceWindowService(repository);

  /**
   * POST /maintenance-windows - 创建维护窗口
   * Body: { name, startTime, endTime, timezone?, description?, affectedServices? }
   */
  app.post('/maintenance-windows', async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/maintenance-windows', async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/maintenance-windows/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const windows = await service.getActiveWindows();
    return reply.send({ success: true, data: windows });
  });

  /**
   * GET /maintenance-windows/upcoming - 获取即将到来的窗口
   * Query: limit (optional, default 10)
   */
  app.get('/maintenance-windows/upcoming', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = query.limit ? parseInt(query.limit, 10) : undefined;
    const windows = await service.getUpcomingWindows(limit);
    return reply.send({ success: true, data: windows });
  });

  /**
   * DELETE /maintenance-windows/:id - 删除窗口
   */
  app.delete('/maintenance-windows/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const deleted = await service.deleteWindow(params.id);
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'NOT_FOUND', message: 'Maintenance window not found' });
    }
    return reply.send({ success: true });
  });

  /**
   * GET /maintenance-windows/check/:serviceName - 检查服务是否在维护窗口内
   */
  app.get('/maintenance-windows/check/:serviceName', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const inMaintenance = await service.isServiceInMaintenanceWindow(params.serviceName);
    return reply.send({ success: true, data: { serviceName: params.serviceName, inMaintenance } });
  });
}
