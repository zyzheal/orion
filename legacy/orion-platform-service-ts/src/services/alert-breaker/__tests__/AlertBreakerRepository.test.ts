/**
 * AlertBreakerRepository Tests
 */
import { AlertBreakerRuleRepository, AlertBreakerStateRepository } from '../AlertBreakerRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();

describe('AlertBreakerRuleRepository', () => {
  let repo: AlertBreakerRuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AlertBreakerRuleRepository({ query: mockQuery });
  });

  describe('findEnabled', () => {
    it('should query enabled rules by tenant', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findEnabled('t-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('enabled = true'),
        ['t-1'],
      );
    });
  });

  describe('findByType', () => {
    it('should query by rule type', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findByType('t-1', 'dedup');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('rule_type = $2'),
        ['t-1', 'dedup'],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should parse JSON string fields', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'r-1', tenant_id: 't-1', name: 'Dedup', description: null,
          rule_type: 'dedup', match_conditions: '{"severity":"critical"}',
          config: '{"dedupWindowMinutes":5}', enabled: true, created_by: null,
          created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findEnabled('t-1');
      expect(result[0].matchConditions).toEqual({ severity: 'critical' });
      expect(result[0].config).toEqual({ dedupWindowMinutes: 5 });
    });

    it('should handle object fields directly', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'r-1', tenant_id: 't-1', name: 'Suppress', description: null,
          rule_type: 'suppress', match_conditions: { severity: 'warning' },
          config: { suppressStart: '22:00' }, enabled: true, created_by: null,
          created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findEnabled('t-1');
      expect(result[0].matchConditions).toEqual({ severity: 'warning' });
    });
  });
});

describe('AlertBreakerStateRepository', () => {
  let repo: AlertBreakerStateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AlertBreakerStateRepository({ query: mockQuery });
  });

  describe('findByRuleAndFingerprint', () => {
    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findByRuleAndFingerprint('r-1', 'fp-1');
      expect(result).toBeUndefined();
    });

    it('should return entity when found', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 's-1', tenant_id: 't-1', rule_id: 'r-1', alert_fingerprint: 'fp-1',
          state: 'open', suppressed_until: null, hit_count: 3, last_hit_at: new Date(),
          created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findByRuleAndFingerprint('r-1', 'fp-1');
      expect(result?.ruleId).toBe('r-1');
      expect(result?.hitCount).toBe(3);
    });
  });

  describe('findActiveByTenant', () => {
    it('should query for open and half-open states', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findActiveByTenant('t-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("state IN ('open', 'half-open')"),
        ['t-1'],
      );
    });
  });
});
