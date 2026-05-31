import { ErrorCode } from '../../errors';
/**
 * Plugin Registry
 *
 * Handles plugin registration, discovery, and metadata management.
 * Supports:
 * - Manual plugin registration with manifest validation
 * - Auto-discovery from plugin directory
 * - Version compatibility checking against platform version
 * - Plugin lookup and listing
 */

import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { OrionError } from '../../errors';
import {
  PluginManifest,
  PluginInfo,
  PluginStatus,
  PLATFORM_VERSION,
  PluginEventType,
  PluginSecurityLevel,
} from './types';
import { PluginRegistryRepository } from '../../repositories/PluginRegistryRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Plugin Registry
 *
 * Central registry for plugin metadata and lifecycle tracking.
 */
export class PluginRegistry {
  private plugins: Map<string, PluginInfo> = new Map(); // in-memory cache
  private pluginDirectory: string;
  private listeners: Map<PluginEventType, Array<(data: any) => void>> = new Map();
  private repository?: PluginRegistryRepository;

  constructor(options?: { pluginDirectory?: string; db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } }) {
    this.pluginDirectory = options?.pluginDirectory || path.join(process.cwd(), 'plugins');
    if (options?.db) {
      this.repository = new PluginRegistryRepository(options.db);
    }
  }

  /**
   * Register a plugin with manifest validation
   */
  async register(manifest: PluginManifest, config?: Record<string, any>): Promise<PluginInfo> {
    this.validateManifest(manifest);

    // Check platform version compatibility
    this.checkPlatformCompatibility(manifest);

    const pluginInfo: PluginInfo = {
      manifest,
      version: manifest.version,
      status: 'installed',
      installDate: new Date(),
      config,
    };

    this.plugins.set(manifest.name, pluginInfo);

    // Persist to repository
    if (this.repository) {
      try {
        await this.repository.create({
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          status: 'installed',
          config: config || {},
          manifest: manifest as any,
        });
      } catch (err) {
        logger.warn({ pluginId: manifest.name, error: err }, 'Failed to persist plugin to repository');
      }
    }

    logger.info({ pluginId: manifest.name, version: manifest.version }, 'Plugin registered');
    this.emit('plugin:registered', { pluginId: manifest.name, version: manifest.version });

    return pluginInfo;
  }

  /**
   * Discover and register plugins from the plugin directory
   *
   * Scans the plugin directory for manifest.json files and registers each plugin.
   * Directory structure expected:
   *   plugins/
   *     plugin-a/
   *       manifest.json
   *       index.js
   *     plugin-b/
   *       manifest.json
   *       index.js
   */
  async discover(): Promise<PluginInfo[]> {
    const discovered: PluginInfo[] = [];

    if (!fs.existsSync(this.pluginDirectory)) {
      logger.info({ directory: this.pluginDirectory }, 'Plugin directory not found, skipping discovery');
      return discovered;
    }

    const entries = fs.readdirSync(this.pluginDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(this.pluginDirectory, entry.name, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        logger.debug({ path: manifestPath }, 'No manifest.json found, skipping');
        continue;
      }

      try {
        const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
        const manifest: PluginManifest = JSON.parse(manifestContent);

        this.validateManifest(manifest);
        this.checkPlatformCompatibility(manifest);

        // Check if already registered
        if (this.plugins.has(manifest.name)) {
          logger.warn(
            { pluginId: manifest.name },
            'Plugin already registered, skipping discovery'
          );
          continue;
        }

        const pluginInfo: PluginInfo = {
          manifest,
          version: manifest.version,
          status: 'installed',
          installDate: new Date(),
        };

        this.plugins.set(manifest.name, pluginInfo);
        discovered.push(pluginInfo);

        logger.info(
          { pluginId: manifest.name, version: manifest.version },
          'Plugin discovered and registered'
        );
      } catch (error) {
        logger.error(
          { path: manifestPath, error: error instanceof Error ? error.message : String(error) },
          'Failed to discover plugin'
        );
      }
    }

    logger.info({ count: discovered.length }, 'Plugin discovery complete');
    return discovered;
  }

  /**
   * Get plugin info by name
   */
  getPlugin(name: string): PluginInfo | undefined {
    return this.plugins.get(name);
  }

  /**
   * List all registered plugins
   */
  listPlugins(options?: {
    statusFilter?: PluginStatus;
    capabilityFilter?: string;
    tagFilter?: string[];
  }): PluginInfo[] {
    let plugins = Array.from(this.plugins.values());

    if (options?.statusFilter) {
      plugins = plugins.filter((p) => p.status === options.statusFilter);
    }

    if (options?.capabilityFilter) {
      plugins = plugins.filter((p) =>
        p.manifest.capabilities.some((c) =>
          c.toLowerCase().includes(options.capabilityFilter!.toLowerCase())
        )
      );
    }

    if (options?.tagFilter?.length) {
      plugins = plugins.filter((p) =>
        p.manifest.tags?.some((tag) => options.tagFilter!.includes(tag))
      );
    }

    return plugins;
  }

  /**
   * Update plugin status
   */
  async updateStatus(name: string, status: PluginStatus, error?: string): Promise<PluginInfo | undefined> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return undefined;
    }

    plugin.status = status;
    if (error) {
      plugin.error = error;
    }
    if (status === 'enabled') {
      plugin.enabledDate = new Date();
    }

    // Persist to repository
    if (this.repository) {
      try {
        const entity = await this.repository.findByName(name);
        if (entity) {
          await this.repository.updateStatus(entity.id, status, error);
        }
      } catch (err) {
        logger.warn({ pluginId: name, error: err }, 'Failed to persist status update to repository');
      }
    }

    return plugin;
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(name: string, config: Record<string, any>): Promise<PluginInfo | undefined> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return undefined;
    }

    plugin.config = { ...plugin.config, ...config };

    // Persist to repository
    if (this.repository) {
      try {
        const entity = await this.repository.findByName(name);
        if (entity) {
          await this.repository.updateConfig(entity.id, config);
        }
      } catch (err) {
        logger.warn({ pluginId: name, error: err }, 'Failed to persist config update to repository');
      }
    }

    return plugin;
  }

  /**
   * Remove a plugin from the registry
   */
  async remove(name: string): Promise<boolean> {
    const existed = this.plugins.delete(name);
    if (existed) {
      // Remove from repository
      if (this.repository) {
        try {
          const entity = await this.repository.findByName(name);
          if (entity) {
            await this.repository.delete(entity.id);
          }
        } catch (err) {
          logger.warn({ pluginId: name, error: err }, 'Failed to remove plugin from repository');
        }
      }
      logger.info({ pluginId: name }, 'Plugin removed from registry');
    }
    return existed;
  }

  /**
   * Check if a plugin exists
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get plugin count
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Validate a plugin manifest
   */
  validateManifest(manifest: PluginManifest): void {
    const errors: string[] = [];

    // Required fields
    if (!manifest.name || manifest.name.trim().length === 0) {
      errors.push('name is required');
    }

    if (!manifest.version || manifest.version.trim().length === 0) {
      errors.push('version is required');
    } else if (!this.isValidSemver(manifest.version)) {
      errors.push(`version "${manifest.version}" is not a valid semver`);
    }

    if (!manifest.description || manifest.description.trim().length === 0) {
      errors.push('description is required');
    }

    if (!manifest.author || manifest.author.trim().length === 0) {
      errors.push('author is required');
    }

    if (!manifest.entryPoint || manifest.entryPoint.trim().length === 0) {
      errors.push('entryPoint is required');
    }

    if (!manifest.capabilities || manifest.capabilities.length === 0) {
      errors.push('capabilities is required and must not be empty');
    }

    // Name format validation (allow hyphens, dots, slashes for namespacing)
    if (manifest.name && !/^[a-z0-9][a-z0-9._/-]*$/.test(manifest.name)) {
      errors.push('name must be lowercase alphanumeric with dots, hyphens, or slashes');
    }

    // Dependency validation
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!dep.name || !dep.version) {
          errors.push(`dependency at index ${manifest.dependencies.indexOf(dep)} is missing name or version`);
        } else if (!this.isValidSemverRange(dep.version)) {
          errors.push(`dependency "${dep.name}" has invalid version range "${dep.version}"`);
        }
      }
    }

    if (errors.length > 0) {
      throw new OrionError('VALIDATION_ERROR', `Invalid plugin manifest: ${errors.join(', ')}`)
    }
  }

  /**
   * Check platform version compatibility
   */
  private checkPlatformCompatibility(manifest: PluginManifest): void {
    if (manifest.minPlatformVersion) {
      if (!this.isVersionGte(PLATFORM_VERSION, manifest.minPlatformVersion)) {
        throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Platform version below minimum required');
      }
    }

    if (manifest.maxPlatformVersion) {
      if (!this.isVersionLte(PLATFORM_VERSION, manifest.maxPlatformVersion)) {
        throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Platform version above maximum supported');
      }
    }
  }

  /**
   * Register an event listener
   */
  on(event: PluginEventType, handler: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  /**
   * Validate semantic version string
   */
  private isValidSemver(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
  }

  /**
   * Validate semver range (simplified)
   */
  private isValidSemverRange(range: string): boolean {
    // Support: exact version, >=, <, combined ranges
    const rangePattern = /^(>=?\d+\.\d+\.\d+|<\d+\.\d+\.\d+)?(\s+(>=?\d+\.\d+\.\d+|<\d+\.\d+\.\d+))*$|^\d+\.\d+\.\d+$/;
    return rangePattern.test(range.trim());
  }

  /**
   * Check if version a >= version b (simple comparison)
   */
  private isVersionGte(a: string, b: string): boolean {
    return this.compareVersions(a, b) >= 0;
  }

  /**
   * Check if version a <= version b (simple comparison)
   */
  private isVersionLte(a: string, b: string): boolean {
    return this.compareVersions(a, b) <= 0;
  }

  /**
   * Compare two version strings
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('-')[0].split('.').map(Number);
    const bParts = b.split('-')[0].split('.').map(Number);
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLen; i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }

    return 0;
  }

  /**
   * Emit an event to listeners
   */
  private emit(event: PluginEventType, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          logger.error({ event, error }, 'Error in event handler');
        }
      }
    }
  }
}
