/**
 * ConfigSearchService - Unit Tests
 *
 * Tests for config search (Fuse.js fuzzy search), UI Schema generation,
 * form layout generation, Markdown doc generation, and metadata access.
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

import {
  configSearchService,
  ConfigUISchemaGenerator,
  CONFIG_METADATA,
  ConfigMetadata,
} from '../ConfigSearchService';

describe('ConfigSearchService', () => {
  // ==================== Constructor / Initialization ====================

  describe('initialization', () => {
    it('should be instantiated with predefined metadata', () => {
      expect(configSearchService).toBeDefined();
      const metadata = configSearchService.getAllMetadata();
      expect(metadata.length).toBeGreaterThan(0);
    });

    it('should have metadata for multiple domains', () => {
      const domains = configSearchService.getDomains();
      expect(domains).toContain('pipeline');
      expect(domains).toContain('security');
      expect(domains).toContain('deploy');
      expect(domains).toContain('alert');
      expect(domains).toContain('notification');
      expect(domains).toContain('monitoring');
      expect(domains).toContain('tenant');
    });
  });

  // ==================== search ====================

  describe('search', () => {
    it('should find configs by key', () => {
      const results = configSearchService.search('maxConcurrent');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toBe('maxConcurrentRuns');
    });

    it('should find configs by description', () => {
      const results = configSearchService.search('JWT');
      expect(results.length).toBeGreaterThan(0);
      const keys = results.map((r) => r.key);
      expect(keys).toContain('jwtSecret');
    });

    it('should find configs by domain', () => {
      const results = configSearchService.search('pipeline', { domain: 'pipeline' });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.domain).toBe('pipeline');
      }
    });

    it('should filter by sensitivity', () => {
      const results = configSearchService.search('', {
        sensitivity: ['secret'],
      });
      // Only secret items should be returned
      for (const r of results) {
        expect(r.sensitivity).toBe('secret');
      }
    });

    it('should filter by tags', () => {
      const results = configSearchService.search('', { tags: ['jwt'] });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.tags).toContain('jwt');
      }
    });

    it('should respect limit option', () => {
      const results = configSearchService.search('', { limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array for non-matching query', () => {
      const results = configSearchService.search('zzzznonexistentqueryzzzz');
      expect(results).toHaveLength(0);
    });

    it('should return results with score', () => {
      const results = configSearchService.search('pipeline');
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('score');
        expect(typeof results[0].score).toBe('number');
      }
    });
  });

  // ==================== getSuggestions ====================

  describe('getSuggestions', () => {
    it('should return suggestion strings in domain.key format', () => {
      const suggestions = configSearchService.getSuggestions('jwt');
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) {
        expect(s).toMatch(/^.+\..+$/); // domain.key format
      }
    });

    it('should respect limit parameter', () => {
      const suggestions = configSearchService.getSuggestions('pipeline', 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should default to 5 suggestions', () => {
      const suggestions = configSearchService.getSuggestions('');
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  // ==================== getDomains ====================

  describe('getDomains', () => {
    it('should return unique domain list', () => {
      const domains = configSearchService.getDomains();
      const uniqueDomains = new Set(domains);
      expect(domains.length).toBe(uniqueDomains.size);
    });

    it('should include expected domains', () => {
      const domains = configSearchService.getDomains();
      expect(domains).toContain('pipeline');
      expect(domains).toContain('security');
      expect(domains).toContain('deploy');
    });
  });

  // ==================== getTags ====================

  describe('getTags', () => {
    it('should return unique tag list', () => {
      const tags = configSearchService.getTags();
      const uniqueTags = new Set(tags);
      expect(tags.length).toBe(uniqueTags.size);
    });

    it('should include expected tags', () => {
      const tags = configSearchService.getTags();
      expect(tags).toContain('pipeline');
      expect(tags).toContain('jwt');
      expect(tags).toContain('deploy');
    });
  });

  // ==================== getByDomain ====================

  describe('getByDomain', () => {
    it('should return configs for a specific domain', () => {
      const pipelineConfigs = configSearchService.getByDomain('pipeline');
      expect(pipelineConfigs.length).toBeGreaterThan(0);
      for (const c of pipelineConfigs) {
        expect(c.domain).toBe('pipeline');
      }
    });

    it('should return empty array for non-existent domain', () => {
      const results = configSearchService.getByDomain('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  // ==================== generateUISchema ====================

  describe('generateUISchema', () => {
    it('should return jsonSchema and formLayout', () => {
      const schema = configSearchService.generateUISchema();
      expect(schema).toHaveProperty('jsonSchema');
      expect(schema).toHaveProperty('formLayout');
    });

    it('should generate valid JSON Schema', () => {
      const { jsonSchema } = configSearchService.generateUISchema();
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(Object.keys(jsonSchema.properties).length).toBeGreaterThan(0);
    });

    it('should generate form layout with groups', () => {
      const { formLayout } = configSearchService.generateUISchema();
      expect(typeof formLayout).toBe('object');
      // Should have at least one group
      const groups = Object.keys(formLayout);
      expect(groups.length).toBeGreaterThan(0);
    });

    it('should sort form layout items by order', () => {
      const { formLayout } = configSearchService.generateUISchema();
      for (const group of Object.values(formLayout)) {
        const items = group as Array<{ order: number }>;
        for (let i = 1; i < items.length; i++) {
          expect(items[i].order).toBeGreaterThanOrEqual(items[i - 1].order);
        }
      }
    });
  });

  // ==================== generateDocs ====================

  describe('generateDocs', () => {
    it('should generate Markdown documentation', () => {
      const docs = configSearchService.generateDocs();
      expect(docs).toContain('# Orion 配置参考');
      expect(docs).toContain('## pipeline');
      expect(docs).toContain('## security');
    });

    it('should include config key headers', () => {
      const docs = configSearchService.generateDocs();
      expect(docs).toContain('`maxConcurrentRuns`');
      expect(docs).toContain('`jwtSecret`');
    });

    it('should include property tables', () => {
      const docs = configSearchService.generateDocs();
      expect(docs).toContain('| 属性 | 值 |');
      expect(docs).toContain('| 类型 |');
      expect(docs).toContain('| 敏感度 |');
    });
  });
});

// ==================== ConfigUISchemaGenerator (static methods) ====================

describe('ConfigUISchemaGenerator', () => {
  const testConfigs: ConfigMetadata[] = [
    {
      domain: 'test',
      key: 'stringValue',
      type: 'string',
      description: 'A string config',
      sensitivity: 'public',
      tags: ['test'],
      validations: { enum: ['a', 'b', 'c'] },
      ui: { label: 'String Value', group: 'test-group', order: 1, widget: 'select' },
    },
    {
      domain: 'test',
      key: 'numberValue',
      type: 'number',
      description: 'A number config',
      sensitivity: 'internal',
      tags: ['test'],
      validations: { min: 0, max: 100 },
      ui: { label: 'Number Value', group: 'test-group', order: 2, widget: 'input' },
    },
    {
      domain: 'test',
      key: 'boolValue',
      type: 'boolean',
      description: 'A boolean config',
      defaultValue: true,
      sensitivity: 'public',
      tags: ['test'],
    },
    {
      domain: 'test',
      key: 'jsonConfig',
      type: 'object',
      description: 'A JSON config',
      sensitivity: 'internal',
      tags: ['test'],
    },
  ];

  describe('generateJsonSchema', () => {
    it('should generate schema with correct types', () => {
      const schema = ConfigUISchemaGenerator.generateJsonSchema(testConfigs);
      expect(schema.type).toBe('object');
      expect(schema.properties.stringValue.type).toBe('string');
      expect(schema.properties.numberValue.type).toBe('number');
      expect(schema.properties.boolValue.type).toBe('boolean');
    });

    it('should include enum for select widgets', () => {
      const schema = ConfigUISchemaGenerator.generateJsonSchema(testConfigs);
      expect(schema.properties.stringValue.enum).toEqual(['a', 'b', 'c']);
    });

    it('should include validation rules', () => {
      const schema = ConfigUISchemaGenerator.generateJsonSchema(testConfigs);
      expect(schema.properties.numberValue.minimum).toBe(0);
      expect(schema.properties.numberValue.maximum).toBe(100);
    });

    it('should include descriptions', () => {
      const schema = ConfigUISchemaGenerator.generateJsonSchema(testConfigs);
      expect(schema.properties.stringValue.description).toBe('A string config');
    });
  });

  describe('generateFormLayout', () => {
    it('should group configs by ui.group', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout(testConfigs);
      expect(layout).toHaveProperty('test-group');
      // Only 2 configs have ui.group = 'test-group'; the other 2 have no ui, so go to 'general'
      expect(layout['test-group']).toHaveLength(2);
      expect(layout['general']).toHaveLength(2);
    });

    it('should use default group "general" when ui.group is missing', () => {
      const configs: ConfigMetadata[] = [
        {
          domain: 'test',
          key: 'noGroup',
          type: 'string',
          description: 'No group',
          sensitivity: 'public',
          tags: [],
        },
      ];
      const layout = ConfigUISchemaGenerator.generateFormLayout(configs);
      expect(layout).toHaveProperty('general');
    });

    it('should include widget information', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout(testConfigs);
      const items = layout['test-group'];
      const selectItem = items.find((i: any) => i.key === 'test.stringValue');
      expect(selectItem?.widget).toBe('select');
    });

    it('should sort items by order within groups', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout(testConfigs);
      const items = layout['test-group'];
      for (let i = 1; i < items.length; i++) {
        expect(items[i].order).toBeGreaterThanOrEqual(items[i - 1].order);
      }
    });
  });

  describe('generateMarkdown', () => {
    it('should generate markdown with domain headers', () => {
      const md = ConfigUISchemaGenerator.generateMarkdown(testConfigs);
      expect(md).toContain('## test');
    });

    it('should generate markdown with key headers', () => {
      const md = ConfigUISchemaGenerator.generateMarkdown(testConfigs);
      expect(md).toContain('### `stringValue`');
    });

    it('should include property tables with type and sensitivity', () => {
      const md = ConfigUISchemaGenerator.generateMarkdown(testConfigs);
      expect(md).toContain('| 类型 | `string` |');
      expect(md).toContain('| 敏感度 | public |');
    });

    it('should include default values when present', () => {
      const md = ConfigUISchemaGenerator.generateMarkdown(testConfigs);
      expect(md).toContain('| 默认值 |');
    });

    it('should include tags when present', () => {
      const md = ConfigUISchemaGenerator.generateMarkdown(testConfigs);
      expect(md).toContain('| 标签 | test |');
    });
  });

  describe('widget inference', () => {
    it('should infer toggle for boolean type', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        { domain: 't', key: 'flag', type: 'boolean', description: '', sensitivity: 'public', tags: [] },
      ]);
      expect(layout['general'][0].widget).toBe('toggle');
    });

    it('should infer json for object type', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        { domain: 't', key: 'config', type: 'object', description: '', sensitivity: 'public', tags: [] },
      ]);
      expect(layout['general'][0].widget).toBe('json');
    });

    it('should infer json for array type', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        { domain: 't', key: 'list', type: 'array', description: '', sensitivity: 'public', tags: [] },
      ]);
      expect(layout['general'][0].widget).toBe('json');
    });

    it('should infer select for string with enum validations', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        {
          domain: 't', key: 'choice', type: 'string', description: '', sensitivity: 'public', tags: [],
          validations: { enum: ['a', 'b'] },
        },
      ]);
      expect(layout['general'][0].widget).toBe('select');
    });

    it('should infer json for key containing "json"', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        { domain: 't', key: 'jsonData', type: 'string', description: '', sensitivity: 'public', tags: [] },
      ]);
      expect(layout['general'][0].widget).toBe('json');
    });

    it('should infer code for key containing "code"', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        { domain: 't', key: 'initCode', type: 'string', description: '', sensitivity: 'public', tags: [] },
      ]);
      expect(layout['general'][0].widget).toBe('code');
    });

    it('should infer code for key containing "script"', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        { domain: 't', key: 'runScript', type: 'string', description: '', sensitivity: 'public', tags: [] },
      ]);
      expect(layout['general'][0].widget).toBe('code');
    });

    it('should default to input for plain string', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        { domain: 't', key: 'hostname', type: 'string', description: '', sensitivity: 'public', tags: [] },
      ]);
      expect(layout['general'][0].widget).toBe('input');
    });

    it('should use explicit ui.widget over inferred', () => {
      const layout = ConfigUISchemaGenerator.generateFormLayout([
        {
          domain: 't', key: 'flag', type: 'boolean', description: '', sensitivity: 'public', tags: [],
          ui: { label: 'Flag', group: 'g', order: 1, widget: 'slider' },
        },
      ]);
      expect(layout['g'][0].widget).toBe('slider');
    });
  });
});

// ==================== CONFIG_METADATA ====================

describe('CONFIG_METADATA', () => {
  it('should have unique domain.key combinations', () => {
    const keys = CONFIG_METADATA.map((c) => `${c.domain}.${c.key}`);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('should have valid sensitivity values', () => {
    const validSensitivities = ['public', 'internal', 'confidential', 'secret'];
    for (const config of CONFIG_METADATA) {
      expect(validSensitivities).toContain(config.sensitivity);
    }
  });

  it('should have tags as arrays', () => {
    for (const config of CONFIG_METADATA) {
      expect(Array.isArray(config.tags)).toBe(true);
    }
  });

  it('should have description for every config', () => {
    for (const config of CONFIG_METADATA) {
      expect(config.description).toBeTruthy();
      expect(config.description.length).toBeGreaterThan(0);
    }
  });
});
