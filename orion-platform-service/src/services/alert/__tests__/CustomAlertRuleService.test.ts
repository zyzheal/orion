/**
 * Tests for CustomAlertRuleService
 */

import { CustomAlertRuleService, CreateRuleInput, RuleFilters } from '../CustomAlertRuleService';

// camelCase to snake_case helper
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
}

// In-memory store for mock db
let ruleStore: Map<string, any>;

function createMockDb() {
  ruleStore = new Map();
  const db = {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      // INSERT ... RETURNING *
      if (sql.includes('INSERT INTO custom_alert_rules')) {
        const colsMatch = sql.match(/\(([^)]+)\)/);
        const cols = colsMatch ? colsMatch[1].split(', ').map((c) => c.trim()) : [];
        const row: any = {};
        cols.forEach((col, i) => {
          row[toSnakeCase(col)] = params?.[i];
        });
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at) row.updated_at = new Date();
        ruleStore.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }
      // UPDATE ... last_evaluated_at / last_triggered_at (updateEvaluationTimestamp)
      if (sql.includes('UPDATE custom_alert_rules') && sql.includes('last_evaluated_at')) {
        const id = params?.[params.length - 1];
        const existing = ruleStore.get(id);
        if (!existing) return { rows: [], rowCount: 0 };
        existing.last_evaluated_at = params?.[0];
        if (sql.includes('last_triggered_at')) {
          existing.last_triggered_at = params?.[0];
        }
        ruleStore.set(id, existing);
        return { rows: [existing], rowCount: 1 };
      }
      // UPDATE ... SET ... WHERE id = $N RETURNING * (BaseRepository.update)
      if (sql.includes('UPDATE custom_alert_rules')) {
        const id = params?.[params.length - 1];
        const existing = ruleStore.get(id);
        if (!existing) return { rows: [], rowCount: 0 };
        const setMatch = sql.match(/SET (.+?) WHERE/);
        if (setMatch) {
          const assignments = setMatch[1].split(', ');
          let paramIdx = 0;
          for (const assignment of assignments) {
            const colRaw = assignment.split(' = ')[0].trim();
            const col = toSnakeCase(colRaw);
            if (col === 'updated_at') {
              existing[col] = new Date();
            } else {
              existing[col] = params?.[paramIdx];
              paramIdx++;
            }
          }
        }
        ruleStore.set(id, existing);
        return { rows: [existing], rowCount: 1 };
      }
      // DELETE FROM custom_alert_rules WHERE id = $1
      if (sql.includes('DELETE FROM custom_alert_rules')) {
        const id = params?.[0];
        const existed = ruleStore.has(id);
        if (existed) ruleStore.delete(id);
        return { rows: [], rowCount: existed ? 1 : 0 };
      }
      // SELECT ... WHERE id = $1
      if (sql.includes('WHERE id = $1')) {
        const id = params?.[0];
        const row = ruleStore.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT ... WHERE tenant_id = $1 (with optional filters)
      if (sql.includes('WHERE tenant_id = $1')) {
        const tenantId = params?.[0];
        let rows = Array.from(ruleStore.values()).filter((r) => r.tenant_id === tenantId);
        // Apply filters from SQL
        let paramIdx = 1;
        if (sql.includes('rule_type')) {
          paramIdx++;
          const ruleType = params?.[1];
          rows = rows.filter((r) => r.rule_type === ruleType);
        }
        if (sql.includes('severity') && params?.length > paramIdx) {
          const severity = params?.[paramIdx];
          rows = rows.filter((r) => r.severity === severity);
        }
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
  return db;
}

describe('CustomAlertRuleService', () => {
  let service: CustomAlertRuleService;
  let mockDb: ReturnType<typeof createMockDb>;
  const tenantId = 'test-tenant-001';

  beforeEach(() => {
    mockDb = createMockDb();
    service = new CustomAlertRuleService(mockDb as any);
  });

  // ==================== createRule ====================

  describe('createRule', () => {
    it('should create a threshold rule', async () => {
      const input: CreateRuleInput = {
        name: 'High CPU',
        ruleType: 'threshold',
        condition: {
          metric: 'cpu_usage',
          operator: '>',
          threshold: 90,
        },
        severity: 'critical',
      };

      const rule = await service.createRule(tenantId, input);

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('High CPU');
      expect(rule.ruleType).toBe('threshold');
      expect(rule.severity).toBe('critical');
      expect(rule.enabled).toBe(true);
      expect(rule.tenantId).toBe(tenantId);
    });

    it('should create a trend rule', async () => {
      const input: CreateRuleInput = {
        name: 'Memory Growth',
        ruleType: 'trend',
        condition: {
          metric: 'memory_usage',
          direction: 'increasing',
          rateOfChange: 15,
          windowSec: 300,
        },
        severity: 'warning',
      };

      const rule = await service.createRule(tenantId, input);

      expect(rule.ruleType).toBe('trend');
      expect(rule.condition).toMatchObject({ direction: 'increasing' });
    });

    it('should create a composite rule', async () => {
      const input: CreateRuleInput = {
        name: 'System Overload',
        ruleType: 'composite',
        condition: {
          expression: 'rule_0 AND rule_1',
          subConditions: [
            { metric: 'cpu_usage', operator: '>', threshold: 80 },
            { metric: 'memory_usage', operator: '>', threshold: 85 },
          ],
        },
        severity: 'critical',
        notificationChannels: [
          { type: 'email', target: 'ops@example.com' },
          { type: 'slack', target: '#alerts' },
        ],
      };

      const rule = await service.createRule(tenantId, input);

      expect(rule.ruleType).toBe('composite');
      expect(rule.notificationChannels).toHaveLength(2);
    });

    it('should throw error for invalid threshold condition', async () => {
      const input = {
        name: 'Bad Rule',
        ruleType: 'threshold' as const,
        condition: { metric: 'cpu' }, // missing operator and threshold
        severity: 'warning' as const,
      };

      await expect(service.createRule(tenantId, input)).rejects.toThrow(
        'Threshold condition requires metric, operator, and threshold',
      );
    });

    it('should throw error for invalid trend condition', async () => {
      const input = {
        name: 'Bad Trend',
        ruleType: 'trend' as const,
        condition: { metric: 'cpu', direction: 'increasing' }, // missing rateOfChange and windowSec
        severity: 'warning' as const,
      };

      await expect(service.createRule(tenantId, input)).rejects.toThrow(
        'Trend condition requires metric, direction, rateOfChange, and windowSec',
      );
    });

    it('should throw error for invalid composite condition', async () => {
      const input = {
        name: 'Bad Composite',
        ruleType: 'composite' as const,
        condition: { expression: 'rule_0' }, // missing subConditions
        severity: 'warning' as const,
      };

      await expect(service.createRule(tenantId, input)).rejects.toThrow(
        'Composite condition requires expression and subConditions',
      );
    });
  });

  // ==================== getRules ====================

  describe('getRules', () => {
    beforeEach(async () => {
      await service.createRule(tenantId, {
        name: 'Rule 1',
        ruleType: 'threshold',
        condition: { metric: 'cpu', operator: '>', threshold: 90 },
        severity: 'critical',
      });
      await service.createRule(tenantId, {
        name: 'Rule 2',
        ruleType: 'trend',
        condition: { metric: 'memory', direction: 'increasing', rateOfChange: 10, windowSec: 300 },
        severity: 'warning',
        enabled: false as any,
      } as CreateRuleInput);
      await service.createRule('other-tenant', {
        name: 'Rule 3',
        ruleType: 'threshold',
        condition: { metric: 'disk', operator: '>', threshold: 95 },
        severity: 'critical',
      });
    });

    it('should return rules for the tenant', async () => {
      const rules = await service.getRules(tenantId);
      expect(rules.length).toBe(2);
    });

    it('should filter by ruleType', async () => {
      const rules = await service.getRules(tenantId, { ruleType: 'threshold' });
      expect(rules.length).toBe(1);
      expect(rules[0].name).toBe('Rule 1');
    });

    it('should filter by severity', async () => {
      const rules = await service.getRules(tenantId, { severity: 'warning' });
      expect(rules.length).toBe(1);
    });

    it('should not return rules from other tenants', async () => {
      const rules = await service.getRules('other-tenant');
      expect(rules.length).toBe(1);

      const tenantRules = await service.getRules(tenantId);
      expect(tenantRules.some((r) => r.name === 'Rule 3')).toBe(false);
    });
  });

  // ==================== getRuleById ====================

  describe('getRuleById', () => {
    it('should return a rule by ID', async () => {
      const created = await service.createRule(tenantId, {
        name: 'Test Rule',
        ruleType: 'threshold',
        condition: { metric: 'cpu', operator: '>', threshold: 90 },
        severity: 'critical',
      });

      const rule = await service.getRuleById(created.id);
      expect(rule).toBeDefined();
      expect(rule!.name).toBe('Test Rule');
    });

    it('should return undefined for non-existent rule', async () => {
      const rule = await service.getRuleById('non-existent');
      expect(rule).toBeUndefined();
    });
  });

  // ==================== updateRule ====================

  describe('updateRule', () => {
    it('should update rule name', async () => {
      const created = await service.createRule(tenantId, {
        name: 'Old Name',
        ruleType: 'threshold',
        condition: { metric: 'cpu', operator: '>', threshold: 90 },
        severity: 'warning',
      });

      const updated = await service.updateRule(created.id, { name: 'New Name' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('New Name');
    });

    it('should disable a rule', async () => {
      const created = await service.createRule(tenantId, {
        name: 'Rule',
        ruleType: 'threshold',
        condition: { metric: 'cpu', operator: '>', threshold: 90 },
        severity: 'warning',
      });

      const updated = await service.updateRule(created.id, { enabled: false });
      expect(updated!.enabled).toBe(false);
    });

    it('should return undefined for non-existent rule', async () => {
      const result = await service.updateRule('non-existent', { name: 'New' });
      expect(result).toBeUndefined();
    });
  });

  // ==================== deleteRule ====================

  describe('deleteRule', () => {
    it('should delete a rule', async () => {
      const created = await service.createRule(tenantId, {
        name: 'To Delete',
        ruleType: 'threshold',
        condition: { metric: 'cpu', operator: '>', threshold: 90 },
        severity: 'warning',
      });

      const deleted = await service.deleteRule(created.id);
      expect(deleted).toBe(true);

      const rule = await service.getRuleById(created.id);
      expect(rule).toBeUndefined();
    });

    it('should return false for non-existent rule', async () => {
      const result = await service.deleteRule('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== evaluateRule ====================

  describe('evaluateRule', () => {
    it('should trigger threshold rule when condition is met', async () => {
      const created = await service.createRule(tenantId, {
        name: 'High CPU',
        ruleType: 'threshold',
        condition: { metric: 'cpu_usage', operator: '>', threshold: 90 },
        severity: 'critical',
      });

      const result = await service.evaluateRule(created.id, 95);
      expect(result.triggered).toBe(true);
      expect(result.currentValue).toBe(95);
      expect(result.message).toContain('cpu_usage');
    });

    it('should not trigger threshold rule when condition is not met', async () => {
      const created = await service.createRule(tenantId, {
        name: 'High CPU',
        ruleType: 'threshold',
        condition: { metric: 'cpu_usage', operator: '>', threshold: 90 },
        severity: 'critical',
      });

      const result = await service.evaluateRule(created.id, 50);
      expect(result.triggered).toBe(false);
    });

    it('should not evaluate disabled rules', async () => {
      const created = await service.createRule(tenantId, {
        name: 'Disabled Rule',
        ruleType: 'threshold',
        condition: { metric: 'cpu_usage', operator: '>', threshold: 90 },
        severity: 'critical',
      });

      await service.updateRule(created.id, { enabled: false });

      const result = await service.evaluateRule(created.id, 99);
      expect(result.triggered).toBe(false);
      expect(result.message).toBe('Rule is disabled');
    });

    it('should respect cooldown period', async () => {
      const created = await service.createRule(tenantId, {
        name: 'Cooldown Rule',
        ruleType: 'threshold',
        condition: { metric: 'cpu_usage', operator: '>', threshold: 90 },
        severity: 'critical',
        cooldownSec: 3600,
      });

      // First evaluation should trigger
      const result1 = await service.evaluateRule(created.id, 95);
      expect(result1.triggered).toBe(true);

      // Second evaluation should be in cooldown
      const result2 = await service.evaluateRule(created.id, 99);
      expect(result2.triggered).toBe(false);
      expect(result2.message).toBe('Rule is in cooldown period');
    });

    it('should throw error for non-existent rule', async () => {
      await expect(service.evaluateRule('non-existent', 95)).rejects.toThrow('not found');
    });

    it('should evaluate composite rules', async () => {
      const created = await service.createRule(tenantId, {
        name: 'Composite',
        ruleType: 'composite',
        condition: {
          expression: 'rule_0 AND rule_1',
          subConditions: [
            { metric: 'cpu', operator: '>', threshold: 80 },
            { metric: 'memory', operator: '>', threshold: 70 },
          ],
        },
        severity: 'critical',
      });

      // Set metric values
      service.setMetricValue('cpu', 90);
      service.setMetricValue('memory', 80);

      const result = await service.evaluateRule(created.id);
      expect(result.triggered).toBe(true);
    });
  });
});
