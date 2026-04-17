/**
 * Plugin API Routes (Fastify 版本)
 *
 * 插件管理相关的 API 路由
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PluginManagerService } from './services/plugin-manager-service';
import { PluginExecutorService } from './services/plugin-executor-service';
import { PluginController } from './api/controllers/PluginController';
import { EventBusService } from './services/event-bus-service';

export interface PluginRoutesOptions {
  eventBus?: EventBusService;
}

/**
 * 注册插件路由
 */
export default async function registerPluginRoutes(
  app: FastifyInstance,
  options: PluginRoutesOptions
): Promise<void> {
  // 初始化服务
  const pluginManager = new PluginManagerService({ eventBus: options.eventBus });
  const pluginExecutor = new PluginExecutorService({
    pluginManager,
    eventBus: options.eventBus,
  });

  // 初始化控制器
  const controller = new PluginController({
    pluginManager,
    pluginExecutor,
  });

  // ==================== 插件管理路由 ====================

  // GET /api/v1/plugins/available - 列出可用插件
  app.get('/available', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.listAvailablePlugins(request, reply)
  );

  // GET /api/v1/plugins/installed - 列出已安装插件
  app.get('/installed', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.listInstalledPlugins(request, reply)
  );

  // GET /api/v1/plugins/:pluginId - 获取插件详情
  app.get('/:pluginId', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.getPluginDetails(request, reply)
  );

  // POST /api/v1/plugins/:pluginId/install - 安装插件
  app.post('/:pluginId/install', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.installPlugin(request, reply)
  );

  // POST /api/v1/plugins/:pluginId/uninstall - 卸载插件
  app.post('/:pluginId/uninstall', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.uninstallPlugin(request, reply)
  );

  // POST /api/v1/plugins/:pluginId/activate - 激活插件
  app.post('/:pluginId/activate', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.activatePlugin(request, reply)
  );

  // POST /api/v1/plugins/:pluginId/deactivate - 停用插件
  app.post('/:pluginId/deactivate', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.deactivatePlugin(request, reply)
  );

  // POST /api/v1/plugins/:pluginId/configure - 配置插件
  app.post('/:pluginId/configure', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.configurePlugin(request, reply)
  );

  // POST /api/v1/plugins/:pluginId/execute - 执行插件任务
  app.post('/:pluginId/execute', async (request: FastifyRequest, reply: FastifyReply) =>
    controller.executePluginTask(request, reply)
  );
}