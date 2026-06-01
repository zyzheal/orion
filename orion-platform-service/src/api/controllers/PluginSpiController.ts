/**
 * Plugin SPI Controller
 *
 * Handles HTTP requests for the Plugin SPI (Service Provider Interface) system.
 * Provides RESTful endpoints for plugin registration, lifecycle management,
 * execution, and health monitoring.
 *
 * Routes are registered under /api/v1/plugins-spi prefix.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PluginService } from '../../services/plugin-spi/PluginService';
import { PluginManifest } from '../../services/plugin-spi/types';
import { OrionError, ErrorCode } from '../../errors';

let pluginService: PluginService | null = null;

/**
 * Initialize the controller with a PluginService instance
 */
export function initPluginSpiController(service: PluginService): void {
  pluginService = service;
}

/**
 * Get the plugin service instance
 */
function getService(): PluginService {
  if (!pluginService) {
    pluginService = new PluginService();
  }
  return pluginService;
}

/**
 * Typed request body
 */
interface PluginRegisterBody {
  manifest: PluginManifest;
  config?: Record<string, any>;
}

interface PluginExecuteBody {
  timeout?: number;
  input?: Record<string, any>;
}

interface PluginConfigBody {
  config: Record<string, any>;
}

interface PluginUninstallBody {
  force?: boolean;
}

