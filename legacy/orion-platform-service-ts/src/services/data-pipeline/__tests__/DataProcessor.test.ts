/**
 * DataProcessor - 数据处理工具单元测试
 *
 * 测试覆盖: 记录处理、Schema验证、数据转换（过滤/映射/聚合）
 */

import { DataProcessor, DataSchema, TransformConfig } from '../DataProcessor';

describe('DataProcessor', () => {
  let processor: DataProcessor;

  beforeEach(() => {
    processor = new DataProcessor();
  });

  // ==================== processRecord ====================

  describe('processRecord', () => {
    it('should process valid record', () => {
      const schema: DataSchema = {
        name: 'test-schema',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
      };

      const result = processor.processRecord({ name: 'Alice', age: 30 }, schema);

      expect(result.data).toEqual({ name: 'Alice', age: 30 });
      expect(result.schema).toBe('test-schema');
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.processedAt).toBeDefined();
    });

    it('should report missing required fields', () => {
      const schema: DataSchema = {
        name: 'test-schema',
        fields: [{ name: 'name', type: 'string', required: true }],
      };

      const result = processor.processRecord({}, schema);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('required');
    });

    it('should report type mismatch', () => {
      const schema: DataSchema = {
        name: 'test-schema',
        fields: [{ name: 'age', type: 'number' }],
      };

      const result = processor.processRecord({ age: 'thirty' }, schema);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('expected type');
    });

    it('should track processed records', () => {
      const schema: DataSchema = { name: 's', fields: [] };

      processor.processRecord({ a: 1 }, schema);
      processor.processRecord({ b: 2 }, schema);

      expect(processor.getProcessedRecords()).toHaveLength(2);
    });
  });

  // ==================== validateSchema ====================

  describe('validateSchema', () => {
    it('should validate required fields', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'email', type: 'string', required: true }],
      };

      const valid = processor.validateSchema({ email: 'test@example.com' }, schema);
      const invalid = processor.validateSchema({}, schema);

      expect(valid.valid).toBe(true);
      expect(invalid.valid).toBe(false);
    });

    it('should validate string type', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'name', type: 'string' }],
      };

      expect(processor.validateSchema({ name: 'Alice' }, schema).valid).toBe(true);
      expect(processor.validateSchema({ name: 123 }, schema).valid).toBe(false);
    });

    it('should validate number type', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'age', type: 'number' }],
      };

      expect(processor.validateSchema({ age: 30 }, schema).valid).toBe(true);
      expect(processor.validateSchema({ age: '30' }, schema).valid).toBe(false);
      expect(processor.validateSchema({ age: NaN }, schema).valid).toBe(false);
    });

    it('should validate boolean type', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'active', type: 'boolean' }],
      };

      expect(processor.validateSchema({ active: true }, schema).valid).toBe(true);
      expect(processor.validateSchema({ active: 'true' }, schema).valid).toBe(false);
    });

    it('should validate date type', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'createdAt', type: 'date' }],
      };

      expect(processor.validateSchema({ createdAt: '2026-01-01' }, schema).valid).toBe(true);
      expect(processor.validateSchema({ createdAt: 'not-a-date' }, schema).valid).toBe(false);
    });

    it('should validate object type', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'metadata', type: 'object' }],
      };

      expect(processor.validateSchema({ metadata: { key: 'value' } }, schema).valid).toBe(true);
      expect(processor.validateSchema({ metadata: [1, 2] }, schema).valid).toBe(false);
      // null is treated as optional/missing and skipped
      expect(processor.validateSchema({ metadata: null }, schema).valid).toBe(true);
    });

    it('should validate array type', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'tags', type: 'array' }],
      };

      expect(processor.validateSchema({ tags: [1, 2, 3] }, schema).valid).toBe(true);
      expect(processor.validateSchema({ tags: 'not-array' }, schema).valid).toBe(false);
    });

    it('should validate enum values', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'status', type: 'string', enum: ['active', 'inactive'] }],
      };

      expect(processor.validateSchema({ status: 'active' }, schema).valid).toBe(true);
      expect(processor.validateSchema({ status: 'deleted' }, schema).valid).toBe(false);
    });

    it('should validate string minLength', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'name', type: 'string', minLength: 3 }],
      };

      const short = processor.validateSchema({ name: 'ab' }, schema);
      expect(short.valid).toBe(true); // minLength produces warning, not error
      expect(short.warnings).toHaveLength(1);
    });

    it('should validate string maxLength', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'name', type: 'string', maxLength: 5 }],
      };

      expect(processor.validateSchema({ name: 'abc' }, schema).valid).toBe(true);
      expect(processor.validateSchema({ name: 'abcdef' }, schema).valid).toBe(false);
    });

    it('should validate string pattern', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'email', type: 'string', pattern: '^.+@.+$' }],
      };

      expect(processor.validateSchema({ email: 'a@b' }, schema).valid).toBe(true);
      expect(processor.validateSchema({ email: 'no-at' }, schema).valid).toBe(false);
    });

    it('should validate number minimum', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'age', type: 'number', minimum: 0 }],
      };

      expect(processor.validateSchema({ age: 5 }, schema).valid).toBe(true);
      expect(processor.validateSchema({ age: -1 }, schema).valid).toBe(false);
    });

    it('should validate number maximum', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'age', type: 'number', maximum: 150 }],
      };

      expect(processor.validateSchema({ age: 100 }, schema).valid).toBe(true);
      expect(processor.validateSchema({ age: 200 }, schema).valid).toBe(false);
    });

    it('should skip validation for optional missing fields', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'optional', type: 'string' }],
      };

      const result = processor.validateSchema({}, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle null values for optional fields', () => {
      const schema: DataSchema = {
        name: 'test',
        fields: [{ name: 'field', type: 'string' }],
      };

      const result = processor.validateSchema({ field: null }, schema);

      expect(result.valid).toBe(true);
    });
  });

  // ==================== transform ====================

  describe('transform', () => {
    const sampleData = [
      { name: 'Alice', age: 30, city: 'Beijing' },
      { name: 'Bob', age: 25, city: 'Shanghai' },
      { name: 'Charlie', age: 35, city: 'Beijing' },
    ];

    describe('filters', () => {
      it('should filter by eq', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'city', operator: 'eq', value: 'Beijing' }],
        });

        expect(result).toHaveLength(2);
      });

      it('should filter by neq', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'city', operator: 'neq', value: 'Beijing' }],
        });

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Bob');
      });

      it('should filter by gt', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'age', operator: 'gt', value: 28 }],
        });

        expect(result).toHaveLength(2);
      });

      it('should filter by gte', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'age', operator: 'gte', value: 30 }],
        });

        expect(result).toHaveLength(2);
      });

      it('should filter by lt', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'age', operator: 'lt', value: 30 }],
        });

        expect(result).toHaveLength(1);
      });

      it('should filter by lte', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'age', operator: 'lte', value: 30 }],
        });

        expect(result).toHaveLength(2);
      });

      it('should filter by in', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'city', operator: 'in', value: ['Beijing', 'Guangzhou'] }],
        });

        expect(result).toHaveLength(2);
      });

      it('should filter by contains', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'name', operator: 'contains', value: 'li' }],
        });

        expect(result).toHaveLength(2); // Alice, Charlie
      });

      it('should filter by regex', () => {
        const result = processor.transform(sampleData, {
          filters: [{ field: 'name', operator: 'regex', value: '^[AB]' }],
        });

        expect(result).toHaveLength(2); // Alice, Bob
      });

      it('should exclude records with undefined filtered field', () => {
        const data = [{ name: 'Alice' }, { name: 'Bob', age: 25 }];
        const result = processor.transform(data, {
          filters: [{ field: 'age', operator: 'gt', value: 20 }],
        });

        expect(result).toHaveLength(1);
      });

      it('should apply multiple filters', () => {
        const result = processor.transform(sampleData, {
          filters: [
            { field: 'city', operator: 'eq', value: 'Beijing' },
            { field: 'age', operator: 'gt', value: 32 },
          ],
        });

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Charlie');
      });
    });

    describe('mappings', () => {
      it('should map fields', () => {
        const result = processor.transform(sampleData, {
          mappings: [{ sourceField: 'name', targetField: 'fullName' }],
        });

        expect(result[0].fullName).toBe('Alice');
        expect(result[0].name).toBeUndefined();
      });

      it('should apply uppercase transform', () => {
        const result = processor.transform(sampleData, {
          mappings: [{ sourceField: 'name', targetField: 'name', transform: 'uppercase' }],
        });

        expect(result[0].name).toBe('ALICE');
      });

      it('should apply lowercase transform', () => {
        const result = processor.transform([{ name: 'ALICE' }], {
          mappings: [{ sourceField: 'name', targetField: 'name', transform: 'lowercase' }],
        });

        expect(result[0].name).toBe('alice');
      });

      it('should apply trim transform', () => {
        const result = processor.transform([{ name: '  Alice  ' }], {
          mappings: [{ sourceField: 'name', targetField: 'name', transform: 'trim' }],
        });

        expect(result[0].name).toBe('Alice');
      });

      it('should apply toInt transform', () => {
        const result = processor.transform([{ age: '30' }], {
          mappings: [{ sourceField: 'age', targetField: 'age', transform: 'toInt' }],
        });

        expect(result[0].age).toBe(30);
      });

      it('should apply toFloat transform', () => {
        const result = processor.transform([{ price: '19.99' }], {
          mappings: [{ sourceField: 'price', targetField: 'price', transform: 'toFloat' }],
        });

        expect(result[0].price).toBe(19.99);
      });

      it('should keep unmapped fields', () => {
        const result = processor.transform(sampleData, {
          mappings: [{ sourceField: 'name', targetField: 'fullName' }],
        });

        expect(result[0].age).toBe(30);
        expect(result[0].city).toBe('Beijing');
      });
    });

    describe('aggregations', () => {
      it('should sum values', () => {
        const data = [{ value: 10 }, { value: 20 }, { value: 30 }];
        const result = processor.transform(data, {
          aggregations: [{ field: 'value', operation: 'sum' }],
        });

        expect(result).toHaveLength(1);
        expect(result[0].value).toBe(60);
      });

      it('should calculate average', () => {
        const data = [{ value: 10 }, { value: 20 }, { value: 30 }];
        const result = processor.transform(data, {
          aggregations: [{ field: 'value', operation: 'avg' }],
        });

        expect(result[0].value).toBe(20);
      });

      it('should count values', () => {
        const data = [{ value: 10 }, { value: 20 }];
        const result = processor.transform(data, {
          aggregations: [{ field: 'value', operation: 'count' }],
        });

        expect(result[0].value).toBe(2);
      });

      it('should find min', () => {
        const data = [{ value: 30 }, { value: 10 }, { value: 20 }];
        const result = processor.transform(data, {
          aggregations: [{ field: 'value', operation: 'min' }],
        });

        expect(result[0].value).toBe(10);
      });

      it('should find max', () => {
        const data = [{ value: 10 }, { value: 30 }, { value: 20 }];
        const result = processor.transform(data, {
          aggregations: [{ field: 'value', operation: 'max' }],
        });

        expect(result[0].value).toBe(30);
      });

      it('should count distinct values', () => {
        const data = [{ value: 10 }, { value: 20 }, { value: 10 }];
        const result = processor.transform(data, {
          aggregations: [{ field: 'value', operation: 'distinct' }],
        });

        expect(result[0].value).toBe(2);
      });

      it('should aggregate with groupBy', () => {
        const data = [
          { city: 'Beijing', value: 10 },
          { city: 'Shanghai', value: 20 },
          { city: 'Beijing', value: 30 },
        ];
        const result = processor.transform(data, {
          aggregations: [{ field: 'value', operation: 'sum', groupBy: ['city'] }],
        });

        expect(result).toHaveLength(2);
        const beijing = result.find(r => r.city === 'Beijing');
        const shanghai = result.find(r => r.city === 'Shanghai');
        expect(beijing!.value).toBe(40);
        expect(shanghai!.value).toBe(20);
      });

      it('should return empty for empty data', () => {
        const result = processor.transform([], {
          aggregations: [{ field: 'value', operation: 'sum' }],
        });

        expect(result).toEqual([]);
      });
    });
  });

  // ==================== clear ====================

  describe('clear', () => {
    it('should clear processed records', () => {
      const schema: DataSchema = { name: 's', fields: [] };
      processor.processRecord({ a: 1 }, schema);
      processor.processRecord({ b: 2 }, schema);

      processor.clear();

      expect(processor.getProcessedRecords()).toEqual([]);
    });
  });
});
