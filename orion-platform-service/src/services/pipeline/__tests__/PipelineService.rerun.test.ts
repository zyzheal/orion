/**
 * PipelineService.retryRun() - GAP-06: Re-run from specific stage
 *
 * Tests for the enhanced retryRun() method that supports:
 * - Default retry (from stage 0, all stages) — backward compatible
 * - Retry from a specific stage (fromStage option)
 * - Retry only failed stages (onlyFailed option)
 */

import { PipelineService } from '../PipelineService';

// ==================== Mock Dependencies ====================

const mockFindRunById = jest.fn();
const mockFindStageExecutionsByRun = jest.fn();
const mockCreateRun = jest.fn();
const mockUpdateRunStatus = jest.fn();
const mockFindPipelineById = jest.fn();

const mockPipelineRepository = {
  findRunById: mockFindRunById,
  findPipelineById: mockFindPipelineById,
  createRun: mockCreateRun,
  updateRunStatus: mockUpdateRunStatus,
  findAll: jest.fn().mockResolvedValue([]),
  findById: mockFindPipelineById,
  findRunsByPipeline: jest.fn().mockResolvedValue([]),
  countRuns: jest.fn().mockResolvedValue(0),
  count: jest.fn().mockResolvedValue(0),
  findStagesByPipeline: jest.fn().mockResolvedValue([]),
  createStage: jest.fn(),
  createStageExecution: jest.fn(),
  findStageExecutions: mockFindStageExecutionsByRun,
  updateStageExecutionStatus: jest.fn(),
  findVersions: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getPipelineStats: jest.fn().mockResolvedValue({ totalRuns: 0, successRuns: 0, failedRuns: 0, runningRuns: 0, avgDuration: 0 }),
};

const mockPipelineService = {
  getById: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn().mockResolvedValue([]),
};

// Minimal mock for PipelineRunRepository
const mockRunRepository = {
  findRunById: mockFindRunById,
  findStageExecutionsByRun: mockFindStageExecutionsByRun,
  createRun: mockCreateRun,
  updateRunStatus: mockUpdateRunStatus,
  findById: mockFindRunById,
  findAll: jest.fn().mockResolvedValue([]),
  findByStatus: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  findStageExecutionById: jest.fn(),
  updateStageExecutionStatus: jest.fn(),
  findStageExecutions: jest.fn().mockResolvedValue([]),
};

