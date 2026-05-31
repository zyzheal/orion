/**
 * Plugin Lifecycle Manager
 *
 * Manages the full plugin lifecycle:
 * - Installation with dependency resolution
 * - Enabling/disabling with activation hooks
 * - Uninstallation with cleanup
 * - State transition validation
 *
 * State Machine:
 *   installed -> enabled -> disabled -> enabled
 *   installed -> uninstalling -> (removed)
 *   any -> error (on failure)
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { PluginRegistry } from './PluginRegistry';
import {
  PluginManifest,
  PluginInfo,
  PluginStatus,
  PluginSandboxConfig,
  DEFAULT_SANDBOX_CONFIGS,
  PluginDependency,
} from './types';
import { PluginDependencyResolver } from './PluginDependencyResolver';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<PluginStatus, PluginStatus[]> = {
  installed: ['enabled', 'uninstalling', 'error'],
  enabled: ['disabled', 'uninstalling', 'error'],
  disabled: ['enabled', 'uninstalling', 'error'],
  error: ['installed', 'uninstalling', 'disabled'],
  uninstalling: ['installed'], // After cleanup, goes back to unregistered
};

/**
 * Activation hook function signature
 */
export type ActivationHook = (pluginId: string, config?: Record<string, any>) => Promise<void>;

/**
 * Deactivation hook function signature
 */
export type DeactivationHook = (pluginId: string) => Promise<void>;

/**
 * Plugin Lifecycle Manager
 */
export class PluginLifecycleManager extends EventEmitter {
  private registry: PluginRegistry;
  private dependencyResolver: PluginDependencyResolver;
  private activationHooks: Map<string, ActivationHook> = new Map();
  private deactivationHooks: Map<string, DeactivationHook> = new Map();
  private globalActivationHooks: {
    beforeEnable: ActivationHook[];
    afterEnable: ActivationHook[];
    beforeDisable: DeactivationHook[];
    afterDisable: DeactivationHook[];
    beforeUninstall: DeactivationHook[];
    afterUninstall: DeactivationHook[];
  } = {
    beforeEnable: [],
    afterEnable: [],
    beforeDisable: [],
    afterDisable: [],
    beforeUninstall: [],
    afterUninstall: [],
  };

  constructor(registry: PluginRegistry, dependencyResolver?: PluginDependencyResolver) {
    super();
    this.registry = registry;
    this.dependencyResolver = dependencyResolver || new PluginDependencyResolver();
  }

  /**
   * Install a plugin
   *
   * Validates manifest, resolves dependencies, and registers the plugin.
   * After installation, the plugin is in 'installed' state (not yet enabled).
   */
  async installPlugin(
    manifest: PluginManifest,
    config?: Record<string, any>
  ): Promise<PluginInfo> {
    logger.info({ pluginId: manifest.name, version: manifest.version }, 'Installing plugin');

    // Validate the manifest
    this.registry.validateManifest(manifest);

    // Check if already installed and enabled
    const existing = this.registry.getPlugin(manifest.name);
    if (existing && existing.status === 'enabled') {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Plugin is already installed and enabled');
    }

    // Resolve and validate dependencies
    await this.resolveDependencies(manifest);

    // Register the plugin
    const pluginInfo = await this.registry.register(manifest, config);

    logger.info({ pluginId: manifest.name }, 'Plugin installed successfully');
    this.emit('plugin:installed', { pluginId: manifest.name, version: manifest.version });

    return pluginInfo;
  }

