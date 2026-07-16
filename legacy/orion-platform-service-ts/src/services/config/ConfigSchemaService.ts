/**
 * ConfigSchemaService - Schema registry and validation orchestration
 *
 * Features:
 * 1. Register and retrieve JSON Schemas for config types
 * 2. Validate config data against registered schemas
 * 3. Built-in schemas for common config types
 * 4. Cross-field and tenant-specific validation rules
 *
 * Prefix: /api/v1/config
 */

import { ConfigValidationService, JsonSchema, ValidationResult, BusinessRuleValidator } from './ConfigValidationService';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('ConfigSchemaService');

// ==================== Types ====================

export interface ConfigSchemaInfo {
  configType: string;
  schema: JsonSchema;
  description?: string;
  builtIn: boolean;
  registeredAt: Date;
}

export interface ListSchemasResult {
  data: ConfigSchemaInfo[];
  total: number;
}

// ==================== Business Rule Validators ====================

/**
 * Built-in business rule: cross-field validation for deploy config
 */
function deployCrossFieldRule(context: { configType: string; data: unknown }): ValidationResult {
  const data = context.data as Record<string, any>;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.resources?.cpu && data.resources?.memory) {
    const cpuStr = String(data.resources.cpu);
    const memStr = String(data.resources.memory);

    if (cpuStr.endsWith('m') && memStr.endsWith('Gi')) {
      const cpuValue = parseInt(cpuStr);
      const memValue = parseInt(memStr);
      if (cpuValue > 4000 && memValue < 2) {
        warnings.push('High CPU with low memory may cause OOMKilled');
      }
    }
  }

  return { valid: true, errors, warnings };
}

/**
 * Built-in business rule: pipeline stage name uniqueness
 */
