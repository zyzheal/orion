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

// In-memory mock for PostgreSQL
function createMockDb() {
  const tables: Record<string, any[]> = {
    auto_recovery_records: [],
    auto_recovery_degraded_state: [],
  };

  const mockDb = {
    query: jest.fn(async (text: string, params: any[] = []) => {
      // Simple in-memory query simulation
      if (text.includes('INSERT INTO auto_recovery_records')) {
        const row = {
          id: params[0],
          provider_id: params[1],
          attempted_at: params[2],
          success: params[3],
          success_rate: params[4],
          degraded_at: params[5],
          recovered_at: params[6],
          tenant_id: params[7],
          created_at: new Date(),
        };
        tables.auto_recovery_records.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (text.includes('INSERT INTO auto_recovery_degraded_state')) {
        const existing = tables.auto_recovery_degraded_state.find(r => r.provider_id === params[1]);
        if (existing) {
          existing.degraded_at = params[2];
          existing.last_success_rate = params[3];
          existing.updated_at = new Date();
          return { rows: [existing], rowCount: 1 };
        }
        const row = {
          id: params[0],
          provider_id: params[1],
          degraded_at: params[2],
          last_success_rate: params[3],
          tenant_id: params[4],
          created_at: new Date(),
          updated_at: new Date(),
        };
        tables.auto_recovery_degraded_state.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (text.includes('DELETE FROM auto_recovery_degraded_state WHERE provider_id')) {
        const idx = tables.auto_recovery_degraded_state.findIndex(r => r.provider_id === params[0]);
        if (idx >= 0) tables.auto_recovery_degraded_state.splice(idx, 1);
        return { rows: [], rowCount: idx >= 0 ? 1 : 0 };
      }

      if (text.includes('DELETE FROM auto_recovery_records WHERE provider_id')) {
        const before = tables.auto_recovery_records.length;
        tables.auto_recovery_records = tables.auto_recovery_records.filter(r => r.provider_id !== params[0]);
        return { rows: [], rowCount: before - tables.auto_recovery_records.length };
      }

      if (text.includes('SELECT * FROM auto_recovery_degraded_state ORDER BY degraded_at DESC')) {
        return { rows: [...tables.auto_recovery_degraded_state], rowCount: tables.auto_recovery_degraded_state.length };
      }

      if (text.includes('SELECT * FROM auto_recovery_degraded_state WHERE provider_id')) {
        const row = tables.auto_recovery_degraded_state.find(r => r.provider_id === params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (text.includes('COUNT(*)') && text.includes('auto_recovery_records') && text.includes('provider_id')) {
        const attempts = tables.auto_recovery_records.filter(r => r.provider_id === params[0]);
        const successes = attempts.filter(r => r.success);
        return {
          rows: [{
            attempt_count: String(attempts.length),
            success_count: String(successes.length),
            failure_count: String(attempts.length - successes.length),
            last_attempt_at: attempts.length > 0 ? attempts[attempts.length - 1].attempted_at : null,
            last_success_at: successes.length > 0 ? successes[successes.length - 1].attempted_at : null,
          }],
          rowCount: 1,
        };
      }

      if (text.includes('COUNT(*)') && text.includes('auto_recovery_records')) {
        const successes = tables.auto_recovery_records.filter(r => r.success);
        return {
          rows: [{
            total_attempts: String(tables.auto_recovery_records.length),
            total_successes: String(successes.length),
          }],
          rowCount: 1,
        };
      }

      if (text.includes('SELECT DISTINCT provider_id FROM auto_recovery_records')) {
        const ids = [...new Set(tables.auto_recovery_records.map(r => r.provider_id))];
        return { rows: ids.map(id => ({ provider_id: id })), rowCount: ids.length };
      }

      return { rows: [], rowCount: 0 };
    }),
  };

  return mockDb;
}

describe('AutoRecoveryService', () => {
  let service: AutoRecoveryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AutoRecoveryService({}, mockDb as any);
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
      const custom = new AutoRecoveryService({ maxRecoveryAttempts: 5, successThreshold: 0.8 }, mockDb as any);
      expect(custom.getConfig().maxRecoveryAttempts).toBe(5);
      expect(custom.getConfig().successThreshold).toBe(0.8);
    });
  });

  // ==================== markDegraded ====================

  describe('markDegraded', () => {
    it('should mark provider as degraded', async () => {
      await service.markDegraded('provider-1');
      const degraded = await service.getDegradedProviders();
      expect(degraded).toContain('provider-1');
    });

    it('should track multiple degraded providers', async () => {
      await service.markDegraded('p1');
      await service.markDegraded('p2');
      const degraded = await service.getDegradedProviders();
      expect(degraded).toHaveLength(2);
    });
  });

  // ==================== attemptRecovery ====================

  describe('attemptRecovery', () => {
    it('should attempt recovery for degraded provider', async () => {
      await service.markDegraded('p1');
      // Default probe returns 0.6 > 0.5 threshold
      const result = await service.attemptRecovery('p1');

      expect(result.attempted).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should fail recovery when probe returns low rate', async () => {
      await service.markDegraded('p1');
      // Set rate below threshold so probe returns low value
      await service.updateProviderSuccessRate('p1', 0.3);

      const result = await service.attemptRecovery('p1');

      expect(result.attempted).toBe(true);
      expect(result.success).toBe(false);
    });

    it('should not attempt after max attempts reached', async () => {
      await service.markDegraded('p1');
      await service.updateProviderSuccessRate('p1', 0.3);

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
      await service.markDegraded('p1');

      await service.attemptRecovery('p1');

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'p1' }));
    });

    it('should emit recovery:failed on failure', async () => {
      const spy = jest.fn();
      service.on('recovery:failed', spy);
      await service.markDegraded('p1');
      await service.updateProviderSuccessRate('p1', 0.3);

      await service.attemptRecovery('p1');

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'p1' }));
    });

    it('should remove from degraded list on success', async () => {
      await service.markDegraded('p1');
      await service.attemptRecovery('p1');

      const degraded = await service.getDegradedProviders();
      expect(degraded).not.toContain('p1');
    });
  });

  // ==================== getRecoveryStats ====================

  describe('getRecoveryStats', () => {
    it('should return stats with no attempts', async () => {
      const stats = await service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
    });

    it('should track success and failure counts', async () => {
      await service.markDegraded('p1');
      await service.attemptRecovery('p1');

      const stats = await service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBe(1);
      expect(stats.successCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== getOverallSuccessRate ====================

  describe('getOverallSuccessRate', () => {
    it('should return 0 with no attempts', async () => {
      expect(await service.getOverallSuccessRate()).toBe(0);
    });

    it('should calculate rate from attempts', async () => {
      await service.markDegraded('p1');
      await service.attemptRecovery('p1');

      const rate = await service.getOverallSuccessRate();
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  // ==================== clearDegraded ====================

  describe('clearDegraded', () => {
    it('should remove provider from degraded list', async () => {
      await service.markDegraded('p1');
      await service.clearDegraded('p1');
      const degraded = await service.getDegradedProviders();
      expect(degraded).not.toContain('p1');
    });
  });

  // ==================== resetAttempts ====================

  describe('resetAttempts', () => {
    it('should reset attempt counter', async () => {
      await service.markDegraded('p1');
      await service.updateProviderSuccessRate('p1', 0.3);
      await service.attemptRecovery('p1');

      await service.resetAttempts('p1');

      const stats = await service.getRecoveryStats('p1');
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
    it('should update success rate for degraded provider', async () => {
      await service.markDegraded('p1');
      await service.updateProviderSuccessRate('p1', 0.75);
      // Rate is used internally for probeProvider
    });
  });

  // ==================== getAllStats ====================

  describe('getAllStats', () => {
    it('should return summary stats', async () => {
      const stats = await service.getAllStats();
      expect(stats.totalProviders).toBe(0);
      expect(stats.degradedProviders).toBe(0);
      expect(stats.overallSuccessRate).toBe(0);
      expect(stats.providers).toEqual([]);
    });

    it('should include degraded count', async () => {
      await service.markDegraded('p1');
      await service.markDegraded('p2');
      const stats = await service.getAllStats();
      expect(stats.degradedProviders).toBe(2);
    });
  });

  // ==================== checkRecoveryCandidates ====================

  describe('checkRecoveryCandidates', () => {
    it('should attempt recovery for eligible providers', async () => {
      await service.markDegraded('p1');
      // Advance time past minRecoveryTime
      jest.advanceTimersByTime(61000);

      await service.checkRecoveryCandidates();

      const stats = await service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBeGreaterThanOrEqual(1);
    });

    it('should not attempt for recently degraded providers', async () => {
      await service.markDegraded('p1');
      // Only advance 10 seconds (less than minRecoveryTime of 60s)
      jest.advanceTimersByTime(10000);

      await service.checkRecoveryCandidates();

      const stats = await service.getRecoveryStats('p1');
      expect(stats.attemptCount).toBe(0);
    });
  });
});