  /**
   * Enable a plugin
   *
   * Transitions from 'installed' or 'disabled' to 'enabled'.
   * Runs activation hooks and enables dependencies first.
   */
  async enablePlugin(pluginId: string): Promise<PluginInfo> {
    logger.info({ pluginId }, 'Enabling plugin');

    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin "${pluginId}" not found. Install it first.`);
    }

    // Validate state transition
    this.validateTransition(pluginId, plugin.status, 'enabled');

    // Enable dependencies first
    await this.enableDependencies(pluginId);

    // Run before-enable hooks
    await this.runHooks(this.globalActivationHooks.beforeEnable, pluginId, plugin.config);

    // Run plugin-specific activation hook
    const activationHook = this.activationHooks.get(pluginId);
    if (activationHook) {
      try {
        await activationHook(pluginId, plugin.config);
      } catch (error) {
        this.handleError(pluginId, error);
        throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Platform version below minimum required');
      }
    }

    // Update status
    const updated = await this.registry.updateStatus(pluginId, 'enabled');
    if (!updated) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin "${pluginId}" not found during enable`);
    }

    // Run after-enable hooks
    await this.runHooks(this.globalActivationHooks.afterEnable, pluginId, plugin.config);

    logger.info({ pluginId }, 'Plugin enabled successfully');
    this.emit('plugin:enabled', { pluginId });

    return updated as PluginInfo;
  }

  /**
   * Disable a plugin
   *
   * Transitions from 'enabled' to 'disabled'.
   * Checks for dependents that rely on this plugin.
   */
  async disablePlugin(pluginId: string): Promise<PluginInfo> {
    logger.info({ pluginId }, 'Disabling plugin');

    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin "${pluginId}" not found.`);
    }

    // Validate state transition
    this.validateTransition(pluginId, plugin.status, 'disabled');

    // Check for active dependents
    this.checkDependents(pluginId);

    // Run before-disable hooks
    await this.runHooks(this.globalActivationHooks.beforeDisable, pluginId);

    // Run plugin-specific deactivation hook
    const deactivationHook = this.deactivationHooks.get(pluginId);
    if (deactivationHook) {
      try {
        await deactivationHook(pluginId);
      } catch (error) {
        logger.warn(
          { pluginId, error: error instanceof Error ? error.message : String(error) },
          'Deactivation hook failed, continuing with disable'
        );
      }
    }

    // Update status
    const updated = await this.registry.updateStatus(pluginId, 'disabled');
    if (!updated) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin "${pluginId}" not found during disable`);
    }

    // Run after-disable hooks
    await this.runHooks(this.globalActivationHooks.afterDisable, pluginId);

    logger.info({ pluginId }, 'Plugin disabled successfully');
    this.emit('plugin:disabled', { pluginId });

    return updated as PluginInfo;
  }

  /**
   * Uninstall a plugin
   *
   * Disables the plugin first, then removes it from the registry.
   * Runs cleanup hooks and validates no other plugins depend on it.
   */
  async uninstallPlugin(pluginId: string, force: boolean = false): Promise<void> {
    logger.info({ pluginId, force }, 'Uninstalling plugin');

    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin "${pluginId}" not found.`);
    }

    // Validate state transition
    this.validateTransition(pluginId, plugin.status, 'uninstalling');

    // Check for dependents (unless force)
    if (!force) {
      this.checkDependents(pluginId);
    }

    // Disable if currently enabled
    if (plugin.status === 'enabled') {
      await this.disablePlugin(pluginId);
    }

    // Update to uninstalling status
    this.registry.updateStatus(pluginId, 'uninstalling');

    // Run before-uninstall hooks
    await this.runHooks(this.globalActivationHooks.beforeUninstall, pluginId);

    // Run cleanup/deactivation hook
    const deactivationHook = this.deactivationHooks.get(pluginId);
    if (deactivationHook) {
      try {
        await deactivationHook(pluginId);
      } catch (error) {
        logger.warn(
          { pluginId, error: error instanceof Error ? error.message : String(error) },
          'Cleanup hook failed during uninstall'
        );
      }
    }

    // Remove from registry
    this.registry.remove(pluginId);

    // Remove hooks
    this.activationHooks.delete(pluginId);
    this.deactivationHooks.delete(pluginId);

    // Run after-uninstall hooks
    await this.runHooks(this.globalActivationHooks.afterUninstall, pluginId);

    logger.info({ pluginId }, 'Plugin uninstalled successfully');
    this.emit('plugin:uninstalled', { pluginId });
  }

  /**
   * Register an activation hook for a specific plugin
   */
  registerActivationHook(pluginId: string, hook: ActivationHook): void {
    this.activationHooks.set(pluginId, hook);
    logger.debug({ pluginId }, 'Activation hook registered');
  }

  /**
   * Register a deactivation hook for a specific plugin
   */
  registerDeactivationHook(pluginId: string, hook: DeactivationHook): void {
    this.deactivationHooks.set(pluginId, hook);
    logger.debug({ pluginId }, 'Deactivation hook registered');
  }

  /**
   * Register a global activation hook that runs for all plugins
   */
  registerGlobalHook(
    phase: 'beforeEnable' | 'afterEnable' | 'beforeDisable' | 'afterDisable' | 'beforeUninstall' | 'afterUninstall',
    hook: ActivationHook | DeactivationHook
  ): void {
    this.globalActivationHooks[phase].push(hook as any);
    logger.debug({ phase }, 'Global hook registered');
  }

  /**
   * Get the default sandbox configuration for a plugin
   */
  getDefaultSandboxConfig(securityLevel: string): PluginSandboxConfig {
    const level = securityLevel as keyof typeof DEFAULT_SANDBOX_CONFIGS;
    return DEFAULT_SANDBOX_CONFIGS[level] || DEFAULT_SANDBOX_CONFIGS.MEDIUM;
  }

  /**
   * Validate a state transition
   */
  private validateTransition(pluginId: string, from: PluginStatus, to: PluginStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Platform version above maximum supported');
    }
  }

  /**
   * Resolve and validate plugin dependencies
   */
  private async resolveDependencies(manifest: PluginManifest): Promise<void> {
    if (!manifest.dependencies || manifest.dependencies.length === 0) {
      return;
    }

    // Build a simple dependency graph including existing plugins
    const allManifests: PluginManifest[] = [manifest];
    for (const plugin of this.registry.listPlugins()) {
      allManifests.push(plugin.manifest);
    }

    const result = this.dependencyResolver.resolveDependencies(allManifests);

    if (!result.resolved) {
      const issues: string[] = [];

      for (const missing of result.missing) {
        issues.push(`Missing dependency: "${missing.pluginId}" requires "${missing.missingDependency}"`);
      }

      for (const cycle of result.cycles) {
        issues.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }

      throw new OrionError('OPERATION_FAILED', `Dependency resolution failed for "${manifest.name}": ${issues.join('; ')}`)
    }
  }

  /**
   * Enable all required dependencies for a plugin
   */
  private async enableDependencies(pluginId: string): Promise<void> {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin || !plugin.manifest.dependencies) {
      return;
    }

    for (const dep of plugin.manifest.dependencies) {
      if (dep.optional) continue;

      const depPlugin = this.registry.getPlugin(dep.name);
      if (!depPlugin) {
        throw new OrionError('VALIDATION_ERROR', `Dependency ${dep.name} not found`);
      }

      // Enable dependency if not already enabled
      if (depPlugin.status !== 'enabled') {
        logger.info(
          { pluginId, dependency: dep.name },
          'Enabling plugin dependency')
        await this.enablePlugin(dep.name);
      }
    }
  }

  /**
   * Check if any other enabled plugins depend on this plugin
   */
  private checkDependents(pluginId: string): void {
    const dependents: string[] = [];

    for (const plugin of this.registry.listPlugins()) {
      if (plugin.manifest.name === pluginId) continue;

      const deps = plugin.manifest.dependencies || [];
      const hasDependency = deps.some(
        (d) => d.name === pluginId && !d.optional
      );

      if (hasDependency && plugin.status === 'enabled') {
        dependents.push(plugin.manifest.name);
      }
    }

    if (dependents.length > 0) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Plugin is already enabled');
    }
  }

  /**
   * Run a list of hooks
   */
  private async runHooks(
    hooks: (ActivationHook | DeactivationHook)[],
    pluginId: string,
    config?: Record<string, any>
  ): Promise<void> {
    for (const hook of hooks) {
      try {
        await (hook as ActivationHook)(pluginId, config);
      } catch (error) {
        logger.warn(
          { pluginId, error: error instanceof Error ? error.message : String(error) },
          'Global hook failed, continuing'
        );
      }
    }
  }

  /**
   * Handle an error during plugin lifecycle
   */
  private handleError(pluginId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.registry.updateStatus(pluginId, 'error', message);
    logger.error({ pluginId, error: message }, 'Plugin lifecycle error');
    this.emit('plugin:error', { pluginId, error: message });
  }
}
