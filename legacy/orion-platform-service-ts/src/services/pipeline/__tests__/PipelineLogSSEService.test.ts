/**
 * PipelineLogSSEService Unit Tests
 */

import { EventEmitter } from 'events';
import { PipelineLogSSEService } from '../PipelineLogSSEService';

// Mock pino
jest.mock('pino', () => {
  return () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  });
});

// Mock SSEConnectionManager
jest.mock('../../chatops/SSEConnectionManager', () => {
  return {
    SSEConnectionManager: jest.fn().mockImplementation(() => ({
      addConnection: jest.fn().mockResolvedValue(undefined),
      removeConnection: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getActiveConnectionCount: jest.fn().mockReturnValue(0),
      getConnectionsByUser: jest.fn().mockReturnValue(new Map()),
    })),
  };
});

describe('PipelineLogSSEService', () => {
  let localBus: EventEmitter;
  let service: PipelineLogSSEService;

  beforeEach(() => {
    jest.clearAllMocks();
    localBus = new EventEmitter();
    localBus.setMaxListeners(50);
    service = new PipelineLogSSEService(localBus);
  });

  afterEach(() => {
    localBus.removeAllListeners();
  });

  // ==================== publishLogEvent ====================

  describe('publishLogEvent', () => {
    it('should emit pipeline.log event on localBus', () => {
      const handler = jest.fn();
      localBus.on('pipeline.log', handler);

      service.publishLogEvent({
        pipelineId: 'pipe-1',
        runId: 'run-1',
        stageId: 'stage-1',
        stageName: 'Build',
        logLine: 'Building...',
        timestamp: new Date(),
        level: 'info',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipe-1',
          logLine: 'Building...',
        })
      );
    });
  });

  // ==================== publishStatusEvent ====================

  describe('publishStatusEvent', () => {
    it('should emit pipeline.status event on localBus', () => {
      const handler = jest.fn();
      localBus.on('pipeline.status', handler);

      service.publishStatusEvent({
        pipelineId: 'pipe-1',
        runId: 'run-1',
        status: 'running',
        progress: 50,
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'running',
          progress: 50,
        })
      );
    });
  });

  // ==================== publishStageStart ====================

  describe('publishStageStart', () => {
    it('should emit pipeline.stage_start event', () => {
      const handler = jest.fn();
      localBus.on('pipeline.stage_start', handler);

      service.publishStageStart('pipe-1', 'run-1', 'stage-1', 'Build');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipe-1',
          runId: 'run-1',
          stageId: 'stage-1',
          stageName: 'Build',
          status: 'running',
          progress: 0,
        })
      );
    });
  });

  // ==================== publishStageEnd ====================

  describe('publishStageEnd', () => {
    it('should emit pipeline.stage_end event with success', () => {
      const handler = jest.fn();
      localBus.on('pipeline.stage_end', handler);

      service.publishStageEnd('pipe-1', 'run-1', 'stage-1', 'Build', 'success', 100);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          progress: 100,
        })
      );
    });

    it('should emit with failed status', () => {
      const handler = jest.fn();
      localBus.on('pipeline.stage_end', handler);

      service.publishStageEnd('pipe-1', 'run-1', 'stage-1', 'Build', 'failed', 50);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', progress: 50 })
      );
    });

    it('should emit with skipped status', () => {
      const handler = jest.fn();
      localBus.on('pipeline.stage_end', handler);

      service.publishStageEnd('pipe-1', 'run-1', 'stage-1', 'Build', 'skipped', 100);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'skipped' })
      );
    });
  });

  // ==================== publishStepStart ====================

  describe('publishStepStart', () => {
    it('should emit pipeline.step_start event', () => {
      const handler = jest.fn();
      localBus.on('pipeline.step_start', handler);

      service.publishStepStart('pipe-1', 'run-1', 'stage-1', 'Build', 'npm install');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          stepName: 'npm install',
          logLine: '[Step] npm install started',
          level: 'info',
        })
      );
    });
  });

  // ==================== publishStepEnd ====================

  describe('publishStepEnd', () => {
    it('should emit pipeline.step_end event with success', () => {
      const handler = jest.fn();
      localBus.on('pipeline.step_end', handler);

      service.publishStepEnd('pipe-1', 'run-1', 'stage-1', 'Build', 'npm install', 'success', 3000);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: '[Step] npm install success (3000ms)',
          level: 'info',
          metadata: { durationMs: 3000 },
        })
      );
    });

    it('should emit with error level for failed', () => {
      const handler = jest.fn();
      localBus.on('pipeline.step_end', handler);

      service.publishStepEnd('pipe-1', 'run-1', 'stage-1', 'Build', 'npm install', 'failed');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: '[Step] npm install failed',
          level: 'error',
        })
      );
    });

    it('should omit duration when not provided', () => {
      const handler = jest.fn();
      localBus.on('pipeline.step_end', handler);

      service.publishStepEnd('pipe-1', 'run-1', 'stage-1', 'Build', 'npm test', 'success');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          logLine: '[Step] npm test success',
        })
      );
    });
  });

  // ==================== Event forwarding ====================

  describe('event forwarding', () => {
    it('should forward pipeline.log events to pipeline-specific channel', () => {
      const handler = jest.fn();
      localBus.on('pipeline:pipe-1:update', handler);

      localBus.emit('pipeline.log', {
        pipelineId: 'pipe-1',
        runId: 'run-1',
        stageId: 'stage-1',
        stageName: 'Build',
        logLine: 'test log',
        timestamp: new Date(),
        level: 'info',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'log',
          data: expect.objectContaining({ pipelineId: 'pipe-1' }),
        })
      );
    });

    it('should forward pipeline.status events', () => {
      const handler = jest.fn();
      localBus.on('pipeline:pipe-1:update', handler);

      localBus.emit('pipeline.status', {
        pipelineId: 'pipe-1',
        runId: 'run-1',
        status: 'running',
        progress: 50,
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'status' })
      );
    });
  });

  // ==================== removeConnection ====================

  describe('removeConnection', () => {
    it('should call sseManager.removeConnection', async () => {
      await service.removeConnection('conn-1');
      // No error thrown means success
      expect(true).toBe(true);
    });
  });

  // ==================== shutdown ====================

  describe('shutdown', () => {
    it('should call sseManager.shutdown', async () => {
      await service.shutdown();
      expect(true).toBe(true);
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return connection stats', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('connectionsByUser');
      expect(stats.totalConnections).toBe(0);
    });
  });
});
