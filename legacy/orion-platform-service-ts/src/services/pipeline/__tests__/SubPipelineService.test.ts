/**
 * SubPipelineService Tests
 *
 * Tests for the sub-pipeline invocation service (GAP-03).
 * Covers: invoke, waitForCompletion, getResults, cancel, failure propagation.
 */

import { SubPipelineService } from '../SubPipelineService';
import { SubPipelineRepository, SubPipelineRecord } from '../../../repositories/SubPipelineRepository';
import { PipelineEngine } from '../../../engine/PipelineEngine';
import { PipelineService } from '../PipelineService';
import { PipelineStatus } from '../../../models/Pipeline';
import { PipelineRun, PipelineRunStatus, TriggerType } from '../../../models/PipelineRun';

// ==================== Mocks ====================

const mockSubPipelineRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByParentRunId: jest.fn(),
  findByChildRunId: jest.fn(),
  findByPipelineId: jest.fn(),
  updateChildRun: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
  countByStatus: jest.fn(),
};

const mockPipelineEngine = {
  execute: jest.fn(),
  cancelExecution: jest.fn(),
};

const mockPipelineService = {
  getById: jest.fn(),
};

function createService(): SubPipelineService {
  return new SubPipelineService(
    mockSubPipelineRepo as unknown as SubPipelineRepository,
    mockPipelineEngine as unknown as PipelineEngine,
    mockPipelineService as unknown as PipelineService,
  );
}

function createMockRecord(overrides?: Partial<SubPipelineRecord>): SubPipelineRecord {
  return {
    id: 'inv-1',
    parent_run_id: 'run-parent-1',
    child_pipeline_id: 'pipeline-child-1',
    child_run_id: 'run-child-1',
    status: 'running',
    input_params: { env: 'staging', version: '1.0.0' },
    output_results: {},
    stage_name: 'deploy-staging',
    output_mapping: { deployUrl: 'url' },
    error_message: null,
    created_at: new Date(),
    completed_at: null,
    ...overrides,
  };
}

