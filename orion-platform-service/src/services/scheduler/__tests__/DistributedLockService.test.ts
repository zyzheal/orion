/**
 * Tests for DistributedLockService
 * Covers: constructor, acquireLock, tryLock, releaseLock, isLocked, getLockInfo,
 *         renewLock, executeWithLock, mock redis client, error paths
 */

import { DistributedLockService, Lock } from '../DistributedLockService';

// Mock pino logger
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return jest.fn(() => mockLogger);
});

describe('DistributedLockService', () => {
  let service: DistributedLockService;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a fresh mock redis for each test
    mockRedis = createMockRedis();
    service = new DistributedLockService(mockRedis);
  });

  function createMockRedis() {
    const store = new Map<string, string>();
    return {
      set: jest.fn(async (key: string, value: string, px?: string, ttl?: number, nx?: string) => {
        if (nx === 'NX' && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      }),
      get: jest.fn(async (key: string) => store.get(key) || null),
      del: jest.fn(async (key: string) => {
        return store.delete(key) ? 1 : 0;
      }),
      exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
      ttl: jest.fn(async (key: string) => {
        if (!store.has(key)) return -2;
        return -1;
      }),
      pexpire: jest.fn(async (key: string, ttl: number) => {
        return store.has(key) ? 1 : 0;
      }),
      eval: jest.fn(async (script: string, numKeys: number, ...args: any[]) => {
        const [key, value] = args;
        if (store.get(key) === value) {
          store.delete(key);
          return 1;
        }
        return 0;
      }),
      // Expose store for test setup
      _store: store,
    };
  }

  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should use provided redis client', () => {
      const svc = new DistributedLockService(mockRedis);
      expect(svc).toBeDefined();
    });

    it('should create default redis client when none provided', () => {
      // This will try to require('redis'), which may fail and fall back to mock
      const svc = new DistributedLockService();
      expect(svc).toBeDefined();
    });
  });

  // ── acquireLock ──────────────────────────────────────────────────────────

  describe('acquireLock', () => {
    it('should acquire lock on first attempt', async () => {
      const lock = await service.acquireLock('test-key');
      expect(lock).toBeDefined();
      expect(lock.key).toBe('test-key');
      expect(lock.acquiredAt).toBeInstanceOf(Date);
      expect(lock.ttl).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
    });

    it('should use default TTL of 30000ms', async () => {
      const lock = await service.acquireLock('ttl-key');
      expect(lock.ttl).toBe(30000);
    });

    it('should use custom TTL', async () => {
      const lock = await service.acquireLock('custom-ttl', { ttl: 5000 });
      expect(lock.ttl).toBe(5000);
    });

    it('should retry when lock is already held', async () => {
      // First attempt fails, second succeeds
      let callCount = 0;
      mockRedis.set.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return null; // lock held
        return 'OK';
      });

      const lock = await service.acquireLock('retry-key', { retryCount: 3, retryDelay: 10 });
      expect(lock).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      mockRedis.set.mockResolvedValue(null); // always fail

      await expect(
        service.acquireLock('fail-key', { retryCount: 2, retryDelay: 10 }),
      ).rejects.toThrow('Failed to acquire lock after 2 attempts');
    });

    it('should retry on redis error and eventually throw', async () => {
      mockRedis.set.mockRejectedValue(new Error('Connection lost'));

      await expect(
        service.acquireLock('err-key', { retryCount: 2, retryDelay: 10 }),
      ).rejects.toThrow('Failed to acquire lock after 2 attempts');
    });

    it('should acquire lock after redis error recovery', async () => {
      let callCount = 0;
      mockRedis.set.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('Transient error');
        return 'OK';
      });

      const lock = await service.acquireLock('recovery-key', { retryCount: 3, retryDelay: 10 });
      expect(lock).toBeDefined();
    });

    it('should set lock key with lock: prefix', async () => {
      await service.acquireLock('my-resource');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:my-resource',
        expect.any(String),
        'PX',
        expect.any(Number),
        'NX',
      );
    });

    it('should provide release function on lock', async () => {
      const lock = await service.acquireLock('release-fn');
      expect(typeof lock.release).toBe('function');
    });
  });

  // ── tryLock ──────────────────────────────────────────────────────────────

  describe('tryLock', () => {
    it('should acquire lock when available', async () => {
      const lock = await service.tryLock('try-key');
      expect(lock).toBeDefined();
      expect(lock!.key).toBe('try-key');
    });

    it('should return null when lock is already held', async () => {
      mockRedis.set.mockResolvedValue(null);
      const lock = await service.tryLock('held-key');
      expect(lock).toBeNull();
    });

    it('should use default TTL when none provided', async () => {
      const lock = await service.tryLock('default-ttl');
      expect(lock!.ttl).toBe(30000);
    });

    it('should use custom TTL', async () => {
      const lock = await service.tryLock('custom-ttl', 10000);
      expect(lock!.ttl).toBe(10000);
    });

    it('should throw on redis error', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      await expect(service.tryLock('err')).rejects.toThrow('Redis down');
    });
  });

  // ── releaseLock ──────────────────────────────────────────────────────────

  describe('releaseLock', () => {
    it('should release lock using Lua script', async () => {
      // First acquire to populate the store
      const lock = await service.acquireLock('rl-key');
      await lock.release();

      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should handle release when lock value does not match', async () => {
      mockRedis.eval.mockResolvedValue(0); // value mismatch
      // Should not throw, just warn
      await expect(service.releaseLock('lock:k', 'wrong-value')).resolves.not.toThrow();
    });

    it('should throw on redis error during release', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis error'));
      await expect(service.releaseLock('lock:k', 'v')).rejects.toThrow('Redis error');
    });
  });

  // ── isLocked ─────────────────────────────────────────────────────────────

  describe('isLocked', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const result = await service.isLocked('exists');
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const result = await service.isLocked('nope');
      expect(result).toBe(false);
    });

    it('should return false on redis error', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Connection error'));
      const result = await service.isLocked('err');
      expect(result).toBe(false);
    });

    it('should use lock: prefix for key', async () => {
      mockRedis.exists.mockResolvedValue(0);
      await service.isLocked('my-key');
      expect(mockRedis.exists).toHaveBeenCalledWith('lock:my-key');
    });
  });

  // ── getLockInfo ──────────────────────────────────────────────────────────

  describe('getLockInfo', () => {
    it('should return exists=false when key does not exist (ttl=-2)', async () => {
      mockRedis.ttl.mockResolvedValue(-2);
      const info = await service.getLockInfo('no-key');
      expect(info).toEqual({ exists: false });
    });

    it('should return exists=true with no ttl when key has no expiry (ttl=-1)', async () => {
      mockRedis.ttl.mockResolvedValue(-1);
      const info = await service.getLockInfo('forever');
      expect(info).toEqual({ exists: true });
    });

    it('should return exists=true with ttl in ms', async () => {
      mockRedis.ttl.mockResolvedValue(30); // 30 seconds
      const info = await service.getLockInfo('with-ttl');
      expect(info).toEqual({ exists: true, ttl: 30000 });
    });

    it('should return null on redis error', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'));
      const info = await service.getLockInfo('err');
      expect(info).toBeNull();
    });

    it('should use lock: prefix', async () => {
      mockRedis.ttl.mockResolvedValue(-2);
      await service.getLockInfo('my-key');
      expect(mockRedis.ttl).toHaveBeenCalledWith('lock:my-key');
    });
  });

  // ── renewLock ────────────────────────────────────────────────────────────

  describe('renewLock', () => {
    it('should renew lock with default TTL from lock object', async () => {
      const lock = await service.acquireLock('renew-key');
      mockRedis.pexpire.mockResolvedValue(1);

      await expect(service.renewLock(lock)).resolves.not.toThrow();
      expect(mockRedis.pexpire).toHaveBeenCalledWith('lock:renew-key', lock.ttl);
    });

    it('should renew lock with custom additional TTL', async () => {
      const lock = await service.acquireLock('renew-custom');
      mockRedis.pexpire.mockResolvedValue(1);

      await service.renewLock(lock, 60000);
      expect(mockRedis.pexpire).toHaveBeenCalledWith('lock:renew-custom', 60000);
    });

    it('should throw when lock has expired (pexpire returns 0)', async () => {
      const lock = await service.acquireLock('expired');
      mockRedis.pexpire.mockResolvedValue(0);

      await expect(service.renewLock(lock)).rejects.toThrow();
    });

    it('should throw on redis error during renewal', async () => {
      const lock = await service.acquireLock('renew-err');
      mockRedis.pexpire.mockRejectedValue(new Error('Connection lost'));

      await expect(service.renewLock(lock)).rejects.toThrow('Connection lost');
    });
  });

  // ── executeWithLock ──────────────────────────────────────────────────────

  describe('executeWithLock', () => {
    it('should execute operation and release lock', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      const result = await service.executeWithLock('exec-key', operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(1);
      // Lock should be released (eval called)
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should release lock even when operation throws', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        service.executeWithLock('fail-exec', operation),
      ).rejects.toThrow('Operation failed');

      // Lock should still be released (finally block)
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should pass lock options to acquireLock', async () => {
      const operation = jest.fn().mockResolvedValue(null);
      await service.executeWithLock('opts-key', operation, { ttl: 5000, retryCount: 1 });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:opts-key',
        expect.any(String),
        'PX',
        5000,
        'NX',
      );
    });

    it('should propagate type through generic', async () => {
      const operation = jest.fn().mockResolvedValue({ data: 42 });
      const result = await service.executeWithLock<{ data: number }>('typed', operation);
      expect(result.data).toBe(42);
    });
  });

  // ── Lock release integration ─────────────────────────────────────────────

  describe('lock release integration', () => {
    it('should release lock acquired via acquireLock', async () => {
      // Pre-populate the mock store so eval can find the key
      mockRedis.set.mockImplementation(async (key: string, value: string) => {
        mockRedis._store.set(key, value);
        return 'OK';
      });
      mockRedis.eval.mockImplementation(async (script: string, numKeys: number, ...args: any[]) => {
        const [key, value] = args;
        if (mockRedis._store.get(key) === value) {
          mockRedis._store.delete(key);
          return 1;
        }
        return 0;
      });

      const lock = await service.acquireLock('release-test');
      await lock.release();

      // After release, lock should be gone
      expect(mockRedis._store.has('lock:release-test')).toBe(false);
    });

    it('should release lock acquired via tryLock', async () => {
      mockRedis.set.mockImplementation(async (key: string, value: string) => {
        mockRedis._store.set(key, value);
        return 'OK';
      });
      mockRedis.eval.mockImplementation(async (script: string, numKeys: number, ...args: any[]) => {
        const [key, value] = args;
        if (mockRedis._store.get(key) === value) {
          mockRedis._store.delete(key);
          return 1;
        }
        return 0;
      });

      const lock = await service.tryLock('try-release');
      expect(lock).not.toBeNull();
      await lock!.release();

      expect(mockRedis._store.has('lock:try-release')).toBe(false);
    });
  });
});
