/**
 * ConfigSchemaService - Business logic layer for Config Schema operations
 *
 * Provides schema CRUD, validation against schemas, and helper utilities
 * for common schema patterns (string, number, boolean, array, object, enum, formats).
 */

import { ConfigSchemaRepository, ConfigSchemaEntity } from '../repositories/ConfigSchemaRepository';
import { JsonSchema, ConfigValidationService, ValidationResult } from './ConfigValidationService';
import { OrionError, ErrorCode } from '../../errors';
import { CacheService } from './cache/CacheService';
import { CreateConfigSchemaInput, UpdateConfigSchemaInput, ListConfigSchemasFilter, ConfigSchema } from './types';

const SCHEMA_CACHE_TTL = 300; // 5 minutes

export class ConfigSchemaServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'ConfigSchemaServiceError'; }
}

export class ConfigSchemaService {
  private repository: ConfigSchemaRepository;
  private cache: CacheService;
  private validationService: ConfigValidationService;

  constructor(repository: ConfigSchemaRepository, cache?: CacheService) {
    this.repository = repository;
    this.cache = cache || new CacheService(null);
    this.validationService = new ConfigValidationService();
  }

  /**
   * Create a new config schema.
   */
  async createSchema(tenantId: string, input: CreateConfigSchemaInput): Promise<ConfigSchema> {
    // Validate the schema itself is valid JSON Schema
    this.validationService.validateSchemaSyntax(input.schema);

    const entity = await this.repository.create(tenantId, {
      name: input.name,
      description: input.description,
      schema: input.schema,
      configKey: input.configKey,
      createdBy: input.createdBy,
    });

    // Cache the schema for validation lookups
    await this.cacheSchema(tenantId, entity);

    return this.entityToSchema(entity);
  }

  /**
   * Get schema by ID.
   */
  async getSchema(tenantId: string, schemaId: string): Promise<ConfigSchema | null> {
    // Try cache first
    const cacheKey = `config:schema:${tenantId}:${schemaId}`;
    const cached = await this.cache.get<ConfigSchema>(cacheKey);
    if (cached) return cached;

    const entity = await this.repository.findById(schemaId, tenantId);
    if (!entity) return null;

    const schema = this.entityToSchema(entity);
    await this.cache.set(cacheKey, schema, SCHEMA_CACHE_TTL);
    return schema;
  }

  /**
   * Get schema by name.
   */
  async getSchemaByName(tenantId: string, name: string): Promise<ConfigSchema | null> {
    const entity = await this.repository.findByName(tenantId, name);
    if (!entity) return null;
    return this.entityToSchema(entity);
  }

  /**
   * Get schema by config key.
   */
  async getSchemaByConfigKey(tenantId: string, configKey: string): Promise<ConfigSchema | null> {
    const entity = await this.repository.findByTenantId(tenantId, { configKey, isActive: true, limit: 1 });
    if (entity.length === 0) return null;
    return this.entityToSchema(entity[0]);
  }

  /**
   * Update an existing schema.
   */
  async updateSchema(tenantId: string, schemaId: string, updates: UpdateConfigSchemaInput): Promise<ConfigSchema> {
    // Validate new schema syntax if provided
    if (updates.schema) {
      this.validationService.validateSchemaSyntax(updates.schema);
    }

    const entity = await this.repository.update(schemaId, tenantId, {
      name: updates.name,
      description: updates.description,
      schema: updates.schema,
      configKey: updates.configKey,
      isActive: updates.isActive,
      updatedBy: updates.updatedBy,
    });

    // Invalidate cache
    await this.invalidateSchemaCache(tenantId, schemaId);

    return this.entityToSchema(entity);
  }

  /**
   * List schemas for a tenant with optional filtering.
   */
  async listSchemas(tenantId: string, filter?: ListConfigSchemasFilter): Promise<{ data: ConfigSchema[]; total: number }> {
    const entities = await this.repository.findByTenantId(tenantId, filter);
    const total = await this.repository.countByTenantId(tenantId, filter);
    return {
      data: entities.map(e => this.entityToSchema(e)),
      total,
    };
  }

  /**
   * Deactivate (soft-delete) a schema.
   */
  async deactivateSchema(tenantId: string, schemaId: string, updatedBy: string): Promise<ConfigSchema> {
    const entity = await this.repository.deactivate(schemaId, tenantId, updatedBy);
    await this.invalidateSchemaCache(tenantId, schemaId);
    return this.entityToSchema(entity);
  }

  /**
   * Delete a schema permanently.
   */
  async deleteSchema(tenantId: string, schemaId: string): Promise<boolean> {
    const deleted = await this.repository.delete(schemaId, tenantId);
    if (deleted) {
      await this.invalidateSchemaCache(tenantId, schemaId);
    }
    return deleted;
  }

  /**
   * Validate a config value against a schema by schema ID.
   */
  async validateConfigBySchemaId(tenantId: string, schemaId: string, value: unknown): Promise<ValidationResult> {
    const schema = await this.getSchema(tenantId, schemaId);
    if (!schema) {
      return { valid: false, errors: [`Schema '${schemaId}' not found`] };
    }
    return this.validationService.validateJson(schema.schema, value);
  }

  /**
   * Validate a config value against a schema by config key.
   */
  async validateConfigByConfigKey(tenantId: string, configKey: string, value: unknown): Promise<ValidationResult> {
    const schema = await this.getSchemaByConfigKey(tenantId, configKey);
    if (!schema) {
      return { valid: true }; // No schema registered - treat as valid
    }
    return this.validationService.validateJson(schema.schema, value);
  }

