/**
 * Stub: Plugin Marketplace Controller
 * Handles HTTP request/response for marketplace routes.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PluginMarketplaceService } from '../../services/plugin-marketplace/PluginMarketplaceService';
import { PluginValidator } from '../../services/plugin-marketplace/PluginValidator';

export class PluginMarketplaceController {
  constructor(
    private service: PluginMarketplaceService,
    private validator: PluginValidator
  ) {}

  async publishPlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const body = request.body as any;
    return this.service.publishPlugin(body);
  }

  async listPlugins(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const query = request.query as any;
    return this.service.listPlugins(query);
  }

  async getPlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const { id } = request.params as { id: string };
    return this.service.getPlugin(id);
  }

  async installPlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return this.service.installPlugin(id, body);
  }

  async ratePlugin(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return this.service.ratePlugin(id, body);
  }

  async getPluginQualityScore(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const { id } = request.params as { id: string };
    return this.service.getQualityScore(id);
  }
}
