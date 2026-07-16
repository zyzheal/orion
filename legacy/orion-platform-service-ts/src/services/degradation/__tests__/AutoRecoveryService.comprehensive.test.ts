// orion-platform-service/src/services/degradation/__tests__/AutoRecoveryService.comprehensive.test.ts
// Comprehensive TDD tests for AutoRecoveryService

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid-0000') }));

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

import { AutoRecoveryService, AutoRecoveryConfig, RecoveryStats } from '../AutoRecoveryService';

// In-memory mock for PostgreSQL
function createMockDb() {
  const tables: Record<string, any[]> = {
    auto_recovery_records: [],
    auto_recovery_degraded_state: [],
  };

  return {
    query: jest.fn(async (text: string, params: any[] = []) => {
      if (text.includes('INSERT INTO auto_recovery_records')) {
        const row = {
          id: params[0], provider_id: params[1], attempted_at: params[2],
          success: params[3], success_rate: params[4], degraded_at: params[5],
          recovered_at: params[6], tenant_id: params[7], created_at: new Date(),
        };
        tables.auto_recovery_records.push(row);
        return { rows: [row], rowCount: 1 };
      }
      if (text.includes('INSERT INTO auto_recovery_degraded_state')) {
        const existing = tables.auto_recovery_degraded_state.find(r => r.provider_id === params[1]);
        if (existing) {
          existing.degraded_at = params[2]; existing.last_success_rate = params[3]; existing.updated_at = new Date();
          return { rows: [existing], rowCount: 1 };
        }
        const row = {
          id: params[0], provider_id: params[1], degraded_at: params[2],
          last_success_rate: params[3], tenant_id: params[4],
          created_at: new Date(), updated_at: new Date(),
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
      if (text.includes('SELECT * FROM auto_recovery_degraded_state ORDER BY')) {
        return { rows: [...tables.auto_recovery_degraded_state], rowCount: tables.auto_recovery_degraded_state.length };
      }
      if (text.includes('SELECT * FROM auto_recovery_degraded_state WHERE provider_id')) {
        const row = tables.auto_recovery_degraded_state.find(r => r.provider_id === params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (text.includes('COUNT(*)') && text.includes('provider_id')) {
        const attempts = tables.auto_recovery_records.filter(r => r.provider_id === params[0]);
        const successes = attempts.filter(r => r.success);
        return {
          rows: [{
            attempt_count: String(attempts.length), success_count: String(successes.length),
            failure_count: String(attempts.length - successes.length),
            last_attempt_at: attempts.length > 0 ? attempts[attempts.length - 1].attempted_at : null,
            last_success_at: successes.length > 0 ? successes[successes.length - 1].attempted_at : null,
          }], rowCount: 1,
        };
      }
      if (text.includes('COUNT(*)') && text.includes('auto_recovery_records')) {
        const successes = tables.auto_recovery_records.filter(r => r.success);
        return { rows: [{ total_attempts: String(tables.auto_recovery_records.length), total_successes: String(successes.length) }], rowCount: 1 };
      }
      if (text.includes('SELECT DISTINCT provider_id')) {
        const ids = [...new Set(tables.auto_recovery_records.map(r => r.provider_id))];
        return { rows: ids.map(id => ({ provider_id: id })), rowCount: ids.length };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('AutoRecoveryService - Comprehensive Tests', () => {
  let service: AutoRecoveryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  afterEach(() => {
    service?.stopMonitoring();
  });

  // =========================================================================
  // 1. Constructor and Configuration
  // =========================================================================
  describe('Constructor and Configuration', () => {
    it('should use default config when no config is provided', () => {
      service = new AutoRecoveryService({}, mockDb as any);
      const config = service.getConfig();
      expect(config.recoveryCheckInterval).toBe(30000);
      expect(config.minRecoveryTime).toBe(60000);
      expect(config.successThreshold).toBe(0.5);
      expect(config.maxRecoveryAttempts).toBe(3);
    });

    it('should merge partial config with defaults', () => {
      service = new AutoRecoveryService({ recoveryCheckInterval: 5000 }, mockDb as any);
      const config = service.getConfig();
      expect(config.recoveryCheckInterval).toBe(5000);
      expect(config.minRecoveryTime).toBe(60000);
    });

    it('should override all config fields', () => {
      const fullConfig: AutoRecoveryConfig = {
        recoveryCheckInterval: 10000,
        minRecoveryTime: 20000,
        successThreshold: 0.8,
        maxRecoveryAttempts: 5,
      };
      service = new AutoRecoveryService(fullConfig, mockDb as any);
      expect(service.getConfig()).toEqual(fullConfig);
    });

    it('should return a copy of config (not a reference)', () => {
      service = new AutoRecoveryService({}, mockDb as any);
      const config1 = service.getConfig();
      const config2 = service.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should initialize with empty degraded providers list', async () => {
      service = new AutoRecoveryService({}, mockDb as any);
      expect(await service.getDegradedProviders()).toEqual([]);
    });

    it('should initialize with 0% overall success rate', async () => {
      service = new AutoRecoveryService({}, mockDb as any);
      expect(await service.getOverallSuccessRate()).toBe(0);
    });
  });

  // =========================================================================
  // 2. markDegraded
  // =========================================================================
  describe('markDegraded', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({}, mockDb as any);
    });

    it('should add provider to degraded list', async () => {
      await service.markDegraded('provider-1');
      expect(await service.getDegradedProviders()).toContain('provider-1');
    });

    it('should track multiple degraded providers', async () => {
      await service.markDegraded('provider-1');
      await service.markDegraded('provider-2');
      await service.markDegraded('provider-3');
      const degraded = await service.getDegradedProviders();
      expect(degraded).toHaveLength(3);
    });

    it('should overwrite existing degraded entry on duplicate mark', async () => {
      await service.markDegraded('provider-1');
      await service.markDegraded('provider-1');
      expect(await service.getDegradedProviders()).toHaveLength(1);
    });
  });

  // =========================================================================
  // 3. clearDegraded
  // =========================================================================
  describe('clearDegraded', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({}, mockDb as any);
    });

    it('should remove provider from degraded list', async () => {
      await service.markDegraded('provider-1');
      expect(await service.getDegradedProviders()).toContain('provider-1');
      await service.clearDegraded('provider-1');
      expect(await service.getDegradedProviders()).not.toContain('provider-1');
    });

    it('should not throw when clearing non-existent provider', async () => {
      await expect(service.clearDegraded('non-existent')).resolves.not.toThrow();
    });

    it('should not affect other providers when clearing one', async () => {
      await service.markDegraded('provider-1');
      await service.markDegraded('provider-2');
      await service.clearDegraded('provider-1');
      expect(await service.getDegradedProviders()).toContain('provider-2');
      expect(await service.getDegradedProviders()).not.toContain('provider-1');
    });
  });

  // =========================================================================
  // 4. attemptRecovery
  // =========================================================================
  describe('attemptRecovery', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 3 }, mockDb as any);
    });

    it('should attempt recovery for degraded provider', async () => {
      await service.markDegraded('provider-1');
      const result = await service.attemptRecovery('provider-1');
      expect(result.attempted).toBe(true);
    });

    it('should succeed when success rate exceeds threshold', async () => {
      await service.markDegraded('provider-1');
      const result = await service.attemptRecovery('provider-1');
      expect(result.attempted).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should fail when success rate is below threshold', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.9, maxRecoveryAttempts: 3 }, mockDb as any);
      await strictService.updateProviderSuccessRate('provider-low', 0.5);
      await strictService.markDegraded('provider-low');
      const result = await strictService.attemptRecovery('provider-low');
      expect(result.attempted).toBe(true);
      expect(result.success).toBe(false);
      strictService.stopMonitoring();
    });

    it('should return attempted=false when max attempts reached', async () => {
      await service.markDegraded('provider-1');
      await service.attemptRecovery('provider-1');
      await service.attemptRecovery('provider-1');
      await service.attemptRecovery('provider-1');
      const result = await service.attemptRecovery('provider-1');
      expect(result.attempted).toBe(false);
      expect(result.success).toBe(false);
    });

    it('should track attempt count correctly', async () => {
      await service.markDegraded('provider-1');
      await service.attemptRecovery('provider-1');
      await service.attemptRecovery('provider-1');
      const stats = await service.getRecoveryStats('provider-1');
      expect(stats.attemptCount).toBe(2);
    });

    it('should emit recovery:success event on success', async () => {
      await service.markDegraded('provider-1');
      const eventPromise = new Promise<any>((resolve) => {
        service.once('recovery:success', resolve);
      });
      await service.attemptRecovery('provider-1');
      const event = await eventPromise;
      expect(event.providerId).toBe('provider-1');
      expect(event.successRate).toBeDefined();
    });

    it('should emit recovery:failed event on failure', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.9, maxRecoveryAttempts: 3 }, mockDb as any);
      await strictService.markDegraded('provider-fail');
      await strictService.updateProviderSuccessRate('provider-fail', 0.3);
      const eventPromise = new Promise<any>((resolve) => {
        strictService.once('recovery:failed', resolve);
      });
      await strictService.attemptRecovery('provider-fail');
      const event = await eventPromise;
      expect(event.providerId).toBe('provider-fail');
      expect(event.successRate).toBe(0.3);
      strictService.stopMonitoring();
    });

    it('should remove provider from degraded list on successful recovery', async () => {
      await service.markDegraded('provider-1');
      expect(await service.getDegradedProviders()).toContain('provider-1');
      await service.attemptRecovery('provider-1');
      expect(await service.getDegradedProviders()).not.toContain('provider-1');
    });

    it('should keep provider in degraded list on failed recovery', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.9, maxRecoveryAttempts: 3 }, mockDb as any);
      await strictService.updateProviderSuccessRate('provider-1', 0.3);
      await strictService.markDegraded('provider-1');
      await strictService.attemptRecovery('provider-1');
      expect(await strictService.getDegradedProviders()).toContain('provider-1');
      strictService.stopMonitoring();
    });

    it('should allow recovery for non-degraded provider (probe still runs)', async () => {
      const result = await service.attemptRecovery('never-degraded');
      expect(result.attempted).toBe(true);
    });
  });

  // =========================================================================
  // 5. resetAttempts
  // =========================================================================
  describe('resetAttempts', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 3 }, mockDb as any);
    });

    it('should reset attempt count for a provider', async () => {
      await service.markDegraded('provider-1');
      await service.attemptRecovery('provider-1');
      await service.attemptRecovery('provider-1');
      await service.attemptRecovery('provider-1');
      const blocked = await service.attemptRecovery('provider-1');
      expect(blocked.attempted).toBe(false);
      await service.resetAttempts('provider-1');
      const result = await service.attemptRecovery('provider-1');
      expect(result.attempted).toBe(true);
    });

    it('should clear stats when attempts are reset', async () => {
      await service.markDegraded('provider-1');
      await service.attemptRecovery('provider-1');
      const statsBefore = await service.getRecoveryStats('provider-1');
      expect(statsBefore.attemptCount).toBe(1);
      await service.resetAttempts('provider-1');
      const statsAfter = await service.getRecoveryStats('provider-1');
      expect(statsAfter.attemptCount).toBe(0);
    });

    it('should not throw when resetting non-existent provider', async () => {
      await expect(service.resetAttempts('non-existent')).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 6. getRecoveryStats
  // =========================================================================
  describe('getRecoveryStats', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 5 }, mockDb as any);
    });

    it('should return zero stats for unknown provider', async () => {
      const stats = await service.getRecoveryStats('unknown');
      expect(stats).toEqual({
        providerId: 'unknown',
        attemptCount: 0,
        successCount: 0,
        failureCount: 0,
        lastAttempt: undefined,
        lastSuccess: undefined,
      });
    });

    it('should track success count correctly', async () => {
      await service.markDegraded('provider-1');
      await service.attemptRecovery('provider-1');
      const stats = await service.getRecoveryStats('provider-1');
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(0);
    });

    it('should track failure count correctly', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.9, maxRecoveryAttempts: 5 }, mockDb as any);
      await strictService.updateProviderSuccessRate('provider-1', 0.3);
      await strictService.markDegraded('provider-1');
      await strictService.attemptRecovery('provider-1');
      const stats = await strictService.getRecoveryStats('provider-1');
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(1);
      strictService.stopMonitoring();
    });

    it('should track lastAttempt timestamp', async () => {
      await service.markDegraded('provider-1');
      const beforeAttempt = new Date();
      await service.attemptRecovery('provider-1');
      const stats = await service.getRecoveryStats('provider-1');
      expect(stats.lastAttempt).toBeDefined();
      expect(stats.lastAttempt!.getTime()).toBeGreaterThanOrEqual(beforeAttempt.getTime());
    });
  });

  // =========================================================================
  // 7. getOverallSuccessRate
  // =========================================================================
  describe('getOverallSuccessRate', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 5 }, mockDb as any);
    });

    it('should return 0 when no attempts have been made', async () => {
      expect(await service.getOverallSuccessRate()).toBe(0);
    });

    it('should return 1.0 when all attempts succeed', async () => {
      await service.markDegraded('p1');
      await service.attemptRecovery('p1');
      expect(await service.getOverallSuccessRate()).toBe(1);
    });

    it('should return 0 when all attempts fail', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.9, maxRecoveryAttempts: 5 }, mockDb as any);
      await strictService.updateProviderSuccessRate('p1', 0.3);
      await strictService.markDegraded('p1');
      await strictService.attemptRecovery('p1');
      expect(await strictService.getOverallSuccessRate()).toBe(0);
      strictService.stopMonitoring();
    });
  });

  // =========================================================================
  // 8. getDegradedProviders
  // =========================================================================
  describe('getDegradedProviders', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({}, mockDb as any);
    });

    it('should return empty array initially', async () => {
      expect(await service.getDegradedProviders()).toEqual([]);
    });

    it('should return all degraded provider IDs', async () => {
      await service.markDegraded('a');
      await service.markDegraded('b');
      await service.markDegraded('c');
      const providers = await service.getDegradedProviders();
      expect(providers).toHaveLength(3);
      expect(providers).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    });

    it('should update after recovery removes a provider', async () => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 3 }, mockDb as any);
      await service.markDegraded('provider-1');
      await service.markDegraded('provider-2');
      await service.attemptRecovery('provider-1');
      const providers = await service.getDegradedProviders();
      expect(providers).not.toContain('provider-1');
      expect(providers).toContain('provider-2');
    });

    it('should update after clearDegraded', async () => {
      await service.markDegraded('provider-1');
      await service.clearDegraded('provider-1');
      expect(await service.getDegradedProviders()).toEqual([]);
    });
  });

  // =========================================================================
  // 9. updateProviderSuccessRate
  // =========================================================================
  describe('updateProviderSuccessRate', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 3 }, mockDb as any);
    });

    it('should influence probeProvider result', async () => {
      await service.updateProviderSuccessRate('provider-1', 1.0);
      await service.markDegraded('provider-1');
      const result = await service.attemptRecovery('provider-1');
      expect(result.attempted).toBe(true);
      expect(result.success).toBe(true);
      const stats = await service.getRecoveryStats('provider-1');
      expect(stats.successCount).toBe(1);
    });

    it('should influence probeProvider to fail when rate is low', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.8, maxRecoveryAttempts: 3 }, mockDb as any);
      await strictService.updateProviderSuccessRate('provider-1', 0.3);
      await strictService.markDegraded('provider-1');
      const result = await strictService.attemptRecovery('provider-1');
      expect(result.success).toBe(false);
      strictService.stopMonitoring();
    });
  });

  // =========================================================================
  // 10. getAllStats
  // =========================================================================
  describe('getAllStats', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 5 }, mockDb as any);
    });

    it('should return empty stats when no activity', async () => {
      const stats = await service.getAllStats();
      expect(stats).toEqual({
        totalProviders: 0,
        degradedProviders: 0,
        overallSuccessRate: 0,
        providers: [],
      });
    });

    it('should count degraded providers correctly', async () => {
      await service.markDegraded('p1');
      await service.markDegraded('p2');
      const stats = await service.getAllStats();
      expect(stats.degradedProviders).toBe(2);
    });

    it('should include per-provider stats', async () => {
      await service.markDegraded('p1');
      await service.attemptRecovery('p1');
      const stats = await service.getAllStats();
      expect(stats.totalProviders).toBe(1);
      expect(stats.providers).toHaveLength(1);
      expect(stats.providers[0].providerId).toBe('p1');
      expect(stats.providers[0].attemptCount).toBe(1);
    });

    it('should track multiple providers independently', async () => {
      await service.markDegraded('p1');
      await service.markDegraded('p2');
      await service.attemptRecovery('p1');
      await service.attemptRecovery('p2');
      await service.attemptRecovery('p2');
      const stats = await service.getAllStats();
      expect(stats.totalProviders).toBe(2);
      const p1Stats = stats.providers.find(p => p.providerId === 'p1')!;
      const p2Stats = stats.providers.find(p => p.providerId === 'p2')!;
      expect(p1Stats.attemptCount).toBe(1);
      expect(p2Stats.attemptCount).toBe(2);
    });

    it('should reflect degraded count changes after recovery', async () => {
      await service.markDegraded('p1');
      await service.markDegraded('p2');
      const before = await service.getAllStats();
      expect(before.degradedProviders).toBe(2);
      await service.attemptRecovery('p1');
      const after = await service.getAllStats();
      expect(after.degradedProviders).toBe(1);
    });
  });

  // =========================================================================
  // 11. Monitoring
  // =========================================================================
  describe('Monitoring', () => {
    it('should start monitoring without errors', () => {
      service = new AutoRecoveryService({ recoveryCheckInterval: 60000 }, mockDb as any);
      expect(() => service.startMonitoring()).not.toThrow();
    });

    it('should not start monitoring twice (idempotent)', () => {
      service = new AutoRecoveryService({ recoveryCheckInterval: 60000 }, mockDb as any);
      service.startMonitoring();
      expect(() => service.startMonitoring()).not.toThrow();
    });

    it('should stop monitoring without errors even if not started', () => {
      service = new AutoRecoveryService({}, mockDb as any);
      expect(() => service.stopMonitoring()).not.toThrow();
    });

    it('should check recovery candidates for eligible providers', async () => {
      service = new AutoRecoveryService({
        recoveryCheckInterval: 50, minRecoveryTime: 1, successThreshold: 0.5, maxRecoveryAttempts: 3,
      }, mockDb as any);
      await service.markDegraded('provider-1');
      await new Promise(r => setTimeout(r, 10));
      await service.checkRecoveryCandidates();
      const stats = await service.getRecoveryStats('provider-1');
      expect(stats.attemptCount).toBeGreaterThanOrEqual(1);
    });

    it('should not check providers that have not elapsed minRecoveryTime', async () => {
      service = new AutoRecoveryService({
        recoveryCheckInterval: 60000, minRecoveryTime: 60000, successThreshold: 0.5, maxRecoveryAttempts: 3,
      }, mockDb as any);
      await service.markDegraded('provider-1');
      await service.checkRecoveryCandidates();
      const stats = await service.getRecoveryStats('provider-1');
      expect(stats.attemptCount).toBe(0);
    });
  });

  // =========================================================================
  // 12. Event Emitter behavior
  // =========================================================================
  describe('Event Emitter behavior', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 3 }, mockDb as any);
    });

    it('should support on() listener for recovery:success', async () => {
      await service.markDegraded('p1');
      let eventReceived = false;
      service.on('recovery:success', () => { eventReceived = true; });
      await service.attemptRecovery('p1');
      expect(eventReceived).toBe(true);
    });

    it('should support on() listener for recovery:failed', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.9, maxRecoveryAttempts: 3 }, mockDb as any);
      await strictService.updateProviderSuccessRate('p1', 0.3);
      await strictService.markDegraded('p1');
      let eventReceived = false;
      strictService.on('recovery:failed', () => { eventReceived = true; });
      await strictService.attemptRecovery('p1');
      expect(eventReceived).toBe(true);
      strictService.stopMonitoring();
    });

    it('should support multiple listeners on same event', async () => {
      await service.markDegraded('p1');
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      service.on('recovery:success', listener1);
      service.on('recovery:success', listener2);
      await service.attemptRecovery('p1');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should pass correct event data to recovery:success', async () => {
      await service.markDegraded('p1');
      let eventData: any;
      const eventPromise = new Promise<void>((resolve) => {
        service.once('recovery:success', (data: any) => { eventData = data; resolve(); });
      });
      await service.attemptRecovery('p1');
      await eventPromise;
      expect(eventData.providerId).toBe('p1');
      expect(typeof eventData.successRate).toBe('number');
    });

    it('should support once() listener', async () => {
      await service.markDegraded('p1');
      await service.markDegraded('p2');
      const listener = jest.fn();
      service.once('recovery:success', listener);
      await service.attemptRecovery('p1');
      await service.resetAttempts('p1');
      await service.markDegraded('p1');
      await service.attemptRecovery('p1');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 13. Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    beforeEach(() => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 3 }, mockDb as any);
    });

    it('should handle empty string as provider ID', async () => {
      await service.markDegraded('');
      expect(await service.getDegradedProviders()).toContain('');
      const result = await service.attemptRecovery('');
      expect(result.attempted).toBe(true);
    });

    it('should handle provider IDs with special characters', async () => {
      const specialId = 'provider/with:special@chars';
      await service.markDegraded(specialId);
      expect(await service.getDegradedProviders()).toContain(specialId);
      const stats = await service.getRecoveryStats(specialId);
      expect(stats.providerId).toBe(specialId);
    });

    it('should handle very long provider IDs', async () => {
      const longId = 'p'.repeat(1000);
      await service.markDegraded(longId);
      expect(await service.getDegradedProviders()).toContain(longId);
    });

    it('should handle 0 threshold (everything succeeds)', async () => {
      const lenientService = new AutoRecoveryService({ successThreshold: 0, maxRecoveryAttempts: 3 }, mockDb as any);
      await lenientService.markDegraded('p1');
      const result = await lenientService.attemptRecovery('p1');
      expect(result.success).toBe(true);
      lenientService.stopMonitoring();
    });

    it('should handle threshold of 1.0 (nothing succeeds with default probe)', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 1.0, maxRecoveryAttempts: 3 }, mockDb as any);
      await strictService.markDegraded('p1');
      const result = await strictService.attemptRecovery('p1');
      expect(result.success).toBe(false);
      strictService.stopMonitoring();
    });

    it('should handle maxRecoveryAttempts of 1', async () => {
      const oneAttemptService = new AutoRecoveryService({ maxRecoveryAttempts: 1, successThreshold: 0.9 }, mockDb as any);
      await oneAttemptService.updateProviderSuccessRate('p1', 0.3);
      await oneAttemptService.markDegraded('p1');
      const first = await oneAttemptService.attemptRecovery('p1');
      expect(first.attempted).toBe(true);
      const second = await oneAttemptService.attemptRecovery('p1');
      expect(second.attempted).toBe(false);
      oneAttemptService.stopMonitoring();
    });

    it('should handle rapid successive markDegraded calls', async () => {
      for (let i = 0; i < 100; i++) {
        await service.markDegraded(`provider-${i}`);
      }
      expect(await service.getDegradedProviders()).toHaveLength(100);
    });
  });

  // =========================================================================
  // 14. Integration scenarios
  // =========================================================================
  describe('Integration scenarios', () => {
    it('should support full degradation-recovery lifecycle', async () => {
      service = new AutoRecoveryService({ successThreshold: 0.5, maxRecoveryAttempts: 3 }, mockDb as any);
      await service.markDegraded('provider-lifecycle');
      expect(await service.getDegradedProviders()).toContain('provider-lifecycle');
      const result = await service.attemptRecovery('provider-lifecycle');
      expect(result.attempted).toBe(true);
      const stats = await service.getRecoveryStats('provider-lifecycle');
      expect(stats.attemptCount).toBe(1);
      expect(await service.getDegradedProviders()).not.toContain('provider-lifecycle');
      const allStats = await service.getAllStats();
      expect(allStats.overallSuccessRate).toBe(1);
    });

    it('should support degradation with eventual failure and manual clear', async () => {
      const strictService = new AutoRecoveryService({ successThreshold: 0.9, maxRecoveryAttempts: 3 }, mockDb as any);
      await strictService.updateProviderSuccessRate('p1', 0.3);
      await strictService.markDegraded('p1');
      await strictService.attemptRecovery('p1');
      await strictService.attemptRecovery('p1');
      await strictService.attemptRecovery('p1');
      const blockedResult = await strictService.attemptRecovery('p1');
      expect(blockedResult.attempted).toBe(false);
      expect(await strictService.getDegradedProviders()).toContain('p1');
      await strictService.clearDegraded('p1');
      expect(await strictService.getDegradedProviders()).not.toContain('p1');
      await strictService.resetAttempts('p1');
      await strictService.markDegraded('p1');
      const retryResult = await strictService.attemptRecovery('p1');
      expect(retryResult.attempted).toBe(true);
      strictService.stopMonitoring();
    });
  });

  // =========================================================================
  // 15. getConfig
  // =========================================================================
  describe('getConfig', () => {
    it('should return default config when constructed with no config', () => {
      service = new AutoRecoveryService({}, mockDb as any);
      const config = service.getConfig();
      expect(config).toEqual({
        recoveryCheckInterval: 30000,
        minRecoveryTime: 60000,
        successThreshold: 0.5,
        maxRecoveryAttempts: 3,
      });
    });

    it('should return merged config when partial config provided', () => {
      service = new AutoRecoveryService({ successThreshold: 0.7 }, mockDb as any);
      const config = service.getConfig();
      expect(config.successThreshold).toBe(0.7);
      expect(config.maxRecoveryAttempts).toBe(3);
    });
  });
});
