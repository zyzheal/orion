/**
 * Plugin Hot Reload API Routes
 *
 * 提供插件热加载和版本管理的 API
 * Prefix: /api/v1/plugins/hotreload
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PluginHotReloadService, HotReloadConfig, HotReloadEvent } from '../services/plugin-spi/PluginHotReloadService';
import { PluginLifecycleManager } from '../services/plugin-spi/PluginLifecycleManager';
import { PluginRegistry } from '../services/plugin-spi/PluginRegistry';
import { PluginVersionSnapshotRepository } from '../repositories/PluginVersionSnapshotRepository';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { OrionError, ErrorCode, handleError } from '../errors';

export interface HotReloadRoutesOptions {
  lifecycleManager: PluginLifecycleManager;
  registry: PluginRegistry;
  database?: DatabasePool;
  watchPaths?: string[];
}

/**
 * 注册插件热加载 API 路由
 */
export default async function registerPluginHotReloadRoutes(
  app: FastifyInstance,
  options: HotReloadRoutesOptions
): Promise<void> {
  if (!options.database) {
    return;
  }

  const snapshotRepo = new PluginVersionSnapshotRepository(options.database);

  const hotReloadConfig: Partial<HotReloadConfig> = {
    watchPaths: options.watchPaths || [],
    autoReload: true,
    rollbackEnabled: true,
    notifyOnReload: true,
  };

  const hotReloadService = new PluginHotReloadService(
    options.lifecycleManager,
    options.registry,
    snapshotRepo,
    hotReloadConfig
  );

  // 事件广播到 EventBus
  hotReloadService.on('hotreload:detected', (event: HotReloadEvent) => {
    app.emit('plugin:change_detected', event);
  });

  hotReloadService.on('hotreload:completed', (event: HotReloadEvent) => {
    app.emit('plugin:updated', event);
  });

  // ==================== 热加载管理 ====================

  // POST /api/v1/plugins/hotreload/:pluginId - 触发插件热加载
  app.post(
    '/plugins/hotreload/:pluginId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const {  pluginId  } = request.params as any as { pluginId: string };
    const {  manifest  } = request.body as any as any || {};

    try {
      const result = await hotReloadService.triggerReload(pluginId, manifest);
      return reply.send({
        success: true,
        plugin: result,
        message: `Plugin "${pluginId}" hot reload completed`,
      });
    } catch (error) {
      return handleError(reply, new OrionError(error, ErrorCode.INTERNAL_ERROR))
    }
  });

  // POST /api/v1/plugins/hotreload/:pluginId/rollback - 回滚插件版本
  app.post(
    '/plugins/hotreload/:pluginId/rollback',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const {  pluginId  } = request.params as any as { pluginId: string };
    const {  targetVersion  } = request.body as any as any || {};

    try {
      const result = await hotReloadService.rollback(pluginId, targetVersion);
      return reply.send({
        success: true,
        plugin: result,
        message: `Plugin "${pluginId}" rolled back to version ${result.manifest.version}`,
      });
    } catch (error) {
      return handleError(reply, new OrionError(error, ErrorCode.INTERNAL_ERROR))
    }
  });

  // GET /api/v1/plugins/hotreload/:pluginId/history - 获取版本历史
  app.get(
    '/plugins/hotreload/:pluginId/history',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const {  pluginId  } = request.params as any;

    const history = await hotReloadService.getVersionHistory(pluginId);
    return reply.send({
      pluginId,
      history,
      total: history.length,
    });
  });

  // ==================== 监控管理 ====================

  // POST /api/v1/plugins/hotreload/watch/start - 启动插件目录监控
  app.post(
    '/plugins/hotreload/watch/start',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const {  paths  } = request.body as any || {};

    // 如果提供了新路径，更新配置
    if (paths && paths.length > 0) {
      // 动态添加监控路径
      const config = hotReloadService.getConfig();
      for (const path of paths) {
        config.watchPaths.push(path);
      }
    }

    hotReloadService.startWatching();

    return reply.send({
      success: true,
      watchPaths: hotReloadService.getConfig().watchPaths,
      message: 'Plugin directory watching started',
    });
  });

  // POST /api/v1/plugins/hotreload/watch/stop - 停止插件目录监控
  app.post(
    '/plugins/hotreload/watch/stop',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    hotReloadService.stopWatching();

    return reply.send({
      success: true,
      message: 'Plugin directory watching stopped',
    });
  });

  // GET /api/v1/plugins/hotreload/stats - 获取热加载统计
  app.get(
    '/plugins/hotreload/stats',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = hotReloadService.getStats();
    return reply.send(stats);
  });

  // ==================== SSE 实时通知 ====================

  // GET /api/v1/plugins/hotreload/events - SSE 实时事件推送
  app.get(
    '/plugins/hotreload/events',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'plugin', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    // 发送连接确认
    reply.raw.write('event: connected\ndata: {"message":"Hot reload events connected"}\n\n');

    // 监听热加载事件
    const eventHandler = (event: HotReloadEvent) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    hotReloadService.on('hotreload:detected', eventHandler);
    hotReloadService.on('hotreload:started', eventHandler);
    hotReloadService.on('hotreload:completed', eventHandler);
    hotReloadService.on('hotreload:failed', eventHandler);
    hotReloadService.on('hotreload:rolled_back', eventHandler);

    // 清理连接
    request.raw.on('close', () => {
      hotReloadService.removeListener('hotreload:detected', eventHandler);
      hotReloadService.removeListener('hotreload:started', eventHandler);
      hotReloadService.removeListener('hotreload:completed', eventHandler);
      hotReloadService.removeListener('hotreload:failed', eventHandler);
      hotReloadService.removeListener('hotreload:rolled_back', eventHandler);
    });

    return reply;
  });

  // 注册关闭钩子
  app.addHook('onClose', async () => {
    await hotReloadService.cleanup();
  });
}