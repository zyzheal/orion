/**
 * SelfHealingRepository - Unit Tests
 *
 * Tests for the database layer of self-healing operations.
 * Uses a mock database pool to verify SQL queries and data mapping.
 */

import { SelfHealingRepository, SelfHealingRule, SelfHealingExecution, HealingIncidentRow, ApprovalRequestRow } from '../SelfHealingRepository';

// ==================== Mock Database Pool ====================

function createMockPool() {
  const mockQuery = jest.fn();

  return {
    query: mockQuery,
  };
}

describe('SelfHealingRepository', () => {
  let repo: SelfHealingRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    mockPool = createMockPool();
    repo = new SelfHealingRepository(mockPool as any);
  });

  // ==================== Rules ====================

  describe('findRuleById', () => {
    it('should return rule when found', async () => {
      const mockRule: SelfHealingRule = {
        id: 'rule-1',
        tenant_id: 'tenant-1',
        name: 'Test Rule',
        trigger_condition: { metric: 'cpu' },
        action: { type: 'restart' },
        enabled: true,
        execution_count: 0,
        last_executed: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockRule], rowCount: 1 });

      const result = await repo.findRuleById('rule-1');
      expect(result).toEqual(mockRule);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM self_healing_rules WHERE id = $1',
        ['rule-1']
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findRuleById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findAllRules', () => {
    it('should return all rules without tenant filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'r1' }, { id: 'r2' }], rowCount: 2 });

      const result = await repo.findAllRules();
      expect(result.length).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM self_healing_rules ORDER BY created_at DESC',
        []
      );
    });

    it('should filter by tenantId when provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'r1' }], rowCount: 1 });

      await repo.findAllRules('tenant-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM self_healing_rules WHERE tenant_id = $1 ORDER BY created_at DESC',
        ['tenant-1']
      );
    });
  });

  describe('createRule', () => {
    it('should insert a new rule', async () => {
      const mockRule = { id: 'rule-new', name: 'New Rule' };
      mockPool.query.mockResolvedValue({ rows: [mockRule], rowCount: 1 });

      const result = await repo.createRule('tenant-1', 'New Rule', { metric: 'cpu' }, { type: 'restart' });
      expect(result).toEqual(mockRule);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO self_healing_rules'),
        ['tenant-1', 'New Rule', { metric: 'cpu' }, { type: 'restart' }]
      );
    });
  });

  describe('updateRule', () => {
    it('should update specified fields', async () => {
      const mockUpdated = { id: 'rule-1', name: 'Updated' };
      mockPool.query.mockResolvedValue({ rows: [mockUpdated], rowCount: 1 });

      const result = await repo.updateRule('rule-1', { name: 'Updated' });
      expect(result).toEqual(mockUpdated);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE self_healing_rules'),
        expect.arrayContaining(['Updated', 'rule-1'])
      );
    });

    it('should return existing rule when no updates provided', async () => {
      const existing = { id: 'rule-1', name: 'Existing' };
      mockPool.query.mockResolvedValue({ rows: [existing], rowCount: 1 });

      const result = await repo.updateRule('rule-1', {});
      expect(result).toEqual(existing);
    });

    it('should update multiple fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'rule-1' }], rowCount: 1 });

      await repo.updateRule('rule-1', {
        name: 'Updated Name',
        enabled: false,
        trigger_condition: { metric: 'memory' },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('name = $1'),
        expect.arrayContaining(['Updated Name', false, expect.any(String), 'rule-1'])
      );
    });
  });

  describe('deleteRule', () => {
    it('should return true when rule deleted', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await repo.deleteRule('rule-1');
      expect(result).toBe(true);
    });

    it('should return false when rule not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.deleteRule('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('incrementExecutionCount', () => {
    it('should execute increment query', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await repo.incrementExecutionCount('rule-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('execution_count = execution_count + 1'),
        ['rule-1']
      );
    });
  });

  // ==================== Executions ====================

  describe('createExecution', () => {
    it('should create a new execution', async () => {
      const mockExec = { id: 'exec-1', rule_id: 'rule-1', status: 'running' };
      mockPool.query.mockResolvedValue({ rows: [mockExec], rowCount: 1 });

      const result = await repo.createExecution('rule-1', { metric: 'cpu', value: 95 });
      expect(result).toEqual(mockExec);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO self_healing_executions'),
        ['rule-1', { metric: 'cpu', value: 95 }]
      );
    });
  });

  describe('completeExecution', () => {
    it('should update execution with result', async () => {
      const mockUpdated = { id: 'exec-1', status: 'success' };
      mockPool.query.mockResolvedValue({ rows: [mockUpdated], rowCount: 1 });

      const result = await repo.completeExecution('exec-1', 'success', { healed: true });
      expect(result).toEqual(mockUpdated);
    });

    it('should update execution with error message', async () => {
      const mockUpdated = { id: 'exec-1', status: 'failed' };
      mockPool.query.mockResolvedValue({ rows: [mockUpdated], rowCount: 1 });

      const result = await repo.completeExecution('exec-1', 'failed', undefined, 'Timeout');
      expect(result).toEqual(mockUpdated);
    });

    it('should return null for non-existent execution', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.completeExecution('non-existent', 'success');
      expect(result).toBeNull();
    });
  });

  describe('findExecutions', () => {
    it('should find executions by rule ID', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'exec-1' }, { id: 'exec-2' }],
        rowCount: 2,
      });

      const result = await repo.findExecutions('rule-1');
      expect(result.length).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE rule_id = $1'),
        ['rule-1', 10]
      );
    });

    it('should respect limit parameter', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findExecutions('rule-1', 5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['rule-1', 5]
      );
    });
  });

  // ==================== Incidents ====================

  describe('createIncident', () => {
    it('should create an incident', async () => {
      const mockRow: HealingIncidentRow = {
        id: 'inc-1',
        alert_id: 'alert-1',
        type: 'pod_crash',
        severity: 'warning',
        app_name: 'test-app',
        environment: 'dev',
        strategy_id: null,
        strategy_name: null,
        actions: [],
        status: 'new',
        attempts: 0,
        approval_status: null,
        approval_request_id: null,
        result: null,
        error: null,
        tags: null,
        started_at: new Date(),
        completed_at: null,
      };

      mockPool.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await repo.createIncident({
        alert_id: 'alert-1',
        type: 'pod_crash',
        severity: 'warning',
        app_name: 'test-app',
        environment: 'dev',
        actions: [],
        status: 'new',
      });

      expect(result).toEqual(mockRow);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO self_healing_incidents'),
        expect.arrayContaining(['alert-1', 'pod_crash', 'warning', 'test-app', 'dev'])
      );
    });

    it('should handle optional fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'inc-2' }],
        rowCount: 1,
      });

      await repo.createIncident({
        type: 'high_cpu',
        severity: 'critical',
        app_name: 'app',
        environment: 'prod',
        actions: [],
        status: 'evaluating',
        attempts: 1,
        approval_status: 'pending',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          null, // alert_id
          'high_cpu',
          'critical',
          'app',
          'prod',
          null, // strategy_id
          null, // strategy_name
          [],
          'evaluating',
          1,
          'pending',
          null, // approval_request_id
          null, // tags
        ])
      );
    });
  });

  describe('findIncidentById', () => {
    it('should return incident when found', async () => {
      const mockRow = { id: 'inc-1', type: 'pod_crash' };
      mockPool.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await repo.findIncidentById('inc-1');
      expect(result).toEqual(mockRow);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findIncidentById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findIncidents', () => {
    it('should query with pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 }) // COUNT query
        .mockResolvedValueOnce({ rows: [{ id: 'inc-1' }, { id: 'inc-2' }], rowCount: 2 }); // Data query

      const result = await repo.findIncidents({ limit: 2, offset: 0 });
      expect(result.total).toBe(10);
      expect(result.rows.length).toBe(2);
    });

    it('should build WHERE clause with filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'inc-1' }], rowCount: 1 });

      await repo.findIncidents({
        appName: 'test-app',
        environment: 'dev',
        type: 'pod_crash',
      });

      // First call is COUNT with WHERE clause
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['test-app', 'dev', 'pod_crash'])
      );
    });

    it('should handle date range filters', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await repo.findIncidents({ startDate, endDate });

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('started_at >= $'),
        expect.arrayContaining([startDate, endDate])
      );
    });
  });

  describe('updateIncident', () => {
    it('should update incident status', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'inc-1', status: 'healed' }], rowCount: 1 });

      const result = await repo.updateIncident('inc-1', { status: 'healed' });
      expect(result).toEqual({ id: 'inc-1', status: 'healed' });
    });

    it('should return existing incident when no updates', async () => {
      const existing = { id: 'inc-1' };
      mockPool.query.mockResolvedValue({ rows: [existing], rowCount: 1 });

      const result = await repo.updateIncident('inc-1', {});
      expect(result).toEqual(existing);
    });

    it('should update multiple fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'inc-1' }], rowCount: 1 });

      await repo.updateIncident('inc-1', {
        status: 'healed',
        attempts: 3,
        error: 'test error',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE self_healing_incidents'),
        expect.arrayContaining(['healed', 3, 'test error', 'inc-1'])
      );
    });
  });

  // ==================== Approvals ====================

  describe('createApprovalRequest', () => {
    it('should create an approval request', async () => {
      const mockRow: ApprovalRequestRow = {
        id: 'approval-1',
        incident_id: 'inc-1',
        title: 'Test Approval',
        description: 'Please approve',
        risk_level: 'high',
        recommended_actions: [],
        status: 'pending',
        requested_by: 'system',
        approved_by: null,
        approval_reason: null,
        requested_at: new Date(),
        responded_at: null,
        expires_at: null,
      };

      mockPool.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await repo.createApprovalRequest({
        incident_id: 'inc-1',
        title: 'Test Approval',
        risk_level: 'high',
        recommended_actions: [],
      });

      expect(result).toEqual(mockRow);
    });

    it('should use default values for optional fields', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'approval-1', status: 'pending', requested_by: 'system' }],
        rowCount: 1,
      });

      await repo.createApprovalRequest({
        incident_id: 'inc-1',
        title: 'Test',
        risk_level: 'low',
        recommended_actions: [],
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'inc-1',
          'Test',
          null, // description
          'low',
          [],
          'pending', // default status
          'system', // default requested_by
          null, // expires_at
        ])
      );
    });
  });

  describe('findApprovalById', () => {
    it('should return approval when found', async () => {
      const mockRow = { id: 'approval-1' };
      mockPool.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

      const result = await repo.findApprovalById('approval-1');
      expect(result).toEqual(mockRow);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findApprovalById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findApprovalsByStatus', () => {
    it('should return all approvals without status filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1' }, { id: 'a2' }], rowCount: 2 });

      const result = await repo.findApprovalsByStatus();
      expect(result.length).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM self_healing_approvals ORDER BY requested_at DESC'
      );
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'a1' }], rowCount: 1 });

      const result = await repo.findApprovalsByStatus('pending');
      expect(result.length).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM self_healing_approvals WHERE status = $1 ORDER BY requested_at DESC',
        ['pending']
      );
    });
  });

  describe('updateApprovalRequest', () => {
    it('should update approval status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'approval-1', status: 'approved' }],
        rowCount: 1,
      });

      const result = await repo.updateApprovalRequest('approval-1', {
        status: 'approved',
        approved_by: 'admin',
        approval_reason: 'Looks good',
        responded_at: new Date(),
      });

      expect(result).toEqual({ id: 'approval-1', status: 'approved' });
    });

    it('should return existing when no updates', async () => {
      const existing = { id: 'approval-1' };
      mockPool.query.mockResolvedValue({ rows: [existing], rowCount: 1 });

      const result = await repo.updateApprovalRequest('approval-1', {});
      expect(result).toEqual(existing);
    });
  });

  describe('markExpiredApprovals', () => {
    it('should mark expired approvals and return count', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 3 });

      const count = await repo.markExpiredApprovals();
      expect(count).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'expired'")
      );
    });

    it('should return 0 when no approvals expired', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const count = await repo.markExpiredApprovals();
      expect(count).toBe(0);
    });
  });
});
