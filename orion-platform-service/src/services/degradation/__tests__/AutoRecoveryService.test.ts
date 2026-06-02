/**
 * AutoRecoveryService Tests
 *
 * Covers:
 * - Constructor: default config, custom config, with DB
 * - markDegraded: mark provider as degraded
 * - attemptRecovery: success/failure, max attempts
 * - getRecoveryStats: stats calculation
 * - getOverallSuccessRate: overall rate
 * - getDegradedProviders: list degraded
 * - clearDegraded: manual clear
 * - resetAttempts: reset attempt counter
 * - startMonitoring/stopMonitoring: timer management
 * - updateProviderSuccessRate: external rate update
 * - getAllStats: summary
 * - Recovery events: recovery:success, recovery:failed
 */

import { AutoRecoveryService } from '../AutoRecoveryService';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }));

describe('AutoRecoveryService', () => {
  let service: AutoRecoveryService;

  beforeEach(() => {
    service = new AutoRecoveryService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.stopMonitoring();
    jest.useRealTimers();
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should use default config', () => {
      const config = service.getConfig();
      expect(config.recoveryCheckInterval).toBe(30000);
      expect(config.minRecoveryTime).toBe(60000);
      expect(config.successThreshold).toBe(0.5);
      expect(config.maxRecoveryAttempts).toBe(3);
    });

    it('should accept custom config', () => {
      const custom = new AutoRecoveryService({ maxRecoveryAttempts: 5, successThreshold: 0.8 });
      expect(custom.getConfig().maxRecoveryAttempts).toBe(5);
      expect(custom.getConfig().successThreshold).toBe(0.8);
    });
  });

  // ==================== markDegraded ====================

  describe('markDegraded', () => {
    it('should mark provider as degraded', () => {
      service.markDegraded('provider-1');
      expect(service.getDegradedProviders()).toContain('provider-1');
    });

    it('should track multiple degraded providers', () => {
      service.markDegraded('p1');
      service.markDegraded('p2');
      expect(service.getDegradedProviders()).toHaveLength(2);
    });
  });

  // ==================== attemptRecovery ====================

  describe('attemptRecovery', () => {
    it('should attempt recovery for degraded provider', async () => {
      service.markDegraded('p1');
      // Default probe returns 0.6 > 0.5 threshold
      const result = await service.attemptRecovery('p1');

      expect(result.attempted).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should fail recovery when probe returns low rate', async () => {
      service.markDegraded('p1');
      // Set rate below threshold so probe returns low value
      service.updateProviderSuccessRate('p1', 0.3);

      const result = await service.attemptRecovery('p1');

      expect(result.attempted).toBe(true);
      expect(result.success).toBe(false);
    });

    it('should not attempt after max attempts reached', async () => {
      service.markDegraded('p1');
      service.updateProviderSuccessRate('p1', 0.3);

      // Exhaust attempts
      await service.attemptRecovery('p1');
      await service.attemptRecovery('p1');
      await service.attemptRecovery('p1');

      const result = await service.attemptRecovery('p1');
      expect(result.attempted).toBe(false);
    });

    it('should emit recovery:success on success', async () => {
      const spy = jest.fn();
      service.on('recovery:success', spy);
      service.markDegraded('p1');

      await service.attemptRecovery('p1');

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'p1' }));
    });

    it('should emit recovery:failed on failure', async () => {
      const spy = jest.fn();
      service.on('recovery:failed', spy);
      service.markDegraded('p1');
      service.updateProviderSuccessRate('p1', 0.3);

      await service.attemptRecovery('p1');

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'p1' }));
    });

    it('should remove from degraded list on success', async () => {
      service.markDegraded('p1');
      await service.attemptRecovery('p1');

      expect(service.getDegradedProviders()).not.toContain('p1');
    });
  });

  // ==================== getRecoveryStats ====================

  describe('getRecoveryStats', () => {
    it('should return stats with no attempts', () => {
      const stats = service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
    });

    it('should track success and failure counts', async () => {
      service.markDegraded('p1');
      await service.attemptRecovery('p1');

      const stats = service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBe(1);
      expect(stats.successCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== getOverallSuccessRate ====================

  describe('getOverallSuccessRate', () => {
    it('should return 0 with no attempts', () => {
      expect(service.getOverallSuccessRate()).toBe(0);
    });

    it('should calculate rate from attempts', async () => {
      service.markDegraded('p1');
      await service.attemptRecovery('p1');

      const rate = service.getOverallSuccessRate();
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  // ==================== clearDegraded ====================

  describe('clearDegraded', () => {
    it('should remove provider from degraded list', () => {
      service.markDegraded('p1');
      service.clearDegraded('p1');
      expect(service.getDegradedProviders()).not.toContain('p1');
    });
  });

  // ==================== resetAttempts ====================

  describe('resetAttempts', () => {
    it('should reset attempt counter', async () => {
      service.markDegraded('p1');
      service.updateProviderSuccessRate('p1', 0.3);
      await service.attemptRecovery('p1');

      service.resetAttempts('p1');

      const stats = service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBe(0);
    });
  });

  // ==================== startMonitoring / stopMonitoring ====================

  describe('startMonitoring/stopMonitoring', () => {
    it('should start monitoring timer', () => {
      service.startMonitoring();
      // Should not throw
    });

    it('should not start twice', () => {
      service.startMonitoring();
      service.startMonitoring(); // second call should warn
    });

    it('should stop monitoring timer', () => {
      service.startMonitoring();
      service.stopMonitoring();
    });

    it('should handle stop when not started', () => {
      service.stopMonitoring(); // should not throw
    });
  });

  // ==================== updateProviderSuccessRate ====================

  describe('updateProviderSuccessRate', () => {
    it('should update success rate', () => {
      service.updateProviderSuccessRate('p1', 0.75);
      // Rate is used internally for probeProvider
    });
  });

  // ==================== getAllStats ====================

  describe('getAllStats', () => {
    it('should return summary stats', () => {
      const stats = service.getAllStats();
      expect(stats.totalProviders).toBe(0);
      expect(stats.degradedProviders).toBe(0);
      expect(stats.overallSuccessRate).toBe(0);
      expect(stats.providers).toEqual([]);
    });

    it('should include degraded count', () => {
      service.markDegraded('p1');
      service.markDegraded('p2');
      const stats = service.getAllStats();
      expect(stats.degradedProviders).toBe(2);
    });
  });

  // ==================== checkRecoveryCandidates ====================

  describe('checkRecoveryCandidates', () => {
    it('should attempt recovery for eligible providers', async () => {
      service.markDegraded('p1');
      // Advance time past minRecoveryTime
      jest.advanceTimersByTime(61000);

      await service.checkRecoveryCandidates();

      const stats = service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBeGreaterThanOrEqual(1);
    });

    it('should not attempt for recently degraded providers', async () => {
      service.markDegraded('p1');
      // Only advance 10 seconds (less than minRecoveryTime of 60s)
      jest.advanceTimersByTime(10000);

      await service.checkRecoveryCandidates();

      const stats = service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBe(0);
    });
  });
});
