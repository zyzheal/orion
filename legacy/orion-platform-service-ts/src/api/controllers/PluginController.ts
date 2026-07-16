/**
 * Plugin Controller (Fastify 版本)
 *
 * 处理插件管理相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PluginManagerService, PluginType, PluginState } from '../../services/plugin-manager-service';
import { PluginExecutorService } from '../../services/plugin-executor-service';

export class PluginController {
  private pluginManager: PluginManagerService;
  private pluginExecutor: PluginExecutorService;

  constructor(options: {
    pluginManager: PluginManagerService;
    pluginExecutor: PluginExecutorService;
  }) {
    this.pluginManager = options.pluginManager;
    this.pluginExecutor = options.pluginExecutor;
  }

  /**
   * 列出可用插件
   * GET /api/v1/plugins/available
   */
  async listAvailablePlugins(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const typeFilter = query.type as PluginType | undefined;
      const tagsFilter = query.tags
        ? (query.tags as string).split(',')
        : undefined;

      const plugins = await this.pluginManager.listAvailablePlugins({
        typeFilter,
        tagsFilter,
      });

      await reply.send({
        success: true,
        data: plugins,
        total: plugins.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * 列出已安装插件
   * GET /api/v1/plugins/installed
   */
  async listInstalledPlugins(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const typeFilter = query.type as PluginType | undefined;
      const stateFilter = query.state as PluginState | undefined;

      const plugins = await this.pluginManager.listInstalledPlugins({
        typeFilter,
        stateFilter,
      });

      await reply.send({
        success: true,
        data: plugins,
        total: plugins.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  /**
   * 获取插件详情
   * GET /api/v1/plugins/:pluginId
   */
  async getPluginDetails(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pluginId } = params;
      const plugin = await this.pluginManager.getPluginDetails(pluginId);

      await reply.send({
        success: true,
        data: plugin,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Plugin not found',
      });
    }
  }

  /**
   * 安装插件
   * POST /api/v1/plugins/:pluginId/install
   */
  async installPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { pluginId } = params;
      const { version, config } = body;

      const plugin = await this.pluginManager.installPlugin(pluginId, version || 'latest', config);

      await reply.status(201).send({
        success: true,
        data: plugin,
        message: `Plugin ${pluginId} installed successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to install plugin',
      });
    }
  }

  /**
   * 卸载插件
   * POST /api/v1/plugins/:pluginId/uninstall
   */
  async uninstallPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pluginId } = params;
      const plugin = await this.pluginManager.uninstallPlugin(pluginId);

      await reply.send({
        success: true,
        data: plugin,
        message: `Plugin ${pluginId} uninstalled successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to uninstall plugin',
      });
    }
  }

  /**
   * 激活插件
   * POST /api/v1/plugins/:pluginId/activate
   */
  async activatePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pluginId } = params;
      const plugin = await this.pluginManager.activatePlugin(pluginId);

      await reply.send({
        success: true,
        data: plugin,
        message: `Plugin ${pluginId} activated successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to activate plugin',
      });
    }
  }

  /**
   * 停用插件
   * POST /api/v1/plugins/:pluginId/deactivate
   */
  async deactivatePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const { pluginId } = params;
      const plugin = await this.pluginManager.deactivatePlugin(pluginId);

      await reply.send({
        success: true,
        data: plugin,
        message: `Plugin ${pluginId} deactivated successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to deactivate plugin',
      });
    }
  }

  /**
   * 配置插件
   * POST /api/v1/plugins/:pluginId/configure
   */
  async configurePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { pluginId } = params;
      const { config } = body;

      const plugin = await this.pluginManager.configurePlugin(pluginId, config);

      await reply.send({
        success: true,
        data: plugin,
        message: `Plugin ${pluginId} configured successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to configure plugin',
      });
    }
  }

  /**
   * 执行插件任务
   * POST /api/v1/plugins/:pluginId/execute
   */
  async executePluginTask(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any || {};
      const { pluginId } = params;
      const { taskId, pipelineRunId, stageId, config, workspace, env, timeout } = body;

      if (!taskId) {
        await reply.status(400).send({
          success: false,
          error: 'taskId is required',
        });
        return;
      }

      const result = await this.pluginExecutor.executeTask({
        taskId,
        pipelineRunId: pipelineRunId || '',
        stageId: stageId || '',
        pluginId,
        config,
        workspace,
        env,
        timeout,
      });

      await reply.status(result.status === 'SUCCESS' ? 200 : 400).send({
        success: result.status === 'SUCCESS',
        data: result,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute plugin task',
      });
    }
  }
}