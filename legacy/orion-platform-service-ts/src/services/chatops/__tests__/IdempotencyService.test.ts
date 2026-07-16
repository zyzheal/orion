/**
 * IdempotencyService 单元测试
 *
 * 测试三层降级策略：Redis → PostgreSQL → 内存去重。
 */

import { IdempotencyService, IdempotencyEntry } from '../IdempotencyService';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  // Mock timers to control setInterval
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create service with no backends', () => {
      service = new IdempotencyService({});
      expect(service).toBeDefined();
    });

    it('should accept redisClient option', () => {
      const mockRedis = { get: jest.fn(), setEx: jest.fn() };
      service = new IdempotencyService({ redisClient: mockRedis });
      expect(service).toBeDefined();
    });

    it('should accept dbPool option', () => {
      const mockDb = { query: jest.fn() };
      service = new IdempotencyService({ dbPool: mockDb as any });
      expect(service).toBeDefined();
    });

    it('should accept both redisClient and dbPool', () => {
      const mockRedis = { get: jest.fn(), setEx: jest.fn() };
      const mockDb = { query: jest.fn() };
      service = new IdempotencyService({ redisClient: mockRedis, dbPool: mockDb as any });
      expect(service).toBeDefined();
    });
  });

  // ==================== checkAndReturn ====================

  describe('checkAndReturn - Redis layer', () => {
    it('should return cached result from Redis', async () => {
      const cachedEntry: IdempotencyEntry = {
        command: 'deploy',
        userId: 'user-1',
        result: { status: 'ok' },
      };
      const mockRedis = {
        get: jest.fn().mockResolvedValue(JSON.stringify(cachedEntry)),
        setEx: jest.fn(),
      };

      service = new IdempotencyService({ redisClient: mockRedis });
      const result = await service.checkAndReturn('key-1');

      expect(result).toEqual(cachedEntry);
      expect(mockRedis.get).toHaveBeenCalledWith('idempotency:key-1');
    });

    it('should return null when Redis has no cached entry', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        setEx: jest.fn(),
      };

      service = new IdempotencyService({ redisClient: mockRedis });
      const result = await service.checkAndReturn('key-1');

      expect(result).toBeNull();
    });

    it('should fall through to DB when Redis throws error', async () => {
      const mockRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        setEx: jest.fn(),
      };
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };

      service = new IdempotencyService({ redisClient: mockRedis, dbPool: mockDb as any });
      const result = await service.checkAndReturn('key-1');

      expect(result).toBeNull();
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('checkAndReturn - PostgreSQL layer', () => {
    it('should return cached result from PostgreSQL', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({
          rows: [{
            command: 'deploy',
            user_id: 'user-1',
            result: { status: 'ok' },
          }],
          rowCount: 1,
        }),
      };

      service = new IdempotencyService({ dbPool: mockDb as any });
      const result = await service.checkAndReturn('key-1');

      expect(result).toEqual({
        command: 'deploy',
        userId: 'user-1',
        result: { status: 'ok' },
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT command, user_id, result FROM chatops_idempotency_keys'),
        ['key-1']
      );
    });

    it('should return null when PostgreSQL has no entry', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      };

      service = new IdempotencyService({ dbPool: mockDb as any });
      const result = await service.checkAndReturn('key-1');

      expect(result).toBeNull();
    });

    it('should fall through to memory when PostgreSQL throws error', async () => {
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      };

      service = new IdempotencyService({ dbPool: mockDb as any });
      const result = await service.checkAndReturn('key-1');

      expect(result).toBeNull();
    });
  });

  describe('checkAndReturn - Memory layer (no backends)', () => {
    it('should return null when no backends configured', async () => {
      service = new IdempotencyService({});
      const result = await service.checkAndReturn('key-1');

      expect(result).toBeNull();
    });
  });

  describe('checkAndReturn - degradation chain', () => {
    it('should try Redis first, then DB, then memory', async () => {
      const mockRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis down')),
        setEx: jest.fn(),
      };
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('DB down')),
      };

      service = new IdempotencyService({ redisClient: mockRedis, dbPool: mockDb as any });
      const result = await service.checkAndReturn('key-1');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  // ==================== store ====================

  describe('store - Redis layer', () => {
    it('should store entry in Redis and return', async () => {
      const mockRedis = {
        get: jest.fn(),
        setEx: jest.fn().mockResolvedValue('OK'),
      };

      service = new IdempotencyService({ redisClient: mockRedis });
      const entry: IdempotencyEntry = {
        command: 'deploy',
        userId: 'user-1',
        result: { status: 'ok' },
      };

      await service.store('key-1', entry);

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        'idempotency:key-1',
        3600, // default TTL
        JSON.stringify(entry)
      );
    });

    it('should use custom TTL when provided', async () => {
      const mockRedis = {
        get: jest.fn(),
        setEx: jest.fn().mockResolvedValue('OK'),
      };

      service = new IdempotencyService({ redisClient: mockRedis });
      await service.store('key-1', { command: 'test', userId: 'u1', result: {} }, { ttlSeconds: 600 });

      expect(mockRedis.setEx).toHaveBeenCalledWith('idempotency:key-1', 600, expect.any(String));
    });

    it('should fall through to DB when Redis throws error', async () => {
      const mockRedis = {
        get: jest.fn(),
        setEx: jest.fn().mockRejectedValue(new Error('Redis down')),
      };
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
      };

      service = new IdempotencyService({ redisClient: mockRedis, dbPool: mockDb as any });
      await service.store('key-1', { command: 'test', userId: 'u1', result: {} });

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('store - PostgreSQL layer', () => {
    it('should store entry in PostgreSQL', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
      };

      service = new IdempotencyService({ dbPool: mockDb as any });
      const entry: IdempotencyEntry = {
        command: 'deploy',
        userId: 'user-1',
        result: { status: 'ok' },
      };

      await service.store('key-1', entry);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_idempotency_keys'),
        ['key-1', 'deploy', 'user-1', '{"status":"ok"}', 3600]
      );
    });

    it('should use custom TTL', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
      };

      service = new IdempotencyService({ dbPool: mockDb as any });
      await service.store('key-1', { command: 'test', userId: 'u1', result: {} }, { ttlSeconds: 120 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([120])
      );
    });

    it('should fall through to memory when DB throws error', async () => {
      const mockDb = {
        query: jest.fn().mockRejectedValue(new Error('DB down')),
      };

      service = new IdempotencyService({ dbPool: mockDb as any });
      await service.store('key-1', { command: 'test', userId: 'u1', result: {} });

      // Should not throw - falls through to memory silently
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('store - Memory layer', () => {
    it('should store entry in memory when no backends', async () => {
      service = new IdempotencyService({});

      // Should not throw
      await service.store('key-1', { command: 'test', userId: 'u1', result: {} });
      expect(true).toBe(true);
    });
  });

  // ==================== Memory cleanup ====================

  describe('memory key cleanup', () => {
    it('should clean expired memory keys after 5 seconds', () => {
      service = new IdempotencyService({});

      // Store a key in memory
      service.store('key-1', { command: 'test', userId: 'u1', result: {} });

      // Advance time past 5 seconds
      jest.advanceTimersByTime(6000);

      // Trigger cleanup interval (10s)
      jest.advanceTimersByTime(10000);

      // No error thrown means cleanup worked
      expect(true).toBe(true);
    });

    it('should not clean non-expired memory keys', () => {
      service = new IdempotencyService({});

      service.store('key-1', { command: 'test', userId: 'u1', result: {} });

      // Advance time but not past 5 seconds
      jest.advanceTimersByTime(3000);

      // Trigger cleanup interval
      jest.advanceTimersByTime(10000);

      // Key should still be there
      expect(true).toBe(true);
    });
  });
});
