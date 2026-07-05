/**
 * PipelineEventSSEBridge Unit Tests
 */

import { PipelineEventSSEBridge, PipelineEventSSEBridgeOptions } from '../PipelineEventSSEBridge';
import { PipelineLogSSEService } from '../PipelineLogSSEService';
import { Stage } from '../../../models/Stage';
import { Task } from '../../../models/Task';
import { PipelineRun } from '../../../models/PipelineRun';

// Mock PipelineLogSSEService
function createMockSSEService(): PipelineLogSSEService {
  return {
    publishLogEvent: jest.fn(),
    publishStatusEvent: jest.fn(),
    publishStageStart: jest.fn(),
    publishStageEnd: jest.fn(),
    publishStepStart: jest.fn(),
    publishStepEnd: jest.fn(),
  } as unknown as PipelineLogSSEService;
}

function createMockRun(overrides?: Partial<PipelineRun>): PipelineRun {
  return {
    id: 'run-1',
    pipelineId: 'pipe-1',
    pipelineVersion: '1',
    triggerType: 'manual' as any,
    status: 'running' as any,
    context: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PipelineRun;
}

function createMockStage(overrides?: Partial<Stage>): Stage {
  return {
    id: 'stage-1',
    runId: 'run-1',
    name: 'Build',
    sequence: 1,
    status: 'running' as any,
    dependsOn: [],
    timeoutSeconds: 3600,
    retryCount: 0,
    maxRetries: 0,
    ...overrides,
  } as Stage;
}

function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: 'task-1',
    stageId: 'stage-1',
    name: 'npm install',
    type: 'shell',
    sequence: 1,
    status: 'running' as any,
    config: {},
    parameters: {},
    retryCount: 0,
    maxRetries: 0,
    timeoutSeconds: 600,
    ...overrides,
  } as Task;
}

