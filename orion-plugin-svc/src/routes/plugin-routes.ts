/**
 * Plugin Routes - Central Route Registration
 * Aggregates all plugin-related routes under /api/v1/plugins
 *
 * This file provides a unified entry point for all plugin service endpoints.
 * Routes are organized by functionality:
 * - /api/v1/plugins - Core plugin management (list, install, enable, disable, uninstall)
 * - /api/v1/plugins/:pluginId/executions - Plugin execution management
 * - /api/v1/plugins/:pluginId/audit - Audit logs for plugin operations
 * - /api/v1/plugins/marketplace - Plugin marketplace
 * - /api/v1/plugins-spi - Plugin SPI endpoints
 * - /api/v1/plugins-enhanced - Enhanced plugin features (debug, AI diagnosis)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pluginSpiRoutes from './plugin-spi';
import pluginRoutes from './plugin';
import pluginEnhancedRoutes from './plugin-enhanced';
import pluginMarketplaceRoutes from './plugin-marketplace';

export interface PluginRoutesOptions {
  database?: any;
  pluginManager?: any;
}

export async function registerPluginRoutes(app: FastifyInstance, options?: PluginRoutesOptions): Promise<void> {
  // Register core plugin routes
  await app.register(pluginRoutes, { prefix: '', database: options?.database });

  // Register plugin marketplace routes
  await app.register(pluginMarketplaceRoutes, { prefix: '/marketplace', database: options?.database });

  // Register plugin SPI routes
  await app.register(pluginSpiRoutes, { prefix: '/spi' });

  // Register enhanced plugin routes
  await app.register(pluginEnhancedRoutes, {
    prefix: '/enhanced',
    database: options?.database,
    pluginManager: options?.pluginManager
  });
}

export default registerPluginRoutes;