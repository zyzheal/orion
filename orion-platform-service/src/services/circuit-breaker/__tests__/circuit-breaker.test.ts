/**
 * Circuit Breaker Service Tests
 *
 * F001: Tests for CircuitBreakerService layer
 */

import { CircuitBreakerService } from '../circuit-breaker-service';
import {
  CircuitBreakerConfigRepository,
  CircuitBreakerStateRepository,
  CircuitBreakerEventRepository,
} from '../circuit-breaker-repositories';

// ─── In-memory DB mock ─────────────────────────────────────────────────────

function createMockDb() {
  const tables = new Map<string, any[]>();
  const counters = new Map<string, number>();

  return {
    tables,
    query: async (text: string, params?: unknown[]) => {
      // Simulate INSERT ... RETURNING * by extracting target_key from params
      if (text.includes('INSERT') && text.includes('RETURNING')) {
        const tableName = text.match(/INTO (\w+)/)?.[1];
        if (tableName && params?.[0]) {
          const targetKey = params[0];
          const id = `mock-${tableName}-${counters.get(targetKey) || 0}`;
          counters.set(targetKey, (counters.get(targetKey) || 0) + 1);

          const row: any = {
            id,
            target_key: targetKey,
            description: params[1],
            failure_threshold: params[2] ?? 5,
            recovery_timeout_ms: params[3] ?? 60000,
            success_threshold: params[4] ?? 1,
            enabled: params[5] ?? true,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const existing = tables.get(tableName) || [];
          const idx = existing.findIndex((r: any) => r.target_key === targetKey);
          if (idx >= 0) {
            existing[idx] = row;
          } else {
            existing.push(row);
          }
          tables.set(tableName, existing);

          return { rows: [row], rowCount: 1 };
        }
      }

      // Simulate SELECT (with optional target_key filter)
      if (text.includes('SELECT') && text.includes('circuit_breaker_configs')) {
        let rows = tables.get('circuit_breaker_configs') || [];
        if (text.includes('target_key') && params?.[0]) {
          rows = rows.filter((r: any) => r.target_key === params[0]);
        }
        return { rows, rowCount: rows.length };
      }

      if (text.includes('SELECT') && text.includes('circuit_breaker_states')) {
        const rows = tables.get('circuit_breaker_states') || [];
        return { rows, rowCount: rows.length };
      }

      if (text.includes('SELECT') && text.includes('circuit_breaker_events')) {
        const rows = tables.get('circuit_breaker_events') || [];
        return { rows, rowCount: rows.length };
      }

      // Simulate UPDATE
      if (text.includes('UPDATE') && !text.includes('INSERT')) {
        return { rows: [], rowCount: 1 };
      }

      // INSERT events (no RETURNING)
      if (text.includes('INSERT') && text.includes('circuit_breaker_events')) {
        const row: any = {
          id: `event-${Date.now()}`,
          target_key: params?.[0],
          event_type: params?.[1],
          from_state: params?.[2],
          to_state: params?.[3],
          failure_count: params?.[4],
          success_count: params?.[5],
          message: params?.[6],
          created_at: new Date(),
        };
        const existing = tables.get('circuit_breaker_events') || [];
        existing.push(row);
        tables.set('circuit_breaker_events', existing);
        return { rows: [row], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

// ─── Helper: Create service with mock DB ────────────────────────────────────

function createService() {
  const mockDb = createMockDb();
  const configRepo = new CircuitBreakerConfigRepository(mockDb);
  const stateRepo = new CircuitBreakerStateRepository(mockDb);
  const eventRepo = new CircuitBreakerEventRepository(mockDb);
  return new CircuitBreakerService(configRepo, stateRepo, eventRepo);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = createService();
  });

  // ─── Test 1: Register and get circuit breaker ──────────────────────────────

  describe('register / getOrCreate', () => {
    test('should register a new circuit breaker', async () => {
      const entry = await service.register('scm:github', {
        failureThreshold: 3,
        recoveryTimeoutMs: 10000,
        successThreshold: 1,
      });

      expect(entry.targetKey).toBe('scm:github');
      expect(entry.config.failureThreshold).toBe(3);
    });

    test('should get or create circuit breaker with defaults', async () => {
      const breaker = await service.getOrCreate('registry:docker', {
        failureThreshold: 5,
        recoveryTimeoutMs: 30000,
      });

      expect(breaker).toBeDefined();
    });

    test('should return existing breaker on second getOrCreate', async () => {
      const breaker1 = await service.getOrCreate('scm:github');
      const breaker2 = await service.getOrCreate('scm:github');

      expect(breaker1).toBe(breaker2);
    });
  });

  // ─── Test 2: Execute with circuit breaker ──────────────────────────────────

  describe('execute', () => {
    test('should pass through on successful execution', async () => {
      const result = await service.execute('test:svc', async () => 'hello');
      expect(result).toBe('hello');
    });

    test('should propagate errors from the wrapped function', async () => {
      await expect(
        service.execute('test:svc', async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });

    test('should handle non-Error thrown values', async () => {
      await expect(
        service.execute('test:svc', async () => {
          throw 'string error';
        })
      ).rejects.toBe('string error');
    });

    test('should open circuit after repeated failures', async () => {
      const svc = createService();
      await svc.register('test:fail', {
        failureThreshold: 3,
        recoveryTimeoutMs: 100,
      });

      // Trigger 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await svc.execute('test:fail', async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      // Circuit should now be open
      const state = await svc.getState('test:fail');
      expect(state?.state).toBe('open');

      // Next execute should fail immediately
      await expect(
        svc.execute('test:fail', async () => 'should-not-reach')
      ).rejects.toThrow();
    });

    test('should recover after timeout in half-open state', async () => {
      jest.useFakeTimers();

      const svc = createService();
      await svc.register('test:recover', {
        failureThreshold: 1,
        recoveryTimeoutMs: 1000,
        successThreshold: 1,
      });

      // Trip the circuit
      try {
        await svc.execute('test:recover', async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      // Advance time past recovery timeout
      jest.advanceTimersByTime(1500);

      // Should be half-open now
      const state = await svc.getState('test:recover');
      expect(state?.state).toBe('half-open');

      // Successful execution should close circuit
      await svc.execute('test:recover', async () => 'recovered');

      const newState = await svc.getState('test:recover');
      expect(newState?.state).toBe('closed');

      jest.useRealTimers();
    });
  });

  // ─── Test 3: Manual reset and trip ─────────────────────────────────────────

  describe('reset / trip', () => {
    test('should reset circuit to closed', async () => {
      const svc = createService();
      await svc.register('test:reset', {
        failureThreshold: 1,
        recoveryTimeoutMs: 10000,
      });

      // Trip manually
      await svc.trip('test:reset');
      let state = await svc.getState('test:reset');
      expect(state?.state).toBe('open');

      // Reset manually
      await svc.reset('test:reset');
      state = await svc.getState('test:reset');
      expect(state?.state).toBe('closed');
    });

    test('should throw error on unknown targetKey', async () => {
      await expect(service.reset('nonexistent')).rejects.toThrow('not found');
      await expect(service.trip('nonexistent')).rejects.toThrow('not found');
    });
  });

  // ─── Test 4: List and summary ──────────────────────────────────────────────

  describe('listAll / getSummary', () => {
    test('should list all registered breakers', async () => {
      await service.register('a:1', { failureThreshold: 5, recoveryTimeoutMs: 60000 });
      await service.register('b:2', { failureThreshold: 3, recoveryTimeoutMs: 30000 });

      const all = await service.listAll();
      expect(all.length).toBe(2);
    });

    test('should return summary counts', async () => {
      await service.register('closed:1', { failureThreshold: 5, recoveryTimeoutMs: 60000 });
      await service.register('closed:2', { failureThreshold: 5, recoveryTimeoutMs: 60000 });

      const summary = await service.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.closed).toBe(2);
      expect(summary.open).toBe(0);
    });
  });

  // ─── Test 5: Config update ─────────────────────────────────────────────────

  describe('updateConfig', () => {
    test('should update configuration', async () => {
      await service.register('test:config', {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
      });

      await service.updateConfig('test:config', {
        failureThreshold: 10,
      });

      const state = await service.getState('test:config');
      expect(state?.config.failureThreshold).toBe(10);
    });

    test('should throw error on unknown targetKey', async () => {
      await expect(
        service.updateConfig('nonexistent', { failureThreshold: 10 })
      ).rejects.toThrow('not found');
    });
  });

  // ─── Test 6: Disable / Enable ──────────────────────────────────────────────

  describe('disable / enable', () => {
    test('should remove from registry on disable', async () => {
      await service.register('test:disable', {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
      });

      await service.disable('test:disable');
      const state = await service.getState('test:disable');
      expect(state).toBeNull();
    });

    test('should re-enable from DB config', async () => {
      await service.register('test:enable', {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
      });

      // Disable removes from registry but keeps DB config
      await service.disable('test:enable');
      expect(await service.getState('test:enable')).toBeNull();

      // Enable should re-create from DB config
      await service.enable('test:enable');
      const state = await service.getState('test:enable');
      expect(state).not.toBeNull();
      expect(state!.state).toBe('closed');
    });

    test('should throw error on enable when no DB config exists', async () => {
      // Use a fresh service with no registered configs
      const freshService = createService();
      await expect(freshService.enable('nonexistent')).rejects.toThrow();
    });
  });

  // ─── Test 7: Events ────────────────────────────────────────────────────────

  describe('getEvents', () => {
    test('should return empty events for new breaker', async () => {
      const events = await service.getEvents('new:breaker');
      expect(events).toEqual([]);
    });

    test('should log events on state changes', async () => {
      await service.register('test:events', {
        failureThreshold: 1,
        recoveryTimeoutMs: 100,
      });

      // Trigger a failure
      try {
        await service.execute('test:events', async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      // Should have events
      const events = await service.getEvents('test:events');
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // ─── Test 8: getAllStates / getAllConfigs ─────────────────────────────────

  describe('getAllStates', () => {
    test('should return all persisted states', async () => {
      await service.register('test:states', {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
      });

      const states = await service.getAllStates();
      expect(states.length).toBeGreaterThan(0);
    });
  });

  describe('getAllConfigs', () => {
    test('should return all enabled configs', async () => {
      await service.register('test:configs', {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
      });

      const configs = await service.getAllConfigs();
      expect(configs.length).toBeGreaterThan(0);
    });
  });

  // ─── Test 9: getOrCreate with DB config ──────────────────────────────────

  describe('getOrCreate with DB config', () => {
    test('should use DB config when available and enabled', async () => {
      // Use a separate mock DB so we can control the table state
      const mockDb = createMockDb();
      const configRepo = new CircuitBreakerConfigRepository(mockDb);
      const stateRepo = new CircuitBreakerStateRepository(mockDb);
      const eventRepo = new CircuitBreakerEventRepository(mockDb);
      const svc = new CircuitBreakerService(configRepo, stateRepo, eventRepo);

      // Register to create DB config (enabled=true)
      await svc.register('test:dbconfig', {
        failureThreshold: 10,
        recoveryTimeoutMs: 120000,
        successThreshold: 3,
      });

      // Create a second service instance that shares the same mock DB
      // but has an empty registry - simulates restart scenario
      const svc2 = new CircuitBreakerService(configRepo, stateRepo, eventRepo);

      // getOrCreate on svc2 should find the DB config and register it
      const breaker = await svc2.getOrCreate('test:dbconfig');
      expect(breaker).toBeDefined();

      const state = await svc2.getState('test:dbconfig');
      expect(state).not.toBeNull();
      expect(state!.state).toBe('closed');
    });
  });
});
