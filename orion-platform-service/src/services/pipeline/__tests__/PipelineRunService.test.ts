/**
 * PipelineRunService Unit Tests
 */

import { PipelineRunService } from '../PipelineRunService';
import { PipelineEventPublisher } from '../../../events/PipelineEventPublisher';
import { PipelineRunRepository } from '../PipelineRunRepository';
import { EnvironmentService } from '../EnvironmentService';

// Mock PipelineEventPublisher
const mockEventPublisher = {
  publishRunCreated: jest.fn().mockResolvedValue(undefined),
  publishRunStarted: jest.fn().mockResolvedValue(undefined),
  publishRunCompleted: jest.fn().mockResolvedValue(undefined),
  publishRunFailed: jest.fn().mockResolvedValue(undefined),
  publishRunCancelled: jest.fn().mockResolvedValue(undefined),
} as unknown as PipelineEventPublisher;

// Mock PipelineRunRepository
function createMockRepository() {
  return {
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findByStatus: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    updateStatus: jest.fn(),
    createStageExecution: jest.fn(),
    findStageExecutionsByRun: jest.fn().mockResolvedValue([]),
    findStageExecutionById: jest.fn(),
    updateStageExecutionStatus: jest.fn(),
    createTaskExecution: jest.fn(),
    findTaskExecutionsByExecution: jest.fn().mockResolvedValue([]),
    findTaskExecutionById: jest.fn(),
    updateTaskExecution: jest.fn(),
  } as unknown as PipelineRunRepository;
}

