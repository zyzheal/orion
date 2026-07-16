/**
 * PipelineAuditLogService Tests
 */

import { PipelineAuditLogService, type PipelineAuditLogServiceOptions } from '../PipelineAuditLogService';

describe('PipelineAuditLogService', () => {
  let mockDb: any;
  let service: PipelineAuditLogService;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    const options: PipelineAuditLogServiceOptions = { db: mockDb };
    service = new PipelineAuditLogService(options);
  });

  // ==================== record ====================

  describe('record', () => {
    test('should record a stage event', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-1', tenant_id: 't-1', run_id: 'run-1', stage_id: 'stage-1',
        task_id: null, action: 'stage.start', actor: 'system', outcome: 'success',
        duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
        metadata: {}, created_at: new Date(),
      }], rowCount: 1 });

      const log = await service.record({
        tenantId: 't-1', runId: 'run-1', stageId: 'stage-1',
        action: 'stage.start', actor: 'system', outcome: 'success',
      });

      expect(log.id).toBe('audit-1');
      expect(log.action).toBe('stage.start');
      expect(log.actor).toBe('system');
      expect(log.outcome).toBe('success');
    });

    test('should record a task event with input/output summary', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-2', tenant_id: 't-1', run_id: 'run-1', stage_id: 's-1', task_id: 'task-1',
        action: 'task.complete', actor: 'system', outcome: 'success',
        duration_ms: 1500, input_summary: { image: 'myapp:1.0' }, output_summary: { result: 'ok' },
        error_message: null, metadata: {}, created_at: new Date(),
      }], rowCount: 1 });

      const log = await service.record({
        tenantId: 't-1', runId: 'run-1', stageId: 's-1', taskId: 'task-1',
        action: 'task.complete', actor: 'system', outcome: 'success',
        durationMs: 1500,
        inputSummary: { image: 'myapp:1.0' },
        outputSummary: { result: 'ok' },
      });

      expect(log.taskId).toBe('task-1');
      expect(log.durationMs).toBe(1500);
      expect(log.inputSummary).toEqual({ image: 'myapp:1.0' });
      expect(log.outputSummary).toEqual({ result: 'ok' });
    });

    test('should record a failed event with error message', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-3', tenant_id: 't-1', run_id: 'run-1', stage_id: null, task_id: null,
        action: 'stage.fail', actor: 'system', outcome: 'failed',
        duration_ms: null, input_summary: {}, output_summary: {},
        error_message: 'Connection timeout', metadata: {}, created_at: new Date(),
      }], rowCount: 1 });

      const log = await service.record({
        tenantId: 't-1', runId: 'run-1',
        action: 'stage.fail', actor: 'system', outcome: 'failed',
        errorMessage: 'Connection timeout',
      });

      expect(log.errorMessage).toBe('Connection timeout');
      expect(log.outcome).toBe('failed');
    });
  });

  // ==================== Convenience Methods ====================

  describe('recordStageEvent', () => {
    test('should record stage.start event', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-s1', tenant_id: 't-1', run_id: 'run-1', stage_id: 'stage-1',
        task_id: null, action: 'stage.start', actor: 'system', outcome: 'pending',
        duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
        metadata: {}, created_at: new Date(),
      }], rowCount: 1 });

      const log = await service.recordStageEvent({
        tenantId: 't-1', runId: 'run-1', stageId: 'stage-1',
        action: 'start', actor: 'system', outcome: 'pending',
      });

      expect(log.action).toBe('stage.start');
      expect(log.stageId).toBe('stage-1');
    });
  });

  describe('recordTaskEvent', () => {
    test('should record task.complete event', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-t1', tenant_id: 't-1', run_id: 'run-1', stage_id: 's-1', task_id: 't-1',
        action: 'task.complete', actor: 'system', outcome: 'success',
        duration_ms: 500, input_summary: {}, output_summary: { exitCode: 0 },
        error_message: null, metadata: {}, created_at: new Date(),
      }], rowCount: 1 });

      const log = await service.recordTaskEvent({
        tenantId: 't-1', runId: 'run-1', stageId: 's-1', taskId: 't-1',
        action: 'complete', actor: 'system', outcome: 'success',
        durationMs: 500, outputSummary: { exitCode: 0 },
      });

      expect(log.action).toBe('task.complete');
      expect(log.taskId).toBe('t-1');
    });
  });

  describe('recordApprovalEvent', () => {
    test('should record approval.approve event', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-a1', tenant_id: 't-1', run_id: 'run-1', stage_id: 's-1',
        task_id: null, action: 'approval.approve', actor: 'user-123', outcome: 'success',
        duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
        metadata: { approver: 'user-123' }, created_at: new Date(),
      }], rowCount: 1 });

      const log = await service.recordApprovalEvent({
        tenantId: 't-1', runId: 'run-1', stageId: 's-1',
        action: 'approve', actor: 'user-123', outcome: 'success',
        metadata: { approver: 'user-123' },
      });

      expect(log.action).toBe('approval.approve');
      expect(log.actor).toBe('user-123');
    });
  });

  describe('recordRunEvent', () => {
    test('should record run.create event', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-r1', tenant_id: 't-1', run_id: 'run-1', stage_id: null, task_id: null,
        action: 'run.create', actor: 'trigger', outcome: 'pending',
        duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
        metadata: {}, created_at: new Date(),
      }], rowCount: 1 });

      const log = await service.recordRunEvent({
        tenantId: 't-1', runId: 'run-1',
        action: 'create', actor: 'trigger', outcome: 'pending',
      });

      expect(log.action).toBe('run.create');
      expect(log.actor).toBe('trigger');
    });
  });

  // ==================== Querying ====================

  describe('query', () => {
    test('should query audit logs by runId', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{
          id: 'audit-1', tenant_id: 't-1', run_id: 'run-1', stage_id: null, task_id: null,
          action: 'run.create', actor: 'trigger', outcome: 'pending',
          duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
          metadata: {}, created_at: new Date(),
        }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

      const result = await service.query({ tenantId: 't-1', runId: 'run-1' });

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.logs[0].runId).toBe('run-1');
    });

    test('should return empty result when no matches', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const result = await service.query({ tenantId: 't-1', runId: 'nonexistent' });

      expect(result.logs).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    test('should support pagination with limit/offset', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      await service.query({ tenantId: 't-1', limit: 10, offset: 20 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('getRunAuditTrail', () => {
    test('should get audit trail for a specific run', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{
          id: 'a1', tenant_id: 't-1', run_id: 'run-1', stage_id: 's-1', task_id: null,
          action: 'stage.start', actor: 'system', outcome: 'success',
          duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
          metadata: {}, created_at: new Date(),
        }, {
          id: 'a2', tenant_id: 't-1', run_id: 'run-1', stage_id: 's-1', task_id: 't-1',
          action: 'task.complete', actor: 'system', outcome: 'success',
          duration_ms: 100, input_summary: {}, output_summary: {}, error_message: null,
          metadata: {}, created_at: new Date(),
        }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 });

      const trail = await service.getRunAuditTrail('t-1', 'run-1');

      expect(trail).toHaveLength(2);
      expect(trail[0].action).toBe('stage.start');
      expect(trail[1].action).toBe('task.complete');
    });
  });

  // ==================== Batch Recording ====================

  describe('recordBatch', () => {
    test('should record multiple entries efficiently', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'audit-b1', tenant_id: 't-1', run_id: 'run-1', stage_id: null, task_id: null,
        action: 'stage.start', actor: 'system', outcome: 'success',
        duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
        metadata: {}, created_at: new Date(),
      }, {
        id: 'audit-b2', tenant_id: 't-1', run_id: 'run-1', stage_id: null, task_id: null,
        action: 'task.start', actor: 'system', outcome: 'pending',
        duration_ms: null, input_summary: {}, output_summary: {}, error_message: null,
        metadata: {}, created_at: new Date(),
      }], rowCount: 2 });

      const logs = await service.recordBatch([
        { tenantId: 't-1', runId: 'run-1', action: 'stage.start', actor: 'system', outcome: 'success' },
        { tenantId: 't-1', runId: 'run-1', action: 'task.start', actor: 'system', outcome: 'pending' },
      ]);

      expect(logs).toHaveLength(2);
      expect(logs[0].action).toBe('stage.start');
      expect(logs[1].action).toBe('task.start');
    });
  });

  // ==================== Maintenance ====================

  describe('cleanupExpired', () => {
    test('should delete old audit logs', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 42 });

      const count = await service.cleanupExpired(30);

      expect(count).toBe(42);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pipeline_audit_logs'),
        expect.any(Array)
      );
    });
  });

  // ==================== Error Handling ====================

  describe('without repository', () => {
    test('should throw when recording without repository', async () => {
      const noDbService = new PipelineAuditLogService();
      await expect(
        noDbService.record({
          tenantId: 't-1', runId: 'run-1', action: 'stage.start', actor: 'system', outcome: 'success',
        })
      ).rejects.toThrow('NO_REPOSITORY');
    });

    test('should throw when querying without repository', async () => {
      const noDbService = new PipelineAuditLogService();
      await expect(
        noDbService.query({})
      ).rejects.toThrow('NO_REPOSITORY');
    });
  });
});
