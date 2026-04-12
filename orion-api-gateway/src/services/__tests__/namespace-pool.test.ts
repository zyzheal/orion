/**
 * Namespace Pool Manager 单元测试
 */

import { NamespacePoolManager, NamespacePool, TenantAllocation } from '../namespace-pool.service';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  hgetall: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hmset: jest.fn(),
  hincrby: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
} as any;

// Mock Fastify 应用
const mockApp = {
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
};

describe('NamespacePoolManager', () => {
  let manager: NamespacePoolManager;

  beforeEach(() => {
    manager = new NamespacePoolManager();
    manager.setRedisClient(mockRedis);
    jest.clearAllMocks();
  });

  describe('calculatePoolIndex', () => {
    it('应该正确计算租户 1-10 的池索引', () => {
      expect(manager.calculatePoolIndex(1)).toBe(1);
      expect(manager.calculatePoolIndex(10)).toBe(1);
    });

    it('应该正确计算租户 11-20 的池索引', () => {
      expect(manager.calculatePoolIndex(11)).toBe(2);
      expect(manager.calculatePoolIndex(20)).toBe(2);
    });

    it('应该正确计算租户 991-1000 的池索引', () => {
      expect(manager.calculatePoolIndex(991)).toBe(100);
      expect(manager.calculatePoolIndex(1000)).toBe(100);
    });
  });

  describe('generatePoolId', () => {
    it('应该生成正确的池 ID', () => {
      expect(manager.generatePoolId(1)).toBe('orion-tenant-pool-001');
      expect(manager.generatePoolId(10)).toBe('orion-tenant-pool-010');
      expect(manager.generatePoolId(100)).toBe('orion-tenant-pool-100');
    });
  });

  describe('parseTenantSeq', () => {
    it('应该解析 t001-t999 格式', () => {
      expect(manager.parseTenantSeq('t001')).toBe(1);
      expect(manager.parseTenantSeq('t010')).toBe(10);
      expect(manager.parseTenantSeq('t999')).toBe(999);
    });

    it('应该解析 tenant-001 格式', () => {
      expect(manager.parseTenantSeq('tenant-001')).toBe(1);
      expect(manager.parseTenantSeq('tenant-100')).toBe(100);
    });

    it('对于无效格式返回 null', () => {
      expect(manager.parseTenantSeq('invalid')).toBeNull();
      expect(manager.parseTenantSeq('team-alpha')).toBeNull();
    });
  });

  describe('allocatePool', () => {
    it('应该为租户分配正确的池', async () => {
      // Mock Redis 响应
      mockRedis.exists.mockResolvedValue(1); // 池已存在

      const allocation = await manager.allocatePool('t005');

      expect(allocation).toBeDefined();
      expect(allocation?.poolId).toBe('orion-tenant-pool-001');
      expect(allocation?.poolIndex).toBe(1);
      expect(allocation?.tenantSeq).toBe(5);
    });

    it('应该为 t015 租户分配到 pool-002', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const allocation = await manager.allocatePool('t015');

      expect(allocation).toBeDefined();
      expect(allocation?.poolId).toBe('orion-tenant-pool-002');
      expect(allocation?.poolIndex).toBe(2);
    });

    it('当 Redis 不可用时返回默认分配', async () => {
      manager.setRedisClient(null as any);

      const allocation = await manager.allocatePool('t005');

      expect(allocation).toBeDefined();
      expect(allocation?.poolId).toBe('orion-tenant-pool-001');
    });
  });

  describe('getPool', () => {
    it('应该获取池信息', async () => {
      const mockPoolData = {
        id: 'orion-tenant-pool-001',
        poolIndex: '1',
        tenantRangeStart: '1',
        tenantRangeEnd: '10',
        tenantCount: '5',
        maxTenants: '10',
        cpuPercent: '50',
        memoryPercent: '60',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockRedis.hgetall.mockResolvedValue(mockPoolData);

      const pool = await manager.getPool('orion-tenant-pool-001');

      expect(pool).toBeDefined();
      expect(pool?.id).toBe('orion-tenant-pool-001');
      expect(pool?.tenantCount).toBe(5);
      expect(pool?.status).toBe('active');
    });

    it('当池不存在时返回 null', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const pool = await manager.getPool('orion-tenant-pool-999');

      expect(pool).toBeNull();
    });
  });

  describe('findAvailablePool', () => {
    it('应该找到第一个有空位的池', async () => {
      mockRedis.hgetall
        .mockResolvedValueOnce({
          // Pool 001 - full
          id: 'orion-tenant-pool-001',
          poolIndex: '1',
          tenantRangeStart: '1',
          tenantRangeEnd: '10',
          tenantCount: '10',
          maxTenants: '10',
          cpuPercent: '80',
          memoryPercent: '90',
          status: 'full',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })
        .mockResolvedValueOnce({
          // Pool 002 - available
          id: 'orion-tenant-pool-002',
          poolIndex: '2',
          tenantRangeStart: '11',
          tenantRangeEnd: '20',
          tenantCount: '5',
          maxTenants: '10',
          cpuPercent: '50',
          memoryPercent: '60',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        });

      const pool = await manager.findAvailablePool();

      expect(pool).toBeDefined();
      expect(pool?.poolIndex).toBe(2);
      expect(pool?.tenantCount).toBe(5);
    });
  });

  describe('deallocatePool', () => {
    it('应该回收租户分配', async () => {
      // Mock 现有分配
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          tenantId: 't005',
          tenantSeq: 5,
          poolId: 'orion-tenant-pool-001',
          poolIndex: 1,
          allocatedAt: '2026-01-01T00:00:00Z',
        })
      );

      await manager.deallocatePool('t005');

      expect(mockRedis.del).toHaveBeenCalledWith('namespace:allocation:t005');
      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        'namespace:pool:orion-tenant-pool-001',
        'tenantCount',
        -1
      );
    });
  });

  describe('getPoolStats', () => {
    it('应该返回池统计信息', async () => {
      mockRedis.hgetall
        .mockResolvedValueOnce({
          id: 'orion-tenant-pool-001',
          poolIndex: '1',
          tenantRangeStart: '1',
          tenantRangeEnd: '10',
          tenantCount: '10',
          maxTenants: '10',
          cpuPercent: '80',
          memoryPercent: '90',
          status: 'full',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })
        .mockResolvedValueOnce({
          id: 'orion-tenant-pool-002',
          poolIndex: '2',
          tenantRangeStart: '11',
          tenantRangeEnd: '20',
          tenantCount: '5',
          maxTenants: '10',
          cpuPercent: '50',
          memoryPercent: '60',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        });

      // Mock 后续池都返回空
      mockRedis.hgetall.mockResolvedValue({});

      const stats = await manager.getPoolStats();

      expect(stats.totalPools).toBeGreaterThan(0);
      expect(stats.totalTenants).toBe(15); // 10 + 5
    });
  });
});
