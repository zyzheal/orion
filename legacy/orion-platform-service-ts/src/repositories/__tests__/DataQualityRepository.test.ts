/**
 * DataQualityRepository Tests
 *
 * Tests for DataQualityRuleRepository and DataQualityCheckRepository
 */

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DataQualityRuleRepository, DataQualityCheckRepository } from '../DataQualityRepository';

function createMockDb() {
  const mockQuery = jest.fn();
  return { query: mockQuery, mockQuery };
}

describe('DataQualityRuleRepository', () => {
  let repo: DataQualityRuleRepository;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const db = createMockDb();
    mockQuery = db.mockQuery;
    repo = new DataQualityRuleRepository(db as any);
  });

  describe('findByTenant', () => {
    it('should find rules by tenant ID', async () => {
      const now = new Date();
      // First call: count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      // Second call: select query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'rule-1',
          tenant_id: 't1',
          name: 'Test Rule',
          table_name: 'users',
          column_name: 'email',
          rule_type: 'not_null',
          config: '{}',
          severity: 'warning',
          enabled: true,
          last_check_at: null,
          last_status: null,
          pass_rate: 0,
          created_at: now,
          updated_at: now,
        }],
        rowCount: 1,
      });

      const result = await repo.findByTenant({ tenantId: 't1' });

      expect(result.entities.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.entities[0].id).toBe('rule-1');
      expect(result.entities[0].tenantId).toBe('t1');
      expect(result.entities[0].name).toBe('Test Rule');
      expect(result.entities[0].ruleType).toBe('not_null');
    });

    it('should filter by table name', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 0 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await repo.findByTenant({ tenantId: 't1', tableName: 'orders' });

      expect(result.entities.length).toBe(0);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('table_name = $2'),
        expect.arrayContaining(['t1', 'orders']),
      );
    });

    it('should filter by enabled status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 0 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant({ tenantId: 't1', enabled: true });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('enabled = $2'),
        expect.arrayContaining(['t1', true]),
      );
    });

    it('should apply limit and offset', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 0 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant({ tenantId: 't1', limit: 10, offset: 20 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        expect.arrayContaining(['t1', 10, 20]),
      );
    });
  });

  describe('updateCheckResult', () => {
    it('should update rule check result', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'rule-1',
          tenant_id: 't1',
          name: 'Test Rule',
          table_name: 'users',
          column_name: null,
          rule_type: 'not_null',
          config: '{}',
          severity: 'warning',
          enabled: true,
          last_check_at: now,
          last_status: 'pass',
          pass_rate: 100,
          created_at: now,
          updated_at: now,
        }],
        rowCount: 1,
      });

      const result = await repo.updateCheckResult('rule-1', 'pass', 100);

      expect(result.lastStatus).toBe('pass');
      expect(result.passRate).toBe(100);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE data_quality_rules'),
        expect.arrayContaining(['pass', 100, 'rule-1']),
      );
    });

    it('should throw if rule not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(repo.updateCheckResult('nonexistent', 'pass', 100)).rejects.toThrow('Rule not found');
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case row to camelCase entity', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'rule-1',
          tenant_id: 't1',
          name: 'Test Rule',
          table_name: 'users',
          column_name: 'email',
          rule_type: 'range',
          config: '{"min": 0, "max": 100}',
          severity: 'error',
          enabled: false,
          last_check_at: now,
          last_status: 'fail',
          pass_rate: 75.5,
          created_at: now,
          updated_at: now,
        }],
        rowCount: 1,
      });

      const result = await repo.findByTenant({ tenantId: 't1' });
      const entity = result.entities[0];

      expect(entity.ruleType).toBe('range');
      expect(entity.tableName).toBe('users');
      expect(entity.columnName).toBe('email');
      expect(entity.lastCheckAt).toEqual(now);
      expect(entity.lastStatus).toBe('fail');
      expect(entity.passRate).toBe(75.5);
      expect(entity.config).toEqual({ min: 0, max: 100 });
      expect(entity.enabled).toBe(false);
    });

    it('should handle string config JSON', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'rule-1',
          tenant_id: 't1',
          name: 'Test',
          table_name: 't',
          column_name: null,
          rule_type: 'not_null',
          config: '{}',
          severity: 'info',
          enabled: true,
          last_check_at: null,
          last_status: null,
          pass_rate: 0,
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findByTenant({ tenantId: 't1' });
      expect(result.entities[0].config).toEqual({});
    });
  });
});

describe('DataQualityCheckRepository', () => {
  let repo: DataQualityCheckRepository;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const db = createMockDb();
    mockQuery = db.mockQuery;
    repo = new DataQualityCheckRepository(db as any);
  });

  describe('findByTenant', () => {
    it('should find checks by tenant ID', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'check-1',
          tenant_id: 't1',
          rule_id: 'rule-1',
          rule_name: 'Test Rule',
          status: 'pass',
          actual_value: '100',
          expected_value: 'non-null',
          details: null,
          checked_at: now,
        }],
        rowCount: 1,
      });

      const result = await repo.findByTenant('t1');

      expect(result.entities.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.entities[0].ruleId).toBe('rule-1');
    });

    it('should filter by rule ID', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 0 });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findByTenant('t1', 'rule-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('rule_id = $2'),
        expect.arrayContaining(['t1', 'rule-1']),
      );
    });
  });

  describe('findByRuleId', () => {
    it('should find checks by rule ID', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'check-1',
          tenant_id: 't1',
          rule_id: 'rule-1',
          rule_name: 'Test Rule',
          status: 'fail',
          actual_value: 'null',
          expected_value: 'non-null',
          details: 'Column contains null values',
          checked_at: now,
        }],
        rowCount: 1,
      });

      const result = await repo.findByRuleId('rule-1');

      expect(result.length).toBe(1);
      expect(result[0].status).toBe('fail');
      expect(result[0].details).toBe('Column contains null values');
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case row to camelCase entity', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'check-1',
          tenant_id: 't1',
          rule_id: 'rule-1',
          rule_name: 'Test Rule',
          status: 'error',
          actual_value: 'timeout',
          expected_value: 'result',
          details: 'Query timed out after 30s',
          checked_at: now,
        }],
        rowCount: 1,
      });

      const result = await repo.findByRuleId('rule-1');
      const entity = result[0];

      expect(entity.ruleId).toBe('rule-1');
      expect(entity.ruleName).toBe('Test Rule');
      expect(entity.actualValue).toBe('timeout');
      expect(entity.expectedValue).toBe('result');
      expect(entity.checkedAt).toEqual(now);
    });
  });
});
