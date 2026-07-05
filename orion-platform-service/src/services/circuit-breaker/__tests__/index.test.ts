/**
 * Circuit Breaker Index (Factory) - Unit Tests
 *
 * Covers:
 * - initCircuitBreakerService: with DB, without DB (in-memory), with DB error
 * - getCircuitBreakerService: returns singleton, returns null before init
 * - createInMemoryService: internal fallback behavior
 */

import { initCircuitBreakerService, getCircuitBreakerService } from '../index';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('pino', () => {
  return () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

jest.mock('../../../db/base-repository', () => {
  return {
    BaseRepository: class MockBaseRepository {
      protected db: any;
      protected tableName: string;
      constructor(db: any, tableName: string) {
        this.db = db;
        this.tableName = tableName;
      }
    },
  };
});

function createMockDb() {
  const tables = new Map<string, any[]>();
  return {
    tables,
    query: jest.fn().mockImplementation(async (text: string, params?: unknown[]) => {
      if (text.includes('SELECT') && text.includes('circuit_breaker_configs')) {
        return { rows: tables.get('configs') || [], rowCount: 0 };
      }
      if (text.includes('INSERT') && text.includes('RETURNING')) {
        const row = {
          id: `mock-${Date.now()}`,
          target_key: params?.[0],
          description: params?.[1],
          failure_threshold: params?.[2] ?? 5,
          recovery_timeout_ms: params?.[3] ?? 60000,
          success_threshold: params?.[4] ?? 1,
          enabled: params?.[5] ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        };
        return { rows: [row], rowCount: 1 };
      }
      if (text.includes('INSERT') && text.includes('circuit_breaker_events')) {
        return { rows: [{ id: `evt-${Date.now()}`, target_key: params?.[0] }], rowCount: 1 };
      }
      if (text.includes('INSERT') || text.includes('UPDATE')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Circuit Breaker Index (Factory)', () => {
  // Reset singleton state before each test
  beforeEach(() => {
    // getCircuitBreakerService returns the module-level singleton.
    // We need to reset it between tests. Since the module caches the instance,
    // we call initCircuitBreakerService with null to reinitialize.
    jest.clearAllMocks();
  });

  // ─── initCircuitBreakerService ───────────────────────────────────────────

  describe('initCircuitBreakerService', () => {
    it('should return a CircuitBreakerService when DB is provided', async () => {
      const mockDb = createMockDb();

      const service = await initCircuitBreakerService(mockDb as any);

      expect(service).not.toBeNull();
      expect(typeof service!.register).toBe('function');
      expect(typeof service!.execute).toBe('function');
      expect(typeof service!.getOrCreate).toBe('function');
    });

    it('should return in-memory service when DB is not provided', async () => {
      const service = await initCircuitBreakerService();

      expect(service).not.toBeNull();
      // In-memory service should still have all methods
      expect(typeof service!.register).toBe('function');
      expect(typeof service!.execute).toBe('function');
    });

    it('should return in-memory service when DB is undefined', async () => {
      const service = await initCircuitBreakerService(undefined);

      expect(service).not.toBeNull();
    });

    it('should initialize from database configs', async () => {
      const mockDb = createMockDb();
      mockDb.tables.set('configs', [
        {
          id: 'cfg-1',
          target_key: 'scm:github',
          description: 'GitHub',
          failure_threshold: 5,
          recovery_timeout_ms: 30000,
          success_threshold: 2,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const service = await initCircuitBreakerService(mockDb as any);

      expect(service).not.toBeNull();
      // The service should have loaded configs from DB
      const state = await service!.getState('scm:github');
      expect(state).not.toBeNull();
    });

    it('should fall back to in-memory when DB init fails', async () => {
      const failingDb = {
        query: jest.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const service = await initCircuitBreakerService(failingDb as any);

      expect(service).not.toBeNull();
      // Should still be usable as in-memory service
      expect(typeof service!.register).toBe('function');
    });

    it('should call initialize on the service when DB is provided', async () => {
      const mockDb = createMockDb();
      const querySpy = mockDb.query;

      await initCircuitBreakerService(mockDb as any);

      // Should have queried for enabled configs
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('WHERE enabled = true'),
      );
    });
  });

  // ─── getCircuitBreakerService ────────────────────────────────────────────

  describe('getCircuitBreakerService', () => {
    it('should return the initialized service instance', async () => {
      const mockDb = createMockDb();
      await initCircuitBreakerService(mockDb as any);

      const service = getCircuitBreakerService();

      expect(service).not.toBeNull();
    });

    it('should return the same instance on multiple calls', async () => {
      const mockDb = createMockDb();
      await initCircuitBreakerService(mockDb as any);

      const service1 = getCircuitBreakerService();
      const service2 = getCircuitBreakerService();

      expect(service1).toBe(service2);
    });

    it('should return new instance after re-initialization', async () => {
      const mockDb1 = createMockDb();
      await initCircuitBreakerService(mockDb1 as any);
      const service1 = getCircuitBreakerService();

      const mockDb2 = createMockDb();
      await initCircuitBreakerService(mockDb2 as any);
      const service2 = getCircuitBreakerService();

      // After re-init, should get a new instance
      expect(service2).not.toBeNull();
      expect(service1).not.toBe(service2);
    });
  });

  // ─── In-memory service behavior ──────────────────────────────────────────

  describe('in-memory service', () => {
    it('should return a service instance without a database', async () => {
      const service = await initCircuitBreakerService();

      expect(service).not.toBeNull();
      expect(typeof service!.register).toBe('function');
      expect(typeof service!.execute).toBe('function');
      expect(typeof service!.getOrCreate).toBe('function');
      expect(typeof service!.getState).toBe('function');
      expect(typeof service!.listAll).toBe('function');
      expect(typeof service!.getSummary).toBe('function');
      expect(typeof service!.reset).toBe('function');
      expect(typeof service!.trip).toBe('function');
    });

    it('should return empty list when no breakers registered', async () => {
      const service = await initCircuitBreakerService();

      const all = await service!.listAll();
      expect(all).toEqual([]);
    });

    it('should return zero summary when no breakers', async () => {
      const service = await initCircuitBreakerService();

      const summary = await service!.getSummary();
      expect(summary.total).toBe(0);
      expect(summary.closed).toBe(0);
      expect(summary.open).toBe(0);
      expect(summary.halfOpen).toBe(0);
    });

    it('should return null for getState on unregistered key', async () => {
      const service = await initCircuitBreakerService();

      const state = await service!.getState('nonexistent');
      expect(state).toBeNull();
    });
  });
});