describe('PipelineRunService', () => {
  let service: PipelineRunService;
  let repository: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = createMockRepository();
    service = new PipelineRunService(mockEventPublisher, repository);
  });

  describe('setEventPublisher', () => {
    it('should update event publisher', () => {
      const newPublisher = { publishRunCreated: jest.fn() } as any;
      service.setEventPublisher(newPublisher);
      // No error means success
      expect(true).toBe(true);
    });
  });

  describe('createRun', () => {
    it('should create a run via repository', async () => {
      const mockRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        trigger_type: 'manual',
        status: 'pending',
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await service.createRun({
        pipelineId: 'p-1',
        pipelineVersion: '1',
        triggerType: 'manual' as any,
      });

      expect(result.id).toBe('r-1');
      expect(result.pipelineId).toBe('p-1');
      expect(mockEventPublisher.publishRunCreated).toHaveBeenCalled();
    });

    it('should extract tenantId from context', async () => {
      const mockRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        trigger_type: 'manual',
        status: 'pending',
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.create as jest.Mock).mockResolvedValue(mockRecord);

      await service.createRun({
        pipelineId: 'p-1',
        pipelineVersion: '1',
        triggerType: 'manual' as any,
        context: { tenantId: 'custom-tenant' },
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'custom-tenant' })
      );
    });

    it('should throw when no repository provided', () => {
      expect(() => new PipelineRunService(mockEventPublisher, null as any)).toThrow(
        'PipelineRunRepository is required'
      );
    });
  });

  describe('getRun', () => {
    it('should return a run by ID', async () => {
      const mockRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        trigger_type: 'manual',
        status: 'success',
        config_snapshot: { version: '1' },
        created_at: new Date(),
      };
      (repository.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await service.getRun('r-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('r-1');
    });

    it('should return null when not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.getRun('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findRunsByStatus', () => {
    it('should return runs by status', async () => {
      (repository.findByStatus as jest.Mock).mockResolvedValue([
        { id: 'r-1', pipeline_id: 'p-1', trigger_type: 'manual', status: 'running', config_snapshot: {}, created_at: new Date() },
      ]);

      const result = await service.findRunsByStatus('running');

      expect(result).toHaveLength(1);
    });

    it('should return empty array from repository', async () => {
      (repository.findByStatus as jest.Mock).mockResolvedValue([]);
      const result = await service.findRunsByStatus('running');

      expect(result).toEqual([]);
    });
  });

  describe('listRuns', () => {
    it('should list runs with filter', async () => {
      (repository.findAll as jest.Mock).mockResolvedValue([
        { id: 'r-1', pipeline_id: 'p-1', trigger_type: 'manual', status: 'success', config_snapshot: {}, created_at: new Date() },
      ]);

      const result = await service.listRuns({
        pipelineId: 'p-1',
        status: 'success',
        limit: 10,
      });

      expect(result).toHaveLength(1);
      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'p-1',
          status: ['success'],
          limit: 10,
        })
      );
    });

    it('should handle array status filter', async () => {
      (repository.findAll as jest.Mock).mockResolvedValue([]);

      await service.listRuns({ status: ['running', 'pending'] as any });

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['running', 'pending'] })
      );
    });
  });

  describe('startRun', () => {
    it('should start a pending run', async () => {
      const mockRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        status: 'pending',
        started_at: null,
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.findById as jest.Mock).mockResolvedValue(mockRecord);
      (repository.updateStatus as jest.Mock).mockResolvedValue({
        ...mockRecord,
        status: 'running',
        started_at: new Date(),
      });

      const result = await service.startRun('r-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('running');
      expect(mockEventPublisher.publishRunStarted).toHaveBeenCalled();
    });

    it('should return null when run not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.startRun('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('completeRun', () => {
    it('should complete a run with success', async () => {
      const mockRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        status: 'running',
        started_at: new Date(),
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.findById as jest.Mock).mockResolvedValue(mockRecord);
      (repository.updateStatus as jest.Mock).mockResolvedValue({ ...mockRecord, status: 'success' });

      const result = await service.completeRun('r-1', 'success' as any);

      expect(result).not.toBeNull();
      expect(mockEventPublisher.publishRunCompleted).toHaveBeenCalled();
    });

    it('should complete a run with failure', async () => {
      const mockRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        status: 'running',
        started_at: new Date(),
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.findById as jest.Mock).mockResolvedValue(mockRecord);
      (repository.updateStatus as jest.Mock).mockResolvedValue({ ...mockRecord, status: 'failed' });

      const result = await service.completeRun('r-1', 'failed' as any);

      expect(result).not.toBeNull();
      expect(mockEventPublisher.publishRunFailed).toHaveBeenCalled();
    });

    it('should return null when run not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.completeRun('nonexistent', 'success' as any);

      expect(result).toBeNull();
    });
  });

  describe('cancelRun', () => {
    it('should cancel a running run', async () => {
      const mockRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        status: 'running',
        started_at: new Date(),
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.findById as jest.Mock).mockResolvedValue(mockRecord);
      (repository.updateStatus as jest.Mock).mockResolvedValue({ ...mockRecord, status: 'cancelled' });

      const result = await service.cancelRun('r-1');

      expect(result).not.toBeNull();
      expect(mockEventPublisher.publishRunCancelled).toHaveBeenCalled();
    });

    it('should cancel a pending run', async () => {
      const mockRecord = {
        id: 'r-1',
        status: 'pending',
        started_at: null,
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.findById as jest.Mock).mockResolvedValue(mockRecord);
      (repository.updateStatus as jest.Mock).mockResolvedValue({ ...mockRecord, status: 'cancelled' });

      const result = await service.cancelRun('r-1');

      expect(result).not.toBeNull();
    });

    it('should return null for completed run', async () => {
      const mockRecord = {
        id: 'r-1',
        status: 'success',
        config_snapshot: {},
        created_at: new Date(),
      };
      (repository.findById as jest.Mock).mockResolvedValue(mockRecord);

      const result = await service.cancelRun('r-1');

      expect(result).toBeNull();
    });

    it('should return null when run not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.cancelRun('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('addStage', () => {
    it('should add a stage execution', async () => {
      await service.addStage('r-1', { id: 's-1', name: 'Build' } as any);

      expect(repository.createStageExecution).toHaveBeenCalledWith('r-1', 's-1', 'Build');
    });
  });

  describe('getStages', () => {
    it('should return stages for a run', async () => {
      (repository.findStageExecutionsByRun as jest.Mock).mockResolvedValue([
        { id: 'e-1', run_id: 'r-1', stage_name: 'Build', status: 'success', created_at: new Date() },
      ]);

      const result = await service.getStages('r-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Build');
    });
  });

  describe('getStage', () => {
    it('should return a stage by ID', async () => {
      (repository.findStageExecutionById as jest.Mock).mockResolvedValue({
        id: 'e-1', run_id: 'r-1', stage_name: 'Build', status: 'success', created_at: new Date(),
      });

      const result = await service.getStage('e-1');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Build');
    });

    it('should return null when not found', async () => {
      (repository.findStageExecutionById as jest.Mock).mockResolvedValue(null);

      const result = await service.getStage('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateStage', () => {
    it('should update stage execution status', async () => {
      const stage = {
        id: 'e-1',
        status: 'success',
        startedAt: new Date(),
        completedAt: new Date(),
        error: undefined,
      } as any;

      await service.updateStage(stage);

      expect(repository.updateStageExecutionStatus).toHaveBeenCalled();
    });
  });

  describe('addTask', () => {
    it('should add a task execution', async () => {
      await service.addTask('e-1', { name: 'npm install', type: 'shell' } as any);

      expect(repository.createTaskExecution).toHaveBeenCalledWith('e-1', 'npm install', 'shell');
    });
  });

  describe('getTasks', () => {
    it('should return tasks for a stage', async () => {
      (repository.findTaskExecutionsByExecution as jest.Mock).mockResolvedValue([
        { id: 't-1', task_name: 'npm install', task_type: 'shell', status: 'success', created_at: new Date() },
      ]);

      const result = await service.getTasks('e-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('npm install');
    });
  });

  describe('getTask', () => {
    it('should return a task by ID', async () => {
      (repository.findTaskExecutionById as jest.Mock).mockResolvedValue({
        id: 't-1', execution_id: 'e-1', task_name: 'npm test', task_type: 'shell', status: 'success', created_at: new Date(),
      });

      const result = await service.getTask('t-1');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('npm test');
    });

    it('should return null when not found', async () => {
      (repository.findTaskExecutionById as jest.Mock).mockResolvedValue(null);

      const result = await service.getTask('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('should update task execution', async () => {
      const task = {
        id: 't-1',
        status: 'success',
        result: { exitCode: 0 },
        startedAt: new Date(),
        completedAt: new Date(),
        error: undefined,
        log: 'output...',
      } as any;

      await service.updateTask(task);

      expect(repository.updateTaskExecution).toHaveBeenCalledWith('t-1', expect.objectContaining({
        status: 'success',
        output: { exitCode: 0 },
        logs: 'output...',
      }));
    });
  });

  describe('getRunDetail', () => {
    it('should return run detail with stages and tasks', async () => {
      const runRecord = {
        id: 'r-1',
        pipeline_id: 'p-1',
        status: 'running',
        config_snapshot: {},
        created_at: new Date(),
      };
      const stageRecord = {
        id: 'e-1',
        run_id: 'r-1',
        stage_name: 'Build',
        status: 'running',
        created_at: new Date(),
      };
      const taskRecord = {
        id: 't-1',
        task_name: 'npm build',
        task_type: 'shell',
        status: 'running',
        created_at: new Date(),
      };

      (repository.findById as jest.Mock).mockResolvedValue(runRecord);
      (repository.findStageExecutionsByRun as jest.Mock).mockResolvedValue([stageRecord]);
      (repository.findTaskExecutionsByExecution as jest.Mock).mockResolvedValue([taskRecord]);

      const result = await service.getRunDetail('r-1');

      expect(result).not.toBeNull();
      expect(result!.run!.id).toBe('r-1');
      expect(result!.stages).toHaveLength(1);
      expect(result!.tasks).toHaveLength(1);
    });

    it('should return null when run not found in repository', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.getRunDetail('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('checkRunCompletion', () => {
    it('should detect complete run with all success', async () => {
      (repository.findById as jest.Mock).mockResolvedValue({ id: 'r-1' });
      (repository.findStageExecutionsByRun as jest.Mock).mockResolvedValue([
        { id: 'e-1', status: 'success' },
        { id: 'e-2', status: 'success' },
      ]);

      const result = await service.checkRunCompletion('r-1');

      expect(result).toEqual({ isComplete: true, allSuccess: true });
    });

    it('should detect incomplete run', async () => {
      (repository.findById as jest.Mock).mockResolvedValue({ id: 'r-1' });
      (repository.findStageExecutionsByRun as jest.Mock).mockResolvedValue([
        { id: 'e-1', status: 'success' },
        { id: 'e-2', status: 'running' },
      ]);

      const result = await service.checkRunCompletion('r-1');

      expect(result).toEqual({ isComplete: false, allSuccess: true });
    });

    it('should detect run with failed stage', async () => {
      (repository.findById as jest.Mock).mockResolvedValue({ id: 'r-1' });
      (repository.findStageExecutionsByRun as jest.Mock).mockResolvedValue([
        { id: 'e-1', status: 'success' },
        { id: 'e-2', status: 'failed' },
      ]);

      const result = await service.checkRunCompletion('r-1');

      expect(result).toEqual({ isComplete: true, allSuccess: false });
    });

    it('should handle skipped stages', async () => {
      (repository.findById as jest.Mock).mockResolvedValue({ id: 'r-1' });
      (repository.findStageExecutionsByRun as jest.Mock).mockResolvedValue([
        { id: 'e-1', status: 'success' },
        { id: 'e-2', status: 'skipped' },
      ]);

      const result = await service.checkRunCompletion('r-1');

      expect(result).toEqual({ isComplete: true, allSuccess: true });
    });

    it('should return isComplete true when no stages', async () => {
      (repository.findById as jest.Mock).mockResolvedValue({ id: 'r-1' });
      (repository.findStageExecutionsByRun as jest.Mock).mockResolvedValue([]);

      const result = await service.checkRunCompletion('r-1');

      expect(result).toEqual({ isComplete: true, allSuccess: true });
    });

    it('should return null when run not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.checkRunCompletion('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('resolveEnvironmentVariables', () => {
    it('should return pipeline variables when no environment service', async () => {
      const svcNoEnv = new PipelineRunService(mockEventPublisher, repository);

      const result = await svcNoEnv.resolveEnvironmentVariables('t-1', 'r-1', { KEY: 'value' });

      expect(result.variables).toEqual({ KEY: 'value' });
      expect(result.environment.name).toBe('');
    });

    it('should return pipeline variables when run has no environment', async () => {
      const mockEnvService = {
        resolveVariables: jest.fn(),
        checkApprovalRequired: jest.fn(),
      } as unknown as EnvironmentService;
      (repository.findById as jest.Mock).mockResolvedValue({
        id: 'r-1',
        environment_name: null,
      });

      const svc = new PipelineRunService(mockEventPublisher, repository, mockEnvService);
      const result = await svc.resolveEnvironmentVariables('t-1', 'r-1', { KEY: 'value' });

      expect(result.variables).toEqual({ KEY: 'value' });
    });

    it('should resolve from environment service when available', async () => {
      const resolvedVars = { variables: { KEY: 'env-value' }, environment: { name: 'prod', approvalRequired: true, approvalCount: 2 } };
      const mockEnvService = {
        resolveVariables: jest.fn().mockResolvedValue(resolvedVars),
      } as unknown as EnvironmentService;
      (repository.findById as jest.Mock).mockResolvedValue({
        id: 'r-1',
        environment_name: 'prod',
      });

      const svc = new PipelineRunService(mockEventPublisher, repository, mockEnvService);
      const result = await svc.resolveEnvironmentVariables('t-1', 'r-1');

      expect(result).toEqual(resolvedVars);
      expect(mockEnvService.resolveVariables).toHaveBeenCalledWith('t-1', 'prod', {});
    });
  });

  describe('checkRunApprovalRequired', () => {
    it('should return false when no environment service', async () => {
      const svcNoEnv = new PipelineRunService(mockEventPublisher, repository);

      const result = await svcNoEnv.checkRunApprovalRequired('t-1', 'r-1');

      expect(result).toEqual({ required: false, approvalCount: 0, environmentFound: false });
    });

    it('should return false when run has no environment', async () => {
      const mockEnvService = { checkApprovalRequired: jest.fn() } as unknown as EnvironmentService;
      (repository.findById as jest.Mock).mockResolvedValue({ id: 'r-1', environment_name: null });

      const svc = new PipelineRunService(mockEventPublisher, repository, mockEnvService);
      const result = await svc.checkRunApprovalRequired('t-1', 'r-1');

      expect(result).toEqual({ required: false, approvalCount: 0, environmentFound: false });
    });

    it('should delegate to environment service', async () => {
      const approvalInfo = { required: true, approvalCount: 2, environmentFound: true };
      const mockEnvService = {
        checkApprovalRequired: jest.fn().mockResolvedValue(approvalInfo),
      } as unknown as EnvironmentService;
      (repository.findById as jest.Mock).mockResolvedValue({ id: 'r-1', environment_name: 'prod' });

      const svc = new PipelineRunService(mockEventPublisher, repository, mockEnvService);
      const result = await svc.checkRunApprovalRequired('t-1', 'r-1');

      expect(result).toEqual(approvalInfo);
    });
  });
});
