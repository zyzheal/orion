/**
 * ConfigValidationService Unit Tests
 *
 * Tests for JSON Schema registration, validation, and error formatting.
 */

import { ConfigValidationService, ConfigValidationError } from '../ConfigValidationService';

describe('ConfigValidationService', () => {
  let service: ConfigValidationService;

  beforeEach(() => {
    service = new ConfigValidationService();
  });

  describe('setSchema / getSchema', () => {
    it('should register and retrieve a schema', () => {
      const schema = {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
        },
      };

      service.setSchema('database.url', schema);
      expect(service.getSchema('database.url')).toEqual(schema);
    });

    it('should overwrite an existing schema', () => {
      const schema1 = { type: 'string' };
      const schema2 = { type: 'number' };

      service.setSchema('my.key', schema1);
      service.setSchema('my.key', schema2);

      expect(service.getSchema('my.key')).toEqual(schema2);
    });

    it('should return undefined for unregistered keys', () => {
      expect(service.getSchema('nonexistent.key')).toBeUndefined();
    });

    it('should throw ConfigValidationError for invalid JSON Schema', () => {
      const invalidSchema = {
        type: 'string',
        minLength: -1, // invalid: must be >= 0
      };

      expect(() => service.setSchema('bad.key', invalidSchema)).toThrow(
        ConfigValidationError
      );
    });
  });

  describe('validateConfig', () => {
    it('should return valid when no schema is registered', () => {
      const result = service.validateConfig('unregistered.key', 'any-value');
      expect(result.valid).toBe(true);
    });

    it('should validate string against string schema', () => {
      service.setSchema('app.name', { type: 'string', minLength: 1, maxLength: 128 });

      expect(service.validateConfig('app.name', 'orion').valid).toBe(true);
      expect(service.validateConfig('app.name', '').valid).toBe(false);
    });

    it('should validate number against number schema', () => {
      service.setSchema('app.port', { type: 'number', minimum: 1, maximum: 65535 });

      expect(service.validateConfig('app.port', 8080).valid).toBe(true);
      expect(service.validateConfig('app.port', 0).valid).toBe(false);
    });

    it('should validate enum values', () => {
      service.setSchema('app.env', {
        type: 'string',
        enum: ['dev', 'staging', 'prod'],
      });

      expect(service.validateConfig('app.env', 'dev').valid).toBe(true);
      expect(service.validateConfig('app.env', 'invalid').valid).toBe(false);
    });

    it('should validate object properties', () => {
      const schema = {
        type: 'object',
        required: ['host', 'port'],
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
        },
      };

      service.setSchema('db.config', schema);

      expect(
        service.validateConfig('db.config', { host: 'localhost', port: 5432 }).valid
      ).toBe(true);
      expect(
        service.validateConfig('db.config', { host: 'localhost' }).valid
      ).toBe(false);
    });

    it('should validate array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'string', pattern: '^[a-z]+$' },
        maxItems: 5,
      };

      service.setSchema('app.tags', schema);

      expect(service.validateConfig('app.tags', ['a', 'b', 'c']).valid).toBe(true);
      expect(service.validateConfig('app.tags', ['A']).valid).toBe(false);
      expect(
        service.validateConfig('app.tags', ['a', 'b', 'c', 'd', 'e', 'f']).valid
      ).toBe(false);
    });

    it('should validate boolean values', () => {
      service.setSchema('feature.flag', { type: 'boolean' });

      expect(service.validateConfig('feature.flag', true).valid).toBe(true);
      expect(service.validateConfig('feature.flag', 'true').valid).toBe(false);
    });

    it('should return formatted errors on validation failure', () => {
      service.setSchema('user.email', {
        type: 'string',
        pattern: '^[^@]+@[^@]+\\.[^@]+$',
      });

      const result = service.validateConfig('user.email', 'invalid-email');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toContain('must match pattern');
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw when validation passes', () => {
      service.setSchema('key', { type: 'string' });
      expect(() => service.validateOrThrow('key', 'value')).not.toThrow();
    });

    it('should throw ConfigValidationError when validation fails', () => {
      service.setSchema('key', { type: 'string' });
      expect(() => service.validateOrThrow('key', 123)).toThrow(ConfigValidationError);
    });
  });

  describe('removeSchema', () => {
    it('should remove a registered schema', () => {
      service.setSchema('temp.key', { type: 'string' });
      expect(service.getSchema('temp.key')).toBeDefined();

      service.removeSchema('temp.key');
      expect(service.getSchema('temp.key')).toBeUndefined();
    });

    it('should treat removed schema as unregistered (valid by default)', () => {
      service.setSchema('temp.key', { type: 'string' });
      service.removeSchema('temp.key');

      const result = service.validateConfig('temp.key', 12345);
      expect(result.valid).toBe(true);
    });
  });

  describe('listSchemaKeys', () => {
    it('should list all registered schema keys', () => {
      service.setSchema('key.a', { type: 'string' });
      service.setSchema('key.b', { type: 'number' });
      service.setSchema('key.c', { type: 'boolean' });

      const keys = service.listSchemaKeys();
      expect(keys).toEqual(['key.a', 'key.b', 'key.c']);
    });

    it('should return empty array when no schemas registered', () => {
      expect(service.listSchemaKeys()).toEqual([]);
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

    it('createEnumSchema should build an enum schema', () => {
      const schema = ConfigValidationService.createEnumSchema(
        ['dev', 'staging', 'prod'],
        'Environment'
      );

      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['dev', 'staging', 'prod']);
      expect(schema.description).toBe('Environment');
    });

    it('createEnumSchema should infer number type', () => {
      const schema = ConfigValidationService.createEnumSchema([1, 2, 3]);
      expect(schema.type).toBe('number');
    });
  });
});