describe('PipelineService.retryRun() - GAP-06', () => {
  let service: PipelineService;

  const baseOriginalRun = {
    id: 'run-001',
    tenant_id: 'tenant-1',
    pipeline_id: 'pipeline-1',
    trigger_type: 'manual',
    trigger_by: 'user-1',
    status: 'failed',
    config_snapshot: { version: '1' },
    started_at: new Date('2026-05-08T10:00:00Z'),
    completed_at: new Date('2026-05-08T10:05:00Z'),
    duration_ms: 300000,
    error_message: 'Deploy stage failed',
    created_at: new Date('2026-05-08T10:00:00Z'),
  };

  // Stage executions for a 3-stage pipeline: build -> test -> deploy
  const stageExecutions = [
    {
      id: 'stage-exec-1',
      run_id: 'run-001',
      stage_id: 'stage-1',
      stage_name: 'build',
      status: 'success',
      started_at: new Date('2026-05-08T10:00:00Z'),
      completed_at: new Date('2026-05-08T10:01:00Z'),
      duration_ms: 60000,
      error_message: null,
      logs: null,
      created_at: new Date('2026-05-08T10:00:00Z'),
    },
    {
      id: 'stage-exec-2',
      run_id: 'run-001',
      stage_id: 'stage-2',
      stage_name: 'test',
      status: 'success',
      started_at: new Date('2026-05-08T10:01:00Z'),
      completed_at: new Date('2026-05-08T10:03:00Z'),
      duration_ms: 120000,
      error_message: null,
      logs: null,
      created_at: new Date('2026-05-08T10:01:00Z'),
    },
    {
      id: 'stage-exec-3',
      run_id: 'run-001',
      stage_id: 'stage-3',
      stage_name: 'deploy',
      status: 'failed',
      started_at: new Date('2026-05-08T10:03:00Z'),
      completed_at: new Date('2026-05-08T10:05:00Z'),
      duration_ms: 120000,
      error_message: 'Deployment timeout',
      logs: null,
      created_at: new Date('2026-05-08T10:03:00Z'),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset service with mock repository
    service = new PipelineService(mockPipelineRepository as any);
    // @ts-ignore - inject run repository for testing
    service['runRepository'] = mockRunRepository as any;
  });

  // ==================== Test 1: Default retry (backward compatible) ====================

  describe('default retry behavior (backward compatible)', () => {
    it('should create a new run from stage 0 with all stages when no options provided', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(stageExecutions);
      mockCreateRun.mockResolvedValue({
        ...baseOriginalRun,
        id: 'run-002',
        status: 'pending',
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
      });

      const newRunId = await service.retryRun('run-001');

      expect(newRunId).toBe('run-002');
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_type: 'retry',
          config_snapshot: expect.objectContaining({
            originalRunId: 'run-001',
            fromStage: undefined,
            onlyFailed: false,
          }),
        })
      );
    });
  });

  // ==================== Test 2: Retry from specific stage ====================

  describe('retry from specific stage (fromStage)', () => {
    it('should create a new run starting from the specified stage, skipping earlier stages', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(stageExecutions);
      mockCreateRun.mockResolvedValue({
        ...baseOriginalRun,
        id: 'run-003',
        status: 'pending',
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
      });

      const newRunId = await service.retryRun('run-001', { fromStage: 'deploy' });

      expect(newRunId).toBe('run-003');
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_type: 'retry',
          config_snapshot: expect.objectContaining({
            originalRunId: 'run-001',
            fromStage: 'deploy',
            onlyFailed: false,
            skippedStages: ['build', 'test'],
          }),
        })
      );
    });

    it('should start from stage 0 when fromStage is the first stage', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(stageExecutions);
      mockCreateRun.mockResolvedValue({
        ...baseOriginalRun,
        id: 'run-004',
        status: 'pending',
      });

      const newRunId = await service.retryRun('run-001', { fromStage: 'build' });

      expect(newRunId).toBe('run-004');
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          config_snapshot: expect.objectContaining({
            fromStage: 'build',
            skippedStages: [],
          }),
        })
      );
    });

    it('should throw an error when fromStage does not exist in the original run', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(stageExecutions);

      await expect(service.retryRun('run-001', { fromStage: 'nonexistent' }))
        .rejects.toThrow('Stage "nonexistent" not found in original run');
    });

    it('should throw an error when original run not found', async () => {
      mockFindRunById.mockResolvedValue(null);

      await expect(service.retryRun('nonexistent-run', { fromStage: 'build' }))
        .rejects.toThrow('Pipeline run not found');
    });
  });

  // ==================== Test 3: Retry only failed stages ====================

  describe('retry only failed stages (onlyFailed)', () => {
    it('should create a new run that only re-runs failed stages', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(stageExecutions);
      mockCreateRun.mockResolvedValue({
        ...baseOriginalRun,
        id: 'run-005',
        status: 'pending',
      });

      const newRunId = await service.retryRun('run-001', { onlyFailed: true });

      expect(newRunId).toBe('run-005');
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_type: 'retry',
          config_snapshot: expect.objectContaining({
            originalRunId: 'run-001',
            fromStage: undefined,
            onlyFailed: true,
            skippedStages: ['build', 'test'], // successful stages are skipped
            failedStages: ['deploy'],
          }),
        })
      );
    });

    it('should throw an error when no stages failed', async () => {
      const allSuccessExecutions = stageExecutions.map(s =>
        s.stage_name === 'deploy' ? { ...s, status: 'success', error_message: null } : s
      );
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(allSuccessExecutions);

      await expect(service.retryRun('run-001', { onlyFailed: true }))
        .rejects.toThrow('No failed stages found in the original run');
    });
  });

  // ==================== Test 4: Combined fromStage + onlyFailed ====================

  describe('combined fromStage + onlyFailed', () => {
    it('should only re-run failed stages from the specified stage onwards', async () => {
      // Add a failed test stage for this scenario
      const mixedExecutions = [
        { ...stageExecutions[0], status: 'success' }, // build: success
        { ...stageExecutions[1], status: 'failed', error_message: 'Test failure' }, // test: failed
        { ...stageExecutions[2], status: 'failed' }, // deploy: failed
      ];

      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(mixedExecutions);
      mockCreateRun.mockResolvedValue({
        ...baseOriginalRun,
        id: 'run-006',
        status: 'pending',
      });

      const newRunId = await service.retryRun('run-001', { fromStage: 'test', onlyFailed: true });

      expect(newRunId).toBe('run-006');
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          config_snapshot: expect.objectContaining({
            originalRunId: 'run-001',
            fromStage: 'test',
            onlyFailed: true,
            skippedStages: ['build'], // only stages before 'test' are skipped
            failedStages: ['test', 'deploy'], // both failed stages from 'test' onwards
          }),
        })
      );
    });
  });

  // ==================== Test 5: Invalid state checks ====================

  describe('invalid state checks', () => {
    it('should allow retry for failed runs', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue(stageExecutions);
      mockCreateRun.mockResolvedValue({ ...baseOriginalRun, id: 'run-007', status: 'pending' });

      const result = await service.retryRun('run-001');
      expect(result).toBe('run-007');
    });

    it('should allow retry for cancelled runs', async () => {
      const cancelledRun = { ...baseOriginalRun, status: 'cancelled' };
      mockFindRunById.mockResolvedValue(cancelledRun);
      mockFindStageExecutionsByRun.mockResolvedValue(stageExecutions);
      mockCreateRun.mockResolvedValue({ ...baseOriginalRun, id: 'run-008', status: 'pending' });

      const result = await service.retryRun('run-001');
      expect(result).toBe('run-008');
    });

    it('should throw error for running runs', async () => {
      const runningRun = { ...baseOriginalRun, status: 'running' };
      mockFindRunById.mockResolvedValue(runningRun);

      await expect(service.retryRun('run-001'))
        .rejects.toThrow('Can only retry failed or cancelled runs');
    });

    it('should throw error for successful runs', async () => {
      const successRun = { ...baseOriginalRun, status: 'success' };
      mockFindRunById.mockResolvedValue(successRun);

      await expect(service.retryRun('run-001'))
        .rejects.toThrow('Can only retry failed or cancelled runs');
    });

    it('should throw error when database not available', async () => {
      const noDbService = new PipelineService(null);

      await expect(noDbService.retryRun('run-001'))
        .rejects.toThrow('Database not available');
    });
  });

  // ==================== Test 6: Retry with no stage executions (early failure) ====================

  describe('edge cases', () => {
    it('should handle runs with no stage executions (default to full retry)', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue([]);
      mockCreateRun.mockResolvedValue({ ...baseOriginalRun, id: 'run-009', status: 'pending' });

      const newRunId = await service.retryRun('run-001');

      expect(newRunId).toBe('run-009');
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_type: 'retry',
          config_snapshot: expect.objectContaining({
            originalRunId: 'run-001',
            fromStage: undefined,
            onlyFailed: false,
            skippedStages: [],
          }),
        })
      );
    });

    it('should throw error when fromStage is specified but no stage executions exist', async () => {
      mockFindRunById.mockResolvedValue(baseOriginalRun);
      mockFindStageExecutionsByRun.mockResolvedValue([]);

      await expect(service.retryRun('run-001', { fromStage: 'build' }))
        .rejects.toThrow('Stage "build" not found in original run');
    });
  });
});
