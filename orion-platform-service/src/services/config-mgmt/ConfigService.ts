/**
 * ConfigService - Business logic layer for Configuration operations
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigRepository, ConfigEntry, ConfigHistory } from './ConfigRepository';
import { ConfigItem, ConfigStatus, ConfigEnvironment } from './types';
import { CacheService } from '../cache/CacheService';
import { OrionError, ErrorCode } from '../../errors';

export class ConfigServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'ConfigServiceError'; }
}

export interface CreateConfigInput {
  key: string;
  value: string;
  environment?: string;
  description?: string;
  encrypted?: boolean;
  tags?: string[];
  createdBy?: string;
}

export interface UpdateConfigInput {
  value: string;
  description?: string;
  status?: ConfigStatus;
  tags?: string[];
  updatedBy: string;
}

export interface ListConfigsFilter {
  environment?: string;
  status?: string;
  keyPrefix?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// Helper: convert ConfigEntry to ConfigItem format
function entryToItem(entry: ConfigEntry): ConfigItem {
  const rawValue = entry.value as any;
  const actualValue = rawValue?.value !== undefined ? rawValue.value : rawValue;
  return {
    id: entry.id,
    key: entry.key,
    value: typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue),
    environment: (entry.environment as ConfigEnvironment) || 'dev',
    version: entry.version,
    status: (entry.status as ConfigStatus) || 'active',
    description: entry.description,
    encrypted: entry.encrypted || false,
    tags: entry.tags || [],
    createdBy: entry.createdBy || entry.created_by || entry.updatedBy || entry.updated_by || 'system',
    createdAt: entry.createdAt || entry.created_at,
    updatedBy: entry.updatedBy || entry.updated_by,
    updatedAt: entry.updatedAt || entry.updated_at,
    approvedBy: (entry as any).approvedBy,
    approvedAt: (entry as any).approvedAt,
  };
}

// Helper: build repository value object from input
function buildValueObject(input: CreateConfigInput | UpdateConfigInput): Record<string, any> {
  return {
    value: input.value,
    ...(input as any).environment !== undefined && { environment: (input as any).environment },
    ...(input as any).description !== undefined && { description: (input as any).description },
    ...(input as any).encrypted !== undefined && { encrypted: (input as any).encrypted },
    ...(input as any).tags !== undefined && { tags: (input as any).tags },
  };
}

export class ConfigService {
  private repository: ConfigRepository;
  private history: Map<string, ConfigHistory[]> = new Map();
  private cache: CacheService;

  constructor(repository?: ConfigRepository, cache?: CacheService) {
    this.repository = repository || new ConfigRepository();
    this.cache = cache || new CacheService(null);
  }

  async createConfig(input: CreateConfigInput): Promise<ConfigItem>;
  async createConfig(tenantId: string, key: string, value?: Record<string, any>): Promise<ConfigItem>;
  async createConfig(tenantId: string, input: Record<string, any>): Promise<ConfigItem>;
  async createConfig(tenantIdOrInput: string | CreateConfigInput, keyOrInput?: string | Record<string, any>, value?: Record<string, any>): Promise<ConfigItem> {
    // Handle createConfig(input) - single object call
    if (typeof tenantIdOrInput === 'object' && keyOrInput === undefined) {
      const input = tenantIdOrInput as CreateConfigInput;
      const existing = await this.repository.findByKey('default', input.key);
      if (existing && existing.environment === input.environment) {
        throw new OrionError(`Config '${input.key}' already exists in environment '${input.environment}'`, ErrorCode.NOT_FOUND);
      }
      const entry = await this.repository.set('default', input.key, buildValueObject(input), input.createdBy);
      // Ensure createdBy is set since repository may not persist it
      if (input.createdBy && !entry.createdBy && !entry.created_by) {
        entry.createdBy = input.createdBy;
        entry.created_by = input.createdBy;
      }
      const item = entryToItem(entry);
      this.addHistoryRecord(entry.id, input.key, null, item.value, input.createdBy, 'Initial creation');
      // Invalidate list cache
      await this.cache.del('config:list:*');
      return item;
    }
    // Handle createConfig(tenantId, input)
    if (typeof keyOrInput === 'object') {
      const input = keyOrInput as CreateConfigInput;
      const entry = await this.repository.set(tenantIdOrInput as string, input.key, buildValueObject(input), input.createdBy);
      const item = entryToItem(entry);
      await this.cache.del(`config:list:${tenantIdOrInput}`);
      return item;
    }
    // Handle createConfig(tenantId, key, value)
    const entry = await this.repository.set(tenantIdOrInput as string, keyOrInput as string, value || {}, undefined);
    const item = entryToItem(entry);
    await this.cache.del(`config:list:${tenantIdOrInput}`);
    return item;
  }

  async updateConfig(configId: string, input: UpdateConfigInput): Promise<ConfigItem>;
  async updateConfig(tenantId: string, key: string, value: Record<string, any>, changedBy?: string): Promise<ConfigItem>;
  async updateConfig(tenantIdOrId: string, keyOrInput: string | UpdateConfigInput, value?: Record<string, any>, changedBy?: string): Promise<ConfigItem> {
    // Handle updateConfig(configId, input) - object-based call
    if (typeof keyOrInput === 'object') {
      const input = keyOrInput as UpdateConfigInput;
      const existing = await this.repository.findById(tenantIdOrId);
      if (!existing) {
        throw new OrionError(`Config '${tenantIdOrId}' not found`, ErrorCode.NOT_FOUND);
      }
      const rawValue = existing.value as any;
      const oldValue = rawValue?.value !== undefined ? rawValue.value : rawValue;
      const updatedValue = {
        ...rawValue,
        value: input.value,
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.tags !== undefined && { tags: input.tags }),
      };
      const entry = await this.repository.set(existing.tenant_id, existing.key, updatedValue, input.updatedBy);
      // Preserve status and updatedBy from input since repository.set may not persist them
      if (input.status) {
        (entry as any).status = input.status;
      }
      entry.updatedBy = input.updatedBy;
      entry.updated_by = input.updatedBy;
      entry.updatedAt = new Date();
      entry.updated_at = new Date();
      const item = entryToItem(entry);
      this.addHistoryRecord(entry.id, existing.key, typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue), item.value, input.updatedBy, `Updated by ${input.updatedBy}`);
      // Invalidate cache on update
      await this.cache.del(`config:${tenantIdOrId}`);
      await this.cache.del(`config:${existing.tenant_id}:${existing.key}`);
      return item;
    }
    // Handle updateConfig(tenantId, key, value, changedBy)
    const entry = await this.repository.set(tenantIdOrId, keyOrInput as string, value || {}, changedBy);
    const item = entryToItem(entry);
    // Invalidate cache on update
    await this.cache.del(`config:${tenantIdOrId}:${keyOrInput}`);
    return item;
  }

  async deleteConfig(configId: string, changedBy?: string): Promise<boolean> {
    const existing = await this.repository.findById(configId);
    if (!existing) {
      throw new OrionError(`Config '${configId}' not found`, ErrorCode.NOT_FOUND);
    }
    // Invalidate cache on delete
    await this.cache.del(`config:${configId}`);
    if (!this.isDbAvailable()) {
      // Soft delete for in-memory: set status to deprecated
      existing.status = 'deprecated';
      existing.updatedAt = new Date();
      existing.updated_by = changedBy || '';
      return true;
    }
    await this.cache.del(`config:${existing.tenant_id}:${existing.key}`);
    return this.repository.delete(existing.tenant_id, existing.key);
  }

  async getConfig(configId: string): Promise<ConfigItem | null> {
    // Try cache first
    const cached = await this.cache.get<ConfigItem>(`config:${configId}`);
    if (cached) return cached;

    const entry = await this.repository.findById(configId);
    if (!entry) return null;

    const item = entryToItem(entry);
    // Cache for 120s — config data changes occasionally
    await this.cache.set(`config:${configId}`, item, 120);
    return item;
  }

  async getConfigByKey(key: string, environment?: string): Promise<ConfigItem | null> {
    const cacheKey = `config:default:${key}${environment ? ':' + environment : ''}`;
    // Try cache first
    const cached = await this.cache.get<ConfigItem>(cacheKey);
    if (cached) return cached;

    const tenantId = 'default';
    const entry = await this.repository.findByKey(tenantId, key);
    if (!entry) return null;
    if (environment && entry.environment !== environment) return null;

    const item = entryToItem(entry);
    await this.cache.set(cacheKey, item, 120);
    return item;
  }

  async listConfigs(filter?: ListConfigsFilter): Promise<ConfigItem[]> {
    const all = await this.repository.findAll('default');
    let items = all.map(entryToItem);
    if (filter) {
      if (filter.environment) items = items.filter(c => c.environment === filter.environment);
      if (filter.status) items = items.filter(c => c.status === filter.status);
      else items = items.filter(c => c.status !== 'deprecated');
      if (filter.keyPrefix) items = items.filter(c => c.key.startsWith(filter.keyPrefix!));
      if (filter.tags && filter.tags.length > 0) items = items.filter(c => c.tags?.some(tag => filter.tags!.includes(tag)));
      if (filter.offset) items = items.slice(filter.offset);
      if (filter.limit) items = items.slice(0, filter.limit);
    } else {
      items = items.filter(c => c.status !== 'deprecated');
    }
    return items;
  }

  async getConfigVersions(tenantIdOrId: string, key?: string): Promise<ConfigHistory[]> {
    if (!key) {
      // Called with configId directly - check in-memory first
      const inMemory = this.history.get(tenantIdOrId);
      if (inMemory && inMemory.length > 0) return inMemory;
      // Fall back to repository
      if (this.repository) {
        return this.repository.getHistoryByConfigId(tenantIdOrId);
      }
      return [];
    }
    // Called with tenantId and key
    const entry = await this.repository.findByKey(tenantIdOrId, key);
    if (!entry) {
      // Check in-memory history as fallback
      for (const [configId, records] of this.history) {
        const match = records.find(r => (r as any).key === key);
        if (match) return records;
      }
      return [];
    }
    // Check in-memory first
    const inMemory = this.history.get(entry.id);
    if (inMemory && inMemory.length > 0) return inMemory;
    return this.repository.getHistory(entry.tenant_id, entry.key);
  }

  async rollbackConfig(configId: string, targetVersion: number, changedBy: string): Promise<ConfigItem> {
    const existing = await this.repository.findById(configId);
    if (!existing) {
      throw new OrionError(`Config '${configId}' not found`, ErrorCode.NOT_FOUND);
    }
    const versions = await this.getConfigVersions(configId);
    const target = versions.find(v => v.version === targetVersion);
    if (!target) {
      throw new OrionError(`Version ${targetVersion} not found for config '${configId}'`, ErrorCode.NOT_FOUND);
    }
    if (targetVersion >= existing.version) {
      throw new OrionError(`Target version ${targetVersion} must be less than current version ${existing.version}`, ErrorCode.NOT_FOUND);
    }
    const targetValue = typeof target.value === 'string' ? target.value : ((target as any).newValue?.value || (target as any).new_value?.value || JSON.stringify(target.value));
    const oldValueStr = typeof (existing.value as any)?.value === 'string' ? (existing.value as any).value : JSON.stringify(existing.value);
    const updatedValue = { ...(existing.value as any), value: targetValue };
    const entry = await this.repository.set(existing.tenant_id, existing.key, updatedValue, changedBy);
    const item = entryToItem(entry);
    this.addHistoryRecord(entry.id, existing.key, oldValueStr, targetValue, changedBy, `Rolled back to version ${targetVersion}`);
    return item;
  }

  async cloneConfig(sourceId: string, targetEnvironment: string, changedBy: string): Promise<ConfigItem> {
    const source = await this.repository.findById(sourceId);
    if (!source) {
      throw new OrionError(`Config '${sourceId}' not found`, ErrorCode.NOT_FOUND);
    }
    // Check if target already exists in the target environment
    const allConfigs = await this.repository.findAll(source.tenant_id);
    const existingInTarget = allConfigs.find(c => c.key === source.key && c.environment === targetEnvironment);
    if (existingInTarget) {
      throw new OrionError(`Config '${source.key}' already exists in environment '${targetEnvironment}'`, 'VALIDATION_ERROR')
    }
    const clonedValue = { ...(source.value as any), environment: targetEnvironment };
    const entry = await this.repository.set('default', source.key, clonedValue, changedBy);
    return entryToItem(entry);
  }

  async batchImportConfigs(inputs: CreateConfigInput[]): Promise<{ created: number; skipped: number; errors: string[] }> {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const input of inputs) {
      try {
        await this.createConfig(input);
        created++;
      } catch (e: any) {
        if (e.message?.includes('already exists')) {
          skipped++;
        } else {
          errors.push(e.message);
        }
      }
    }
    return { created, skipped, errors };
  }

  async getEnvironmentConfigs(environment: string): Promise<ConfigItem[]> {
    return this.listConfigs({ environment });
  }

  // Alias for ConfigController compatibility
  async list(tenantId: string, options?: ListConfigsFilter): Promise<ConfigItem[]> {
    return this.listConfigs(options);
  }

  async set(tenantId: string, key: string, value: Record<string, any>, changedBy?: string): Promise<ConfigItem> {
    const entry = await this.repository.set(tenantId, key, value, changedBy);
    return entryToItem(entry);
  }

  async get(tenantId: string, key: string): Promise<ConfigItem | null> {
    const cacheKey = `config:${tenantId}:${key}`;
    // Try cache first
    const cached = await this.cache.get<ConfigItem>(cacheKey);
    if (cached) return cached;

    const entry = await this.repository.findByKey(tenantId, key);
    if (!entry) return null;

    const item = entryToItem(entry);
    await this.cache.set(cacheKey, item, 120);
    return item;
  }

  async getAll(tenantId: string): Promise<ConfigItem[]> {
    const entries = await this.repository.findAll(tenantId);
    return entries.map(entryToItem);
  }

  async delete(tenantId: string, key: string): Promise<boolean> {
    // Invalidate cache on delete
    await this.cache.del(`config:${tenantId}:${key}`);
    return this.repository.delete(tenantId, key);
  }

  async getHistory(tenantId: string, key: string, limit?: number): Promise<ConfigHistory[]> {
    return this.repository.getHistory(tenantId, key, limit);
  }

  async importConfig(tenantId: string, configs: Record<string, any>, changedBy?: string): Promise<number> {
    let count = 0;
    for (const [key, value] of Object.entries(configs)) {
      await this.repository.set(tenantId, key, value as Record<string, any>, changedBy);
      count++;
    }
    return count;
  }

  async updateConfigByKey(key: string, value: Record<string, any>): Promise<ConfigItem | null> {
    const entry = await this.repository.updateByKey(key, value);
    return entry ? entryToItem(entry) : null;
  }

  async getConfigById(id: string): Promise<ConfigItem | null> {
    return this.getConfig(id);
  }

  async getConfigVersionsById(configId: string, limit?: number): Promise<ConfigHistory[]> {
    return this.getConfigVersions(configId);
  }

  // ==================== Internal Methods ====================

  private isDbAvailable(): boolean {
    // Check if repository has DB connection (for in-memory fallback)
    return (this.repository as any).isDbAvailable?.() || false;
  }

  private addHistoryRecord(configId: string, configKey: string, oldValue: string | null, newValue: string, changedBy: string | undefined, changeLog: string): void {
    if (!this.isDbAvailable()) {
      const historyList = this.history.get(configId) || [];
      const versionNum = historyList.length + 1;
      const buildRecordValue = (v: string): Record<string, any> => ({ value: v });
      historyList.push({
        id: uuidv4(),
        config_id: configId,
        configId,
        changed_by: changedBy || null,
        changedBy: changedBy,
        old_value: oldValue !== null ? buildRecordValue(oldValue) : null,
        oldValue: oldValue !== null ? buildRecordValue(oldValue) : null,
        new_value: buildRecordValue(newValue),
        newValue: buildRecordValue(newValue),
        key: configKey,
        value: newValue as unknown as Record<string, any>,
        version: versionNum,
        changeLog,
        createdBy: changedBy,
        createdAt: new Date(),
        created_at: new Date(),
      });
      this.history.set(configId, historyList);
    }
  }
}
