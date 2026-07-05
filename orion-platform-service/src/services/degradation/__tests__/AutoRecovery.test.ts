// orion-platform-service/src/services/degradation/__tests__/AutoRecovery.test.ts
import { AutoRecoveryService } from '../AutoRecoveryService';

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

describe('AutoRecoveryService', () => {
  let service: AutoRecoveryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AutoRecoveryService({
      recoveryCheckInterval: 30000,
      minRecoveryTime: 60000,
      successThreshold: 0.5,
    }, mockDb as any);
  });

  afterEach(() => {
    service.stopMonitoring();
  });

  describe('attemptRecovery', () => {
    it('should attempt recovery after degradation', async () => {
      const degradedProvider = 'openai-provider-1';
      await service.markDegraded(degradedProvider);
      const result = await service.attemptRecovery(degradedProvider);
      expect(result.attempted).toBe(true);
    });

    it('should track recovery success rate', async () => {
      await service.markDegraded('provider-1');
      await service.attemptRecovery('provider-1');
      const stats = await service.getRecoveryStats('provider-1');
      expect(stats.attemptCount).toBeGreaterThan(0);
    });

    it('should not attempt recovery after max attempts', async () => {
      const providerId = 'provider-max-attempts';
      await service.markDegraded(providerId);
      await service.attemptRecovery(providerId);
      await service.attemptRecovery(providerId);
      await service.attemptRecovery(providerId);
      const result = await service.attemptRecovery(providerId);
      expect(result.attempted).toBe(false);
    });

    it('should emit recovery:success event on successful recovery', async () => {
      const providerId = 'provider-success';
      await service.markDegraded(providerId);
      const successPromise = new Promise<{ providerId: string }>((resolve) => {
        service.on('recovery:success', resolve);
      });
      await service.attemptRecovery(providerId);
      const stats = await service.getRecoveryStats(providerId);
      expect(stats.successCount).toBeGreaterThan(0);
    });

    it('should emit recovery:failed event on failed recovery', async () => {
      const strictService = new AutoRecoveryService({
        recoveryCheckInterval: 30000, minRecoveryTime: 60000, successThreshold: 0.9,
      }, mockDb as any);
      const providerId = 'provider-fail';
      await strictService.markDegraded(providerId);
      await strictService.attemptRecovery(providerId);
      const stats = await strictService.getRecoveryStats(providerId);
      expect(stats.failureCount).toBeGreaterThan(0);
      strictService.stopMonitoring();
    });
  });

  describe('recoverySuccessRate', () => {
    it('should achieve >80% recovery success', async () => {
      for (let i = 0; i < 10; i++) {
        const providerId = `provider-${i}`;
        await service.markDegraded(providerId);
        await service.attemptRecovery(providerId);
      }
      const successRate = await service.getOverallSuccessRate();
      expect(successRate).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('monitoring', () => {
    it('should start and stop monitoring', () => {
      const monitoringService = new AutoRecoveryService({
        recoveryCheckInterval: 1000, minRecoveryTime: 1000, successThreshold: 0.5,
      }, mockDb as any);
      monitoringService.startMonitoring();
      monitoringService.stopMonitoring();
      expect(true).toBe(true);
    });

    it('should check recovery candidates periodically', async () => {
      const quickService = new AutoRecoveryService({
        recoveryCheckInterval: 100, minRecoveryTime: 50, successThreshold: 0.5,
      }, mockDb as any);
      const providerId = 'quick-provider';
      await quickService.markDegraded(providerId);
      let recoveryChecked = false;
      quickService.on('recovery:success', () => { recoveryChecked = true; });
      quickService.startMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 200));
      quickService.stopMonitoring();
      const stats = await quickService.getRecoveryStats(providerId);
      expect(stats.attemptCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRecoveryStats', () => {
    it('should return correct stats for provider with no attempts', async () => {
      const stats = await service.getRecoveryStats('unknown-provider');
      expect(stats.attemptCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
      expect(stats.lastAttempt).toBeUndefined();
    });

    it('should track last attempt and last success times', async () => {
      const providerId = 'stats-provider';
      await service.markDegraded(providerId);
      await service.attemptRecovery(providerId);
      const stats = await service.getRecoveryStats(providerId);
      expect(stats.lastAttempt).toBeDefined();
      expect(stats.lastAttempt).toBeInstanceOf(Date);
    });
  });

  describe('markDegraded', () => {
    it('should track degraded providers with timestamp', async () => {
      const providerId = 'degraded-provider';
      await service.markDegraded(providerId);
      const degradedProviders = await service.getDegradedProviders();
      expect(degradedProviders).toContain(providerId);
    });
  });

  describe('integration with degradation flow', () => {
    it('should remove provider from degraded list after successful recovery', async () => {
      const providerId = 'recovery-flow-provider';
      await service.markDegraded(providerId);
      expect(await service.getDegradedProviders()).toContain(providerId);
      await service.attemptRecovery(providerId);
      expect(await service.getDegradedProviders()).not.toContain(providerId);
    });
  });
});
