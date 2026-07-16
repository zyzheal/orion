/**
 * ProcessInstanceRepository Tests - Database layer for process instances and step instances
 * Covers query generation, parameter binding, JSON serialization, and tenant isolation
 */

import { ProcessInstanceRepository, ProcessInstance, ProcessStepInstance } from '../ProcessInstanceRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

describe('ProcessInstanceRepository', () => {
  let mockPool: { query: jest.Mock };
  let repo: ProcessInstanceRepository;

  const mockInstanceRow: ProcessInstance = {
    id: 'proc-1',
    tenant_id: 'test-tenant',
    definition_id: 'def-1',
    definition_snapshot: { steps: [] },
    entity_type: 'ticket',
    entity_id: 'ticket-1',
    current_step_id: 'step-1',
    status: 'running',
    started_at: new Date('2026-01-01'),
    completed_at: null,
    created_by: 'user-1',
    updated_at: new Date('2026-01-01'),
  };

  const mockStepRow: ProcessStepInstance = {
    id: 'step-inst-1',
    tenant_id: 'test-tenant',
    instance_id: 'proc-1',
    step_id: 'step-1',
    step_name: 'Approval',
    step_type: 'approval',
    handler_key: 'approval-handler',
    status: 'pending',
    input_data: null,
    output_data: null,
    started_at: null,
    completed_at: null,
    operator: null,
    comment: null,
    created_at: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new ProcessInstanceRepository(mockPool as any);
  });

  // ==================== findInstanceById ====================

  describe('findInstanceById', () => {
    it('should return instance when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockInstanceRow], rowCount: 1 });

      const result = await repo.findInstanceById('proc-1');

      expect(result).toEqual(mockInstanceRow);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM process_instances WHERE id = $1',
        ['proc-1'],
      );
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findInstanceById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== findInstances ====================

  describe('findInstances', () => {
    it('should build dynamic WHERE with all optional filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockInstanceRow] });

      const result = await repo.findInstances({
        definitionId: 'def-1',
        entityType: 'ticket',
        entityId: 'ticket-1',
        status: 'running',
      });

      expect(result.total).toBe(1);
      // Count query
      const countSql = mockPool.query.mock.calls[0][0];
      expect(countSql).toContain('tenant_id = $1');
      expect(countSql).toContain('definition_id = $2');
      expect(countSql).toContain('entity_type = $3');
      expect(countSql).toContain('entity_id = $4');
      expect(countSql).toContain('status = $5');
      const countParams = mockPool.query.mock.calls[0][1];
      expect(countParams).toEqual(['test-tenant', 'def-1', 'ticket', 'ticket-1', 'running']);
    });

    it('should use default limit 20 and offset 0', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.findInstances();

      const dataCall = mockPool.query.mock.calls[1];
      expect(dataCall[0]).toContain('LIMIT $2 OFFSET $3');
      expect(dataCall[1]).toEqual(['test-tenant', 20, 0]);
    });
  });

  // ==================== createInstance ====================

  describe('createInstance', () => {
    it('should stringify definition_snapshot and use default status', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockInstanceRow], rowCount: 1 });

      const result = await repo.createInstance({
        definition_id: 'def-1',
        definition_snapshot: { steps: [] },
        entity_type: 'ticket',
        entity_id: 'ticket-1',
      });

      expect(result).toEqual(mockInstanceRow);
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[2]).toBe(JSON.stringify({ steps: [] }));
      expect(params[6]).toBe('running'); // default status
      expect(params[7]).toBeNull();       // default created_by
    });
  });

  // ==================== updateInstance ====================

  describe('updateInstance', () => {
    it('should generate SET clauses and append updated_at', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockInstanceRow], rowCount: 1 });

      await repo.updateInstance('proc-1', {
        current_step_id: 'step-2',
        status: 'completed',
      });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('current_step_id = $1');
      expect(sql).toContain('status = $2');
      expect(sql).toContain('updated_at = NOW()');
      expect(sql).toContain('WHERE id = $3');
      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['step-2', 'completed', 'proc-1']);
    });

    it('should fall back to findInstanceById when no fields provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockInstanceRow], rowCount: 1 });

      await repo.updateInstance('proc-1', {});

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM process_instances WHERE id = $1',
        ['proc-1'],
      );
    });
  });

  // ==================== findStepByInstanceIdAndStepId ====================

  describe('findStepByInstanceIdAndStepId', () => {
    it('should query with instance_id and step_id, limiting to 1', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockStepRow], rowCount: 1 });

      const result = await repo.findStepByInstanceIdAndStepId('proc-1', 'step-1');

      expect(result).toEqual(mockStepRow);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM process_step_instances WHERE instance_id = $1 AND step_id = $2 ORDER BY created_at DESC LIMIT 1',
        ['proc-1', 'step-1'],
      );
    });

    it('should return null when no step found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findStepByInstanceIdAndStepId('proc-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==================== createStep ====================

  describe('createStep', () => {
    it('should stringify input_data and use default status', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockStepRow], rowCount: 1 });

      const result = await repo.createStep({
        instance_id: 'proc-1',
        step_id: 'step-1',
        step_name: 'Approval',
        step_type: 'approval',
        input_data: { approver: 'admin' },
      });

      expect(result).toEqual(mockStepRow);
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[6]).toBe('pending');                           // default status
      expect(params[7]).toBe(JSON.stringify({ approver: 'admin' })); // input_data serialized
    });
  });

  // ==================== updateStep ====================

  describe('updateStep', () => {
    it('should stringify output_data and generate dynamic SET clauses', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockStepRow], rowCount: 1 });

      await repo.updateStep('step-inst-1', {
        status: 'completed',
        output_data: { approved: true },
        comment: 'LGTM',
      });

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toContain('status = $1');
      expect(sql).toContain('output_data = $2');
      expect(sql).toContain('comment = $3');
      expect(sql).toContain('WHERE id = $4');
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('completed');
      expect(params[1]).toBe(JSON.stringify({ approved: true }));
      expect(params[2]).toBe('LGTM');
      expect(params[3]).toBe('step-inst-1');
    });
  });
});
