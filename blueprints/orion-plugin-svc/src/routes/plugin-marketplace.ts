/**
 * Plugin Marketplace API Routes - Phase 3
 *
 * Routes under /api/v1/plugins/marketplace
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../utils/database';
import { PluginMarketplaceService } from '../services/plugin-marketplace/PluginMarketplaceService';
import { PluginValidator } from '../services/plugin-marketplace/PluginValidator';
import { PluginMarketplaceController } from './controllers/PluginMarketplaceController';

interface PluginMarketplaceOptions {
  database?: DatabasePool;
}

export default async function pluginMarketplaceRoutes(
  app: FastifyInstance,
  options: PluginMarketplaceOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[PluginMarketplaceRoutes] No database pool provided, routes will not be functional');
    return;
  }

  const service = new PluginMarketplaceService(options.database);
  const validator = new PluginValidator();
  const controller = new PluginMarketplaceController(service, validator);

  // ==================== Marketplace ====================

  // POST /api/v1/plugins/marketplace - Publish a plugin
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.publishPlugin(request, reply);
  });

  // GET /api/v1/plugins/marketplace - List plugins
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listPlugins(request, reply);
  });

  // GET /api/v1/plugins/marketplace/:id - Get plugin details
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPlugin(request, reply);
  });

  // POST /api/v1/plugins/marketplace/:id/install - Install a plugin
  app.post('/:id/install', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.installPlugin(request, reply);
  });

  // POST /api/v1/plugins/marketplace/:id/rate - Rate a plugin
  app.post('/:id/rate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.ratePlugin(request, reply);
  });

  // GET /api/v1/plugins/marketplace/:id/quality - Get plugin quality score
  app.get('/:id/quality', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPluginQualityScore(request, reply);
  });
}
