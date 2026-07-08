/**
 * ConfigValidationService Unit Tests
 *
 * Tests for JSON Schema registration, validation, business rules,
 * built-in schemas, and error formatting with path details.
 */

import { ConfigValidationService, JsonSchema, ValidationResult } from '../ConfigValidationService';
import { OrionError, ErrorCode } from '@/errors';

describe('ConfigValidationService', () => {
  let service: ConfigValidationService;

  beforeEach(() => {
    service = new ConfigValidationService();
  });

  describe('registerSchema / getSchema / removeSchema', () => {
    it('should register and retrieve a schema', () => {
      const schema: JsonSchema = {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
        },
      };

      service.registerSchema('database.url', schema);
      expect(service.getSchema('database.url')).toEqual(schema);
    });

    it('should overwrite an existing schema', () => {
      const schema1: JsonSchema = { type: 'string' };
      const schema2: JsonSchema = { type: 'number' };

      service.registerSchema('my.key', schema1);
      service.registerSchema('my.key', schema2);

      expect(service.getSchema('my.key')).toEqual(schema2);
    });

    it('should return undefined for unregistered keys', () => {
      expect(service.getSchema('nonexistent.key')).toBeUndefined();
    });

    it('should throw OrionError for invalid JSON Schema', () => {
      const invalidSchema: JsonSchema = {
        type: 'string',
        minLength: -1,
      };

      expect(() => service.registerSchema('bad.key', invalidSchema)).toThrow(OrionError);
    });

    it('should remove a registered schema', () => {
      service.registerSchema('temp.key', { type: 'string' });
      expect(service.getSchema('temp.key')).toBeDefined();

      service.removeSchema('temp.key');
      expect(service.getSchema('temp.key')).toBeUndefined();
    });

    it('should treat removed schema as unregistered (valid by default)', () => {
      service.registerSchema('temp.key', { type: 'string' });
      service.removeSchema('temp.key');

      const result = service.validateConfig('temp.key', 12345);
      expect(result.valid).toBe(true);
    });
  });

  describe('setSchema / listSchemaKeys', () => {
    it('setSchema should be an alias for registerSchema', () => {
      const schema: JsonSchema = { type: 'string', minLength: 1 };
      service.setSchema('app.name', schema);
      expect(service.getSchema('app.name')).toEqual(schema);
    });

    it('listSchemaKeys should return all registered keys', () => {
      service.setSchema('key.a', { type: 'string' });
      service.setSchema('key.b', { type: 'number' });
      service.setSchema('key.c', { type: 'boolean' });

      expect(service.listSchemaKeys()).toEqual(['key.a', 'key.b', 'key.c']);
    });

    it('listSchemaKeys should return empty array when no schemas registered', () => {
      expect(service.listSchemaKeys()).toEqual([]);
    });
  });

  describe('validateConfig', () => {
    it('should return valid when no schema is registered', () => {
      const result = service.validateConfig('unregistered.key', 'any-value');
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("No schema registered for config type 'unregistered.key'");
    });

    it('should validate string against string schema', () => {
      service.registerSchema('app.name', { type: 'string', minLength: 1, maxLength: 128 });

      expect(service.validateConfig('app.name', 'orion').valid).toBe(true);
      expect(service.validateConfig('app.name', '').valid).toBe(false);
    });

    it('should validate number against number schema', () => {
      service.registerSchema('app.port', { type: 'number', minimum: 1, maximum: 65535 });

      expect(service.validateConfig('app.port', 8080).valid).toBe(true);
      expect(service.validateConfig('app.port', 0).valid).toBe(false);
      expect(service.validateConfig('app.port', -1).valid).toBe(false);
    });

    it('should validate integer schema', () => {
      service.registerSchema('app.count', { type: 'integer', minimum: 0, maximum: 100 });

      expect(service.validateConfig('app.count', 50).valid).toBe(true);
      expect(service.validateConfig('app.count', 3.14).valid).toBe(false); // float fails integer
    });

    it('should validate enum values', () => {
      service.registerSchema('app.env', {
        type: 'string',
        enum: ['dev', 'staging', 'prod'],
      });

      expect(service.validateConfig('app.env', 'dev').valid).toBe(true);
      expect(service.validateConfig('app.env', 'invalid').valid).toBe(false);
    });

    it('should validate object properties', () => {
      const schema: JsonSchema = {
        type: 'object',
        required: ['host', 'port'],
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
        },
      };

      service.registerSchema('db.config', schema);

      expect(service.validateConfig('db.config', { host: 'localhost', port: 5432 }).valid).toBe(true);
      expect(service.validateConfig('db.config', { host: 'localhost' }).valid).toBe(false);
    });

    it('should validate array items', () => {
      const schema: JsonSchema = {
        type: 'array',
        items: { type: 'string', pattern: '^[a-z]+$' },
        maxItems: 5,
      };

      service.registerSchema('app.tags', schema);

      expect(service.validateConfig('app.tags', ['a', 'b', 'c']).valid).toBe(true);
      expect(service.validateConfig('app.tags', ['A']).valid).toBe(false);
      expect(service.validateConfig('app.tags', ['a', 'b', 'c', 'd', 'e', 'f']).valid).toBe(false);
    });

    it('should validate boolean values', () => {
      service.registerSchema('feature.flag', { type: 'boolean' });

      expect(service.validateConfig('feature.flag', true).valid).toBe(true);
      expect(service.validateConfig('feature.flag', 'true').valid).toBe(false);
    });

    it('should return formatted errors with path on validation failure', () => {
      service.registerSchema('user.email', {
        type: 'string',
        pattern: '^[^@]+@[^@]+\\.[^@]+$',
      });

      const result = service.validateConfig('user.email', 'invalid-email');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toContain('must match pattern');
    });

    it('should validate nested object properties', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          resources: {
            type: 'object',
            properties: {
              cpu: { type: 'string', pattern: '^[0-9]+m?$' },
              memory: { type: 'string', pattern: '^[0-9]+(Mi|Gi)?$' },
            },
          },
        },
      };

      service.registerSchema('deploy.config', schema);

      expect(service.validateConfig('deploy.config', { resources: { cpu: '1000m', memory: '2Gi' } }).valid).toBe(true);
      expect(service.validateConfig('deploy.config', { resources: { cpu: 'abc', memory: '2Gi' } }).valid).toBe(false);
    });

    it('should validate minLength and maxLength', () => {
      service.registerSchema('app.name', { type: 'string', minLength: 3, maxLength: 10 });

      expect(service.validateConfig('app.name', 'abc').valid).toBe(true);
      expect(service.validateConfig('app.name', 'ab').valid).toBe(false);
      expect(service.validateConfig('app.name', 'abcdefghijk').valid).toBe(false);
    });
  });

  describe('validateBeforeSave', () => {
    it('should return valid when schema and business rules pass', () => {
      service.registerSchema('deploy', {
        type: 'object',
        required: ['image', 'replicas'],
        properties: {
          image: { type: 'string' },
          replicas: { type: 'integer', minimum: 1 },
        },
      });

      const result = service.validateBeforeSave('deploy', {
        image: 'nginx:latest',
        replicas: 3,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return schema errors first when schema validation fails', () => {
      service.registerSchema('deploy', {
        type: 'object',
        required: ['image'],
        properties: {
          image: { type: 'string' },
        },
      });

      const result = service.validateBeforeSave('deploy', { replicas: 3 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should run registered business rules', () => {
      service.registerSchema('test.config', {
        type: 'object',
        properties: {
          value: { type: 'number' },
        },
      });

      service.registerBusinessRule('test.config', (context) => {
        const data = context.data as Record<string, any>;
        if (data.value && data.value > 100) {
          return { valid: false, errors: ['Value exceeds maximum of 100'], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
      });

      expect(service.validateBeforeSave('test.config', { value: 50 }).valid).toBe(true);
      expect(service.validateBeforeSave('test.config', { value: 150 }).valid).toBe(false);
    });

    it('should accumulate warnings from business rules', () => {
      service.registerSchema('test.config', {
        type: 'object',
        properties: {
          cpu: { type: 'string' },
        },
      });

      service.registerBusinessRule('test.config', (context) => {
        return { valid: true, errors: [], warnings: ['CPU allocation seems high'] };
      });

      const result = service.validateBeforeSave('test.config', { cpu: '4000m' });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('CPU allocation seems high');
    });
  });

  describe('validateBeforeDeploy', () => {
    it('should add deployment warning when valid', () => {
      service.registerSchema('deploy', {
        type: 'object',
        properties: {
          image: { type: 'string' },
        },
      });

      const result = service.validateBeforeDeploy('config-1', { image: 'nginx:latest' }, { configType: 'deploy' });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Config 'config-1' is ready for deployment");
    });
  });

  describe('registerBusinessRule', () => {
    it('should store and run custom business rules', () => {
      service.registerSchema('notification', {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['email', 'sms', 'webhook'] },
                enabled: { type: 'boolean' },
              },
            },
          },
        },
      });

      service.registerBusinessRule('notification', (context) => {
        const data = context.data as Record<string, any>;
        const enabled = (data.channels || []).filter((ch: any) => ch.enabled !== false);
        if (enabled.length === 0) {
          return { valid: false, errors: ['At least one channel must be enabled'], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
      });

      expect(service.validateBeforeSave('notification', { channels: [{ type: 'email', enabled: true }] }).valid).toBe(true);
      expect(service.validateBeforeSave('notification', { channels: [] }).valid).toBe(false);
    });
  });

  describe('validateJson', () => {
    it('should validate against a raw JSON Schema', () => {
      const schema: JsonSchema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      };

      expect(service.validateJson(schema, { name: 'test' }).valid).toBe(true);
      expect(service.validateJson(schema, {}).valid).toBe(false);
    });

    it('should return errors with path details', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          port: { type: 'number', minimum: 1, maximum: 65535 },
        },
      };

      const result = service.validateJson(schema, { port: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toContain('port');
    });

    it('should handle schema compilation errors', () => {
      const badSchema = { type: 'invalid-type' } as JsonSchema;
      const result = service.validateJson(badSchema, 'anything');
      expect(result.valid).toBe(false);
      expect(result.errors![0]).toContain('compilation error');
    });
  });

  describe('validateSchemaSyntax', () => {
    it('should not throw for valid schemas', () => {
      expect(() => service.validateSchemaSyntax({ type: 'string' })).not.toThrow();
    });

    it('should throw OrionError for invalid schemas', () => {
      expect(() => service.validateSchemaSyntax({ type: 'string', minLength: -1 })).toThrow(OrionError);
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw when validation passes', () => {
      service.setSchema('key', { type: 'string' });
      expect(() => service.validateOrThrow('key', 'value')).not.toThrow();
    });

    it('should throw OrionError when validation fails', () => {
      service.setSchema('key', { type: 'string' });
      expect(() => service.validateOrThrow('key', 123)).toThrow(OrionError);
    });
  });

  describe('built-in schemas', () => {
    beforeEach(() => {
      service.registerBuiltInSchemas();
    });

    it('should register deploy schema', () => {
      const schema = service.getSchema('deploy');
      expect(schema).toBeDefined();
      expect(schema!.required).toContain('image');
      expect(schema!.required).toContain('replicas');
    });

    it('should register pipeline schema', () => {
      const schema = service.getSchema('pipeline');
      expect(schema).toBeDefined();
      expect(schema!.required).toContain('name');
      expect(schema!.required).toContain('stages');
    });

    it('should register notification schema', () => {
      const schema = service.getSchema('notification');
      expect(schema).toBeDefined();
    });

    it('should register feature-flag schema', () => {
      const schema = service.getSchema('feature-flag');
      expect(schema).toBeDefined();
    });

    it('should validate against deploy built-in schema', () => {
      const validDeploy = {
        image: 'nginx:latest',
        replicas: 3,
        environment: { name: 'prod', variables: {} },
      };

      expect(service.validateConfig('deploy', validDeploy).valid).toBe(true);

      const invalidDeploy = {
        image: 'nginx:latest',
        replicas: 3,
        // missing environment
      };

      expect(service.validateConfig('deploy', invalidDeploy).valid).toBe(false);
    });

    it('should validate against pipeline built-in schema', () => {
      const validPipeline = {
        name: 'my-pipeline',
        stages: [
          {
            name: 'build',
            tasks: [{ name: 'compile', image: 'golang:1.21' }],
          },
        ],
      };

      expect(service.validateConfig('pipeline', validPipeline).valid).toBe(true);
    });
  });

  describe('static helpers', () => {
    it('createStringSchema should build a string schema', () => {
      const schema = ConfigValidationService.createStringSchema({
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-z]+$',
        description: 'Lowercase string',
      });

      expect(schema.type).toBe('string');
      expect(schema.minLength).toBe(1);
      expect(schema.maxLength).toBe(100);
      expect(schema.pattern).toBe('^[a-z]+$');
      expect(schema.description).toBe('Lowercase string');
    });

    it('createNumberSchema should build a number schema', () => {
      const schema = ConfigValidationService.createNumberSchema({
        minimum: 0,
        maximum: 100,
        description: 'Percentage',
      });

      expect(schema.type).toBe('number');
      expect(schema.minimum).toBe(0);
      expect(schema.maximum).toBe(100);
      expect(schema.description).toBe('Percentage');
    });

    it('createIntegerSchema should build an integer schema', () => {
      const schema = ConfigValidationService.createIntegerSchema({
        minimum: 0,
        maximum: 100,
        enum: [1, 2, 5, 10],
      });

      expect(schema.type).toBe('integer');
      expect(schema.enum).toEqual([1, 2, 5, 10]);
    });

    it('createBooleanSchema should build a boolean schema', () => {
      const schema = ConfigValidationService.createBooleanSchema('Enable feature');
      expect(schema.type).toBe('boolean');
      expect(schema.description).toBe('Enable feature');
    });

    it('createArraySchema should build an array schema', () => {
      const schema = ConfigValidationService.createArraySchema({
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
      });

      expect(schema.type).toBe('array');
      expect((schema.items as JsonSchema).type).toBe('string');
      expect(schema.minItems).toBe(1);
      expect(schema.maxItems).toBe(10);
      expect(schema.uniqueItems).toBe(true);
    });

    it('createObjectSchema should build an object schema', () => {
      const schema = ConfigValidationService.createObjectSchema({
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
        description: 'User object',
      });

      expect(schema.type).toBe('object');
      expect(schema.required).toEqual(['id', 'name']);
      expect(schema.properties).toBeDefined();
      expect(schema.description).toBe('User object');
    });

    it('createEnumSchema should build a string enum schema', () => {
      const schema = ConfigValidationService.createEnumSchema(['dev', 'staging', 'prod'], 'Environment');
      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['dev', 'staging', 'prod']);
      expect(schema.description).toBe('Environment');
    });

    it('createEnumSchema should infer number type', () => {
      const schema = ConfigValidationService.createEnumSchema([1, 2, 3]);
      expect(schema.type).toBe('number');
    });

    it('createEnumSchema should infer boolean type', () => {
      const schema = ConfigValidationService.createEnumSchema([true, false]);
      expect(schema.type).toBe('boolean');
    });
  });

  describe('custom validation rules', () => {
    it('should support regex pattern validation', () => {
      service.registerSchema('app.name', {
        type: 'string',
        pattern: '^[a-zA-Z0-9_-]+$',
      });

      expect(service.validateConfig('app.name', 'my-app_v2').valid).toBe(true);
      expect(service.validateConfig('app.name', 'my app').valid).toBe(false);
    });

    it('should support range validation (minimum/maximum)', () => {
      service.registerSchema('app.port', {
        type: 'integer',
        minimum: 1,
        maximum: 65535,
      });

      expect(service.validateConfig('app.port', 8080).valid).toBe(true);
      expect(service.validateConfig('app.port', 0).valid).toBe(false);
      expect(service.validateConfig('app.port', 65536).valid).toBe(false);
    });

    it('should support enum validation', () => {
      service.registerSchema('app.env', {
        type: 'string',
        enum: ['dev', 'staging', 'prod'],
      });

      expect(service.validateConfig('app.env', 'dev').valid).toBe(true);
      expect(service.validateConfig('app.env', 'prod').valid).toBe(true);
      expect(service.validateConfig('app.env', 'unknown').valid).toBe(false);
    });
  });

  describe('validation error reporting with path details', () => {
    it('should report root-level errors with empty path', () => {
      service.registerSchema('simple', { type: 'number' });

      const result = service.validateConfig('simple', 'not-a-number');
      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toContain('root');
    });

    it('should report nested property errors with full path', () => {
      service.registerSchema('deploy', {
        type: 'object',
        properties: {
          resources: {
            type: 'object',
            properties: {
              cpu: { type: 'string' },
            },
          },
        },
      });

      const result = service.validateConfig('deploy', { resources: { cpu: 123 } });
      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors!.some(e => e.includes('/resources/cpu') || e.includes('resources'))).toBe(true);
    });

    it('should report array index in error path', () => {
      service.registerSchema('items', {
        type: 'array',
        items: { type: 'number' },
      });

      const result = service.validateConfig('items', ['a', 1, 2]);
      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('validation on create/update simulation', () => {
    it('should catch missing required fields on create', () => {
      service.registerSchema('deploy', {
        type: 'object',
        required: ['image', 'replicas', 'environment'],
      });

      const result = service.validateBeforeSave('deploy', {
        image: 'nginx:latest',
        // missing replicas and environment
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('replicas') || e.includes('required'))).toBe(true);
    });

    it('should catch invalid values on update', () => {
      service.registerSchema('deploy', {
        type: 'object',
        properties: {
          replicas: { type: 'integer', minimum: 1, maximum: 100 },
        },
      });

      const result = service.validateBeforeSave('deploy', { replicas: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('replicas') || e.includes('minimum'))).toBe(true);
    });
  });
});
