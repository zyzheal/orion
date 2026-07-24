/**
 * ConfigService - Business logic layer for Configuration operations
 */

import { ConfigRepository, ConfigEntry, ConfigHistory } from './ConfigRepository';
import { ConfigItem, ConfigStatus, ConfigEnvironment, CreateConfigSchemaInput, ConfigSchema, UpdateConfigSchemaInput, ListConfigSchemasFilter, ConfigTemplate, ConfigTemplateVersion, CanaryDeployment, CanaryDeploymentHistory, ConfigDependency, CreateConfigTemplateInput, UpdateConfigTemplateInput, DependencyType } from './types';
import { CacheService } from '../cache/CacheService';
import { OrionError, ErrorCode } from '../../errors';
import { WebhookService } from '../webhook/WebhookService';
import { ConfigValidationService, JsonSchema, ConfigValidationError, ValidationResult } from './ConfigValidationService';
import { ConfigSchemaService } from './ConfigSchemaService';
import { ConfigSchemaRepository } from '../../repositories/ConfigSchemaRepository';
import { ConfigTemplateRepository } from '../../repositories/ConfigTemplateRepository';
import { CanaryDeploymentRepository } from '../../repositories/CanaryDeploymentRepository';
import { ConfigDependencyRepository } from '../../repositories/ConfigDependencyRepository';
import { createLogger } from '../../utils/logger';

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
  schema?: JsonSchema;
}

export interface UpdateConfigInput {
  value: string;
  description?: string;
  status?: ConfigStatus;
  tags?: string[];
  updatedBy: string;
  schema?: JsonSchema;
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
  private cache: CacheService;
  private webhookService: WebhookService | null;
  private validationService: ConfigValidationService;
  private schemaService: ConfigSchemaService;

  constructor(repository: ConfigRepository, cache?: CacheService, webhookService?: WebhookService, schemaRepository?: ConfigSchemaRepository) {
    if (!repository) throw new OrionError('ConfigRepository is required', ErrorCode.INTERNAL_ERROR);
    this.repository = repository;
    this.cache = cache || new CacheService(null);
    this.webhookService = webhookService || null;
    this.validationService = new ConfigValidationService();
    this.schemaService = new ConfigSchemaService(schemaRepository || new ConfigSchemaRepository({ query: async () => ({ rows: [], rowCount: 0 }) } as any), this.cache);
  }

  private async emitEvent(tenantId: string, event: string, payload: Record<string, any>): Promise<void> {
    if (!this.webhookService) return;
    try {
      await this.webhookService.triggerEvent(tenantId, event, payload);
    } catch (e) {
      // Do not block config operations on webhook delivery failures
    }
  }

  private validateValue(key: string, value: unknown): void {
    const result = this.validationService.validateConfig(key, value);
    if (!result.valid) {
      throw new ConfigValidationError(
        `Config validation failed for key '${key}'`,
        key,
        result.errors ?? ['Validation failed']
      );
    }
  }

  async registerSchema(key: string, schema: JsonSchema): Promise<void> {
    this.validationService.setSchema(key, schema);
  }