export class PluginSpiController {
  /**
   * Initialize the plugin service
   * POST /api/v1/plugins-spi/init
   */
  async initialize(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const service = getService();
      await service.initialize();

      await reply.status(200).send({
        success: true,
        message: 'Plugin SPI service initialized',
        data: service.getStats(),
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to initialize plugin service',
      });
    }
  }

  /**
   * Get service statistics
   * GET /api/v1/plugins-spi/stats
   */
  async getStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const service = getService();
      const stats = service.getStats();

      await reply.send({
        success: true,
        data: stats,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get stats',
      });
    }
  }

  // ==================== Plugin Registration & Discovery ====================

  /**
   * Register a plugin
   * POST /api/v1/plugins-spi/register
   */
  async registerPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as PluginRegisterBody;
      if (!body.manifest) {
        await reply.status(400).send({
          success: false,
          error: 'manifest is required in request body',
        });
        return;
      }

      const service = getService();
      const plugin = await service.registerPlugin(body.manifest, body.config);

      await reply.status(201).send({
        success: true,
        data: plugin,
        message: `Plugin "${plugin.manifest.name}" registered successfully`,
      });
    } catch (err) {
      const statusCode = err instanceof Error && err.message.includes('Invalid') ? 400 : 500;
      await reply.status(statusCode).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to register plugin',
      });
    }
  }

  /**
   * Discover plugins from directory
   * POST /api/v1/plugins-spi/discover
   */
  async discoverPlugins(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const service = getService();
      const discovered = await service.discoverPlugins();

      await reply.send({
        success: true,
        data: discovered.map((p) => ({
          name: p.manifest.name,
          version: p.manifest.version,
          description: p.manifest.description,
          status: p.status,
        })),
        total: discovered.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to discover plugins',
      });
    }
  }

  /**
   * List all plugins
   * GET /api/v1/plugins-spi
   */
  async listPlugins(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const service = getService();

      const plugins = service.listPlugins({
        statusFilter: query.status,
        capabilityFilter: query.capability,
        tagFilter: query.tags ? (query.tags as string).split(',') : undefined,
      });

      await reply.send({
        success: true,
        data: plugins.map((p) => ({
          name: p.manifest.name,
          version: p.manifest.version,
          description: p.manifest.description,
          author: p.manifest.author,
          capabilities: p.manifest.capabilities,
          status: p.status,
          installDate: p.installDate,
          enabledDate: p.enabledDate,
        })),
        total: plugins.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to list plugins',
      });
    }
  }

  /**
   * Get plugin details
   * GET /api/v1/plugins-spi/:pluginId
   */
  async getPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const service = getService();
      const plugin = service.getPlugin(params.pluginId);

      if (!plugin) {
        await reply.status(404).send({
          success: false,
          error: `Plugin "${params.pluginId}" not found`,
        });
        return;
      }

      await reply.send({
        success: true,
        data: {
          manifest: plugin.manifest,
          status: plugin.status,
          installDate: plugin.installDate,
          enabledDate: plugin.enabledDate,
          config: plugin.config,
          sandboxConfig: plugin.sandboxConfig,
          error: plugin.error,
        },
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get plugin',
      });
    }
  }

  // ==================== Lifecycle Management ====================

  /**
   * Enable a plugin
   * POST /api/v1/plugins-spi/:pluginId/enable
   */
  async enablePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const service = getService();
      const plugin = await service.enablePlugin(params.pluginId);

      await reply.send({
        success: true,
        data: {
          name: plugin.manifest.name,
          status: plugin.status,
          enabledDate: plugin.enabledDate,
        },
        message: `Plugin "${params.pluginId}" enabled successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to enable plugin',
      });
    }
  }

  /**
   * Disable a plugin
   * POST /api/v1/plugins-spi/:pluginId/disable
   */
  async disablePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const service = getService();
      const plugin = await service.disablePlugin(params.pluginId);

      await reply.send({
        success: true,
        data: {
          name: plugin.manifest.name,
          status: plugin.status,
        },
        message: `Plugin "${params.pluginId}" disabled successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to disable plugin',
      });
    }
  }

  /**
   * Uninstall a plugin
   * POST /api/v1/plugins-spi/:pluginId/uninstall
   */
  async uninstallPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const body = request.body as PluginUninstallBody;
      const service = getService();
      await service.uninstallPlugin(params.pluginId, body?.force);

      await reply.send({
        success: true,
        message: `Plugin "${params.pluginId}" uninstalled successfully`,
      });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to uninstall plugin',
      });
    }
  }

  /**
   * Update plugin configuration
   * PUT /api/v1/plugins-spi/:pluginId/config
   */
  async updateConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const body = request.body as PluginConfigBody;

      if (!body.config) {
        await reply.status(400).send({
          success: false,
          error: 'config is required in request body',
        });
        return;
      }

      const service = getService();
      const plugin = await service.updatePluginConfig(params.pluginId, body.config);

      if (!plugin) {
        await reply.status(404).send({
          success: false,
          error: `Plugin "${params.pluginId}" not found`,
        });
        return;
      }

      await reply.send({
        success: true,
        data: {
          name: plugin.manifest.name,
          config: plugin.config,
        },
        message: `Plugin "${params.pluginId}" configuration updated`,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update config',
      });
    }
  }

  // ==================== Plugin Execution ====================

  /**
   * Execute a plugin
   * POST /api/v1/plugins-spi/:pluginId/execute
   */
  async executePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const body = request.body as PluginExecuteBody;
      const service = getService();

      // Execute the plugin with sandbox isolation
      const result = await service.executePlugin(
        params.pluginId,
        async (signal) => {
          // Simulated execution - in production this would load and run the plugin's entry point
          if (signal.aborted) {
            throw new OrionError('Execution aborted', ErrorCode.OPERATION_FAILED);
          }

          // Simulate some work
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 50);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Execution aborted'));
            });
          });

          return {
            pluginId: params.pluginId,
            input: body?.input || {},
            executedAt: new Date().toISOString(),
          };
        },
        { timeout: body?.timeout }
      );

      const statusCode = result.success ? 200 : 400;
      await reply.status(statusCode).send({
        success: result.success,
        data: result,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute plugin',
      });
    }
  }

  /**
   * Cancel a running plugin execution
   * POST /api/v1/plugins-spi/:pluginId/cancel
   */
  async cancelExecution(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const body = request.body as { reason?: string };
      const service = getService();
      const cancelled = service.cancelExecution(params.pluginId, body?.reason);

      await reply.send({
        success: cancelled,
        message: cancelled
          ? `Execution of "${params.pluginId}" cancelled`
          : `No active execution found for "${params.pluginId}"`,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel execution',
      });
    }
  }

  // ==================== Health & Monitoring ====================

  /**
   * Get plugin health status
   * GET /api/v1/plugins-spi/:pluginId/health
   */
  async getPluginHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const service = getService();
      const health = service.getPluginHealth(params.pluginId);

      await reply.send({
        success: true,
        data: health,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get plugin health',
      });
    }
  }

  /**
   * Get health status for all plugins
   * GET /api/v1/plugins-spi/health
   */
  async getAllHealth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const service = getService();
      const healthList = service.getAllPluginHealth();

      await reply.send({
        success: true,
        data: healthList,
        total: healthList.length,
      });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get health status',
      });
    }
  }

  // ==================== Dependency Management ====================

  /**
   * Get dependency information for a plugin
   * GET /api/v1/plugins-spi/:pluginId/dependencies
   */
  async getDependencies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { pluginId: string };
      const service = getService();
      const depInfo = service.getDependencyInfo(params.pluginId);

      await reply.send({
        success: true,
        data: depInfo,
      });
    } catch (err) {
      await reply.status(404).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get dependencies',
      });
    }
  }
}
