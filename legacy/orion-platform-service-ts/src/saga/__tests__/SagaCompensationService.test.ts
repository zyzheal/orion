/**
 * SagaCompensationService Tests
 *
 * Tests for saga compensation: register, execute, full compensation,
 * status tracking, cleanup, and error handling.
 */
import {
  SagaCompensationService,
  SagaCompensationError,
  CompensationStatus,
} from '../SagaCompensationService';

describe('SagaCompensationService', () => {
  let service: SagaCompensationService;

  beforeEach(() => {
    service = new SagaCompensationService();
  });

  describe('registerCompensation', () => {
    it('should register a compensation action', () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('action-1', fn, { orchestrationId: 'orch-1' });

      const record = service.getRecord('action-1');
      expect(record).toBeDefined();
      expect(record!.actionId).toBe('action-1');
      expect(record!.status).toBe('registered');
      expect(record!.orchestrationId).toBe('orch-1');
    });

    it('should throw if actionId is empty', () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      expect(() => service.registerCompensation('', fn)).toThrow(SagaCompensationError);
    });

    it('should throw if compensationFn is not a function', () => {
      expect(() => service.registerCompensation('action-1', null as any)).toThrow(SagaCompensationError);
    });

    it('should throw if duplicate registration with non-completed status', () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('action-1', fn, { orchestrationId: 'orch-1' });
      expect(() => service.registerCompensation('action-1', fn)).toThrow(SagaCompensationError);
    });

    it('should allow re-registration after completion', () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('action-1', fn, { orchestrationId: 'orch-1' });
      // Simulate completion
      const record = service.getRecord('action-1');
      record!.status = 'completed';
      // Re-register should succeed
      service.registerCompensation('action-1', fn, { orchestrationId: 'orch-1' });
      expect(service.getRecord('action-1')!.status).toBe('registered');
    });

    it('should track actions by orchestrationId', () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('a-1', fn, { orchestrationId: 'orch-1' });
      service.registerCompensation('a-2', fn, { orchestrationId: 'orch-1' });
      service.registerCompensation('a-3', fn, { orchestrationId: 'orch-2' });

      expect(service.getOrchestrationIds()).toEqual(['orch-1', 'orch-2']);
    });
  });

  describe('executeCompensation', () => {
    it('should execute a registered compensation successfully', async () => {
      const fn = jest.fn(async () => ({ success: true, result: 'compensated' }));
      service.registerCompensation('action-1', fn, { orchestrationId: 'orch-1' });

      const result = await service.executeCompensation('action-1');

      expect(result.success).toBe(true);
      expect(result.result).toBe('compensated');
      expect(fn).toHaveBeenCalled();

      const record = service.getRecord('action-1');
      expect(record!.status).toBe('completed');
    });

    it('should return error for unknown actionId', async () => {
      const result = await service.executeCompensation('unknown');

      expect(result.success).toBe(false);
      expect(result.error).toBe('COMPENSATION_NOT_FOUND');
    });

    it('should return error for already completed compensation', async () => {
      const fn = jest.fn(async () => ({ success: true, result: 'done' }));
      service.registerCompensation('action-1', fn, { orchestrationId: 'orch-1' });

      // Execute once
      await service.executeCompensation('action-1');

      // Try again
      const result = await service.executeCompensation('action-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_COMPLETED');
    });

    it('should retry on compensation failure', async () => {
      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts += 1;
        if (attempts < 3) return { success: false, result: 'retrying' };
        return { success: true, result: 'finally ok' };
      });

      service.registerCompensation('action-1', fn, {
        orchestrationId: 'orch-1',
        maxRetries: 3,
      });

      const result = await service.executeCompensation('action-1');

      // Should eventually succeed after retries
      expect(result.success).toBe(true);
      expect(attempts).toBeGreaterThanOrEqual(3);
    });
  });

  describe('executeFullCompensation', () => {
    it('should compensate all actions in reverse order', async () => {
      const order: string[] = [];
      const fn = jest.fn(async (ctx) => {
        order.push(ctx.actionId);
        return { success: true, result: 'compensated' };
      });

      service.registerCompensation('a-1', fn, { orchestrationId: 'orch-1' });
      service.registerCompensation('a-2', fn, { orchestrationId: 'orch-1' });
      service.registerCompensation('a-3', fn, { orchestrationId: 'orch-1' });

      const result = await service.executeFullCompensation('orch-1');

      expect(result.success).toBe(true);
      // Reverse order: a-3, a-2, a-1
      expect(order).toEqual(['a-3', 'a-2', 'a-1']);
    });

    it('should return error for unknown orchestrationId', async () => {
      const result = await service.executeFullCompensation('unknown');

      expect(result.success).toBe(false);
      expect(result.result.overallStatus).toBe('not_started');
    });
  });

  describe('getCompensationStatus', () => {
    it('should return correct status summary', () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('a-1', fn, { orchestrationId: 'orch-1' });
      service.registerCompensation('a-2', fn, { orchestrationId: 'orch-1' });

      const status = service.getCompensationStatus('orch-1');

      expect(status.totalActions).toBe(2);
      expect(status.pendingCount).toBe(2);
      expect(status.compensatedCount).toBe(0);
      expect(status.overallStatus).toBe('not_started');
    });

    it('should show completed status after full compensation', async () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('a-1', fn, { orchestrationId: 'orch-1' });

      await service.executeCompensation('a-1');

      const status = service.getCompensationStatus('orch-1');
      expect(status.compensatedCount).toBe(1);
      expect(status.overallStatus).toBe('completed');
    });
  });

  describe('cleanupCompletedCompensations', () => {
    it('should remove completed records', async () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('a-1', fn, { orchestrationId: 'orch-1' });

      await service.executeCompensation('a-1');

      const cleaned = service.cleanupCompletedCompensations();
      expect(cleaned).toBe(1);
      expect(service.getRecord('a-1')).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const fn = jest.fn(async () => ({ success: true, result: 'ok' }));
      service.registerCompensation('a-1', fn, { orchestrationId: 'orch-1' });

      service.reset();

      expect(service.getAllRecords()).toHaveLength(0);
      expect(service.getOrchestrationIds()).toHaveLength(0);
    });
  });
});