  async createConfig(input: CreateConfigInput): Promise<ConfigItem>;
  async createConfig(tenantId: string, key: string, value?: Record<string, any>): Promise<ConfigItem>;
  async createConfig(tenantId: string, input: Record<string, any>): Promise<ConfigItem>;
  async createConfig(tenantIdOrInput: string | CreateConfigInput, keyOrInput?: string | Record<string, any>, value?: Record<string, any>): Promise<ConfigItem> {
    // Handle createConfig(input) - single object call
    if (typeof tenantIdOrInput === 'object' && keyOrInput === undefined) {
      const input = tenantIdOrInput as CreateConfigInput;
      // Validate value before persisting
      this.validateValue(input.key, input.value);
      // Register schema if provided
      if (input.schema) {
        this.validationService.setSchema(input.key, input.schema);
      }
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
      // Invalidate list cache
      await this.cache.del('config:list:*');
      await this.emitEvent('default', 'config.created', { configId: item.id, key: item.key, environment: item.environment, createdBy: input.createdBy });
      return item;
    }
    // Handle createConfig(tenantId, input)
    if (typeof keyOrInput === 'object') {
      const input = keyOrInput as CreateConfigInput;
      this.validateValue(input.key, input.value);
      if (input.schema) {
        this.validationService.setSchema(input.key, input.schema);
      }
      const entry = await this.repository.set(tenantIdOrInput as string, input.key, buildValueObject(input), input.createdBy);
      const item = entryToItem(entry);
      await this.cache.del(`config:list:${tenantIdOrInput}`);
      await this.emitEvent(tenantIdOrInput as string, 'config.created', { configId: item.id, key: item.key, environment: item.environment, createdBy: input.createdBy });
      return item;
    }
    // Handle createConfig(tenantId, key, value)
    this.validateValue(keyOrInput as string, value);
    const entry = await this.repository.set(tenantIdOrInput as string, keyOrInput as string, value || {}, undefined);
    const item = entryToItem(entry);
    await this.cache.del(`config:list:${tenantIdOrInput}`);
    await this.emitEvent(tenantIdOrInput as string, 'config.created', { configId: item.id, key: item.key, environment: item.environment || 'dev', createdBy: undefined });
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
      this.validateValue(existing.key, input.value);
      if (input.schema) {
        this.validationService.setSchema(existing.key, input.schema);
      }
      const rawValue = existing.value as any;
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
      // Invalidate cache on update
      await this.cache.del(`config:${tenantIdOrId}`);
      await this.cache.del(`config:${existing.tenant_id}:${existing.key}`);
      await this.emitEvent(existing.tenant_id, 'config.updated', { configId: item.id, key: item.key, environment: item.environment, updatedBy: input.updatedBy });
      return item;
    }
    // Handle updateConfig(tenantId, key, value, changedBy)
    this.validateValue(keyOrInput as string, value);
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
    // Validate on read if schema exists
    try {
      this.validateValue(item.key, item.value);
    } catch (e) {
      // Log but do not block reads for legacy data that may not conform
    }
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
    try {
      this.validateValue(item.key, item.value);
    } catch (e) {
      // Log but do not block reads for legacy data
    }
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
      // Called with configId directly — delegate to repository
      return this.repository.getHistoryByConfigId(tenantIdOrId);
    }
    // Called with tenantId and key
    const entry = await this.repository.findByKey(tenantIdOrId, key);
    if (!entry) {
      return [];
    }
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
    this.validateValue(existing.key, targetValue);
    const updatedValue = { ...(existing.value as any), value: targetValue };
    const entry = await this.repository.set(existing.tenant_id, existing.key, updatedValue, changedBy);
    const item = entryToItem(entry);
    return item;
  }

  async cloneConfig(sourceId: string, targetEnvironment: string, changedBy: string): Promise<ConfigItem> {
    const source = await this.repository.findById(sourceId);
    if (!source) {
      throw new OrionError(`Config '${sourceId}' not found`, ErrorCode.NOT_FOUND);
    }
    this.validateValue(source.key, source.value);
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
    this.validateValue(key, value);
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
    try {
      this.validateValue(item.key, item.value);
    } catch (e) {
      // Log but do not block reads for legacy data
    }
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
      this.validateValue(key, value);
      await this.repository.set(tenantId, key, value as Record<string, any>, changedBy);
      count++;
    }
    return count;
  }

  async updateConfigByKey(key: string, value: Record<string, any>): Promise<ConfigItem | null> {
    this.validateValue(key, value);
    const entry = await this.repository.updateByKey(key, value);
    return entry ? entryToItem(entry) : null;
  }

  async getConfigById(id: string): Promise<ConfigItem | null> {
    return this.getConfig(id);
  }

  async getConfigVersionsById(configId: string, limit?: number): Promise<ConfigHistory[]> {
    return this.getConfigVersions(configId);
  }

  // ==================== Schema Management ====================

  async createSchema(tenantId: string, input: CreateConfigSchemaInput): Promise<ConfigSchema> {
    return this.schemaService.createSchema(tenantId, input);
  }

  async getSchema(tenantId: string, schemaId: string): Promise<ConfigSchema | null> {
    return this.schemaService.getSchema(tenantId, schemaId);
  }

  async getSchemaByName(tenantId: string, name: string): Promise<ConfigSchema | null> {
    return this.schemaService.getSchemaByName(tenantId, name);
  }

  async updateSchema(tenantId: string, schemaId: string, updates: UpdateConfigSchemaInput): Promise<ConfigSchema> {
    return this.schemaService.updateSchema(tenantId, schemaId, updates);
  }

  async listSchemas(tenantId: string, filter?: ListConfigSchemasFilter): Promise<{ data: ConfigSchema[]; total: number }> {
    return this.schemaService.listSchemas(tenantId, filter);
  }

  async deactivateSchema(tenantId: string, schemaId: string, updatedBy: string): Promise<ConfigSchema> {
    return this.schemaService.deactivateSchema(tenantId, schemaId, updatedBy);
  }

  async deleteSchema(tenantId: string, schemaId: string): Promise<boolean> {
    return this.schemaService.deleteSchema(tenantId, schemaId);
  }

  async validateConfigBySchema(tenantId: string, schemaId: string, value: unknown): Promise<ValidationResult> {
    return this.schemaService.validateConfigBySchemaId(tenantId, schemaId, value);
  }

  async validateConfigByConfigKey(tenantId: string, configKey: string, value: unknown): Promise<ValidationResult> {
    return this.schemaService.validateConfigByConfigKey(tenantId, configKey, value);
  }

  /**
   * 验证 config 值是否合法。
   * 优先使用已注册的 JSON Schema；若无 schema，则做基础类型推断校验。
   */
  async validateConfig(tenantId: string, configKey: string, value: unknown): Promise<ValidationResult> {
    // 1. 先查 internal validationService 是否有显式注册的 schema
    const internalResult = this.validationService.validateConfig(configKey, value);
    if (!internalResult.valid) {
      return internalResult;
    }
    if (this.validationService.getSchema(configKey)) {
      return { valid: true };
    }

    // 2. 尝试通过 schemaService（按 configKey 关联的 schema）
    const schemaResult = await this.schemaService.validateConfigByConfigKey(tenantId, configKey, value);
    if (!schemaResult.valid) {
      return schemaResult;
    }
    // schemaService 有 schema 且验证通过
    return { valid: true };
  }

  // ==================== Template Methods ====================

  private templateRepo: ConfigTemplateRepository | null = null;

  private getTemplateRepo(db?: any): ConfigTemplateRepository {
    if (!this.templateRepo) {
      this.templateRepo = new ConfigTemplateRepository(db || (this.repository as any).getDb());
    }
    return this.templateRepo;
  }

  async createTemplate(tenantId: string, input: CreateConfigTemplateInput): Promise<ConfigTemplate> {
    const repo = this.getTemplateRepo();
    const entity = await repo.create({ ...input, createdBy: input.createdBy, tenantId } as any);
    return this.mapTemplateEntityToModel(entity);
  }

  async updateTemplate(tenantId: string, templateId: string, input: UpdateConfigTemplateInput & { updatedBy: string }): Promise<ConfigTemplate> {
    const repo = this.getTemplateRepo();
    const entity = await repo.update(templateId, { ...input, updatedBy: input.updatedBy } as any);
    return this.mapTemplateEntityToModel(entity);
  }

  async deleteTemplate(tenantId: string, templateId: string): Promise<boolean> {
    const repo = this.getTemplateRepo();
    return repo.delete(templateId);
  }

  async listTemplates(tenantId: string, category?: string): Promise<ConfigTemplate[]> {
    const repo = this.getTemplateRepo();
    const entities = await repo.findByTenant(tenantId, category);
    return entities.map(e => this.mapTemplateEntityToModel(e));
  }

  async getTemplate(tenantId: string, templateId: string): Promise<ConfigTemplate | null> {
    const repo = this.getTemplateRepo();
    const entity = await repo.findById(templateId);
    return entity ? this.mapTemplateEntityToModel(entity) : null;
  }

  async listTemplateVersions(tenantId: string, templateId: string): Promise<ConfigTemplateVersion[]> {
    const repo = this.getTemplateRepo();
    const entities = await repo.listVersions(templateId, tenantId);
    return entities.map(e => this.mapTemplateVersionEntityToModel(e));
  }

  async applyTemplate(tenantId: string, templateId: string, targetEnv: string): Promise<{ applied: number; skipped: string[] }> {
    const repo = this.getTemplateRepo();
    const template = await repo.findById(templateId);
    if (!template) {
      throw new OrionError(`Template ${templateId} not found`, ErrorCode.NOT_FOUND);
    }

    const configData = (template as any).config_data as Record<string, any>;
    const keys = Object.keys(configData);
    let applied = 0;
    const skipped: string[] = [];

    for (const key of keys) {
      try {
        const entry = await this.repository.set(tenantId, key, { value: configData[key], environment: targetEnv }, 'template-apply');
        if (entry) applied++;
      } catch (e: any) {
        skipped.push(key);
      }
    }

    return { applied, skipped };
  }

  async createTemplateVersion(tenantId: string, templateId: string, changes: Record<string, any>, changedBy: string): Promise<ConfigTemplateVersion> {
    const repo = this.getTemplateRepo();
    const entity = await repo.createVersion(tenantId, {
      templateId,
      configData: changes,
      createdBy: changedBy,
    });
    return this.mapTemplateVersionEntityToModel(entity);
  }

  // ==================== Canary Methods ====================

  private canaryRepo: CanaryDeploymentRepository | null = null;

  private getCanaryRepo(db?: any): CanaryDeploymentRepository {
    if (!this.canaryRepo) {
      this.canaryRepo = new CanaryDeploymentRepository(db || (this.repository as any).getDb());
    }
    return this.canaryRepo;
  }

  async createCanaryDeployment(tenantId: string, configId: string, percentage: number, canaryValue: Record<string, any>, targetValue: Record<string, any>, configKey?: string): Promise<CanaryDeployment> {
    const repo = this.getCanaryRepo();
    const entity = await repo.create({
      tenantId,
      configId,
      configKey: configKey || 'unknown',
      environment: 'dev',
      percentage,
      canaryValue,
      targetValue,
      createdBy: tenantId,
    });
    return this.mapCanaryEntityToModel(entity);
  }

  async updateCanaryPercentage(tenantId: string, deploymentId: string, percentage: number): Promise<CanaryDeployment> {
    const repo = this.getCanaryRepo();
    const entity = await repo.updatePercentage(tenantId, deploymentId, percentage, 'system');
    return this.mapCanaryEntityToModel(entity);
  }

  async promoteCanary(tenantId: string, deploymentId: string): Promise<CanaryDeployment> {
    const repo = this.getCanaryRepo();
    const entity = await repo.promote(tenantId, deploymentId, 'system');
    return this.mapCanaryEntityToModel(entity);
  }

  async rollbackCanary(tenantId: string, deploymentId: string): Promise<CanaryDeployment> {
    const repo = this.getCanaryRepo();
    const entity = await repo.rollback(tenantId, deploymentId, 'system');
    return this.mapCanaryEntityToModel(entity);
  }

  async getCanaryHistory(tenantId: string, deploymentId: string): Promise<CanaryDeploymentHistory[]> {
    const repo = this.getCanaryRepo();
    const entities = await repo.getHistory(deploymentId, tenantId);
    return entities.map(e => this.mapCanaryHistoryEntityToModel(e));
  }

  // ==================== Dependency Methods ====================

  private dependencyRepo: ConfigDependencyRepository | null = null;

  private getDependencyRepo(db?: any): ConfigDependencyRepository {
    if (!this.dependencyRepo) {
      this.dependencyRepo = new ConfigDependencyRepository(db || (this.repository as any).getDb());
    }
    return this.dependencyRepo;
  }

  async addDependency(tenantId: string, configId: string, dependsOnConfigId: string, type: DependencyType = 'hard', description?: string): Promise<ConfigDependency> {
    const repo = this.getDependencyRepo();
    const entity = await repo.createDependency(tenantId, {
      configId,
      dependsOnConfigId,
      dependencyType: type,
      description,
      createdBy: tenantId,
    });
    return this.mapDependencyEntityToModel(entity);
  }

  async getDependencyGraph(tenantId: string, configId: string): Promise<{ node: ConfigDependency; dependencies: ConfigDependency[] }> {
    const repo = this.getDependencyRepo();
    const dependencies = await repo.findByConfigId(configId, tenantId);
    const node: ConfigDependency = {
      id: configId,
      tenant_id: tenantId,
      configId,
      dependsOnConfigId: '',
      dependencyType: 'hard',
      isActive: true,
      createdBy: tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return { node, dependencies: dependencies.map(d => this.mapDependencyEntityToModel(d)) };
  }

  async validateDependencies(tenantId: string, configId: string): Promise<{ valid: boolean; unsatisfied: string[] }> {
    const repo = this.getDependencyRepo();
    return repo.validate(tenantId, configId);
  }

  async removeDependency(tenantId: string, configId: string, dependsOnConfigId: string): Promise<boolean> {
    const repo = this.getDependencyRepo();
    return repo.deleteDependency(configId, dependsOnConfigId, tenantId);
  }

  // ==================== Mappers ====================

  private mapTemplateEntityToModel(entity: any): ConfigTemplate {
    return {
      id: entity.id,
      tenant_id: entity.tenant_id,
      name: entity.name,
      description: entity.description,
      category: entity.category,
      configData: typeof entity.config_data === 'string' ? JSON.parse(entity.config_data) : (entity.config_data ?? {}),
      targetEnvironment: entity.target_environment,
      isActive: entity.is_active,
      createdBy: entity.created_by,
      updatedBy: entity.updated_by,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  private mapTemplateVersionEntityToModel(entity: any): ConfigTemplateVersion {
    return {
      id: entity.id,
      templateId: entity.template_id,
      tenant_id: entity.tenant_id,
      configData: typeof entity.config_data === 'string' ? JSON.parse(entity.config_data) : (entity.config_data ?? {}),
      version: entity.version,
      changeLog: entity.change_log,
      createdBy: entity.created_by,
      createdAt: entity.created_at,
    };
  }

  private mapCanaryEntityToModel(entity: any): CanaryDeployment {
    return {
      id: entity.id,
      tenant_id: entity.tenant_id,
      configId: entity.config_id,
      configKey: entity.config_key,
      environment: entity.environment,
      percentage: entity.percentage,
      status: entity.status,
      oldValue: typeof entity.old_value === 'string' ? JSON.parse(entity.old_value) : entity.old_value,
      canaryValue: typeof entity.canary_value === 'string' ? JSON.parse(entity.canary_value) : (entity.canary_value ?? {}),
      targetValue: typeof entity.target_value === 'string' ? JSON.parse(entity.target_value) : (entity.target_value ?? {}),
      promotedAt: entity.promoted_at,
      rolledBackAt: entity.rolled_back_at,
      createdBy: entity.created_by,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  private mapCanaryHistoryEntityToModel(entity: any): CanaryDeploymentHistory {
    return {
      id: entity.id,
      deploymentId: entity.deployment_id,
      tenant_id: entity.tenant_id,
      oldPercentage: entity.old_percentage,
      newPercentage: entity.new_percentage,
      action: entity.action,
      performedBy: entity.performed_by,
      createdAt: entity.created_at,
    };
  }

  private mapDependencyEntityToModel(entity: any): ConfigDependency {
    return {
      id: entity.id,
      tenant_id: entity.tenant_id,
      configId: entity.configId,
      dependsOnConfigId: entity.dependsOnConfigId,
      dependencyType: entity.dependencyType,
      description: entity.description,
      isActive: entity.isActive,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
