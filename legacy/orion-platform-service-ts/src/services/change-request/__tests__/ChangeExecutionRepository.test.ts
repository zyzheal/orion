/**
 * ChangeExecutionRepository Tests
 * Covers listByChange, updateStatus, startStep, completeStep, failStep, getProgress, mapRowToEntity
 */
import { ChangeExecutionRepository } from '../ChangeExecutionRepository';

describe('ChangeExecutionRepository', () => {
  let mockDb: { query: jest.Mock };
  let repo: ChangeExecutionRepository;

  const snakeRow = {
    id: 'exec-1',
    tenant_id: 'tenant-1',
    change_request_id: 'cr-1',
    step_order: 1,
    step_name: 'Backup',
    step_type: 'manual',
    status: 'pending',
    started_at: null,
    completed_at: null,
    output: null,
    error: null,
    executed_by: null,
    created_at: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ChangeExecutionRepository(mockDb as any);
  });

  describe('listByChange', () => {
    it('should query by change_request_id ordered by step_order', async () => {
      mockDb.query.mockResolvedValue({ rows: [snakeRow] });
      const result = await repo.listByChange('cr-1');
      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('change_request_id = $1 ORDER BY step_order ASC'),
        ['cr-1'],
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status with output and error', async () => {
      const updatedRow = { ...snakeRow, status: 'completed', output: 'Done' };
      mockDb.query.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });
      const result = await repo.updateStatus('exec-1', 'completed', 'Done');
      expect(result?.status).toBe('completed');
      expect(result?.output).toBe('Done');
    });

    it('should return undefined when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.updateStatus('missing', 'completed');
      expect(result).toBeUndefined();
    });
  });

  describe('startStep', () => {
    it('should update to running with started_at and executed_by', async () => {
      const runningRow = { ...snakeRow, status: 'running', started_at: new Date(), executed_by: 'user-1' };
      mockDb.query.mockResolvedValue({ rows: [runningRow], rowCount: 1 });
      const result = await repo.startStep('exec-1', 'user-1');
      expect(result?.status).toBe('running');
      expect(result?.executedBy).toBe('user-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'running'"),
        ['user-1', 'exec-1'],
      );
    });

    it('should return undefined when not in pending status', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.startStep('exec-1');
      expect(result).toBeUndefined();
    });
  });

  describe('completeStep', () => {
    it('should update to completed with output', async () => {
      const completedRow = { ...snakeRow, status: 'completed', completed_at: new Date(), output: 'Success' };
      mockDb.query.mockResolvedValue({ rows: [completedRow], rowCount: 1 });
      const result = await repo.completeStep('exec-1', 'Success');
      expect(result?.status).toBe('completed');
      expect(result?.output).toBe('Success');
    });
  });

  describe('failStep', () => {
    it('should update to failed with error', async () => {
      const failedRow = { ...snakeRow, status: 'failed', completed_at: new Date(), error: 'Timeout' };
      mockDb.query.mockResolvedValue({ rows: [failedRow], rowCount: 1 });
      const result = await repo.failStep('exec-1', 'Timeout');
      expect(result?.status).toBe('failed');
      expect(result?.error).toBe('Timeout');
    });
  });

  describe('getProgress', () => {
    it('should return parsed progress counts', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ total: '5', completed: '3', failed: '1', pending: '1', running: '0' }],
      });
      const result = await repo.getProgress('cr-1');
      expect(result).toEqual({ total: 5, completed: 3, failed: 1, pending: 1, running: 0 });
    });
  });

  describe('mapRowToEntity', () => {
    it('should map all snake_case fields to camelCase', () => {
      const entity = (repo as any).mapRowToEntity(snakeRow);
      expect(entity.tenantId).toBe('tenant-1');
      expect(entity.changeRequestId).toBe('cr-1');
      expect(entity.stepOrder).toBe(1);
      expect(entity.stepName).toBe('Backup');
      expect(entity.stepType).toBe('manual');
    });

    it('should apply defaults for nullable fields', () => {
      const minimal = { ...snakeRow, step_type: null, status: null, started_at: null, completed_at: null, output: null, error: null, executed_by: null };
      const entity = (repo as any).mapRowToEntity(minimal);
      expect(entity.stepType).toBe('manual');
      expect(entity.status).toBe('pending');
      expect(entity.startedAt).toBeNull();
      expect(entity.completedAt).toBeNull();
      expect(entity.output).toBeNull();
      expect(entity.error).toBeNull();
      expect(entity.executedBy).toBeNull();
    });
  });
});
