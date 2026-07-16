/**
 * PipelineExecutionRepository 单元测试
 */

import { PipelineExecutionRepository } from '../PipelineExecutionRepository';
import { PipelineRunStatus } from '../../models/PipelineRun';

describe('PipelineExecutionRepository', () => {
  let repo: PipelineExecutionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new PipelineExecutionRepository(mockDb);
  });

  describe('save', () => {
    it('应该插入新的 pipeline execution', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.save({
        runId: 'run-1',
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        status: PipelineRunStatus.RUNNING,
        pendingStages: ['stage-1', 'stage-2'],
        runningStages: [],
        completedStages: [],
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_executions'),
        expect.arrayContaining(['run-1', 'pipe-1', 'tenant-1', 'running'])
      );
    });

    it('应该在冲突时更新现有记录', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.save({
        runId: 'run-1',
        pipelineId: 'pipe-1',
        tenantId: 'tenant-1',
        status: PipelineRunStatus.SUCCESS,
        pendingStages: [],
        runningStages: [],
        completedStages: ['stage-1'],
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (run_id) DO UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('findByRunId', () => {
    it('应该通过 runId 查找', async () => {
      const mockRow = {
        run_id: 'run-1',
        pipeline_id: 'pipe-1',
        tenant_id: 'tenant-1',
        status: 'running',
        pending_stages: ['s1'],
        running_stages: [],
        completed_stages: [],
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });
      const result = await repo.findByRunId('run-1');
      expect(result).not.toBeNull();
      expect(result!.run_id).toBe('run-1');
      expect(result!.pending_stages).toEqual(['s1']);
    });

    it('未找到时返回 null', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.findByRunId('not-exist');
      expect(result).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('应该通过 tenantId 查找运行中和排队的 executions', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await repo.findByTenant('tenant-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('running', 'pending')"),
        expect.any(Array)
      );
    });
  });

  describe('findByStatus', () => {
    it('应该按状态查找', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await repo.findByStatus('running');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = $1"),
        ['running']
      );
    });
  });

  describe('delete', () => {
    it('应该删除 execution 记录', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.delete('run-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM pipeline_executions WHERE run_id = $1',
        ['run-1']
      );
    });
  });
});
