/**
 * PipelineTriggerService - Enhanced Run Tracking Tests (Task 6)
 *
 * Tests for: lastRunId, lastRunStatus, consecutiveFailures, timezone-aware cron.
 */

import {
  PipelineTriggerService,
  PipelineTriggerServiceError,
  type PipelineTriggerServiceOptions,
  type CreateTriggerInput,
  type TriggerExecutionStatus,
} from '../PipelineTriggerService';

describe('PipelineTriggerService - Enhanced Run Tracking', () => {
  let mockDb: any;
  let service: PipelineTriggerService;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    const options: PipelineTriggerServiceOptions = {
      db: mockDb,
    };
    service = new PipelineTriggerService(options);
  });

  // ==================== Trigger Interface ====================

  describe('Trigger interface - run tracking fields', () => {
    test('新 trigger 应初始化 consecutiveFailures 为 0', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      };

      const trigger = await service.registerTrigger(input);
      expect(trigger.consecutiveFailures).toBe(0);
      expect(trigger.lastRunId).toBeUndefined();
      expect(trigger.lastRunStatus).toBeUndefined();
      expect(trigger.lastRunAt).toBeUndefined();
    });

    test('从数据库加载时应映射 run tracking 字段', async () => {
      const mockRows = [
        {
          id: 'trigger-1',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          trigger_type: 'schedule',
          trigger_config: { cronExpression: '* * * * *' },
          status: 'active',
          last_run_id: 'run-123',
          last_run_status: 'success',
          last_run_at: new Date('2024-01-01T01:00:00Z'),
          consecutive_failures: 0,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      await service.initialize();

      const trigger = await service.getTrigger('trigger-1');
      expect(trigger).not.toBeNull();
      expect(trigger!.lastRunId).toBe('run-123');
      expect(trigger!.lastRunStatus).toBe('success');
      expect(trigger!.lastRunAt).toEqual(new Date('2024-01-01T01:00:00Z'));
      expect(trigger!.consecutiveFailures).toBe(0);
    });
  });

  // ==================== recordExecution ====================

  describe('recordExecution', () => {
    test('执行成功应记录 lastRunId 和 lastRunStatus', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      };
      const trigger = await service.registerTrigger(input);

      await service.recordExecution(trigger.id, 'run-abc-123', 'success');

      const updated = await service.getTrigger(trigger.id);
      expect(updated!.lastRunId).toBe('run-abc-123');
      expect(updated!.lastRunStatus).toBe('success');
      expect(updated!.lastRunAt).toBeDefined();
    });

    test('执行成功应重置 consecutiveFailures', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      };
      const trigger = await service.registerTrigger(input);

      // Simulate 3 failures
      for (let i = 0; i < 3; i++) {
        await service.recordFailure(trigger.id, `error-${i}`);
      }

      let current = await service.getTrigger(trigger.id);
      expect(current!.consecutiveFailures).toBe(3);

      // Now succeed
      await service.recordExecution(trigger.id, 'run-success', 'success');

      current = await service.getTrigger(trigger.id);
      expect(current!.consecutiveFailures).toBe(0);
      expect(current!.lastRunStatus).toBe('success');
    });

    test('应持久化 run tracking 到 PostgreSQL', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      };
      const trigger = await service.registerTrigger(input);

      mockDb.query.mockClear();
      await service.recordExecution(trigger.id, 'run-persist', 'success');

      const calls = mockDb.query.mock.calls;
      const updateCall = calls.find((call: any[]) =>
        String(call[0]).includes('UPDATE pipeline_triggers') &&
        String(call[0]).includes('last_run_id')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![0]).toContain('last_run_id');
      expect(updateCall![1]).toContain('run-persist');
      expect(updateCall![1]).toContain('success');
      expect(updateCall![1]).toContain(0);
      expect(updateCall![1]).toContain(trigger.id);
    });

    test('trigger 不存在时应静默返回', async () => {
      // Should not throw
      await expect(
        service.recordExecution('non-existent', 'run-1', 'success')
      ).resolves.toBeUndefined();
    });
  });

  // ==================== consecutiveFailures ====================

  describe('consecutiveFailures tracking', () => {
    test('连续失败应递增 counter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      };
      const trigger = await service.registerTrigger(input);

      await service.recordFailure(trigger.id, 'error-1');
      await service.recordFailure(trigger.id, 'error-2');
      await service.recordFailure(trigger.id, 'error-3');

      const current = await service.getTrigger(trigger.id);
      expect(current!.consecutiveFailures).toBe(3);
    });

    test('成功后应重置 consecutiveFailures 为 0', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '* * * * *' },
      };
      const trigger = await service.registerTrigger(input);

      // Fail 2 times
      await service.recordFailure(trigger.id, 'error-1');
      await service.recordFailure(trigger.id, 'error-2');

      let current = await service.getTrigger(trigger.id);
      expect(current!.consecutiveFailures).toBe(2);

      // Success resets counter
      await service.recordExecution(trigger.id, 'run-ok', 'success');

      current = await service.getTrigger(trigger.id);
      expect(current!.consecutiveFailures).toBe(0);
    });

    test('5 次连续失败后应标记 trigger 为 failed', async () => {
      const executionRecords: any[] = [];
      mockDb.query.mockImplementation(async (sql: string, params: any[] = []) => {
        const norm = sql.trim();
        if (/INSERT\s+INTO\s+pipeline_trigger_executions/i.test(norm)) {
          const row = {
            id: params[0], trigger_id: params[1], run_id: params[2],
            status: params[3], context_json: params[4], executed_at: params[5],
          };
          executionRecords.push(row);
          return { rows: [row], rowCount: 1 };
        }
        if (/SELECT.*FROM\s+pipeline_trigger_executions/i.test(norm) && /trigger_id/i.test(norm)) {
          const triggerId = params[0];
          const failures = executionRecords.filter(
            r => r.trigger_id === triggerId && r.status === 'failed'
          );
          return { rows: failures, rowCount: failures.length };
        }
        return { rows: [], rowCount: 0 };
      });

      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1', tenantId: 'tenant-1', type: 'schedule',
        config: { cronExpression: '* * * * *' },
      };
      const trigger = await service.registerTrigger(input);

      for (let i = 0; i < 5; i++) {
        await service.recordFailure(trigger.id, `error-${i}`);
      }

      const current = await service.getTrigger(trigger.id);
      expect(current!.status).toBe('failed');
      expect(current!.consecutiveFailures).toBe(5);
    });
  });

  // ==================== executeTrigger ====================

  describe('executeTrigger - run tracking', () => {
    test('执行 trigger 应生成 runId 并更新 lastRunId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'manual',
        config: {},
      };
      const trigger = await service.registerTrigger(input);

      mockDb.query.mockClear();
      const record = await service.executeTrigger(trigger.id);

      expect(record.runId).toBeDefined();
      expect(record.runId).toMatch(/^run-/);

      const updated = await service.getTrigger(trigger.id);
      expect(updated!.lastRunId).toBe(record.runId);
      expect(updated!.lastRunStatus).toBe('success');
    });
  });

  // ==================== Timezone Support ====================

  describe('timezone-aware cron scheduling', () => {
    test('应接受带 timezone 的 schedule trigger', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '0 9 * * *', timezone: 'Asia/Shanghai' },
      });

      const schedule = service.getCronSchedule(trigger.id);
      expect(schedule).toBeDefined();
      expect(schedule!.cronExpression).toBe('0 9 * * *');
    });

    test('timezone 配置应传递给 cron-parser', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      // This should not throw - Asia/Shanghai is a valid timezone
      await expect(
        service.registerTrigger({
          pipelineId: 'pipe-1',
          tenantId: 'tenant-1',
          type: 'schedule',
          config: { cronExpression: '0 9 * * *', timezone: 'Asia/Shanghai' },
        })
      ).resolves.toBeDefined();
    });

    test('无 timezone 配置时应正常调度', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const trigger = await service.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'schedule',
        config: { cronExpression: '0 9 * * *' },
      });

      const schedule = service.getCronSchedule(trigger.id);
      expect(schedule).toBeDefined();
    });
  });
});