  /**
   * Validate a config value against a raw JSON Schema.
   */
  validateConfig(schema: JsonSchema, value: unknown): ValidationResult {
    return this.validationService.validateJson(schema, value);
  }

  /**
   * Helper: Create a string schema.
   */
  static createStringSchema(options: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: string[];
    format?: 'email' | 'url' | 'uuid' | 'date-time' | 'date' | 'time';
    description?: string;
  } = {}): JsonSchema {
    const schema: JsonSchema = { type: 'string' };
    if (options.minLength !== undefined) schema.minLength = options.minLength;
    if (options.maxLength !== undefined) schema.maxLength = options.maxLength;
    if (options.pattern) schema.pattern = options.pattern;
    if (options.enum) schema.enum = options.enum;
    if (options.format) schema.format = options.format;
    if (options.description) schema.description = options.description;
    return schema;
  }

  /**
   * Helper: Create a number schema.
   */
  static createNumberSchema(options: {
    minimum?: number;
    maximum?: number;
    enum?: number[];
    description?: string;
  } = {}): JsonSchema {
    const schema: JsonSchema = { type: 'number' };
    if (options.minimum !== undefined) schema.minimum = options.minimum;
    if (options.maximum !== undefined) schema.maximum = options.maximum;
    if (options.enum) schema.enum = options.enum;
    if (options.description) schema.description = options.description;
    return schema;
  }

  /**
   * Helper: Create an integer schema.
   */
  static createIntegerSchema(options: {
    minimum?: number;
    maximum?: number;
    enum?: number[];
    description?: string;
  } = {}): JsonSchema {
    const schema: JsonSchema = { type: 'integer' };
    if (options.minimum !== undefined) schema.minimum = options.minimum;
    if (options.maximum !== undefined) schema.maximum = options.maximum;
    if (options.enum) schema.enum = options.enum;
    if (options.description) schema.description = options.description;
    return schema;
  }

  /**
   * Helper: Create a boolean schema.
   */
  static createBooleanSchema(description?: string): JsonSchema {
    const schema: JsonSchema = { type: 'boolean' };
    if (description) schema.description = description;
    return schema;
  }

  /**
   * Helper: Create an array schema.
   */
  static createArraySchema(options: {
    items?: JsonSchema;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    description?: string;
  } = {}): JsonSchema {
    const schema: JsonSchema = { type: 'array' };
    if (options.items) schema.items = options.items;
    if (options.minItems !== undefined) schema.minItems = options.minItems;
    if (options.maxItems !== undefined) schema.maxItems = options.maxItems;
    if (options.uniqueItems !== undefined) schema.uniqueItems = options.uniqueItems;
    if (options.description) schema.description = options.description;
    return schema;
  }

  /**
   * Helper: Create an object schema with required fields.
   */
  static createObjectSchema(options: {
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean | JsonSchema;
    description?: string;
  } = {}): JsonSchema {
    const schema: JsonSchema = { type: 'object', properties: {} };
    if (options.properties) schema.properties = options.properties;
    if (options.required) schema.required = options.required;
    if (options.additionalProperties !== undefined) schema.additionalProperties = options.additionalProperties;
    if (options.description) schema.description = options.description;
    return schema;
  }

  /**
   * Helper: Create an enum schema.
   */
  static createEnumSchema<T extends (string | number | boolean | null)[]>(
    values: T,
    description?: string
  ): JsonSchema {
    return {
      type: typeof values[0] === 'number' ? 'number' : typeof values[0] === 'boolean' ? 'boolean' : 'string',
      enum: values,
      ...(description && { description }),
    };
  }

  /**
   * Helper: Create a common config value schema (string, number, boolean, or object).
   */
  static createCommonConfigSchema(valueType: 'string' | 'number' | 'boolean' | 'object', options?: {
    required?: boolean;
    description?: string;
  }): JsonSchema {
    const schema: JsonSchema = { type: valueType };
    if (options?.description) schema.description = options.description;
    if (options?.required) schema['x-required'] = true;
    return schema;
  }

  /**
   * Cache a schema entity.
   */
  private async cacheSchema(tenantId: string, entity: ConfigSchemaEntity): Promise<void> {
    const cacheKey = `config:schema:${tenantId}:${entity.id}`;
    const schema = this.entityToSchema(entity);
    await this.cache.set(cacheKey, schema, SCHEMA_CACHE_TTL);

    // Also cache by config key if present
    if (entity.config_key) {
      const keyCache = `config:schema:${tenantId}:key:${entity.config_key}`;
      await this.cache.set(keyCache, schema, SCHEMA_CACHE_TTL);
    }
  }

  /**
   * Invalidate schema cache.
   */
  private async invalidateSchemaCache(tenantId: string, schemaId: string): Promise<void> {
    await this.cache.del(`config:schema:${tenantId}:${schemaId}`);
    // Pattern delete for config key caches
    const pattern = `config:schema:${tenantId}:key:*`;
    await this.cache.delPattern(pattern);
  }

  /**
   * Convert entity to public schema type.
   */
  private entityToSchema(entity: ConfigSchemaEntity): ConfigSchema {
    return {
      id: entity.id,
      tenant_id: entity.tenant_id,
      name: entity.name,
      description: entity.description,
      schema: entity.schema,
      config_key: entity.config_key,
      version: entity.version,
      is_active: entity.is_active,
      created_by: entity.created_by,
      updated_by: entity.updated_by,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
