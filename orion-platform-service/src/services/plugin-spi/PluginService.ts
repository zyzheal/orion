/**
 * Plugin SPI Service
 *
 * Main orchestration service that combines:
 * - PluginRegistry: Registration and discovery
 * - PluginLifecycleManager: Install/enable/disable/uninstall
 * - PluginSandboxSPI: Isolated execution
 * - PluginDependencyResolver: Dependency management
 *
 * Provides a unified interface for plugin management and execution
 * with health monitoring and event publishing.
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { PluginRegistry } from './PluginRegistry';
import { PluginLifecycleManager } from './PluginLifecycleManager';
import { PluginSandboxSPI } from './PluginSandbox';
import { PluginDependencyResolver } from './PluginDependencyResolver';
import {
  PluginManifest,
  PluginInfo,
  PluginStatus,
  PluginExecutionResult,
  PluginHealthStatus,
  PluginSandboxConfig,
} from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Plugin SPI Service
 */
export class PluginService extends EventEmitter {
  private registry: PluginRegistry;
  private lifecycleManager: PluginLifecycleManager;
  private sandbox: PluginSandboxSPI;
  private dependencyResolver: PluginDependencyResolver;
  private initialized = false;

  constructor(options?: {
    pluginDirectory?: string;
    sandboxConfig?: Partial<PluginSandboxConfig>;
  }) {
    super();

    // Initialize components
    this.registry = new PluginRegistry({
      pluginDirectory: options?.pluginDirectory,
    });

    this.dependencyResolver = new PluginDependencyResolver();

    this.lifecycleManager = new PluginLifecycleManager(
      this.registry,
      this.dependencyResolver
    );

    this.sandbox = new PluginSandboxSPI(options?.sandboxConfig);

    // Wire up lifecycle events to the main service
    this.lifecycleManager.on('plugin:installed', (data) =>
      this.emit('plugin:installed', data)
    );
    this.lifecycleManager.on('plugin:enabled', (data) =>
      this.emit('plugin:enabled', data)
    );
    this.lifecycleManager.on('plugin:disabled', (data) =>
      this.emit('plugin:disabled', data)
    );
    this.lifecycleManager.on('plugin:uninstalled', (data) =>
      this.emit('plugin:uninstalled', data)
    );
    this.lifecycleManager.on('plugin:error', (data) =>
      this.emit('plugin:error', data)
    );
  }

  /**
   * Initialize the plugin service
   *
   * Discovers plugins from the plugin directory and loads them.
   * This should be called once during application startup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Plugin service already initialized');
      return;
    }

    logger.info('Initializing plugin service');

    // Discover plugins from directory
    const discovered = await this.registry.discover();

    logger.info(
      { count: discovered.length, total: this.registry.getPluginCount() },
      'Plugin service initialized'
    );

    this.initialized = true;
    this.emit('service:initialized', {
      discovered: discovered.map((p) => p.manifest.name),
    });
  }

  // ==================== Registration & Discovery ====================

  /**
   * Register a plugin manually
   */
  async registerPlugin(
    manifest: PluginManifest,
    config?: Record<string, any>
  ): Promise<PluginInfo> {
    return this.lifecycleManager.installPlugin(manifest, config);
  }

  /**
   * Discover plugins from the plugin directory
   */
  async discoverPlugins(): Promise<PluginInfo[]> {
    return this.registry.discover();
  }

  /**
   * Get plugin information by name
   */
  getPlugin(pluginId: string): PluginInfo | undefined {
    return this.registry.getPlugin(pluginId);
  }

  /**
   * List all plugins with optional filtering
   */
  listPlugins(options?: {
    statusFilter?: PluginStatus;
    capabilityFilter?: string;
    tagFilter?: string[];
  }): PluginInfo[] {
    return this.registry.listPlugins(options);
  }

  // ==================== Lifecycle Management ====================

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<PluginInfo> {
    return this.lifecycleManager.enablePlugin(pluginId);
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<PluginInfo> {
    return this.lifecycleManager.disablePlugin(pluginId);
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string, force: boolean = false): Promise<void> {
    return this.lifecycleManager.uninstallPlugin(pluginId, force);
  }

  /**
   * Update plugin configuration
   */
  updatePluginConfig(
    pluginId: string,
    config: Record<string, any>
  ): PluginInfo | undefined {
    return this.registry.updateConfig(pluginId, config);
  }

  // ==================== Plugin Execution ====================

  /**
   * Execute a plugin with sandbox isolation
   *
   * @param pluginId - Plugin identifier
   * @param fn - Function to execute (the plugin's entry point logic)
   * @param options - Execution options (timeout override)
   * @returns Execution result with output and metrics
   */
  async executePlugin<T = Record<string, any>>(
    pluginId: string,
    fn: (signal: AbortSignal) => Promise<T>,
    options?: { timeout?: number }
  ): Promise<PluginExecutionResult> {
    // Verify plugin exists and is enabled
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      return {
        success: false,
        output: undefined,
        duration: 0,
        error: `Plugin "${pluginId}" not found`,
        exitCode: 1,
      };
    }

    if (plugin.status !== 'enabled') {
      return {
        success: false,
        output: undefined,
        duration: 0,
        error: `Plugin "${pluginId}" is not enabled (status: ${plugin.status})`,
        exitCode: 1,
      };
    }

    this.emit('plugin:executing', { pluginId });

    // Execute in sandbox
    const result = await this.sandbox.execute(pluginId, fn, options);

    this.emit('plugin:executed', {
      pluginId,
      success: result.success,
      duration: result.duration,
    });

    return result;
  }