function pipelineStageRule(context: { configType: string; data: unknown }): ValidationResult {
  const data = context.data as Record<string, any>;
  const errors: string[] = [];

  if (Array.isArray(data?.stages)) {
    const stageNames = new Set<string>();
    for (const stage of data.stages) {
      if (stageNames.has(stage.name)) {
        errors.push(`Duplicate stage name: '${stage.name}'`);
      }
      stageNames.add(stage.name);
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Built-in business rule: notification channel consistency
 */
function notificationChannelRule(context: { configType: string; data: unknown }): ValidationResult {
  const data = context.data as Record<string, any>;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (Array.isArray(data?.channels)) {
    const enabledChannels = data.channels.filter((ch: any) => ch.enabled !== false);
    if (enabledChannels.length === 0) {
      warnings.push('No notification channels are enabled');
    }

    const webhookChannels = enabledChannels.filter((ch: any) => ch.type === 'webhook');
    for (const ch of webhookChannels) {
      if (!ch.config?.url) {
        errors.push('Webhook channel requires a URL in config');
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Built-in business rule: feature flag rollout sanity
 */
function featureFlagRolloutRule(context: { configType: string; data: unknown }): ValidationResult {
  const data = context.data as Record<string, any>;
  const warnings: string[] = [];

  if (data?.rollout?.percentage !== undefined) {
    const pct = data.rollout.percentage;
    if (pct > 0 && pct < 10) {
      warnings.push(`Rollout percentage (${pct}%) is very low, may not generate meaningful metrics`);
    }
    if (pct === 100 && data.enabled === false) {
      warnings.push('Rollout is 100% but flag is disabled');
    }
  }

  return { valid: true, errors: [], warnings };
}

// ==================== ConfigSchemaService ====================

export class ConfigSchemaService {
  private validationService: ConfigValidationService;
  private schemas: Map<string, ConfigSchemaInfo> = new Map();

  constructor() {
    this.validationService = new ConfigValidationService();
    this.registerBuiltInSchemas();
    this.registerBuiltInBusinessRules();
  }

  // ==================== Schema Registration ====================

  /**
   * Register a JSON Schema for a config type.
   */
  registerSchema(configType: string, schema: JsonSchema, description?: string): void {
    this.validationService.registerSchema(configType, schema);

    this.schemas.set(configType, {
      configType,
      schema,
      description,
      builtIn: false,
      registeredAt: new Date(),
    });

    logger.debug({ configType }, 'Schema registered in ConfigSchemaService');
  }

  /**
   * Get the registered schema for a config type.
   */
  getSchema(configType: string): ConfigSchemaInfo | undefined {
    return this.schemas.get(configType);
  }

  /**
   * List all registered schemas.
   */
  listSchemas(): ListSchemasResult {
    const data = Array.from(this.schemas.values()).map(info => ({
      ...info,
      registeredAt: info.registeredAt,
    }));
    return { data, total: data.length };
  }

  // ==================== Validation ====================

  /**
   * Validate config data against its schema.
   */
  validateConfig(configType: string, data: unknown): ValidationResult {
    return this.validationService.validateConfig(configType, data);
  }

  /**
   * Full validation before saving config.
   */
  validateBeforeSave(configType: string, data: unknown, context?: { tenantId?: string; configId?: string }): ValidationResult {
    return this.validationService.validateBeforeSave(configType, data, context);
  }

  /**
   * Validation before config deployment.
   */
  validateBeforeDeploy(configId: string, data: unknown, context?: { configType?: string; tenantId?: string }): ValidationResult {
    return this.validationService.validateBeforeDeploy(configId, data, context);
  }

  // ==================== Built-in Schemas ====================

  /**
   * Register built-in schemas for common config types.
   */
  private registerBuiltInSchemas(): void {
    const builtIns: Array<{ type: string; schema: JsonSchema; description: string }> = [
      {
        type: 'deploy',
        description: 'Deployment configuration schema',
        schema: {
          type: 'object',
          required: ['image', 'replicas', 'environment'],
          properties: {
            image: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._\\-/:]+$', description: 'Container image URL' },
            replicas: { type: 'integer', minimum: 1, maximum: 100, description: 'Number of replicas' },
            environment: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', enum: ['dev', 'staging', 'prod'] },
                variables: { type: 'object', additionalProperties: { type: 'string' } },
              },
            },
            resources: {
              type: 'object',
              properties: {
                cpu: { type: 'string', pattern: '^[0-9]+m?$' },
                memory: { type: 'string', pattern: '^[0-9]+(Mi|Gi)?$' },
              },
            },
            healthCheck: {
              type: 'object',
              properties: {
                path: { type: 'string', pattern: '^/.*' },
                port: { type: 'integer', minimum: 1, maximum: 65535 },
                initialDelaySeconds: { type: 'integer', minimum: 0 },
                periodSeconds: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
      {
        type: 'pipeline',
        description: 'Pipeline configuration schema',
        schema: {
          type: 'object',
          required: ['name', 'stages'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[a-zA-Z0-9_-]+$' },
            description: { type: 'string', maxLength: 1024 },
            stages: {
              type: 'array',
              minItems: 1,
              maxItems: 20,
              items: {
                type: 'object',
                required: ['name', 'tasks'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 128 },
                  tasks: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'object',
                      required: ['name', 'image'],
                      properties: {
                        name: { type: 'string', minLength: 1, maxLength: 128 },
                        image: { type: 'string' },
                        script: { type: 'string' },
                        env: { type: 'object', additionalProperties: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
            triggers: {
              type: 'object',
              properties: {
                cron: { type: 'string' },
                webhook: { type: 'boolean' },
              },
            },
          },
        },
      },
      {
        type: 'notification',
        description: 'Notification configuration schema',
        schema: {
          type: 'object',
          required: ['channels', 'recipients'],
          properties: {
            channels: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['type'],
                properties: {
                  type: { type: 'string', enum: ['email', 'sms', 'webhook', 'slack', 'teams'] },
                  config: { type: 'object' },
                  enabled: { type: 'boolean', default: true },
                },
              },
            },
            recipients: {
              type: 'array',
              items: {
                type: 'object',
                required: ['userId'],
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  channels: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            rateLimit: {
              type: 'object',
              properties: {
                maxPerHour: { type: 'integer', minimum: 1 },
                maxPerDay: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
      {
        type: 'feature-flag',
        description: 'Feature flag configuration schema',
        schema: {
          type: 'object',
          required: ['key', 'enabled'],
          properties: {
            key: { type: 'string', pattern: '^[a-z][a-z0-9_]*$', minLength: 1, maxLength: 128 },
            enabled: { type: 'boolean' },
            description: { type: 'string', maxLength: 1024 },
            variants: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                required: ['weight'],
                properties: {
                  weight: { type: 'number', minimum: 0, maximum: 1 },
                  payload: { type: 'object' },
                },
              },
            },
            rules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  attribute: { type: 'string' },
                  operator: { type: 'string', enum: ['eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'contains'] },
                  value: { type: 'string' },
                },
              },
            },
            rollout: {
              type: 'object',
              properties: {
                percentage: { type: 'integer', minimum: 0, maximum: 100 },
                environment: { type: 'string', enum: ['dev', 'staging', 'prod'] },
              },
            },
          },
        },
      },
    ];

    for (const builtIn of builtIns) {
      this.registerSchema(builtIn.type, builtIn.schema, builtIn.description);
    }

    logger.info('Built-in config schemas registered: deploy, pipeline, notification, feature-flag');
  }

  /**
   * Register built-in business rule validators.
   */
  private registerBuiltInBusinessRules(): void {
    this.validationService.registerBusinessRule('deploy', deployCrossFieldRule);
    this.validationService.registerBusinessRule('pipeline', pipelineStageRule);
    this.validationService.registerBusinessRule('notification', notificationChannelRule);
    this.validationService.registerBusinessRule('feature-flag', featureFlagRolloutRule);

    logger.debug('Built-in business rules registered for deploy, pipeline, notification, feature-flag');
  }

  // ==================== Static Helpers ====================

  static createStringSchema(options: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: string[];
    format?: string;
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

  static createBooleanSchema(description?: string): JsonSchema {
    const schema: JsonSchema = { type: 'boolean' };
    if (description) schema.description = description;
    return schema;
  }

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
}

// Singleton instance with built-in schemas pre-loaded
export const configSchemaService = new ConfigSchemaService();
