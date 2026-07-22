/**
 * TriggerRepository 单元测试
 * Tests CRUD operations for pipeline triggers and execution records.
 */

import {
  TriggerRepository,
  type TriggerEntity,
  type TriggerExecutionEntity,
} from '../TriggerRepository';

describe('TriggerRepository', () => {
  let repo: TriggerRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new TriggerRepository(mockDb);
  });

  // ==================== Trigger CRUD ====================

  describe('create (trigger)', () => {
    test('should create a trigger', async () => {
      const mockRow = {
        id: 'trigger-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        trigger_type: 'git',
        trigger_config: { branch: 'main' },
        status: 'active',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.create({
        id: 'trigger-1',
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        type: 'git',
        config: { branch: 'main' },
        status: 'active',
      });

      expect(result.id).toBe('trigger-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.pipelineId).toBe('pipe-1');
      expect(result.type).toBe('git');
      expect(result.config).toEqual({ branch: 'main' });
      expect(result.status).toBe('active');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_triggers'),
        expect.arrayContaining(['tenant-1', 'pipe-1', 'git']),
      );
      // Verify correct column names (snake_case)
      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs[0]).toContain('tenant_id');
      expect(callArgs[0]).toContain('pipeline_id');
      expect(callArgs[0]).toContain('trigger_type');
      expect(callArgs[0]).toContain('trigger_config');
    });
  });

  describe('findById', () => {
    test('should return trigger by ID', async () => {
      const mockRow = {
        id: 'trigger-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        trigger_type: 'webhook',
        trigger_config: { webhookUrl: 'https://example.com/hook' },
        status: 'active',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.findById('trigger-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('trigger-1');
      expect(result!.type).toBe('webhook');
      expect(result!.config.webhookUrl).toBe('https://example.com/hook');
    });

    test('should return undefined for non-existent trigger', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByTenant', () => {
    test('should return triggers for a tenant', async () => {
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
        {
          id: 'trigger-2',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-2',
          trigger_type: 'schedule',
          trigger_config: { cronExpression: '0 * * * *' },
          status: 'active',
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repo.findByTenant('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].tenantId).toBe('tenant-1');
      expect(result[1].tenantId).toBe('tenant-1');
    });

    test('should return empty array for tenant with no triggers', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByTenant('tenant-empty');

      expect(result).toHaveLength(0);
    });
  });

  describe('findByPipeline', () => {
    test('should return triggers for a specific pipeline', async () => {
      const mockRow = {
        id: 'trigger-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        trigger_type: 'git',
        trigger_config: { branch: 'main' },
        status: 'active',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.findByPipeline('tenant-1', 'pipe-1');

      expect(result).toHaveLength(1);
      expect(result[0].pipelineId).toBe('pipe-1');
      expect(result[0].tenantId).toBe('tenant-1');
    });
  });

  describe('findActiveTriggers', () => {
    test('should return only active triggers', async () => {
      const mockRows = [
        {
          id: 'trigger-1',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          trigger_type: 'schedule',
          trigger_config: { cronExpression: '0 * * * *' },
          status: 'active',
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repo.findActiveTriggers();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'active'"),
      );
    });
  });

  describe('updateStatus', () => {
    test('should update trigger status', async () => {
      const mockRow = {
        id: 'trigger-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        trigger_type: 'git',
        trigger_config: {},
        status: 'inactive',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.updateStatus('trigger-1', 'inactive');

      expect(result.status).toBe('inactive');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pipeline_triggers SET status = $1'),
        ['inactive', 'trigger-1'],
      );
    });

    test('should throw if trigger not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(repo.updateStatus('non-existent', 'inactive')).rejects.toThrow(
        'UPDATE on pipeline_triggers affected no rows'
      );
    });
  });

  describe('updateTriggerConfig', () => {
    test('should update trigger type and config', async () => {
      const mockRow = {
        id: 'trigger-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        trigger_type: 'webhook',
        trigger_config: { webhookUrl: 'https://example.com/hook' },
        status: 'active',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.updateTriggerConfig('trigger-1', 'webhook', {
        webhookUrl: 'https://example.com/hook',
      });

      expect(result.type).toBe('webhook');
      expect(result.config.webhookUrl).toBe('https://example.com/hook');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pipeline_triggers SET trigger_type = $1, trigger_config = $2'),
        expect.any(Array),
      );
    });
  });

  describe('delete', () => {
    test('should delete a trigger', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.delete('trigger-1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pipeline_triggers'),
        ['trigger-1', '__system__'],
      );
    });

    test('should return false if trigger not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== Execution Record CRUD ====================

  describe('saveExecutionRecord', () => {
    test('should save a successful execution record', async () => {
      const mockRow = {
        id: 'exec-1',
        trigger_id: 'trigger-1',
        run_id: 'run-1',
        status: 'success',
        context_json: {},
        created_at: new Date('2024-01-01T00:00:00Z'),
        executed_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.saveExecutionRecord({
        id: 'exec-1',
        triggerId: 'trigger-1',
        runId: 'run-1',
        status: 'success',
        contextJson: {},
        executedAt: new Date('2024-01-01T00:00:00Z'),
      });

      expect(result.id).toBe('exec-1');
      expect(result.triggerId).toBe('trigger-1');
      expect(result.status).toBe('success');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_trigger_executions'),
        expect.any(Array),
      );
    });

    test('should save a failed execution record with context', async () => {
      const mockRow = {
        id: 'exec-2',
        trigger_id: 'trigger-1',
        run_id: null,
        status: 'failed',
        context_json: { error: 'timeout' },
        created_at: new Date('2024-01-01T00:00:00Z'),
        executed_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.saveExecutionRecord({
        id: 'exec-2',
        triggerId: 'trigger-1',
        status: 'failed',
        contextJson: { error: 'timeout' },
        executedAt: new Date('2024-01-01T00:00:00Z'),
      });

      expect(result.status).toBe('failed');
      expect(result.contextJson).toEqual({ error: 'timeout' });
    });
  });

  describe('findExecutionHistory', () => {
    test('should return execution history for a trigger', async () => {
      const mockRows = [
        {
          id: 'exec-1',
          trigger_id: 'trigger-1',
          run_id: null,
          status: 'success',
          context_json: {},
          created_at: new Date('2024-01-01T00:00:00Z'),
          executed_at: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'exec-2',
          trigger_id: 'trigger-1',
          run_id: 'run-1',
          status: 'failed',
          context_json: { error: 'timeout' },
          created_at: new Date('2024-01-01T01:00:00Z'),
          executed_at: new Date('2024-01-01T01:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repo.findExecutionHistory('trigger-1');

      expect(result).toHaveLength(2);
      expect(result[0].triggerId).toBe('trigger-1');
      expect(result[0].status).toBe('success');
      expect(result[1].status).toBe('failed');
    });

    test('should return empty array for trigger with no history', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findExecutionHistory('trigger-no-history');

      expect(result).toHaveLength(0);
    });
  });

  describe('findRecentFailures', () => {
    test('should return recent failures within time window', async () => {
      const mockRows = [
        {
          id: 'exec-1',
          trigger_id: 'trigger-1',
          run_id: null,
          status: 'failed',
          context_json: { error: 'timeout' },
          created_at: new Date('2024-01-01T00:00:00Z'),
          executed_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const since = new Date('2024-01-01T00:00:00Z');
      const result = await repo.findRecentFailures('trigger-1', since);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('failed');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'failed'"),
        expect.any(Array),
      );
    });
  });

  describe('list (findAll)', () => {
    test('should list triggers with pagination', async () => {
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
      mockDb.query
        .mockResolvedValueOnce({ rows: mockRows })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.list({ limit: 10, offset: 0 });

      expect(result.entities).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('mapRowToEntity', () => {
    test('should map row with null config to empty object', () => {
      const row = {
        id: 'trigger-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        trigger_type: 'manual',
        trigger_config: null,
        status: 'active',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };

      const result = repo.mapRowToEntityPublic(row);

      expect(result.config).toEqual({});
    });

    test('should map row with null run_id', () => {
      const row = {
        id: 'exec-1',
        trigger_id: 'trigger-1',
        run_id: null,
        status: 'success',
        context_json: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        executed_at: new Date('2024-01-01T00:00:00Z'),
      };

      const result = repo.mapExecutionRowToEntityPublic(row);

      expect(result.runId).toBeNull();
      expect(result.contextJson).toEqual({});
    });
  });
});