  /**
   * Cancel a running plugin execution
   */
  cancelExecution(pluginId: string, reason?: string): boolean {
    return this.sandbox.cancelExecution(pluginId, reason);
  }

  // ==================== Health Monitoring ====================

  /**
   * Get health status for a specific plugin
   */
  getPluginHealth(pluginId: string): PluginHealthStatus {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      return {
        pluginId,
        healthy: false,
        lastChecked: new Date(),
        message: 'Plugin not found',
      };
    }

    const metrics = this.sandbox.getPluginHealth(pluginId);

    // Determine health based on status and execution metrics
    let healthy = plugin.status === 'enabled';
    let message: string | undefined;

    if (plugin.status === 'error') {
      healthy = false;
      message = plugin.error || 'Plugin is in error state';
    } else if (metrics.successRate < 0.5 && metrics.totalExecutions > 5) {
      healthy = false;
      message = `Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`;
    } else if (metrics.activeExecutions >= (plugin.sandboxConfig?.maxConcurrent || 10)) {
      healthy = false;
      message = 'Plugin at maximum concurrency';
    }

    return {
      pluginId,
      healthy,
      lastChecked: new Date(),
      message,
      metrics: {
        executionCount: metrics.totalExecutions,
        successRate: metrics.successRate,
        avgDurationMs: metrics.avgDurationMs,
        errorCount: metrics.failureCount,
      },
    };
  }

  /**
   * Get health status for all plugins
   */
  getAllPluginHealth(): PluginHealthStatus[] {
    const plugins = this.registry.listPlugins();
    return plugins.map((p) => this.getPluginHealth(p.manifest.name));
  }

  // ==================== Dependency Management ====================

  /**
   * Get dependency resolution info for a plugin
   */
  getDependencyInfo(pluginId: string): {
    dependencies: string[];
    dependents: string[];
    canInstall: boolean;
    missingDeps: string[];
  } {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    const deps = plugin.manifest.dependencies?.map((d) => d.name) || [];
    const dependents: string[] = [];
    const missingDeps: string[] = [];

    for (const other of this.registry.listPlugins()) {
      if (other.manifest.name === pluginId) continue;
      const otherDeps = other.manifest.dependencies || [];
      if (otherDeps.some((d) => d.name === pluginId)) {
        dependents.push(other.manifest.name);
      }
    }

    for (const dep of plugin.manifest.dependencies || []) {
      if (!dep.optional && !this.registry.hasPlugin(dep.name)) {
        missingDeps.push(dep.name);
      }
    }

    return {
      dependencies: deps,
      dependents,
      canInstall: missingDeps.length === 0,
      missingDeps,
    };
  }

  // ==================== Registration of Custom Hooks ====================

  /**
   * Register a custom activation hook for a plugin
   */
  registerActivationHook(
    pluginId: string,
    hook: (pluginId: string, config?: Record<string, any>) => Promise<void>
  ): void {
    this.lifecycleManager.registerActivationHook(pluginId, hook);
  }

  /**
   * Register a custom deactivation hook for a plugin
   */
  registerDeactivationHook(
    pluginId: string,
    hook: (pluginId: string) => Promise<void>
  ): void {
    this.lifecycleManager.registerDeactivationHook(pluginId, hook);
  }

  // ==================== Shutdown ====================

  /**
   * Shutdown the plugin service
   *
   * Cancels all running executions and cleans up resources.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down plugin service');

    // Cancel all running executions
    const cancelled = this.sandbox.cancelAllExecutions('Service shutdown');

    // Disable all enabled plugins
    for (const plugin of this.registry.listPlugins({ statusFilter: 'enabled' })) {
      try {
        await this.lifecycleManager.disablePlugin(plugin.manifest.name);
      } catch (error) {
        logger.warn(
          { pluginId: plugin.manifest.name, error },
          'Failed to disable plugin during shutdown'
        );
      }
    }

    // Shutdown sandbox
    this.sandbox.shutdown();

    this.initialized = false;
    logger.info({ cancelled }, 'Plugin service shutdown complete');
  }

  /**
   * Get service initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalPlugins: number;
    enabledPlugins: number;
    disabledPlugins: number;
    errorPlugins: number;
    activeExecutions: number;
  } {
    const all = this.registry.listPlugins();
    return {
      totalPlugins: all.length,
      enabledPlugins: all.filter((p) => p.status === 'enabled').length,
      disabledPlugins: all.filter((p) => p.status === 'disabled').length,
      errorPlugins: all.filter((p) => p.status === 'error').length,
      activeExecutions: this.sandbox.getActiveExecutionCount(),
    };
  }
}
