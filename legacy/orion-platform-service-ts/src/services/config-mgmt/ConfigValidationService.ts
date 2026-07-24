/**
 * ConfigValidationService - JSON Schema validation for configuration management
 *
 * Features:
 * 1. Store and retrieve JSON Schemas for config keys
 * 2. Validate config values against registered schemas
 * 3. Support common types: string, number, boolean, object, array, enum
 * 4. Format AJV errors into human-readable messages
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

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
  errors?: string[];
  rawErrors?: ErrorObject[];
}

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly configKey: string,
    public readonly errors: string[]
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class ConfigValidationService {
  private ajv: Ajv;
  private schemas: Map<string, JsonSchema> = new Map();
  private compiledValidators: Map<string, (data: unknown) => boolean> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      removeAdditional: false,
    });
    addFormats(this.ajv);
  }

  /**
   * Register a JSON Schema for a config key.
   * The schema is compiled immediately and cached for performance.
   */
  setSchema(configKey: string, schema: JsonSchema): void {
    this.schemas.set(configKey, schema);
    try {
      const validateFn = this.ajv.compile(schema);
      this.compiledValidators.set(configKey, validateFn as (data: unknown) => boolean);
    } catch (error) {
      // If schema compilation fails, clear cached validator so runtime compilation is attempted
      this.compiledValidators.delete(configKey);
      throw new ConfigValidationError(
        `Invalid JSON Schema for config '${configKey}': ${(error as Error).message}`,
        configKey,
        [(error as Error).message]
      );
    }
  }

  /**
   * Retrieve the registered JSON Schema for a config key.
   * Returns undefined if no schema is registered.
   */
  getSchema(configKey: string): JsonSchema | undefined {
    return this.schemas.get(configKey);
  }

  /**
   * Validate a value against the registered schema for the given config key.
   *
   * @throws ConfigValidationError if validation fails and no schema is registered
   */
  validateConfig(configKey: string, value: unknown): ValidationResult {
    const schema = this.schemas.get(configKey);
    if (!schema) {
      // No schema registered — treat as valid (no constraint)
      return { valid: true };
    }

    let validateFn = this.compiledValidators.get(configKey);
    if (!validateFn) {
      // Lazy compile if not cached (e.g., schema compilation failed at set time)
      try {
        validateFn = this.ajv.compile(schema) as (data: unknown) => boolean;
        this.compiledValidators.set(configKey, validateFn);
      } catch (error) {
        return {
          valid: false,
          errors: [`Schema compilation error: ${(error as Error).message}`],
          rawErrors: [],
        };
      }
    }

    const valid = validateFn(value);
    if (valid) {
      return { valid: true };
    }

    const rawErrors = (validateFn as any).errors ?? [];
    const errors = this.formatErrors(rawErrors);
    return { valid: false, errors, rawErrors };
  }

  /**
   * Validate and throw on failure. Convenience wrapper around validateConfig.
   */
  validateOrThrow(configKey: string, value: unknown): void {
    const result = this.validateConfig(configKey, value);
    if (!result.valid) {
      throw new ConfigValidationError(
        `Config validation failed for '${configKey}'`,
        configKey,
        result.errors ?? ['Validation failed']
      );
    }
  }

  /**
   * Remove a registered schema (and its cached validator) for a config key.
   */
  removeSchema(configKey: string): void {
    this.schemas.delete(configKey);
    this.compiledValidators.delete(configKey);
  }

  /**
   * List all registered config keys that have schemas.
   */
  listSchemaKeys(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Format AJV ErrorObjects into human-readable strings.
   */
  private formatErrors(errors: ErrorObject[]): string[] {
    return errors.map(err => {
      const path = err.instancePath || 'root';
      const message = err.message || 'Validation error';
      return `${path}: ${message}`;
    });
  }

  /**
   * Helper: Create a simple string schema with constraints.
   */
  static createStringSchema(options: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: string[];
    description?: string;
  } = {}): JsonSchema {
    const schema: JsonSchema = { type: 'string' };
    if (options.minLength !== undefined) schema.minLength = options.minLength;
    if (options.maxLength !== undefined) schema.maxLength = options.maxLength;
    if (options.pattern) schema.pattern = options.pattern;
    if (options.enum) schema.enum = options.enum;
    if (options.description) schema.description = options.description;
    return schema;
  }

  /**
   * Helper: Create a simple number schema with constraints.
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
   * Helper: Create a simple object schema.
   */
  static createObjectSchema(options: {
    properties?: Record<string, JsonSchema>;
    required?: string[];
    description?: string;
  } = {}): JsonSchema {
    const schema: JsonSchema = { type: 'object', properties: {} };
    if (options.properties) schema.properties = options.properties;
    if (options.required) schema.required = options.required;
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
   * Validate a raw JSON Schema for syntax errors.
   * Throws ConfigValidationError if the schema is invalid.
   */
  validateSchemaSyntax(schema: JsonSchema): void {
    try {
      this.ajv.compile(schema);
    } catch (error) {
      throw new ConfigValidationError(
        `Invalid JSON Schema: ${(error as Error).message}`,
        'schema-validation',
        [(error as Error).message]
      );
    }
  }

  /**
   * Validate a value against a raw JSON Schema (not tied to a config key).
   */
  validateJson(schema: JsonSchema, value: unknown): ValidationResult {
    let validateFn: (data: unknown) => boolean;
    try {
      validateFn = this.ajv.compile(schema) as (data: unknown) => boolean;
    } catch (error) {
      return {
        valid: false,
        errors: [`Schema compilation error: ${(error as Error).message}`],
        rawErrors: [],
      };
    }

    const valid = validateFn(value);
    if (valid) {
      return { valid: true };
    }

    const rawErrors = (validateFn as any).errors ?? [];
    const errors = this.formatErrors(rawErrors);
    return { valid: false, errors, rawErrors };
  }
}
