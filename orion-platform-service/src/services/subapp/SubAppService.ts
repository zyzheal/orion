/**
 * SubAppService - Service layer for SubApp management
 *
 * Provides business logic for sub-application configuration management
 */

import { DatabasePool } from '../database';
import { SubAppRepository, SubAppConfig, CreateSubAppInput, UpdateSubAppInput, SubAppConfigHistory } from './SubAppRepository';
import { OrionError, ErrorCode } from '../../../errors';

export class SubAppService {
  private repository: SubAppRepository;

  constructor(db: DatabasePool) {
    this.repository = new SubAppRepository(db);
  }

  /**
   * Get all sub-app configurations
   */
  async getAll(): Promise<SubAppConfig[]> {
    return this.repository.findAll();
  }

  /**
   * Get enabled sub-apps only
   */
  async getEnabled(): Promise<SubAppConfig[]> {
    return this.repository.findEnabled();
  }

  /**
   * Get sub-app by key
   */
  async getByKey(key: string): Promise<SubAppConfig | null> {
    return this.repository.findByKey(key);
  }

  /**
   * Create new sub-app configuration
   */
  async create(input: CreateSubAppInput, userId?: string): Promise<SubAppConfig> {
    // Validate input
    this.validateInput(input);

    // Check if key already exists
    const existing = await this.repository.findByKey(input.key);
    if (existing) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Sub-app with key '${input.key}' already exists`);
    }

    // Create the config
    const config = await this.repository.create({
      ...input,
      created_by: userId || undefined,
    });

    // Add history record
    await this.repository.addHistory(
      (input as any).key || (input as any).key,
      'created',
      null,
      this.toRecord(config),
      userId || null,
      `Created sub-app '${input.name}'`,
    );

    return config;
  }

  /**
   * Update sub-app configuration
   */
  async update(key: string, input: any, userId?: string): Promise<SubAppConfig> {
    // Get current config
    const current = await this.repository.findByKey(key);
    if (!current) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Sub-app with key '${key}' not found`);
    }

    // Validate input if provided
    if ((input as any).key && (input as any).key !== key) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Cannot change sub-app key');
    }

    // Update the config
    const updated = await this.repository.update(key, input);
    if (!updated) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Failed to update sub-app configuration');
    }

    // Add history record
    const action = input.status && input.status !== current.status ? 'status_changed' : 'updated';
    await this.repository.addHistory(
      key,
      action,
      this.toRecord(current),
      this.toRecord(updated),
      userId || null,
      `Updated sub-app '${current.name}'`,
    );

    return updated;
  }

  /**
   * Toggle sub-app status
   */
  async toggleStatus(key: string, userId?: string): Promise<SubAppConfig> {
    const current = await this.repository.findByKey(key);
    if (!current) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Sub-app with key '${key}' not found`);
    }

    const updated = await this.repository.toggleStatus(key);
    if (!updated) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Failed to toggle sub-app status');
    }

    // Add history record
    await this.repository.addHistory(
      key,
      'status_changed',
      this.toRecord(current),
      this.toRecord(updated),
      userId || null,
      `Changed status from '${current.status}' to '${updated.status}'`,
    );

    return updated;
  }

  /**
   * Delete sub-app configuration
   */
  async delete(key: string, userId?: string): Promise<void> {
    const current = await this.repository.findByKey(key);
    if (!current) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Sub-app with key '${key}' not found`);
    }

    const deleted = await this.repository.delete(key);
    if (!deleted) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Failed to delete sub-app configuration');
    }

    // Add history record
    await this.repository.addHistory(
      key,
      'deleted',
      this.toRecord(current),
      null,
      userId || null,
      `Deleted sub-app '${current.name}'`,
    );
  }

  /**
   * Get configuration history
   */
  async getHistory(key: string): Promise<SubAppConfigHistory[]> {
    return this.repository.getHistory(key);
  }

  /**
   * Validate input configuration
   */
  private validateInput(input: CreateSubAppInput | any): void {
    if ('key' in input && input.key) {
      // Key format: lowercase, alphanumeric, hyphens only
      if (!/^[a-z][a-z0-9-]*$/.test(input.key)) {
        throw new Error('Key must start with lowercase letter and contain only lowercase letters, numbers, and hyphens');
      }
    }

    if ('entry_dev' in input && input.entry_dev) {
      // Validate development URL
      try {
        const url = new URL(input.entry_dev);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new OrionError(ErrorCode.OPERATION_FAILED, 'Development entry must use HTTP or HTTPS');
        }
      } catch {
        throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid development entry URL');
      }
    }

    if ('entry_prod' in input && input.entry_prod) {
      // Production entry should be a path or relative URL
      if (!input.entry_prod.startsWith('/') && !input.entry_prod.startsWith('http')) {
        throw new OrionError(ErrorCode.OPERATION_FAILED, 'Production entry must be a path starting with / or a full URL');
      }
    }

    if ('routes' in input && input.routes) {
      if (!Array.isArray(input.routes)) {
        throw new OrionError(ErrorCode.OPERATION_FAILED, 'Routes must be an array');
      }
      for (const route of input.routes) {
        if (!route.startsWith('/')) {
          throw new OrionError(ErrorCode.OPERATION_FAILED, 'Each route must start with /');
        }
      }
    }
  }

  /**
   * Convert config to record for history
   */
  private toRecord(config: SubAppConfig): Record<string, any> {
    return {
      id: config.id,
      name: config.name,
      key: config.key,
      version: config.version,
      entry_dev: config.entry_dev,
      entry_prod: config.entry_prod,
      routes: config.routes,
      permissions: config.permissions,
      keep_alive: config.keep_alive,
      preload: config.preload,
      description: config.description,
      icon: config.icon,
      status: config.status,
      sort_order: config.sort_order,
    };
  }
}

export default SubAppService;