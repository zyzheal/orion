/**
 * PipelineRunRepository - 数据仓库层单元测试
 *
 * 测试覆盖: 流水线运行CRUD、状态更新、阶段执行、任务执行
 */

import { PipelineRunRepository } from '../PipelineRunRepository';

describe('PipelineRunRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: PipelineRunRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new PipelineRunRepository(mockDb as any);
  });

  // ==================== Pipeline Runs ====================

  describe('findById', () => {
    it('should return run by id with tenant isolation', async () => {
      const mockRun = { id: 'run-1', pipeline_id: 'p1', status: 'completed' };
      mockDb.query.mockResolvedValue({ rows: [mockRun] });

      const result = await repository.findById('run-1', 'tenant-1');

      expect(result).toEqual(mockRun);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM pipeline_runs WHERE id = $1 AND tenant_id = $2', ['run-1', 'tenant-1']);
    });

    it('should return null when run not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('non-existent', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all runs without filter', async () => {
      const mockRuns = [{ id: 'r1' }, { id: 'r2' }];
      mockDb.query.mockResolvedValue({ rows: mockRuns });

      const result = await repository.findAll();

      expect(result).toEqual(mockRuns);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ tenantId: 't1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t1']
      );
    });

    it('should filter by pipelineId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ pipelineId: 'p1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_id = $1'),
        ['p1']
      );
    });

    it('should filter by single status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ status: 'running' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['running']
      );
    });

    it('should filter by multiple statuses', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ status: ['running', 'pending'] });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status IN ($1, $2)'),
        ['running', 'pending']
      );
    });

    it('should filter by triggerType', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ triggerType: 'webhook' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('trigger_type = $1'),
        ['webhook']
      );
    });

    it('should filter by since date', async () => {
      const since = new Date('2026-01-01');
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ since });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= $1'),
        [since]
      );
    });

    it('should apply limit and offset', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ limit: 10, offset: 20 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 20]
      );
    });

    it('should combine multiple filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({
        tenantId: 't1',
        pipelineId: 'p1',
        status: 'running',
        limit: 5,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1 AND pipeline_id = $2 AND status = $3'),
        ['t1', 'p1', 'running', 5]
      );
    });
  });

  describe('count', () => {
    it('should return total count without filter', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await repository.count();

      expect(result).toBe(42);
    });

    it('should return filtered count', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await repository.count({ pipelineId: 'p1', status: 'completed' });

      expect(result).toBe(5);
    });
  });

  describe('create', () => {
    it('should create a run with all fields', async () => {
      const mockRun = {
        id: 'run-1',
        tenant_id: 't1',
        pipeline_id: 'p1',
        trigger_type: 'webhook',
        trigger_by: 'user-1',
        environment_name: 'production',
        status: 'pending',
        config_snapshot: { branch: 'main' },
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRun] });

      const result = await repository.create({
        tenant_id: 't1',
        pipeline_id: 'p1',
        trigger_type: 'webhook',
        trigger_by: 'user-1',
        environment_name: 'production',
        config_snapshot: { branch: 'main' },
      });

      expect(result).toEqual(mockRun);
    });

    it('should create run with minimal fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'run-1' }] });

      await repository.create({
        tenant_id: 't1',
        pipeline_id: 'p1',
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[2]).toBe('manual'); // default trigger_type
      expect(params[3]).toBeNull(); // trigger_by
      expect(params[4]).toBeNull(); // environment_name
      expect(params[5]).toEqual({}); // config_snapshot
    });
  });

  describe('updateStatus', () => {
    it('should update status only', async () => {
      const mockUpdated = { id: 'run-1', status: 'running' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateStatus('run-1', 'running');

      expect(result).toEqual(mockUpdated);
    });

    it('should update status with startedAt', async () => {
      const startedAt = new Date();
      mockDb.query.mockResolvedValue({ rows: [{ id: 'run-1' }] });

      await repository.updateStatus('run-1', 'running', startedAt);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('started_at'),
        expect.arrayContaining(['running', startedAt, 'run-1'])
      );
    });

    it('should update status with startedAt and completedAt', async () => {
      const startedAt = new Date('2026-01-01T10:00:00');
      const completedAt = new Date('2026-01-01T10:05:00');
      mockDb.query.mockResolvedValue({ rows: [{ id: 'run-1' }] });

      await repository.updateStatus('run-1', 'completed', startedAt, completedAt);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('duration_ms'),
        expect.arrayContaining(['completed', startedAt, completedAt, 300000, 'run-1'])
      );
    });

    it('should update status with error message', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'run-1' }] });

      await repository.updateStatus('run-1', 'failed', undefined, undefined, 'Build failed');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('error_message'),
        expect.arrayContaining(['failed', 'Build failed', 'run-1'])
      );
    });

    it('should return null when run not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateStatus('non-existent', 'running');

      expect(result).toBeNull();
    });
  });

  describe('findByStatus', () => {
    it('should return runs by status', async () => {
      const mockRuns = [{ id: 'r1', status: 'running' }];
      mockDb.query.mockResolvedValue({ rows: mockRuns });

      const result = await repository.findByStatus('running');

      expect(result).toEqual(mockRuns);
    });

    it('should return empty array when no runs', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByStatus('running');

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete an existing run with tenant isolation', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.delete('run-1', 'tenant-1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM pipeline_runs WHERE id = $1 AND tenant_id = $2', ['run-1', 'tenant-1']);
    });

    it('should return false when run not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.delete('non-existent', 'tenant-1');

      expect(result).toBe(false);
    });
  });

  // ==================== Stage Executions ====================

  describe('findStageExecutionsByRun', () => {
    it('should return stage executions for run', async () => {
      const mockExecutions = [{ id: 'se1', run_id: 'run-1' }];
      mockDb.query.mockResolvedValue({ rows: mockExecutions });

      const result = await repository.findStageExecutionsByRun('run-1');

      expect(result).toEqual(mockExecutions);
    });

    it('should return empty array when no executions', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findStageExecutionsByRun('run-1');

      expect(result).toEqual([]);
    });
  });

  describe('findStageExecutionById', () => {
    it('should return stage execution by id', async () => {
      const mockExecution = { id: 'se1', stage_name: 'build' };
      mockDb.query.mockResolvedValue({ rows: [mockExecution] });

      const result = await repository.findStageExecutionById('se1');

      expect(result).toEqual(mockExecution);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findStageExecutionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createStageExecution', () => {
    it('should create a stage execution', async () => {
      const mockExecution = {
        id: 'se1',
        run_id: 'run-1',
        stage_id: 'stage-1',
        stage_name: 'build',
        status: 'pending',
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockExecution] });

      const result = await repository.createStageExecution('run-1', 'stage-1', 'build');

      expect(result).toEqual(mockExecution);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stage_executions'),
        ['run-1', 'stage-1', 'build']
      );
    });

    it('should create stage execution with null stageId', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'se1' }] });

      await repository.createStageExecution('run-1', null, 'build');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stage_executions'),
        ['run-1', null, 'build']
      );
    });
  });

  describe('updateStageExecutionStatus', () => {
    it('should update status only', async () => {
      const mockUpdated = { id: 'se1', status: 'running' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateStageExecutionStatus('se1', 'running');

      expect(result).toEqual(mockUpdated);
    });

    it('should update with all fields', async () => {
      const startedAt = new Date('2026-01-01T10:00:00');
      const completedAt = new Date('2026-01-01T10:05:00');
      mockDb.query.mockResolvedValue({ rows: [{ id: 'se1' }] });

      await repository.updateStageExecutionStatus(
        'se1',
        'completed',
        startedAt,
        completedAt,
        undefined,
        'Build logs'
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        expect.arrayContaining(['completed', startedAt, completedAt, 300000, 'Build logs', 'se1'])
      );
    });

    it('should update with error message', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'se1' }] });

      await repository.updateStageExecutionStatus('se1', 'failed', undefined, undefined, 'Build failed');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('error_message'),
        expect.arrayContaining(['failed', 'Build failed', 'se1'])
      );
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateStageExecutionStatus('non-existent', 'running');

      expect(result).toBeNull();
    });
  });

  // ==================== Task Executions ====================

  describe('findTaskExecutionsByExecution', () => {
    it('should return task executions for execution', async () => {
      const mockTasks = [{ id: 'te1', execution_id: 'se1' }];
      mockDb.query.mockResolvedValue({ rows: mockTasks });

      const result = await repository.findTaskExecutionsByExecution('se1');

      expect(result).toEqual(mockTasks);
    });

    it('should return empty array when no tasks', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findTaskExecutionsByExecution('se1');

      expect(result).toEqual([]);
    });
  });

  describe('findTaskExecutionById', () => {
    it('should return task execution by id', async () => {
      const mockTask = { id: 'te1', task_name: 'compile' };
      mockDb.query.mockResolvedValue({ rows: [mockTask] });

      const result = await repository.findTaskExecutionById('te1');

      expect(result).toEqual(mockTask);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findTaskExecutionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createTaskExecution', () => {
    it('should create a task execution', async () => {
      const mockTask = {
        id: 'te1',
        execution_id: 'se1',
        task_name: 'compile',
        task_type: 'build',
        status: 'pending',
        input: { args: '--release' },
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockTask] });

      const result = await repository.createTaskExecution('se1', 'compile', 'build', { args: '--release' });

      expect(result).toEqual(mockTask);
    });

    it('should create task execution with default input', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'te1' }] });

      await repository.createTaskExecution('se1', 'compile', 'build');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO task_executions'),
        ['se1', 'compile', 'build', {}]
      );
    });
  });

  describe('updateTaskExecution', () => {
    it('should update task status', async () => {
      const mockUpdated = { id: 'te1', status: 'running' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateTaskExecution('te1', { status: 'running' });

      expect(result).toEqual(mockUpdated);
    });

    it('should update task output', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'te1' }] });

      await repository.updateTaskExecution('te1', {
        status: 'completed',
        output: { result: 'success' },
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('output'),
        expect.arrayContaining(['completed', '{"result":"success"}', 'te1'])
      );
    });

    it('should update task with all fields', async () => {
      const startedAt = new Date('2026-01-01T10:00:00');
      const completedAt = new Date('2026-01-01T10:05:00');
      mockDb.query.mockResolvedValue({ rows: [{ id: 'te1' }] });

      await repository.updateTaskExecution('te1', {
        status: 'completed',
        startedAt,
        completedAt,
        errorMessage: undefined,
        logs: 'Task logs',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        expect.arrayContaining(['completed', startedAt, completedAt, 'Task logs', 'te1'])
      );
    });

    it('should return current task when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'te1' }] });

      const result = await repository.updateTaskExecution('te1', {});

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateTaskExecution('non-existent', { status: 'running' });

      expect(result).toBeNull();
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate connection refused errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findById('run-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate timeout errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repository.create({ tenant_id: 't1', pipeline_id: 'p1' })).rejects.toThrow('Query timeout');
    });

    it('should propagate constraint violation errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repository.createStageExecution('run-1', 'stage-1', 'build')).rejects.toThrow('Unique constraint violation');
    });
  });
});