describe('PipelineEventSSEBridge', () => {
  let sseService: PipelineLogSSEService;
  let bridge: PipelineEventSSEBridge;

  beforeEach(() => {
    jest.clearAllMocks();
    sseService = createMockSSEService();
    bridge = new PipelineEventSSEBridge({ sseService });
  });

  // ==================== Run events ====================

  describe('publishRunStarted', () => {
    it('should publish running status event', () => {
      const run = createMockRun();

      bridge.publishRunStarted('pipe-1', run);

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipe-1',
          runId: 'run-1',
          status: 'running',
          progress: 0,
        })
      );
    });

    it('should not publish when status events disabled', () => {
      const b = new PipelineEventSSEBridge({ sseService, enableStatusEvents: false });
      b.publishRunStarted('pipe-1', createMockRun());

      expect(sseService.publishStatusEvent).not.toHaveBeenCalled();
    });
  });

  describe('publishRunCompleted', () => {
    it('should publish success status event', () => {
      bridge.publishRunCompleted('pipe-1', createMockRun());

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          progress: 100,
        })
      );
    });
  });

  describe('publishRunFailed', () => {
    it('should publish failed status event', () => {
      bridge.publishRunFailed('pipe-1', createMockRun());

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          progress: 100,
        })
      );
    });

    it('should publish error log when error message provided', () => {
      bridge.publishRunFailed('pipe-1', createMockRun(), 'Build failed');

      expect(sseService.publishLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: 'Build failed',
          level: 'error',
        })
      );
    });

    it('should not publish error log when no error message', () => {
      bridge.publishRunFailed('pipe-1', createMockRun());

      expect(sseService.publishLogEvent).not.toHaveBeenCalled();
    });

    it('should not publish error log when log events disabled', () => {
      const b = new PipelineEventSSEBridge({ sseService, enableLogEvents: false });
      b.publishRunFailed('pipe-1', createMockRun(), 'Error');

      expect(sseService.publishLogEvent).not.toHaveBeenCalled();
      expect(sseService.publishStatusEvent).toHaveBeenCalled();
    });
  });

  describe('publishRunCancelled', () => {
    it('should publish cancelled status event', () => {
      bridge.publishRunCancelled('pipe-1', createMockRun());

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          progress: 100,
        })
      );
    });
  });

  // ==================== Stage events ====================

  describe('publishStageStarted', () => {
    it('should publish stage running status and log', () => {
      const stage = createMockStage();

      bridge.publishStageStarted('pipe-1', 'run-1', stage);

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'running',
          stageId: 'stage-1',
          stageName: 'Build',
          progress: 0,
        })
      );
      expect(sseService.publishLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: 'Stage "Build" started',
          level: 'info',
        })
      );
    });

    it('should not publish log when log events disabled', () => {
      const b = new PipelineEventSSEBridge({ sseService, enableLogEvents: false });
      b.publishStageStarted('pipe-1', 'run-1', createMockStage());

      expect(sseService.publishLogEvent).not.toHaveBeenCalled();
      expect(sseService.publishStatusEvent).toHaveBeenCalled();
    });
  });

  describe('publishStageCompleted', () => {
    it('should publish success status with duration', () => {
      const stage = createMockStage({ durationMs: 5000 });

      bridge.publishStageCompleted('pipe-1', 'run-1', stage);

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', progress: 100 })
      );
      expect(sseService.publishLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: 'Stage "Build" completed (5s)',
        })
      );
    });

    it('should publish without duration when not available', () => {
      const stage = createMockStage({ durationMs: undefined });

      bridge.publishStageCompleted('pipe-1', 'run-1', stage);

      expect(sseService.publishLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: 'Stage "Build" completed',
        })
      );
    });
  });

  describe('publishStageFailed', () => {
    it('should publish failed status with error message', () => {
      const stage = createMockStage();

      bridge.publishStageFailed('pipe-1', 'run-1', stage, 'Compile error');

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', progress: 100 })
      );
      expect(sseService.publishLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: 'Stage "Build" failed: Compile error',
          level: 'error',
        })
      );
    });

    it('should publish without error when not provided', () => {
      bridge.publishStageFailed('pipe-1', 'run-1', createMockStage());

      expect(sseService.publishLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: 'Stage "Build" failed',
        })
      );
    });
  });

  describe('publishStageSkipped', () => {
    it('should publish skip event with warn level', () => {
      bridge.publishStageSkipped('pipe-1', 'run-1', createMockStage());

      expect(sseService.publishStatusEvent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', progress: 100 })
      );
      expect(sseService.publishLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: 'Stage "Build" skipped',
          level: 'warn',
        })
      );
    });
  });

  // ==================== Task events ====================

  describe('publishTaskStarted', () => {
    it('should publish step start', () => {
      const stage = createMockStage();
      const task = createMockTask();

      bridge.publishTaskStarted('pipe-1', 'run-1', stage, task);

      expect(sseService.publishStepStart).toHaveBeenCalledWith(
        'pipe-1', 'run-1', 'stage-1', 'Build', 'npm install'
      );
    });

    it('should not publish when log events disabled', () => {
      const b = new PipelineEventSSEBridge({ sseService, enableLogEvents: false });
      b.publishTaskStarted('pipe-1', 'run-1', createMockStage(), createMockTask());

      expect(sseService.publishStepStart).not.toHaveBeenCalled();
    });
  });

  describe('publishTaskCompleted', () => {
    it('should publish step end with duration', () => {
      const task = createMockTask({ durationMs: 3000 });

      bridge.publishTaskCompleted('pipe-1', 'run-1', createMockStage(), task);

      expect(sseService.publishStepEnd).toHaveBeenCalledWith(
        'pipe-1', 'run-1', 'stage-1', 'Build', 'npm install', 'success', 3000
      );
    });
  });

  describe('publishTaskFailed', () => {
    it('should publish step end as failed with error', () => {
      bridge.publishTaskFailed('pipe-1', 'run-1', createMockStage(), createMockTask(), 'Exit code 1');

      expect(sseService.publishStepEnd).toHaveBeenCalledWith(
        'pipe-1', 'run-1', 'stage-1', 'Build', 'npm install failed: Exit code 1', 'failed'
      );
    });

    it('should publish step end as failed without error', () => {
      bridge.publishTaskFailed('pipe-1', 'run-1', createMockStage(), createMockTask());

      expect(sseService.publishStepEnd).toHaveBeenCalledWith(
        'pipe-1', 'run-1', 'stage-1', 'Build', 'npm install failed', 'failed'
      );
    });
  });

  // ==================== Options ====================

  describe('constructor options', () => {
    it('should default to both events enabled', () => {
      const b = new PipelineEventSSEBridge({ sseService });
      const run = createMockRun();
      const stage = createMockStage();

      b.publishRunStarted('pipe-1', run);
      b.publishStageStarted('pipe-1', 'run-1', stage);

      expect(sseService.publishStatusEvent).toHaveBeenCalledTimes(2);
      expect(sseService.publishLogEvent).toHaveBeenCalledTimes(1);
    });

    it('should disable both event types', () => {
      const b = new PipelineEventSSEBridge({
        sseService,
        enableLogEvents: false,
        enableStatusEvents: false,
      });

      b.publishRunStarted('pipe-1', createMockRun());
      b.publishStageStarted('pipe-1', 'run-1', createMockStage());

      expect(sseService.publishStatusEvent).not.toHaveBeenCalled();
      expect(sseService.publishLogEvent).not.toHaveBeenCalled();
    });
  });
});
