/**
 * EventTriggerRepository Tests
 */
import { EventTriggerRuleRepository, EventTriggerLogRepository } from '../EventTriggerRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();

describe('EventTriggerRuleRepository', () => {
  let repo: EventTriggerRuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EventTriggerRuleRepository({ query: mockQuery });
  });

  describe('findEnabled', () => {
    it('should query enabled rules', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findEnabled('t-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('enabled = true'),
        ['t-1'],
      );
    });
  });

  describe('findByEventType', () => {
    it('should filter by event type', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findByEventType('t-1', 'deployment.completed');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('event_type = $2'),
        ['t-1', 'deployment.completed'],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should parse JSON string actions', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'r-1', tenant_id: 't-1', name: 'Auto-notify', description: null,
          event_type: 'alert.fired', match_conditions: '{"severity":"critical"}',
          actions: '[{"id":"a1","type":"notification","config":{},"order":1}]',
          enabled: true, cooldown_seconds: 300, last_triggered_at: null,
          created_by: null, created_at: new Date(), updated_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findEnabled('t-1');
      expect(result[0].actions).toHaveLength(1);
      expect(result[0].actions[0].type).toBe('notification');
      expect(result[0].cooldownSeconds).toBe(300);
    });
  });
});

describe('EventTriggerLogRepository', () => {
  let repo: EventTriggerLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EventTriggerLogRepository({ query: mockQuery });
  });

  describe('findByRuleId', () => {
    it('should query logs by rule id with limit', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findByRuleId('r-1', 10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('rule_id = $1'),
        ['r-1', 10],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should parse JSON payload and results', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'l-1', tenant_id: 't-1', rule_id: 'r-1', event_type: 'alert.fired',
          event_payload: '{"severity":"critical"}',
          action_results: '[{"actionId":"a1","actionType":"notification","status":"success","output":null,"error":null}]',
          status: 'success', triggered_at: new Date(), created_at: new Date(),
        }],
        rowCount: 1,
      });
      const result = await repo.findByRuleId('r-1');
      expect(result[0].eventPayload).toEqual({ severity: 'critical' });
      expect(result[0].actionResults).toHaveLength(1);
    });
  });
});
