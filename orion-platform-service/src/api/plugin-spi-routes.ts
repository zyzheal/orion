/**
 * TASK-104: Plugin SPI API Routes
 *
 * Provides RESTful endpoints for the Plugin SPI (Service Provider Interface) system:
 * - Plugin registration and discovery
 * - Lifecycle management (install/enable/disable/uninstall)
 * - Plugin execution with sandbox isolation
 * - Health monitoring
 * - Dependency management
 *
 * Registered under /api/v1/plugins-spi prefix.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PluginSpiController } from './controllers/PluginSpiController';
import { PluginService } from '../services/plugin-spi/PluginService';

export default async function pluginSpiRoutes(app: FastifyInstance): Promise<void> {
  // Initialize the plugin SPI service
  const pluginService = new PluginService({
    pluginDirectory: process.env.PLUGIN_DIRECTORY,
  });
  pluginService.initialize().catch((err) => {
    // Log but don't fail startup - plugins may not exist yet
    console.warn('Plugin SPI service initialization failed:', err.message);
  });

  const controller = new PluginSpiController();

  // Initialize controller with service
  // (The controller uses a singleton pattern internally)

  // ==================== Service Control ====================

  // POST /init - Initialize the plugin SPI service
  app.post('/init', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.initialize(request, reply);
  });

  // GET /stats - Get service statistics
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStats(request, reply);
  });

  // ==================== Plugin Registration & Discovery ====================

  // POST /register - Register a plugin with manifest
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.registerPlugin(request, reply);
  });

  // POST /discover - Discover plugins from plugin directory
  app.post('/discover', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.discoverPlugins(request, reply);
  });

  // GET / - List all plugins
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listPlugins(request, reply);
  });

  // GET /:pluginId - Get plugin details
  app.get('/:pluginId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPlugin(request, reply);
  });

  // ==================== Lifecycle Management ====================

  // POST /:pluginId/enable - Enable a plugin
  app.post('/:pluginId/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.enablePlugin(request, reply);
  });

  // POST /:pluginId/disable - Disable a plugin
  app.post('/:pluginId/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.disablePlugin(request, reply);
  });

  // POST /:pluginId/uninstall - Uninstall a plugin
  app.post('/:pluginId/uninstall', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.uninstallPlugin(request, reply);
  });

  // PUT /:pluginId/config - Update plugin configuration
  app.put('/:pluginId/config', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateConfig(request, reply);
  });

  // ==================== Plugin Execution ====================

  // POST /:pluginId/execute - Execute a plugin in sandbox
  app.post('/:pluginId/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executePlugin(request, reply);
  });

  // POST /:pluginId/cancel - Cancel a running execution
  app.post('/:pluginId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.cancelExecution(request, reply);
  });

  // ==================== Health & Monitoring ====================

  // GET /health - Get health status for all plugins
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAllHealth(request, reply);
  });

  // GET /:pluginId/health - Get health status for a specific plugin
  app.get('/:pluginId/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPluginHealth(request, reply);
  });

  // ==================== Dependency Management ====================

  // GET /:pluginId/dependencies - Get dependency information
  app.get('/:pluginId/dependencies', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDependencies(request, reply);
  });
}
