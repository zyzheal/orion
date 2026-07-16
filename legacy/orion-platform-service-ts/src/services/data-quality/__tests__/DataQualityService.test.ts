/**
 * DataQualityService 单元测试
 *
 * Uses mock PostgreSQL db pattern
 */

import { DataQualityService } from '../DataQualityService';
import { DataQualityRuleRepository, DataQualityCheckRepository } from '../../../repositories/DataQualityRepository';

// Mock PostgreSQL db
function createMockDb() {
  const tables: Record<string, any[]> = {
    data_quality_rules: [],
    data_quality_checks: [],
  };

  const db = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      const upperSql = sql.toUpperCase().trim();

      // INSERT into data_quality_rules (BaseRepository.create() does NOT include id)
      // Param order from service.createRule: tenantId, name, tableName, columnName, ruleType, config, severity, enabled, lastCheckAt, lastStatus, passRate
      if (upperSql.startsWith('INSERT INTO DATA_QUALITY_RULES')) {
        const generatedId = 'id-' + (tables.data_quality_rules.length + 1);
        const row = {
          id: generatedId,
          tenant_id: params?.[0],
          name: params?.[1],
          table_name: params?.[2],
          column_name: params?.[3],
          rule_type: params?.[4],
          config: params?.[5],
          severity: params?.[6],
          enabled: params?.[7],
          last_check_at: params?.[8] ?? null,
          last_status: params?.[9] ?? null,
          pass_rate: params?.[10] ?? 0,
          created_at: new Date(),
          updated_at: new Date(),
        };
        tables.data_quality_rules.push(row);
        return { rows: [row], rowCount: 1 };
      }

      // INSERT into data_quality_checks (BaseRepository.create() does NOT include id)
      // Param order from service: tenantId, ruleId, ruleName, status, actualValue, expectedValue, details
      if (upperSql.startsWith('INSERT INTO DATA_QUALITY_CHECKS')) {
        const generatedId = 'check-' + (tables.data_quality_checks.length + 1);
        const row = {
          id: generatedId,
          tenant_id: params?.[0],
          rule_id: params?.[1],
          rule_name: params?.[2],
          status: params?.[3],
          actual_value: params?.[4],
          expected_value: params?.[5],
          details: params?.[6],
          checked_at: new Date(),
        };
        tables.data_quality_checks.push(row);
        return { rows: [row], rowCount: 1 };
      }

      // SELECT COUNT for rules
      if (upperSql.includes('SELECT COUNT(*) AS COUNT') && upperSql.includes('DATA_QUALITY_RULES')) {
        const tenantId = params?.[0];
        const count = tables.data_quality_rules.filter(r => r.tenant_id === tenantId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      // SELECT COUNT for checks
      if (upperSql.includes('SELECT COUNT(*) AS COUNT') && upperSql.includes('DATA_QUALITY_CHECKS')) {
        const tenantId = params?.[0];
        const count = tables.data_quality_checks.filter(r => r.tenant_id === tenantId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }


      // SELECT rule by ID (BaseRepository.findById: WHERE id = $1 AND tenant_id = $2)
      // MUST come before tenant handler since findById SQL also contains TENANT_ID
      if (upperSql.includes('SELECT * FROM DATA_QUALITY_RULES WHERE ID')) {
        const id = params?.[0];
        const row = tables.data_quality_rules.find(r => r.id === id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT rules by tenant
      if (upperSql.includes('SELECT * FROM DATA_QUALITY_RULES') && upperSql.includes('TENANT_ID')) {
        const tenantId = params?.[0];
        const rows = tables.data_quality_rules.filter(r => r.tenant_id === tenantId);
        return { rows, rowCount: rows.length };
      }

      // SELECT checks by tenant
      if (upperSql.includes('SELECT * FROM DATA_QUALITY_CHECKS') && upperSql.includes('TENANT_ID')) {
        const tenantId = params?.[0];
        let rows = tables.data_quality_checks.filter(r => r.tenant_id === tenantId);
        if (upperSql.includes('RULE_ID') && params?.[1]) {
          rows = rows.filter(r => r.rule_id === params[1]);
        }
        return { rows, rowCount: rows.length };
      }




      // UPDATE rule check result
      if (upperSql.startsWith('UPDATE DATA_QUALITY_RULES') && upperSql.includes('LAST_CHECK_AT')) {
        const id = params?.[2];
        const row = tables.data_quality_rules.find(r => r.id === id);
        if (row) {
          row.last_check_at = new Date();
          row.last_status = params?.[0];
          row.pass_rate = params?.[1];
          row.updated_at = new Date();
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // UPDATE rule with check result
      if (upperSql.startsWith('UPDATE DATA_QUALITY_RULES') && upperSql.includes('LAST_CHECK_AT')) {
        const id = params?.[2];
        const row = tables.data_quality_rules.find(r => r.id === id);
        if (row) {
          row.last_check_at = new Date();
          row.last_status = params?.[0];
          row.pass_rate = params?.[1];
          row.updated_at = new Date();
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // UPDATE rule (general)
      if (upperSql.startsWith('UPDATE DATA_QUALITY_RULES')) {
        const id = params?.[params.length - 2];
        const row = tables.data_quality_rules.find(r => r.id === id);
        if (row) {
          // Parse SET clause to apply values
          const setMatch = upperSql.match(/SET\s+(.*?)\s+WHERE/s);
          if (setMatch) {
            const setClauses = setMatch[1].split(',').map(s => s.trim());
            let paramIdx = 0;
            for (const clause of setClauses) {
              if (clause.includes('NOW()') || clause.includes('UPDATED_AT')) continue;
              const colMatch = clause.match(/^(\w+)\s*=\s*\$/);
              if (colMatch && paramIdx < params!.length - 1) {
                const col = colMatch[1].toLowerCase();
                row[col] = params![paramIdx];
                paramIdx++;
              }
            }
          }
          row.updated_at = new Date();
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // DELETE rule
      if (upperSql.startsWith('DELETE FROM DATA_QUALITY_RULES')) {
        const id = params?.[0];
        const idx = tables.data_quality_rules.findIndex(r => r.id === id);
        if (idx >= 0) {
          tables.data_quality_rules.splice(idx, 1);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    }),
  };

  console.log = console.log || (() => {});
  const originalQuery = db.query;
  db.query = async (...args) => {
    const result = await originalQuery(...args);
    if (args[0].includes('DATA_QUALITY_RULES') && args[0].includes('WHERE')) {
      console.log('MOCK SQL:', args[0]);
      console.log('MOCK PARAMS:', args[1]);
      console.log('MOCK RESULT rows:', result.rows.length);
    }
    return result;
  };

  return { db, tables };
}

describe('DataQualityService', () => {
  let service: DataQualityService;
  let db: ReturnType<typeof createMockDb>['db'];
  let tables: ReturnType<typeof createMockDb>['tables'];

  beforeEach(() => {
    const mock = createMockDb();
    db = mock.db;
    tables = mock.tables;
    service = new DataQualityService(db as any);
  });

  describe('createRule', () => {
    it('should create a quality rule', async () => {
      const rule = await service.createRule({
        tenant_id: 't1',
        name: 'Email Not Null',
        table_name: 'users',
        column_name: 'email',
        rule_type: 'not_null',
        severity: 'error',
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Email Not Null');
      expect(rule.table_name).toBe('users');
      expect(rule.column_name).toBe('email');
      expect(rule.rule_type).toBe('not_null');
      expect(rule.severity).toBe('error');
      expect(rule.enabled).toBe(true);
      expect(rule.pass_rate).toBe(0);
    });

    it('should use default severity when not provided', async () => {
      const rule = await service.createRule({
        tenant_id: 't1',
        name: 'Test Rule',
        table_name: 'test_table',
        rule_type: 'unique',
      });

      expect(rule.severity).toBe('warning');
    });
  });

  describe('listRules', () => {
    it('should list rules for a tenant', async () => {
      await service.createRule({
        tenant_id: 't1',
        name: 'Rule 1',
        table_name: 'users',
        rule_type: 'not_null',
      });
      await service.createRule({
        tenant_id: 't1',
        name: 'Rule 2',
        table_name: 'orders',
        rule_type: 'unique',
      });

      const rules = await service.listRules('t1');

      expect(rules.length).toBe(2);
      expect(rules[0].name).toBeDefined();
    });

    it('should not return rules from other tenants', async () => {
      await service.createRule({
        tenant_id: 't1',
        name: 'Rule 1',
        table_name: 'users',
        rule_type: 'not_null',
      });

      const rules = await service.listRules('t2');

      expect(rules.length).toBe(0);
    });
  });

  describe('getRule', () => {
    it('should return a rule by ID', async () => {
      const created = await service.createRule({
        tenant_id: 't1',
        name: 'Test Rule',
        table_name: 'users',
        rule_type: 'not_null',
      });

      const rule = await service.getRule(created.id);

      expect(rule).toBeDefined();
      expect(rule!.name).toBe('Test Rule');
    });

    it('should return undefined for non-existent rule', async () => {
      const rule = await service.getRule('nonexistent');

      expect(rule).toBeUndefined();
    });
  });

  describe('updateRule', () => {
    it('should update a rule', async () => {
      const created = await service.createRule({
        tenant_id: 't1',
        name: 'Old Name',
        table_name: 'users',
        rule_type: 'not_null',
      });

      const updated = await service.updateRule(created.id, {
        name: 'New Name',
        severity: 'critical',
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('New Name');
      expect(updated!.severity).toBe('critical');
    });

    it('should return undefined for non-existent rule', async () => {
      const result = await service.updateRule('nonexistent', { name: 'Test' });

      expect(result).toBeUndefined();
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule', async () => {
      const created = await service.createRule({
        tenant_id: 't1',
        name: 'To Delete',
        table_name: 'users',
        rule_type: 'not_null',
      });

      const deleted = await service.deleteRule(created.id);

      expect(deleted).toBe(true);

      const rule = await service.getRule(created.id);
      expect(rule).toBeUndefined();
    });

    it('should return false for non-existent rule', async () => {
      const deleted = await service.deleteRule('nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('runCheck', () => {
    it('should run a check and create check record', async () => {
      const created = await service.createRule({
        tenant_id: 't1',
        name: 'Test Rule',
        table_name: 'users',
        rule_type: 'not_null',
      });

      const check = await service.runCheck(created.id);

      expect(check.id).toBeDefined();
      expect(check.rule_id).toBe(created.id);
      expect(check.rule_name).toBe('Test Rule');
      expect(check.status).toBe('pass');
    });

    it('should update rule status after check', async () => {
      const created = await service.createRule({
        tenant_id: 't1',
        name: 'Test Rule',
        table_name: 'users',
        rule_type: 'not_null',
      });

      await service.runCheck(created.id);

      const updated = await service.getRule(created.id);
      expect(updated!.last_status).toBe('pass');
      expect(updated!.pass_rate).toBe(100);
    });

    it('should throw for non-existent rule', async () => {
      await expect(service.runCheck('nonexistent')).rejects.toThrow('Rule not found');
    });
  });

  describe('listChecks', () => {
    it('should list checks for a tenant', async () => {
      const rule = await service.createRule({
        tenant_id: 't1',
        name: 'Test Rule',
        table_name: 'users',
        rule_type: 'not_null',
      });

      await service.runCheck(rule.id);

      const checks = await service.listChecks('t1');

      expect(checks.length).toBe(1);
      expect(checks[0].rule_id).toBe(rule.id);
    });

    it('should filter checks by rule ID', async () => {
      const rule1 = await service.createRule({
        tenant_id: 't1',
        name: 'Rule 1',
        table_name: 'users',
        rule_type: 'not_null',
      });
      const rule2 = await service.createRule({
        tenant_id: 't1',
        name: 'Rule 2',
        table_name: 'orders',
        rule_type: 'unique',
      });

      await service.runCheck(rule1.id);
      await service.runCheck(rule2.id);

      const checks = await service.listChecks('t1', rule1.id);

      expect(checks.length).toBe(1);
      expect(checks[0].rule_id).toBe(rule1.id);
    });
  });

  describe('DTO conversion', () => {
    it('should convert entity to DTO with snake_case fields', async () => {
      const rule = await service.createRule({
        tenant_id: 't1',
        name: 'Test Rule',
        table_name: 'users',
        column_name: 'email',
        rule_type: 'not_null',
        severity: 'error',
      });

      // DTO should use snake_case
      expect(rule.tenant_id).toBe('t1');
      expect(rule.table_name).toBe('users');
      expect(rule.column_name).toBe('email');
      expect(rule.rule_type).toBe('not_null');
      expect(rule.last_check_at).toBeNull();
      expect(rule.last_status).toBeNull();
      expect(rule.created_at).toBeDefined();
      expect(rule.updated_at).toBeDefined();
    });
  });
});
