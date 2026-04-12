/**
 * ConfigService - Core Configuration Management
 *
 * Provides CRUD operations for configuration items with versioning support.
 * Every change creates a new version, enabling full history and rollback.
 *
 * Features:
 *   - Environment-specific config (dev/staging/prod)
 *   - Automatic versioning on every change
 *   - Config rollback to any previous version
 *   - Tag-based filtering
 *   - Encrypted value support (placeholder)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ConfigItem,
  ConfigVersion,
  CreateConfigInput,
  UpdateConfigInput,
  ListConfigsFilter,
  ConfigEnvironment,
  ConfigStatus,
  IEventPublisher,
  ConfigEvents,
} from './types';

export interface ConfigServiceConfig {
  eventPublisher?: IEventPublisher;
}

export class ConfigService {
  private configs: Map<string, ConfigItem>;
  private versions: Map<string, ConfigVersion[]>; // configId -> versions
  private eventPublisher: IEventPublisher | null;

  constructor(config?: ConfigServiceConfig) {
    this.configs = new Map();
    this.versions = new Map();
    this.eventPublisher = config?.eventPublisher || null;
  }

  setEventPublisher(publisher: IEventPublisher): void {
    this.eventPublisher = publisher;
  }

  /**
   * Create a new configuration item
   */
  async createConfig(input: CreateConfigInput): Promise<ConfigItem> {
    // Check for duplicate key+environment
    const existing = this.findByKeyAndEnv(input.key, input.environment);
    if (existing) {
      throw new Error(
        `Config '${input.key}' already exists in environment '${input.environment}'`
      );
    }

    const now = new Date();
    const id = uuidv4();

    const config: ConfigItem = {
      id,
      key: input.key,
      value: input.value,
      environment: input.environment,
      version: 1,
      status: 'active',
      description: input.description,
      encrypted: input.encrypted || false,
      tags: input.tags || [],
      createdBy: input.createdBy,
      createdAt: now,
    };

    this.configs.set(id, config);

    // Create initial version
    const initialVersion: ConfigVersion = {
      id: uuidv4(),
      configId: id,
      key: input.key,
      value: input.value,
      version: 1,
      environment: input.environment,
      changeLog: 'Initial creation',
      createdBy: input.createdBy,
      createdAt: now,
    };

    this.versions.set(id, [initialVersion]);

    await this.publishEvent(ConfigEvents.CONFIG_CHANGED, {
      action: 'created',
      configId: id,
      key: input.key,
      environment: input.environment,
      version: 1,
    });

    return { ...config };
  }

  /**
   * Update an existing configuration item
   */
  async updateConfig(
    configId: string,
    input: UpdateConfigInput
  ): Promise<ConfigItem> {
    const config = this.configs.get(configId);
    if (!config) {
      throw new Error(`Config '${configId}' not found`);
    }

    const oldVersion = config.version;
    const newVersion = oldVersion + 1;
    const now = new Date();

    // Update config
    config.value = input.value;
    config.version = newVersion;
    config.updatedBy = input.updatedBy;
    config.updatedAt = now;

    if (input.description !== undefined) {
      config.description = input.description;
    }
    if (input.status !== undefined) {
      config.status = input.status;
    }
    if (input.tags !== undefined) {
      config.tags = input.tags;
    }

    // Create new version record
    const version: ConfigVersion = {
      id: uuidv4(),
      configId,
      key: config.key,
      value: input.value,
      version: newVersion,
      environment: config.environment,
      changeLog: `Updated by ${input.updatedBy}`,
      createdBy: input.updatedBy,
      createdAt: now,
    };

    const versions = this.versions.get(configId) || [];
    versions.push(version);
    this.versions.set(configId, versions);

    await this.publishEvent(ConfigEvents.CONFIG_CHANGED, {
      action: 'updated',
      configId,
      key: config.key,
      environment: config.environment,
      oldVersion,
      newVersion,
    });

    return { ...config };
  }

  /**
   * Delete a configuration item (soft delete by setting status to deprecated)
   */
  async deleteConfig(configId: string, deletedBy: string): Promise<void> {
    const config = this.configs.get(configId);
    if (!config) {
      throw new Error(`Config '${configId}' not found`);
    }

    config.status = 'deprecated';
    config.updatedBy = deletedBy;
    config.updatedAt = new Date();

    await this.publishEvent(ConfigEvents.CONFIG_CHANGED, {
      action: 'deleted',
      configId,
      key: config.key,
      environment: config.environment,
    });
  }

  /**
   * Get a configuration item by ID
   */
  async getConfig(configId: string): Promise<ConfigItem | null> {
    const config = this.configs.get(configId);
    return config ? { ...config } : null;
  }

  /**
   * Get a configuration item by key and environment
   */
  async getConfigByKey(
    key: string,
    environment: ConfigEnvironment
  ): Promise<ConfigItem | null> {
    return this.findByKeyAndEnv(key, environment) || null;
  }

  /**
   * List configurations with optional filters
   */
  async listConfigs(filter?: ListConfigsFilter): Promise<ConfigItem[]> {
    let results = Array.from(this.configs.values());

    // Filter out deprecated by default
    if (!filter?.status) {
      results = results.filter((c) => c.status !== 'deprecated');
    }

    if (filter?.environment) {
      results = results.filter((c) => c.environment === filter.environment);
    }
    if (filter?.status) {
      results = results.filter((c) => c.status === filter.status);
    }
    if (filter?.keyPrefix) {
      results = results.filter((c) => c.key.startsWith(filter.keyPrefix!));
    }
    if (filter?.tags && filter.tags.length > 0) {
      results = results.filter(
        (c) =>
          c.tags && filter.tags!.some((tag) => c.tags!.includes(tag))
      );
    }

    // Apply pagination
    const offset = filter?.offset || 0;
    const limit = filter?.limit || results.length;
    return results.slice(offset, offset + limit).map((c) => ({ ...c }));
  }

  /**
   * Get all versions of a configuration item
   */
  async getConfigVersions(configId: string): Promise<ConfigVersion[]> {
    const versions = this.versions.get(configId) || [];
    return versions.map((v) => ({ ...v }));
  }

  /**
   * Rollback a configuration item to a specific version
   */
  async rollbackConfig(
    configId: string,
    targetVersion: number,
    rolledBackBy: string
  ): Promise<ConfigItem> {
    const config = this.configs.get(configId);
    if (!config) {
      throw new Error(`Config '${configId}' not found`);
    }

    const versions = this.versions.get(configId) || [];
    const targetVersionRecord = versions.find((v) => v.version === targetVersion);

    if (!targetVersionRecord) {
      throw new Error(
        `Version ${targetVersion} not found for config '${configId}'`
      );
    }

    if (targetVersion >= config.version) {
      throw new Error(
        `Target version ${targetVersion} must be less than current version ${config.version}`
      );
    }

    const oldVersion = config.version;
    const newVersion = config.version + 1;
    const now = new Date();

    // Rollback the value
    config.value = targetVersionRecord.value;
    config.version = newVersion;
    config.updatedBy = rolledBackBy;
    config.updatedAt = now;

    // Create version record for rollback
    const rollbackVersion: ConfigVersion = {
      id: uuidv4(),
      configId,
      key: config.key,
      value: targetVersionRecord.value,
      version: newVersion,
      environment: config.environment,
      changeLog: `Rolled back from v${oldVersion} to v${targetVersion} by ${rolledBackBy}`,
      createdBy: rolledBackBy,
      createdAt: now,
    };

    versions.push(rollbackVersion);
    this.versions.set(configId, versions);

    await this.publishEvent(ConfigEvents.CONFIG_ROLLED_BACK, {
      configId,
      key: config.key,
      environment: config.environment,
      fromVersion: oldVersion,
      toVersion: targetVersion,
      newVersionNumber: newVersion,
      rolledBackBy,
    });

    return { ...config };
  }

  /**
   * Get configs for a specific environment (bulk retrieval)
   */
  async getEnvironmentConfigs(
    environment: ConfigEnvironment
  ): Promise<ConfigItem[]> {
    return this.listConfigs({ environment });
  }

  /**
   * Clone a config item to another environment
   */
  async cloneConfig(
    configId: string,
    targetEnvironment: ConfigEnvironment,
    createdBy: string
  ): Promise<ConfigItem> {
    const source = this.configs.get(configId);
    if (!source) {
      throw new Error(`Config '${configId}' not found`);
    }

    const existing = this.findByKeyAndEnv(source.key, targetEnvironment);
    if (existing) {
      throw new Error(
        `Config '${source.key}' already exists in environment '${targetEnvironment}'`
      );
    }

    return this.createConfig({
      key: source.key,
      value: source.value,
      environment: targetEnvironment,
      description: source.description,
      encrypted: source.encrypted,
      tags: source.tags,
      createdBy,
    });
  }

  /**
   * Batch import configs (useful for GitOps sync)
   */
  async batchImportConfigs(
    inputs: CreateConfigInput[]
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const result = { created: 0, skipped: 0, errors: [] as string[] };

    for (const input of inputs) {
      try {
        await this.createConfig(input);
        result.created++;
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          result.skipped++;
        } else {
          result.errors.push(
            `Failed to import ${input.key}: ${error.message}`
          );
        }
      }
    }

    return result;
  }

  // ==================== Internal Helpers ====================

  private findByKeyAndEnv(
    key: string,
    environment: ConfigEnvironment
  ): ConfigItem | undefined {
    for (const config of this.configs.values()) {
      if (config.key === key && config.environment === environment) {
        return config;
      }
    }
    return undefined;
  }

  private async publishEvent(type: string, data: any): Promise<void> {
    if (!this.eventPublisher) return;
    try {
      await this.eventPublisher.publish(type, data, {
        source: 'config-mgmt-service',
      });
    } catch (error) {
      // Best-effort event publishing
    }
  }
}