function createMockChildRun(overrides?: Partial<PipelineRun>): PipelineRun {
  return {
    id: 'run-child-1',
    pipelineId: 'pipeline-child-1',
    pipelineVersion: '1',
    triggerType: TriggerType.API,
    triggerBy: 'sub-pipeline',
    status: PipelineRunStatus.PENDING,
    context: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ==================== Tests ====================

describe('SubPipelineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== invoke() ====================

  describe('invoke()', () => {
    it('should invoke a child pipeline and return invocation with childRunId', async () => {
      const childRun = createMockChildRun();
      mockSubPipelineRepo.create.mockResolvedValue(createMockRecord());
      mockPipelineService.getById.mockResolvedValue({
        id: 'pipeline-child-1',
        name: 'child-pipeline',
        version: '1',
        yamlDefinition: 'apiVersion: v1\nkind: Pipeline\nmetadata:\n  name: child\nspec:\n  stages: []',
        status: PipelineStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPipelineEngine.execute.mockResolvedValue(childRun);
      mockSubPipelineRepo.updateChildRun.mockResolvedValue(createMockRecord({ status: 'running' }));

      const service = createService();
      const result = await service.invoke({
        childPipelineId: 'pipeline-child-1',
        parentRunId: 'run-parent-1',
        inputParams: { env: 'staging', version: '1.0.0' },
        stageName: 'deploy-staging',
        outputMapping: { deployUrl: 'url' },
      });

      expect(result.invocation.id).toBe('inv-1');
      expect(result.childRunId).toBe('run-child-1');
      expect(mockSubPipelineRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_run_id: 'run-parent-1',
          child_pipeline_id: 'pipeline-child-1',
          input_params: { env: 'staging', version: '1.0.0' },
          stage_name: 'deploy-staging',
          output_mapping: { deployUrl: 'url' },
        })
      );
      expect(mockPipelineEngine.execute).toHaveBeenCalledWith(
        'pipeline-child-1',
        TriggerType.API,
        'sub-pipeline',
        expect.objectContaining({
          env: 'staging',
          version: '1.0.0',
          parentRunId: 'run-parent-1',
          isSubPipeline: true,
        })
      );
    });

    it('should throw if child pipeline not found', async () => {
      mockSubPipelineRepo.create.mockResolvedValue(createMockRecord());
      mockPipelineService.getById.mockResolvedValue(null);

      const service = createService();

      await expect(service.invoke({
        childPipelineId: 'nonexistent',
        parentRunId: 'run-parent-1',
        inputParams: {},
        stageName: 'test',
      })).rejects.toThrow('Child pipeline not found: nonexistent');
    });

    it('should throw if child pipeline is not active', async () => {
      mockSubPipelineRepo.create.mockResolvedValue(createMockRecord());
      mockPipelineService.getById.mockResolvedValue({
        id: 'pipeline-child-1',
        status: PipelineStatus.INACTIVE,
      });

      const service = createService();

      await expect(service.invoke({
        childPipelineId: 'pipeline-child-1',
        parentRunId: 'run-parent-1',
        inputParams: {},
        stageName: 'test',
      })).rejects.toThrow('Child pipeline is not active');
    });

    it('should mark invocation as failed if child run cannot start', async () => {
      mockSubPipelineRepo.create.mockResolvedValue(createMockRecord());
      mockPipelineService.getById.mockResolvedValue({
        id: 'pipeline-child-1',
        status: PipelineStatus.ACTIVE,
      });
      mockPipelineEngine.execute.mockRejectedValue(new Error('Database unavailable'));

      const service = createService();

      await expect(service.invoke({
        childPipelineId: 'pipeline-child-1',
        parentRunId: 'run-parent-1',
        inputParams: {},
        stageName: 'test',
      })).rejects.toThrow('Database unavailable');

      expect(mockSubPipelineRepo.updateStatus).toHaveBeenCalledWith(
        'inv-1',
        'failed',
        {},
        'Database unavailable'
      );
    });
  });

  // ==================== waitForCompletion() ====================

  describe('waitForCompletion()', () => {
    it('should return when child pipeline completes', async () => {
      mockSubPipelineRepo.findByChildRunId
        .mockResolvedValueOnce(createMockRecord({ status: 'running' }))
        .mockResolvedValueOnce(createMockRecord({ status: 'completed', output_results: { url: 'https://example.com' } }));

      const service = createService();
      const result = await service.waitForCompletion('run-child-1', 5000, 10);

      expect(result.status).toBe('completed');
      expect(result.outputResults).toEqual({ url: 'https://example.com' });
    });

    it('should throw when child pipeline fails', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({ status: 'failed', error_message: 'Build failed' })
      );

      const service = createService();

      await expect(service.waitForCompletion('run-child-1', 5000, 10))
        .rejects.toThrow('Sub-pipeline failed: Build failed');
    });

    it('should throw when child pipeline is cancelled', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({ status: 'cancelled' })
      );

      const service = createService();

      await expect(service.waitForCompletion('run-child-1', 5000, 10))
        .rejects.toThrow('Sub-pipeline was cancelled');
    });

    it('should throw when invocation not found', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(null);

      const service = createService();

      await expect(service.waitForCompletion('nonexistent', 5000, 10))
        .rejects.toThrow('Sub-pipeline invocation not found for childRunId: nonexistent');
    });

    it('should throw on timeout', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({ status: 'running' })
      );

      const service = createService();

      await expect(service.waitForCompletion('run-child-1', 100, 50))
        .rejects.toThrow('Sub-pipeline timed out after 100ms');
    });
  });

  // ==================== getResults() ====================

  describe('getResults()', () => {
    it('should return mapped results from completed sub-pipeline', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({
          status: 'completed',
          output_results: { url: 'https://example.com', status: 'success', version: '2.0.0' },
          output_mapping: { deployUrl: 'url', deployVersion: 'version' },
        })
      );

      const service = createService();
      const results = await service.getResults('run-child-1');

      expect(results).toEqual({
        deployUrl: 'https://example.com',
        deployVersion: '2.0.0',
        status: 'success',
        url: 'https://example.com',
        version: '2.0.0',
      });
    });

    it('should throw if sub-pipeline not completed', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({ status: 'running' })
      );

      const service = createService();

      await expect(service.getResults('run-child-1'))
        .rejects.toThrow('Sub-pipeline is not completed (status: running)');
    });

    it('should throw if invocation not found', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(null);

      const service = createService();

      await expect(service.getResults('nonexistent'))
        .rejects.toThrow('Sub-pipeline invocation not found for childRunId: nonexistent');
    });
  });

  // ==================== cancel() ====================

  describe('cancel()', () => {
    it('should cancel a running sub-pipeline', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({ status: 'running' })
      );
      mockPipelineEngine.cancelExecution.mockResolvedValue(undefined);
      mockSubPipelineRepo.updateStatus.mockResolvedValue(
        createMockRecord({ status: 'cancelled' })
      );

      const service = createService();
      const result = await service.cancel('run-child-1');

      expect(result.status).toBe('cancelled');
      expect(mockPipelineEngine.cancelExecution).toHaveBeenCalledWith('run-child-1');
      expect(mockSubPipelineRepo.updateStatus).toHaveBeenCalledWith('inv-1', 'cancelled');
    });

    it('should throw if sub-pipeline not running', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({ status: 'completed' })
      );

      const service = createService();

      await expect(service.cancel('run-child-1'))
        .rejects.toThrow('Cannot cancel sub-pipeline with status: completed');
    });

    it('should throw if invocation not found', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(null);

      const service = createService();

      await expect(service.cancel('nonexistent'))
        .rejects.toThrow('Sub-pipeline invocation not found for childRunId: nonexistent');
    });
  });

  // ==================== markCompleted() ====================

  describe('markCompleted()', () => {
    it('should mark sub-pipeline as completed with results', async () => {
      const record = createMockRecord({
        status: 'running',
        output_results: {},
      });
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(record);
      mockSubPipelineRepo.updateStatus.mockResolvedValue(
        createMockRecord({
          status: 'completed',
          output_results: { buildVersion: '1.0.0' },
        })
      );

      const service = createService();
      const result = await service.markCompleted('run-child-1', { buildVersion: '1.0.0' });

      expect(result.status).toBe('completed');
      expect(result.outputResults).toEqual({ buildVersion: '1.0.0' });
      expect(mockSubPipelineRepo.updateStatus).toHaveBeenCalledWith(
        'inv-1',
        'completed',
        { buildVersion: '1.0.0' }
      );
    });

    it('should throw if invocation not found', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(null);

      const service = createService();

      await expect(service.markCompleted('nonexistent', {}))
        .rejects.toThrow('Sub-pipeline invocation not found for childRunId: nonexistent');
    });
  });

  // ==================== markFailed() ====================

  describe('markFailed()', () => {
    it('should mark sub-pipeline as failed with error', async () => {
      mockSubPipelineRepo.findByChildRunId.mockResolvedValue(
        createMockRecord({ status: 'running' })
      );
      mockSubPipelineRepo.updateStatus.mockResolvedValue(
        createMockRecord({ status: 'failed', error_message: 'Timeout' })
      );

      const service = createService();
      const result = await service.markFailed('run-child-1', 'Timeout');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Timeout');
    });
  });

  // ==================== Query methods ====================

  describe('getByParentRunId()', () => {
    it('should return all sub-pipeline invocations for a parent run', async () => {
      mockSubPipelineRepo.findByParentRunId.mockResolvedValue([
        createMockRecord({ id: 'inv-1' }),
        createMockRecord({ id: 'inv-2' }),
      ]);

      const service = createService();
      const results = await service.getByParentRunId('run-parent-1');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('inv-1');
      expect(results[1].id).toBe('inv-2');
    });

    it('should throw when repository is null', () => {
      expect(() => new SubPipelineService(null as any)).toThrow(
        'SubPipelineRepository is required'
      );
    });
  });

  describe('getById()', () => {
    it('should return sub-pipeline invocation by ID', async () => {
      mockSubPipelineRepo.findById.mockResolvedValue(createMockRecord());

      const service = createService();
      const result = await service.getById('inv-1');

      expect(result?.id).toBe('inv-1');
    });

    it('should return null if not found', async () => {
      mockSubPipelineRepo.findById.mockResolvedValue(null);

      const service = createService();
      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByPipelineId()', () => {
    it('should return sub-pipeline invocations by child pipeline ID', async () => {
      mockSubPipelineRepo.findByPipelineId.mockResolvedValue([
        createMockRecord({ child_pipeline_id: 'pipeline-child-1' }),
      ]);

      const service = createService();
      const results = await service.getByPipelineId('pipeline-child-1');

      expect(results).toHaveLength(1);
      expect(results[0].childPipelineId).toBe('pipeline-child-1');
    });
  });
});
