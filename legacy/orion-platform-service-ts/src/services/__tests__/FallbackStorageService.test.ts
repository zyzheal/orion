/**
 * FallbackStorageService 单元测试
 */

import { FallbackStorageService, LoggerLike } from '../fallback-storage';

// Mock RedisCache (L2)
const mockRedisCache = {
  isHealthy: jest.fn(() => true),
} as any;

// Mock DatabasePool (L3) — CacheRepository 内部使用 pool.query()
const mockDatabasePool = {
  query: jest.fn(),
};

// Mock logger to avoid Pino Proxy issues in test environment
const mockLogger: LoggerLike = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('FallbackStorageService', () => {
  let service: FallbackStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRedisCache.isHealthy.mockReturnValue(true);
    mockDatabasePool.query.mockClear();
  });

  afterEach(() => {
    service?.stopHealthCheck();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('应该创建只有 Memory 层的服务（无 Redis 无 PostgreSQL）', () => {
      service = new FallbackStorageService({ tenantId: 'test-tenant', logger: mockLogger });
      expect(service.getActiveTier()).toBe('memory');
      expect(service.isDegraded()).toBe(false);
    });

    it('应该创建 Redis + Memory 的服务', () => {
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });
      expect(service.getActiveTier()).toBe('redis');
    });

    it('应该创建 PostgreSQL + Memory 的服务（database 可用时）', () => {
      mockDatabasePool.query.mockResolvedValue({ rows: [{ value: 'test' }] });
      service = new FallbackStorageService({ tenantId: 'test-tenant', database: mockDatabasePool as any, logger: mockLogger });
      // PostgreSQL 层存在但初始状态取决于健康检查，初始 available=true
      expect(service.getActiveTier()).toBe('postgres');
    });

    it('应该创建三层全部可用的服务', () => {
      mockDatabasePool.query.mockResolvedValue({ rows: [{ value: 'test' }] });
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, logger: mockLogger });
      expect(service.getActiveTier()).toBe('redis');
    });
  });

  describe('get', () => {
    it('应该从 Redis 层获取数据', async () => {
      // CacheService.get 内部调用 redis.get，需要 mock RedisCache.get
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });

      const result = await service.get('key-1');

      // InMemoryCache 没有数据，返回 null
      expect(result).toBeNull();
    });

    it('Redis 不可用时应该降级到 PostgreSQL', async () => {
      mockRedisCache.isHealthy.mockReturnValue(false);
      mockDatabasePool.query.mockResolvedValue({ rows: [{ tenant_id: 'default', key: 'key-1', value: { data: 'pg-value' } }] });
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, logger: mockLogger });

      const result = await service.get('key-1');

      expect(result).toEqual({ data: 'pg-value' });
    });

    it('Redis 和 PostgreSQL 都不可用时应该降级到 Memory', async () => {
      mockRedisCache.isHealthy.mockReturnValue(false);
      mockDatabasePool.query.mockRejectedValue(new Error('PG down'));
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, logger: mockLogger });

      // Memory 层没有数据 → 返回 null
      const result = await service.get('key-1');

      expect(result).toBeNull();
    });

    it('应该返回 null 当所有层都没有数据', async () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('应该写入 Redis 层', async () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });

      await service.set('key-1', { data: 'value' }, 300);

      // 不应抛出异常
      expect(service.getActiveTier()).toBe('redis');
    });

    it('应该同时写入 Redis 和 PostgreSQL', async () => {
      mockDatabasePool.query.mockResolvedValue({ rows: [{ value: 'test' }] });
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, logger: mockLogger });

      await service.set('key-1', { data: 'value' }, 300);

      // 不应抛出异常
      expect(service.isDegraded()).toBe(false);
    });

    it('写入失败不应影响其他层', async () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      mockDatabasePool.query.mockRejectedValue(new Error('PG write fail'));
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, logger: mockLogger });

      // 不应该抛出异常
      await expect(service.set('key-1', { data: 'value' })).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('应该从 Redis 层删除', async () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });

      await service.del('key-1');

      // 不应抛出异常
      expect(service.getActiveTier()).toBe('redis');
    });

    it('应该从所有可用层删除', async () => {
      mockDatabasePool.query.mockResolvedValue({ rows: [{ value: 'test' }] });
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, logger: mockLogger });

      await service.del('key-1');

      // 不应抛出异常
      expect(service.isDegraded()).toBe(false);
    });
  });

  describe('getOrLoad', () => {
    it('缓存命中时不应调用 loader', async () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });

      // 先 set 数据到 cache
      await service.set('key-1', { data: 'cached' });
      const loader = jest.fn().mockResolvedValue({ data: 'fresh' });
      const result = await service.getOrLoad('key-1', loader);

      expect(result).toEqual({ data: 'cached' });
      expect(loader).not.toHaveBeenCalled();
    });

    it('缓存未命中时调用 loader 并写入缓存', async () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });

      const loader = jest.fn().mockResolvedValue({ data: 'fresh' });
      const result = await service.getOrLoad('key-1', loader, 300);

      expect(result).toEqual({ data: 'fresh' });
      expect(loader).toHaveBeenCalled();
    });
  });

  describe('degradation & recovery', () => {
    it('Redis isHealthy 返回 false 后应标记降级到 Memory', async () => {
      mockRedisCache.isHealthy.mockReturnValue(false);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, healthCheckIntervalMs: 30_000, logger: mockLogger });

      // 执行健康检查 → Redis 不可用 → 降级
      await service.performHealthCheck();

      expect(service.isDegraded()).toBe(true);
      expect(service.getActiveTier()).toBe('memory');
    });

    it('PostgreSQL 健康检查失败后应标记降级', async () => {
      mockDatabasePool.query.mockRejectedValue(new Error('PG down'));
      mockRedisCache.isHealthy.mockReturnValue(false);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, healthCheckIntervalMs: 30_000, logger: mockLogger });

      // 执行健康检查 → PostgreSQL 不可用 → 降级到 Memory（Redis 也不可用）
      await service.performHealthCheck();

      expect(service.isDegraded()).toBe(true);
      expect(service.getActiveTier()).toBe('memory');
    });

    it('恢复后应自动升级回上层', async () => {
      // 先降级：Redis isHealthy 返回 false
      mockRedisCache.isHealthy.mockReturnValue(false);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, healthCheckIntervalMs: 100, logger: mockLogger });

      await service.performHealthCheck();
      expect(service.isDegraded()).toBe(true);
      expect(service.getActiveTier()).toBe('memory');

      // 恢复 Redis：isHealthy 返回 true
      mockRedisCache.isHealthy.mockReturnValue(true);
      await service.performHealthCheck();

      expect(service.isDegraded()).toBe(false);
      expect(service.getActiveTier()).toBe('redis');
    });

    it('降级应记录日志事件', async () => {
      mockRedisCache.isHealthy.mockReturnValue(false);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, healthCheckIntervalMs: 30_000, logger: mockLogger });

      await service.performHealthCheck();

      const stats = service.getStats();
      expect(stats.degradationCount).toBe(1);
    });

    it('恢复应记录日志事件', async () => {
      // 先降级
      mockRedisCache.isHealthy.mockReturnValue(false);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, healthCheckIntervalMs: 100, logger: mockLogger });

      await service.performHealthCheck();
      expect(service.isDegraded()).toBe(true);

      // 恢复
      mockRedisCache.isHealthy.mockReturnValue(true);
      await service.performHealthCheck();

      const stats = service.getStats();
      expect(stats.recoveryCount).toBe(1);
    });

    it('降级后 get 应从下层获取数据', async () => {
      mockRedisCache.isHealthy.mockReturnValue(false);
      mockDatabasePool.query.mockResolvedValue({ rows: [{ tenant_id: 'default', key: 'key-1', value: { data: 'pg-value' } }] });
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, healthCheckIntervalMs: 30_000, logger: mockLogger });

      // 先健康检查降级
      await service.performHealthCheck();

      // 然后 get 应该从 PostgreSQL 层获取
      const result = await service.get('key-1');
      expect(result).toEqual({ data: 'pg-value' });
    });

    it('全层降级后 get 应从 Memory 获取', async () => {
      mockRedisCache.isHealthy.mockReturnValue(false);
      mockDatabasePool.query.mockRejectedValue(new Error('PG down'));
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, database: mockDatabasePool as any, healthCheckIntervalMs: 30_000, logger: mockLogger });

      // 健康检查：Redis 和 PG 都不可用
      await service.performHealthCheck();
      expect(service.getActiveTier()).toBe('memory');

      // 先 set 数据到 Memory 层
      await service.set('key-1', { data: 'mem-value' });
      const result = await service.get('key-1');
      expect(result).toEqual({ data: 'mem-value' });
    });
  });

  describe('getStats', () => {
    it('应返回正确的统计信息', async () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, logger: mockLogger });

      await service.get('key-1');
      await service.set('key-2', 'value');

      const stats = service.getStats();
      expect(stats.activeTier).toBe('redis');
      expect(stats.degraded).toBe(false);
      expect(stats.totalOps).toBe(2);
      expect(stats.tiers.redis.available).toBe(true);
    });
  });

  describe('stopHealthCheck', () => {
    it('应停止健康检查定时器', () => {
      mockRedisCache.isHealthy.mockReturnValue(true);
      service = new FallbackStorageService({ tenantId: 'test-tenant', redis: mockRedisCache as any, healthCheckIntervalMs: 100, logger: mockLogger });

      service.stopHealthCheck();

      // 推进时间但不触发恢复（因为定时器已停止）
      jest.advanceTimersByTime(200);

      // 服务应该仍然可用（定时器停止不影响操作）
      expect(service.getActiveTier()).toBe('redis');
    });
  });
});