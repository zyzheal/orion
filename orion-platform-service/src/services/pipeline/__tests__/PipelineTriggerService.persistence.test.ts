/**
 * PipelineTriggerService - Persistence Integration Tests
 * Tests for GAP-11: PostgreSQL persistence of triggers and execution history.
 */

import {
  PipelineTriggerService,
  PipelineTriggerServiceError,
  type PipelineTriggerServiceOptions,
  type CreateTriggerInput,
} from '../PipelineTriggerService';

describe('PipelineTriggerService - Persistence', () => {
  let mockDb: any;
  let service: PipelineTriggerService;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    const options: PipelineTriggerServiceOptions = {
      db: mockDb,
    };
    service = new PipelineTriggerService(options);
  });

  // ==================== Initialization ====================

  describe('initialize', () => {
    test('should load active triggers from PostgreSQL on startup', async () => {
      const mockRows = [
        {
          id: 'trigger-1',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          trigger_type: 'git',
          trigger_config: { branch: 'main' },
          status: 'active',
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'trigger-2',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-2',
          trigger_type: 'webhook',
          trigger_config: { webhookUrl: 'https://example.com/hook' },
          status: 'active',
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      await service.initialize();

      const trigger1 = await service.getTrigger('trigger-1');
      expect(trigger1).not.toBeNull();
      expect(trigger1!.type).toBe('git');
      expect(trigger1!.config.branch).toBe('main');

      const trigger2 = await service.getTrigger('trigger-2');
      expect(trigger2).not.toBeNull();
      expect(trigger2!.type).toBe('webhook');

      const triggers = await service.listTriggersByTenant('tenant-1');
      expect(triggers).toHaveLength(2);
    });

    test('should not load inactive triggers on startup', async () => {
      const mockRows = [
        {
          id: 'trigger-1',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          trigger_type: 'git',
          trigger_config: {},
          status: 'active',
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      await service.initialize();

      const triggers = await service.listTriggersByTenant('tenant-1');
      expect(triggers).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'active'"),
      );
    });

    test('should handle empty database on startup', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await service.initialize();

      const triggers = await service.listTriggersByTenant('tenant-any');
      expect(triggers).toHaveLength(0);
    });

    test('should gracefully handle DB connection failure on startup', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      // Should not throw - graceful degradation
      await expect(service.initialize()).resolves.toBeUndefined();
    });

    test('should skip initialization when no repository is configured', async () => {
      const noDbService = new PipelineTriggerService();
      await expect(noDbService.initialize()).resolves.toBeUndefined();
    });
  });

  // ==================== Persistence on Mutation ====================

  describe('registerTrigger - persistence', () => {
    test('should persist new trigger to PostgreSQL', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: { branch: 'main' },
      };

      const trigger = await service.registerTrigger(input);

      expect(trigger.id).toMatch(/^trigger-/);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_triggers'),
        expect.any(Array),
      );
    });

    test('should work even if DB insert fails (graceful degradation)', async () => {
      mockDb.query.mockRejectedValue(new Error('DB error'));

      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };

      // Should not throw - trigger still exists in memory
      const trigger = await service.registerTrigger(input);
      expect(trigger).toBeDefined();

      const found = await service.getTrigger(trigger.id);
      expect(found).not.toBeNull();
    });
  });

  describe('updateTrigger - persistence', () => {
    test('should persist trigger update to PostgreSQL', async () => {
      // First register a trigger (mock DB)
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: { branch: 'main' },
      };
      const created = await service.registerTrigger(input);

      // Now update
      mockDb.query.mockResolvedValue({ rows: [] });
      const updated = await service.updateTrigger(created.id, {
        status: 'inactive',
      });

      expect(updated.status).toBe('inactive');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pipeline_triggers SET'),
        expect.any(Array),
      );
    });
  });

  describe('updateTriggerStatus - persistence', () => {
    test('should persist status change to PostgreSQL', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);

      mockDb.query.mockResolvedValue({ rows: [] });
      await service.updateTriggerStatus(created.id, 'inactive');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pipeline_triggers SET'),
        expect.arrayContaining(['inactive', created.id]),
      );
    });
  });

  describe('deleteTrigger - persistence', () => {
    test('should delete trigger from PostgreSQL', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);

      mockDb.query.mockResolvedValue({ rowCount: 1 });
      await service.deleteTrigger(created.id);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pipeline_triggers'),
        [created.id],
      );

      const found = await service.getTrigger(created.id);
      expect(found).toBeNull();
    });
  });

  // ==================== Execution History Persistence ====================

  describe('executeTrigger - persistence', () => {
    test('should persist execution record to PostgreSQL', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);

      mockDb.query.mockResolvedValue({ rows: [] });
      const record = await service.executeTrigger(created.id);

      expect(record.status).toBe('success');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_trigger_executions'),
        expect.any(Array),
      );
    });
  });

  describe('recordFailure - persistence', () => {
    test('should persist failure record to PostgreSQL', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);

      mockDb.query.mockResolvedValue({ rows: [] });
      const record = await service.recordFailure(created.id, 'timeout error');

      expect(record.status).toBe('failed');
      expect(record.message).toBe('timeout error');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_trigger_executions'),
        expect.any(Array),
      );
    });

    test('should persist trigger status change to failed after 5 consecutive failures', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      };
      const created = await service.registerTrigger(input);

      mockDb.query.mockResolvedValue({ rows: [] });
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(created.id, `error-${i}`);
      }

      const trigger = await service.getTrigger(created.id);
      expect(trigger!.status).toBe('failed');

      // Should have persisted the status change
      const updateCalls = mockDb.query.mock.calls.filter(
        (call: any[]) => call[0].includes('UPDATE pipeline_triggers')
      );
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== Backward Compatibility ====================

  describe('Backward compatibility (no repository)', () => {
    test('should work without repository (in-memory only)', async () => {
      const noDbService = new PipelineTriggerService();

      const input: CreateTriggerInput = {
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: { branch: 'main' },
      };

      const trigger = await noDbService.registerTrigger(input);
      expect(trigger).toBeDefined();

      const found = await noDbService.getTrigger(trigger.id);
      expect(found).not.toBeNull();
      expect(found!.type).toBe('git');
    });

    test('should execute triggers without repository', async () => {
      const noDbService = new PipelineTriggerService();

      const created = await noDbService.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      });

      const record = await noDbService.executeTrigger(created.id);
      expect(record.status).toBe('success');

      const history = await noDbService.getTriggerHistory('pipe-1', 'tenant-1');
      expect(history).toHaveLength(1);
    });

    test('should support old constructor signature (callback only)', async () => {
      const callback = jest.fn();
      const serviceWithCallback = new PipelineTriggerService(callback);

      const created = await serviceWithCallback.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      });

      expect(created).toBeDefined();
    });

    test('should support new constructor signature (options object)', async () => {
      const callback = jest.fn();
      const options: PipelineTriggerServiceOptions = {
        db: mockDb,
        onTickCallback: callback,
      };
      const serviceWithOptions = new PipelineTriggerService(options);

      const created = await serviceWithOptions.registerTrigger({
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        type: 'git',
        config: {},
      });

      expect(created).toBeDefined();
    });
  });
});
