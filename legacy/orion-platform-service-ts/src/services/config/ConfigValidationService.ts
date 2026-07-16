/**
 * ConfigValidationService - JSON Schema validation for configuration management
 *
 * Features:
 * 1. Validate config values against JSON Schema using Ajv
 * 2. Business rule validation (cross-field, tenant-specific, etc.)
 * 3. Support for warnings in addition to errors
 * 4. Built-in validators for common config types
 *
 * Prefix: /api/v1/config
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('ConfigValidationService');

// ==================== Types ====================

export interface JsonSchema {
  $schema?: string;
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: (string | number | boolean | null)[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  default?: any;
  description?: string;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
  keyword: string;
}

// ==================== Business Rule Validators ====================

export interface BusinessRuleContext {
  configType: string;
  data: unknown;
  tenantId?: string;
  configId?: string;
}

export type BusinessRuleValidator = (context: BusinessRuleContext) => ValidationResult;

// ==================== ConfigValidationService ====================

export class ConfigValidationService {
  private ajv: Ajv;
  private schemas: Map<string, JsonSchema> = new Map();
  private businessRules: Map<string, BusinessRuleValidator[]> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      removeAdditional: false,
    });
    addFormats(this.ajv);
  }

  // ==================== Schema Management ====================

  /**
   * Register a JSON Schema for a config type.
   */
  registerSchema(configType: string, schema: JsonSchema): void {
    this.validateSchemaSyntax(schema);
    this.schemas.set(configType, schema);
    logger.debug({ configType }, 'Schema registered');
  }

  /**
   * Get the registered schema for a config type.
   */
  getSchema(configType: string): JsonSchema | undefined {
    return this.schemas.get(configType);
  }

  /**
   * List all registered config types.
   */
  listSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Remove a registered schema.
   */
  removeSchema(configType: string): void {
    this.schemas.delete(configType);
  }

  /**
   * Alias for registerSchema (compatibility with config-mgmt service).
   */
  setSchema(configType: string, schema: JsonSchema): void {
    this.registerSchema(configType, schema);
  }

  /**
   * List all registered schema keys.
   */
  listSchemaKeys(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Validate and throw ConfigValidationError on failure.
   */
  validateOrThrow(configType: string, data: unknown): void {
    const result = this.validateConfig(configType, data);
    if (!result.valid) {
      throw new OrionError(
        `Config validation failed for '${configType}': ${result.errors.join('; ')}`,
        ErrorCode.VALIDATION_ERROR,
        false,
        { configType, errors: result.errors },
      );
    }
  }

  // ==================== Validation ====================

  /**
   * Validate config data against its registered schema.
   * Returns validation result with errors and warnings.
   */
  validateConfig(configType: string, data: unknown): ValidationResult {
    const schema = this.schemas.get(configType);
    if (!schema) {
      return {
        valid: true,
        errors: [],
        warnings: [`No schema registered for config type '${configType}'`],
      };
    }

    return this.validateJson(schema, data);
  }

  /**
   * Full validation before saving config.
   * Runs schema validation + business rule validation.
   */
  validateBeforeSave(configType: string, data: unknown, context?: Partial<BusinessRuleContext>): ValidationResult {
    const schemaResult = this.validateConfig(configType, data);
    if (!schemaResult.valid) {
      return schemaResult;
    }

    // Run business rules
    const rules = this.businessRules.get(configType) || [];
    const fullContext: BusinessRuleContext = {
      configType,
      data,
      ...context,
    };

    let combinedWarnings = [...schemaResult.warnings];
    for (const rule of rules) {
      const ruleResult = rule(fullContext);
      if (!ruleResult.valid) {
        return {
          valid: false,
          errors: ruleResult.errors,
          warnings: combinedWarnings,
        };
      }
      combinedWarnings = [...combinedWarnings, ...ruleResult.warnings];
    }

    return {
      valid: true,
      errors: [],
      warnings: combinedWarnings,
    };
  }

  /**
   * Validation before config deployment.
   * Includes schema validation + deployment-specific business rules.
   */
  validateBeforeDeploy(configId: string, data: unknown, context?: Partial<BusinessRuleContext>): ValidationResult {
    // For deployment, we validate against the config type schema
    const configType = context?.configType || 'default';
    const result = this.validateBeforeSave(configType, data, {
      ...context,
      configId,
    });

    // Add deployment-specific warnings
    if (result.valid) {
      result.warnings.push(`Config '${configId}' is ready for deployment`);
    }

    return result;
  }

  // ==================== Business Rules ====================

  /**
   * Register a business rule validator for a config type.
   */
  registerBusinessRule(configType: string, validator: BusinessRuleValidator): void {
    const rules = this.businessRules.get(configType) || [];
    rules.push(validator);
    this.businessRules.set(configType, rules);
  }

  // ==================== Raw JSON Validation ====================

  /**
   * Validate a value against a raw JSON Schema.
   */
  validateJson(schema: JsonSchema, value: unknown): ValidationResult {
    let validateFn: (data: unknown) => boolean;
    try {
      validateFn = this.ajv.compile(schema) as (data: unknown) => boolean;
    } catch (error) {
      return {
        valid: false,
        errors: [`Schema compilation error: ${(error as Error).message}`],
        warnings: [],
      };
    }

    const valid = validateFn(value);
    if (valid) {
      return { valid: true, errors: [], warnings: [] };
    }

    const rawErrors = (validateFn as any).errors ?? [];
    const errors = this.formatErrors(rawErrors).map(e => e.message);
    return { valid: false, errors, warnings: [] };
  }

  /**
   * Validate schema syntax without applying it.
   */
  validateSchemaSyntax(schema: JsonSchema): void {
    try {
      this.ajv.compile(schema);
    } catch (error) {
      throw new OrionError(
        `Invalid JSON Schema: ${(error as Error).message}`,
        ErrorCode.VALIDATION_ERROR,
        false,
        { schemaError: (error as Error).message },
      );
    }
  }

  // ==================== Built-in Schemas ====================

  /**
   * Register built-in schemas for common config types.
   */
  registerBuiltInSchemas(): void {
    // Deploy config schema
    this.registerSchema('deploy', {
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
    });

    // Pipeline config schema
    this.registerSchema('pipeline', {
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
            cron: { type: 'string', pattern: '^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (([0-9]+h)?([0-9]+m)?([0-9]+s)?))|([0-9\\*\\-/,]+ [0-9\\*\\-/,]+ [0-9\\*\\-/]+ [0-9\\*\\-/]+ [0-9\\*\\-/]+)$' },
            webhook: { type: 'boolean' },
          },
        },
      },
    });

    // Notification config schema
    this.registerSchema('notification', {
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
    });

    // Feature flag schema
    this.registerSchema('feature-flag', {
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
    });

    logger.info('Built-in config schemas registered: deploy, pipeline, notification, feature-flag');
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

  // ==================== Private Helpers ====================

  private formatErrors(errors: ErrorObject[]): ValidationErrorDetail[] {
    return errors.map(err => {
      const path = err.instancePath || 'root';
      return {
        path,
        message: `${path}: ${err.message || 'Validation error'}`,
        keyword: err.keyword || '',
      };
    });
  }
}
