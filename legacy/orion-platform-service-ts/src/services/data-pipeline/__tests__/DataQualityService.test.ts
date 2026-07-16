/**
 * DataQualityService Tests
 *
 * Covers: quality rule CRUD, rule toggle, data validation for all rule types,
 * validation history, quality scoring.
 */

import {
  DataQualityService,
  DataQualityRule,
  CreateQualityRuleInput,
} from '../DataQualityService';

describe('DataQualityService', () => {
  let service: DataQualityService;

  const baseRuleInput: CreateQualityRuleInput = {
    pipelineId: 'pipeline-001',
    name: 'email-not-null',
    ruleType: 'not_null',
    targetField: 'email',
    condition: {},
  };

  beforeEach(() => {
    service = new DataQualityService();
  });

  // ==================== createRule ====================

  describe('createRule', () => {
    it('should create a quality rule with default severity', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      expect(rule.id).toBeDefined();
      expect(rule.tenantId).toBe('tenant-1');
      expect(rule.pipelineId).toBe('pipeline-001');
      expect(rule.name).toBe('email-not-null');
      expect(rule.ruleType).toBe('not_null');
      expect(rule.targetField).toBe('email');
      expect(rule.severity).toBe('warning');
      expect(rule.enabled).toBe(true);
      expect(rule.createdBy).toBe('user-1');
      expect(rule.createdAt).toBeInstanceOf(Date);
    });

    it('should create a rule with custom severity', async () => {
      const rule = await service.createRule('tenant-1', {
        ...baseRuleInput,
        severity: 'critical',
      }, 'user-1');

      expect(rule.severity).toBe('critical');
    });

    it('should create a rule with optional fields', async () => {
      const rule = await service.createRule('tenant-1', {
        ...baseRuleInput,
        stageId: 'stage-1',
        description: 'Email must not be null',
      }, 'user-1');

      expect(rule.stageId).toBe('stage-1');
      expect(rule.description).toBe('Email must not be null');
    });

    it('should support all rule types', async () => {
      const ruleTypes: Array<'not_null' | 'unique' | 'range' | 'pattern' | 'custom' | 'referential' | 'completeness'> =
        ['not_null', 'unique', 'range', 'pattern', 'custom', 'referential', 'completeness'];

      for (const type of ruleTypes) {
        const rule = await service.createRule('tenant-1', {
          ...baseRuleInput,
          ruleType: type,
          name: `rule-${type}`,
        }, 'user-1');
        expect(rule.ruleType).toBe(type);
      }
    });

    it('should support all severity levels', async () => {
      const severities: Array<'critical' | 'warning' | 'info'> = ['critical', 'warning', 'info'];

      for (const severity of severities) {
        const rule = await service.createRule('tenant-1', {
          ...baseRuleInput,
          severity,
          name: `rule-${severity}`,
        }, 'user-1');
        expect(rule.severity).toBe(severity);
      }
    });
  });

  // ==================== getRules ====================

  describe('getRules', () => {
    it('should return all rules for a pipeline', async () => {
      await service.createRule('tenant-1', { ...baseRuleInput, name: 'rule-1' }, 'user-1');
      await service.createRule('tenant-1', { ...baseRuleInput, name: 'rule-2' }, 'user-1');
      await service.createRule('tenant-1', { ...baseRuleInput, name: 'rule-3', pipelineId: 'pipeline-002' }, 'user-1');

      const rules = await service.getRules('tenant-1', 'pipeline-001');
      expect(rules.length).toBe(2);
    });

    it('should return empty array when no rules exist', async () => {
      const rules = await service.getRules('tenant-1', 'non-existent');
      expect(rules).toEqual([]);
    });

    it('should enforce tenant isolation', async () => {
      await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const rules = await service.getRules('tenant-2', 'pipeline-001');
      expect(rules).toEqual([]);
    });
  });

  // ==================== getRule ====================

  describe('getRule', () => {
    it('should return a rule by ID', async () => {
      const created = await service.createRule('tenant-1', baseRuleInput, 'user-1');
      const found = await service.getRule(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent rule', async () => {
      const found = await service.getRule('non-existent');
      expect(found).toBeNull();
    });
  });

  // ==================== updateRule ====================

  describe('updateRule', () => {
    it('should update rule name', async () => {
      const created = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const updated = await service.updateRule(created.id, { name: 'updated-name' }, 'user-2');
      expect(updated.name).toBe('updated-name');
    });

    it('should update rule condition', async () => {
      const created = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const updated = await service.updateRule(created.id, {
        condition: { min: 1, max: 100 },
      }, 'user-1');
      expect(updated.condition).toEqual({ min: 1, max: 100 });
    });

    it('should throw for non-existent rule', async () => {
      await expect(
        service.updateRule('non-existent', { name: 'new' }, 'user-1')
      ).rejects.toThrow("Quality rule 'non-existent' not found");
    });
  });

  // ==================== toggleRule ====================

  describe('toggleRule', () => {
    it('should disable an enabled rule', async () => {
      const created = await service.createRule('tenant-1', baseRuleInput, 'user-1');
      expect(created.enabled).toBe(true);

      const toggled = await service.toggleRule(created.id);
      expect(toggled.enabled).toBe(false);
    });

    it('should enable a disabled rule', async () => {
      const created = await service.createRule('tenant-1', baseRuleInput, 'user-1');
      await service.toggleRule(created.id); // disable

      const toggled = await service.toggleRule(created.id); // enable
      expect(toggled.enabled).toBe(true);
    });

    it('should throw for non-existent rule', async () => {
      await expect(
        service.toggleRule('non-existent')
      ).rejects.toThrow("Quality rule 'non-existent' not found");
    });
  });

  // ==================== deleteRule ====================

  describe('deleteRule', () => {
    it('should delete an existing rule', async () => {
      const created = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const deleted = await service.deleteRule(created.id);
      expect(deleted).toBe(true);

      const found = await service.getRule(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent rule', async () => {
      const deleted = await service.deleteRule('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ==================== validateData - not_null ====================

  describe('validateData - not_null', () => {
    it('should pass when all records have non-null values', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const result = await service.validateData(rule.id, [
        { email: 'a@b.com' },
        { email: 'c@d.com' },
        { email: 'e@f.com' },
      ]);

      expect(result.status).toBe('passed');
      expect(result.totalRecords).toBe(3);
      expect(result.passedRecords).toBe(3);
      expect(result.failedRecords).toBe(0);
      expect(result.failureRate).toBe(0);
      expect(result.failureSamples).toEqual([]);
    });

    it('should fail when records have null/empty values', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const result = await service.validateData(rule.id, [
        { email: 'a@b.com' },
        { email: null },
        { email: '' },
        { email: undefined },
      ]);

      expect(result.status).toBe('warning'); // warning severity
      expect(result.passedRecords).toBe(1);
      expect(result.failedRecords).toBe(3);
      expect(result.failureRate).toBe(0.75);
      expect(result.failureSamples.length).toBeGreaterThan(0);
    });

    it('should fail with "failed" status for critical severity', async () => {
      const rule = await service.createRule('tenant-1', {
        ...baseRuleInput,
        severity: 'critical',
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { email: null },
      ]);

      expect(result.status).toBe('failed');
    });
  });

  // ==================== validateData - range ====================

  describe('validateData - range', () => {
    it('should pass when values are within range', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'age-range',
        pipelineId: 'pipeline-001',
        ruleType: 'range',
        targetField: 'age',
        condition: { min: 18, max: 65 },
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { age: 25 },
        { age: 18 },
        { age: 65 },
        { age: 30 },
      ]);

      expect(result.status).toBe('passed');
      expect(result.passedRecords).toBe(4);
    });

    it('should fail when values are outside range', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'age-range',
        pipelineId: 'pipeline-001',
        ruleType: 'range',
        targetField: 'age',
        condition: { min: 18, max: 65 },
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { age: 17 },
        { age: 66 },
        { age: 30 },
      ]);

      expect(result.passedRecords).toBe(1);
      expect(result.failedRecords).toBe(2);
    });
  });

  // ==================== validateData - pattern ====================

  describe('validateData - pattern', () => {
    it('should pass when values match pattern', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'email-pattern',
        pipelineId: 'pipeline-001',
        ruleType: 'pattern',
        targetField: 'email',
        condition: { pattern: '^[\\w]+@[\\w]+\\.[\\w]+$' },
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { email: 'user@example.com' },
        { email: 'admin@test.org' },
      ]);

      expect(result.status).toBe('passed');
    });

    it('should fail when values do not match pattern', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'email-pattern',
        pipelineId: 'pipeline-001',
        ruleType: 'pattern',
        targetField: 'email',
        condition: { pattern: '^[\\w]+@[\\w]+\\.[\\w]+$' },
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { email: 'valid@example.com' },
        { email: 'invalid-email' },
      ]);

      expect(result.passedRecords).toBe(1);
      expect(result.failedRecords).toBe(1);
    });
  });

  // ==================== validateData - completeness ====================

  describe('validateData - completeness', () => {
    it('should pass when field completeness meets threshold', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'completeness-check',
        pipelineId: 'pipeline-001',
        ruleType: 'completeness',
        targetField: '_all',
        condition: { fields: ['name', 'email', 'age'], threshold: 0.9 },
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { name: 'Alice', email: 'a@b.com', age: 30 },
        { name: 'Bob', email: 'b@b.com', age: 25 },
      ]);

      expect(result.status).toBe('passed');
    });

    it('should fail when field completeness is below threshold', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'completeness-check',
        pipelineId: 'pipeline-001',
        ruleType: 'completeness',
        targetField: '_all',
        condition: { fields: ['name', 'email', 'age'], threshold: 1.0 },
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { name: 'Alice', email: 'a@b.com' }, // missing age
      ]);

      expect(result.status).toBe('warning');
      expect(result.passedRecords).toBe(0);
    });
  });

  // ==================== validateData - unique ====================

  describe('validateData - unique', () => {
    it('should pass when field is defined', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'unique-id',
        pipelineId: 'pipeline-001',
        ruleType: 'unique',
        targetField: 'id',
        condition: {},
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { id: '1' },
        { id: '2' },
      ]);

      expect(result.status).toBe('passed');
    });
  });

  // ==================== validateData - custom ====================

  describe('validateData - custom', () => {
    it('should always pass for custom rule type', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'custom-rule',
        pipelineId: 'pipeline-001',
        ruleType: 'custom',
        targetField: 'data',
        condition: {},
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { data: 'anything' },
      ]);

      expect(result.status).toBe('passed');
    });
  });

  // ==================== validateData - referential ====================

  describe('validateData - referential', () => {
    it('should pass when field is defined', async () => {
      const rule = await service.createRule('tenant-1', {
        name: 'ref-check',
        pipelineId: 'pipeline-001',
        ruleType: 'referential',
        targetField: 'foreign_id',
        condition: {},
      }, 'user-1');

      const result = await service.validateData(rule.id, [
        { foreign_id: 'ref-1' },
      ]);

      expect(result.status).toBe('passed');
    });
  });

  // ==================== validateData - edge cases ====================

  describe('validateData - edge cases', () => {
    it('should throw for non-existent rule', async () => {
      await expect(
        service.validateData('non-existent', [{ data: 'test' }])
      ).rejects.toThrow("Quality rule 'non-existent' not found");
    });

    it('should throw for disabled rule', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');
      await service.toggleRule(rule.id); // disable

      await expect(
        service.validateData(rule.id, [{ email: 'test@example.com' }])
      ).rejects.toThrow('Rule is disabled');
    });

    it('should handle empty data array', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const result = await service.validateData(rule.id, []);

      expect(result.totalRecords).toBe(0);
      expect(result.passedRecords).toBe(0);
      expect(result.failedRecords).toBe(0);
      expect(result.failureRate).toBe(0);
    });

    it('should limit failure samples to 5', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const data = Array.from({ length: 10 }, (_, i) => ({ email: null }));
      const result = await service.validateData(rule.id, data);

      expect(result.failureSamples.length).toBeLessThanOrEqual(5);
    });

    it('should include executionId in result', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const result = await service.validateData(rule.id, [
        { email: 'a@b.com' },
      ], 'exec-123');

      expect(result.executionId).toBe('exec-123');
    });

    it('should record durationMs', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      const result = await service.validateData(rule.id, [
        { email: 'a@b.com' },
      ]);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== getValidationHistory ====================

  describe('getValidationHistory', () => {
    it('should return all validation results', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      await service.validateData(rule.id, [{ email: 'a@b.com' }]);
      await service.validateData(rule.id, [{ email: null }]);

      const history = service.getValidationHistory();
      expect(history.length).toBe(2);
    });

    it('should filter by pipelineId', async () => {
      const rule1 = await service.createRule('tenant-1', {
        ...baseRuleInput,
        pipelineId: 'pipeline-001',
      }, 'user-1');
      const rule2 = await service.createRule('tenant-1', {
        ...baseRuleInput,
        pipelineId: 'pipeline-002',
      }, 'user-1');

      await service.validateData(rule1.id, [{ email: 'a@b.com' }]);
      await service.validateData(rule2.id, [{ email: 'a@b.com' }]);

      const pipeline001History = service.getValidationHistory('pipeline-001');
      expect(pipeline001History.length).toBe(1);
    });

    it('should limit to last 100 results', async () => {
      const rule = await service.createRule('tenant-1', baseRuleInput, 'user-1');

      for (let i = 0; i < 120; i++) {
        await service.validateData(rule.id, [{ email: `test${i}@example.com` }]);
      }

      const history = service.getValidationHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });
});
