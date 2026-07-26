/**
 * Stub: Plugin SPI Controller
 * Handles HTTP request/response for SPI routes.
 * Uses a singleton pattern to access the PluginService.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

let pluginService: any = null;

export function initPluginSpiController(service: any): void {
  pluginService = service;
}

function getService(): any {
  if (!pluginService) {
    throw new Error('Plugin SPI service not initialized. Call initPluginSpiController first.');
  }
  return pluginService;
}

export class PluginSpiController {
  async initialize(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    await service.initialize();
    return { status: 'initialized' };
  }

  async getStats(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    return service.getStats();
  }

  async registerPlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const body = request.body as any;
    return service.registerPlugin(body.manifest, body.config);
  }

  async discoverPlugins(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const plugins = await service.discoverPlugins();
    return { plugins };
  }

  async listPlugins(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const query = request.query as any;
    const plugins = service.listPlugins(query);
    return { plugins };
  }

  async getPlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    const plugin = service.getPlugin(pluginId);
    if (!plugin) {
      return reply.code(404).send({ error: `Plugin ${pluginId} not found` });
    }
    return { plugin };
  }

  async enablePlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    return service.enablePlugin(pluginId);
  }

  async disablePlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    return service.disablePlugin(pluginId);
  }

  async uninstallPlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    await service.uninstallPlugin(pluginId);
    return { pluginId, status: 'uninstalled' };
  }

  async updateConfig(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    const body = request.body as any;
    return service.updatePluginConfig(pluginId, body.config);
  }

  async executePlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    const body = request.body as any;
    return service.executePlugin(pluginId, body.fn, body.options);
  }

  async cancelExecution(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    const body = request.body as any;
    const cancelled = service.cancelExecution(pluginId, body.reason);
    return { pluginId, cancelled };
  }

  async getAllHealth(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    return { health: service.getAllPluginHealth() };
  }

  async getPluginHealth(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    return service.getPluginHealth(pluginId);
  }

  async getDependencies(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const service = getService();
    const { pluginId } = request.params as { pluginId: string };
    return service.getDependencyInfo(pluginId);
  }
}
