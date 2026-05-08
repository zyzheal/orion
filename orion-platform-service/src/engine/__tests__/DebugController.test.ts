/**
 * DebugController Tests
 *
 * Verifies pause/resume/step debug controls for pipeline executions.
 */

import { DebugController } from '../DebugController';

describe('DebugController', () => {
  beforeEach(() => {
    DebugController.resetForTesting();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = DebugController.getInstance();
      const b = DebugController.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('pause', () => {
    it('should create debug state for new runId', async () => {
      const controller = DebugController.getInstance();
      const state = await controller.pause('run-001');

      expect(state.runId).toBe('run-001');
      expect(state.status).toBe('paused');
    });

    it('should return existing state if already paused', async () => {
      const controller = DebugController.getInstance();
      const first = await controller.pause('run-002');
      const second = await controller.pause('run-002');

      expect(first).toBe(second);
    });
  });

  describe('resume', () => {
    it('should resume a paused pipeline', async () => {
      const controller = DebugController.getInstance();
      await controller.pause('run-003');

      await controller.resume('run-003');

      const state = controller.getState('run-003');
      expect(state?.status).toBe('running');
    });

    it('should throw if no debug state exists', async () => {
      const controller = DebugController.getInstance();

      await expect(controller.resume('nonexistent')).rejects.toThrow('No debug state found');
    });

    it('should throw if pipeline is not paused', async () => {
      const controller = DebugController.getInstance();
      await controller.pause('run-004');
      await controller.resume('run-004');

      await expect(controller.resume('run-004')).rejects.toThrow('not paused');
    });
  });

  describe('step', () => {
    it('should set pipeline to stepping mode', async () => {
      const controller = DebugController.getInstance();
      await controller.pause('run-005');

      const state = await controller.step('run-005');

      expect(state.status).toBe('stepping');
    });

    it('should throw if no debug state exists', async () => {
      const controller = DebugController.getInstance();

      await expect(controller.step('nonexistent')).rejects.toThrow('No debug state found');
    });
  });

  describe('shouldPause', () => {
    it('should return false for unknown runId', () => {
      const controller = DebugController.getInstance();
      expect(controller.shouldPause('unknown')).toBe(false);
    });

    it('should return true for paused run', async () => {
      const controller = DebugController.getInstance();
      await controller.pause('run-006');

      expect(controller.shouldPause('run-006')).toBe(true);
    });

    it('should return false for running run', async () => {
      const controller = DebugController.getInstance();
      await controller.pause('run-007');
      await controller.resume('run-007');

      expect(controller.shouldPause('run-007')).toBe(false);
    });
  });

  describe('waitForSignal', () => {
    it('should return true immediately for no debug state', async () => {
      const controller = DebugController.getInstance();
      const result = await controller.waitForSignal('no-debug');
      expect(result).toBe(true);
    });

    it('should allow one task in stepping mode then re-pause', async () => {
      const controller = DebugController.getInstance();
      await controller.pause('run-008');
      await controller.step('run-008');

      // First call should allow execution (step mode)
      const result = await controller.waitForSignal('run-008');
      expect(result).toBe(true);

      // After step, status should be back to paused
      const state = controller.getState('run-008');
      expect(state?.status).toBe('paused');
    });
  });

  describe('registerRun / unregisterRun', () => {
    it('should register and unregister runs', () => {
      const controller = DebugController.getInstance();

      controller.registerRun('run-009', { currentStage: 'build' });
      expect(controller.getState('run-009')).toBeDefined();
      expect(controller.getState('run-009')?.currentStage).toBe('build');

      controller.unregisterRun('run-009');
      expect(controller.getState('run-009')).toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should list active debug sessions', async () => {
      const controller = DebugController.getInstance();

      await controller.pause('run-010');
      await controller.pause('run-011');

      const sessions = controller.listSessions();
      expect(sessions.length).toBe(2);
      expect(sessions.map((s) => s.runId).sort()).toEqual(['run-010', 'run-011']);
    });
  });

  describe('concurrent sessions', () => {
    it('should not interfere between different runIds', async () => {
      const controller = DebugController.getInstance();

      await controller.pause('run-a');
      await controller.pause('run-b');

      // Resume only run-a
      await controller.resume('run-a');

      expect(controller.getState('run-a')?.status).toBe('running');
      expect(controller.getState('run-b')?.status).toBe('paused');
    });
  });
});
