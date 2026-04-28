/**
 * 租户配额管理服务单元测试
 */

import { TenantQuotaService, QuotaUsage } from '../tenant-quota.service';
import { DEFAULT_QUOTAS, TenantTier } from '../../middleware/tenant';

// Mock Redis module before importing
jest.mock('../../utils/redis', () => ({
  redisClient: {
    getClient: jest.fn().mockReturnValue(null),
    isConnected: jest.fn().mockReturnValue(false),
  },
}));

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  incrby: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
};

describe('TenantQuotaService', () => {
  let service: TenantQuotaService;

  beforeEach(() => {
    service = new TenantQuotaService();
    service.setRedisClient(mockRedis as any);
    jest.clearAllMocks();
  });

  describe('initQuota', () => {
    it('应该初始化租户配额', async () => {
      await service.initQuota('t001', 'standard');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('tenant:quota:t001:usage'),
        expect.any(String)
      );
    });

    it('应该使用默认等级初始化', async () => {
      await service.initQuota('t001');

      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('getUsage / updateUsage', () => {
    it('应该获取配额使用量', async () => {
      const mockUsage: QuotaUsage = {
        tenantId: 't001',
        cpuUsed: 100,
        memoryUsed: 256,
        runnersActive: 2,
        queueDepth: 10,
        tokenUsed: 5000,
        apiCalls: 100,
        hoursUsed: 5,
        lastUpdated: new Date(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockUsage));

      const result = await service.getUsage('t001');

      expect(result).toEqual(mockUsage);
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining('tenant:quota:t001:usage')
      );
    });

    it('当没有使用记录时返回 null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getUsage('t001');

      expect(result).toBeNull();
    });

    it('应该更新配额使用量', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        tenantId: 't001',
        cpuUsed: 100,
        memoryUsed: 256,
        runnersActive: 2,
        queueDepth: 10,
        tokenUsed: 5000,
        apiCalls: 100,
        hoursUsed: 5,
        lastUpdated: new Date(),
      }));

      await service.updateUsage('t001', { cpuUsed: 200, memoryUsed: 512 });

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('tenant:quota:t001:usage'),
        expect.any(String)
      );
    });
  });

  describe('incrementRunners / decrementRunners', () => {
    it('应该增加 Runner 计数', async () => {
      mockRedis.incrby.mockResolvedValue(3);

      const result = await service.incrementRunners('t001', 1);

      expect(result).toBe(3);
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringContaining('tenant:quota:t001:runners'),
        1
      );
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('应该减少 Runner 计数', async () => {
      mockRedis.incrby.mockResolvedValue(2);

      const result = await service.decrementRunners('t001', 1);

      expect(result).toBe(2);
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringContaining('tenant:quota:t001:runners'),
        -1
      );
    });

    it('Runner 计数不应小于 0', async () => {
      mockRedis.incrby.mockResolvedValue(-1);

      const result = await service.decrementRunners('t001', 5);

      expect(result).toBe(0);
    });

    it('应该获取当前 Runner 数', async () => {
      mockRedis.get.mockResolvedValue('5');

      const result = await service.getRunnersCount('t001');

      expect(result).toBe(5);
    });
  });

  describe('incrementTokens / getTokenUsage', () => {
    it('应该增加 Token 使用量', async () => {
      mockRedis.incrby.mockResolvedValue(15000);

      const result = await service.incrementTokens('t001', 1000);

      expect(result).toBe(15000);
      expect(mockRedis.incrby).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining('tokens:daily'),
        86400
      );
    });

    it('应该获取今日 Token 使用量', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockRedis.get.mockResolvedValue('8000');

      const result = await service.getTokenUsage('t001');

      expect(result).toBe(8000);
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining(`tokens:daily:${today}`)
      );
    });
  });

  describe('incrementApiCalls / getCurrentQps', () => {
    it('应该增加 API 调用计数', async () => {
      mockRedis.incr.mockResolvedValue(50);

      const result = await service.incrementApiCalls('t001');

      expect(result).toBe(50);
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining('api:qps'),
        1
      );
    });

    it('应该获取当前 QPS', async () => {
      mockRedis.get.mockResolvedValue('75');

      const result = await service.getCurrentQps('t001');

      expect(result).toBe(75);
    });
  });

  describe('incrementQueue / decrementQueue', () => {
    it('应该增加队列深度', async () => {
      mockRedis.incrby.mockResolvedValue(25);

      const result = await service.incrementQueue('t001', 5);

      expect(result).toBe(25);
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringContaining('tenant:quota:t001:queue'),
        5
      );
    });

    it('应该减少队列深度', async () => {
      mockRedis.incrby.mockResolvedValue(15);

      const result = await service.decrementQueue('t001', 5);

      expect(result).toBe(15);
    });
  });

  describe('配额检查', () => {
    const quota = DEFAULT_QUOTAS.standard;

    describe('checkRunnerQuota', () => {
      it('当 Runner 数未达上限时允许', async () => {
        mockRedis.get.mockResolvedValue('3');

        const result = await service.checkRunnerQuota('t001', quota);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
      });

      it('当 Runner 数达上限时拒绝', async () => {
        mockRedis.get.mockResolvedValue('5');

        const result = await service.checkRunnerQuota('t001', quota);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('并发 Runner 数已达上限');
      });
    });

    describe('checkTokenQuota', () => {
      it('当 Token 未达上限时允许', async () => {
        const today = new Date().toISOString().split('T')[0];
        mockRedis.get.mockResolvedValue('50000');

        const result = await service.checkTokenQuota('t001', quota);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(50000);
      });

      it('当 Token 达上限时拒绝', async () => {
        const today = new Date().toISOString().split('T')[0];
        mockRedis.get.mockResolvedValue('100000');

        const result = await service.checkTokenQuota('t001', quota);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('今日 Token 配额已耗尽');
      });
    });

    describe('checkQpsQuota', () => {
      it('当 QPS 未达上限时允许', async () => {
        mockRedis.get.mockResolvedValue('50');

        const result = await service.checkQpsQuota('t001', quota);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(50);
      });

      it('当 QPS 达上限时拒绝', async () => {
        mockRedis.get.mockResolvedValue('100');

        const result = await service.checkQpsQuota('t001', quota);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('API 调用频率超限');
      });
    });

    describe('checkQueueQuota', () => {
      it('当队列深度未达上限时允许', async () => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({
          tenantId: 't001',
          cpuUsed: 0,
          memoryUsed: 0,
          runnersActive: 0,
          queueDepth: 50,
          tokenUsed: 0,
          apiCalls: 0,
          hoursUsed: 0,
          lastUpdated: new Date(),
        }));

        const result = await service.checkQueueQuota('t001', quota);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(50);
      });

      it('当队列深度达上限时拒绝', async () => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({
          tenantId: 't001',
          cpuUsed: 0,
          memoryUsed: 0,
          runnersActive: 0,
          queueDepth: 100,
          tokenUsed: 0,
          apiCalls: 0,
          hoursUsed: 0,
          lastUpdated: new Date(),
        }));

        const result = await service.checkQueueQuota('t001', quota);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('队列深度已达上限');
      });
    });

    describe('checkAllQuotas', () => {
      it('当所有配额都充足时允许', async () => {
        mockRedis.get.mockResolvedValue('1');

        const result = await service.checkAllQuotas('t001', quota);

        expect(result.allowed).toBe(true);
      });

      it('当任一配额不足时拒绝', async () => {
        mockRedis.get.mockResolvedValue('100'); // Runner 已达上限

        const result = await service.checkAllQuotas('t001', quota);

        expect(result.allowed).toBe(false);
      });
    });
  });

  describe('checkQuotaAlerts', () => {
    it('当使用率达到 85% 时生成预警', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        tenantId: 't001',
        cpuUsed: 0,
        memoryUsed: 0,
        runnersActive: 9, // 9/10 = 90%
        queueDepth: 0,
        tokenUsed: 0,
        apiCalls: 0,
        hoursUsed: 0,
        lastUpdated: new Date(),
      }));

      const result = await service.checkQuotaAlerts('t001', DEFAULT_QUOTAS.free);

      expect(result).toHaveLength(1);
      expect(result[0].quotaType).toBe('concurrentRunners');
      expect(result[0].usagePercent).toBe(90);
    });

    it('当使用率低于 85% 时不生成预警', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        tenantId: 't001',
        cpuUsed: 0,
        memoryUsed: 0,
        runnersActive: 1, // 1/10 = 10%
        queueDepth: 0,
        tokenUsed: 0,
        apiCalls: 0,
        hoursUsed: 0,
        lastUpdated: new Date(),
      }));

      const result = await service.checkQuotaAlerts('t001', DEFAULT_QUOTAS.free);

      expect(result).toHaveLength(0);
    });
  });

  describe('resetQuota', () => {
    it('应该重置租户配额', async () => {
      await service.resetQuota('t001');

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('getAllTenantsQuotaStatus', () => {
    it('应该获取所有租户的配额状态', async () => {
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({
          tenantId: 't001',
          cpuUsed: 100,
          memoryUsed: 256,
          runnersActive: 2,
          queueDepth: 10,
          tokenUsed: 5000,
          apiCalls: 100,
          hoursUsed: 5,
          lastUpdated: new Date(),
        }))
        .mockResolvedValueOnce(JSON.stringify({
          tenantId: 't002',
          cpuUsed: 200,
          memoryUsed: 512,
          runnersActive: 3,
          queueDepth: 20,
          tokenUsed: 10000,
          apiCalls: 200,
          hoursUsed: 10,
          lastUpdated: new Date(),
        }));

      const result = await service.getAllTenantsQuotaStatus(['t001', 't002']);

      expect(result.size).toBe(2);
      expect(result.get('t001')).toBeDefined();
      expect(result.get('t002')).toBeDefined();
    });
  });
});

describe('TenantQuotaService - 无 Redis 场景', () => {
  let service: TenantQuotaService;

  beforeEach(() => {
    service = new TenantQuotaService();
    // 不设置 Redis 客户端
    jest.clearAllMocks();
  });

  it('当 Redis 不可用时 initQuota 不抛出错误', async () => {
    await expect(service.initQuota('t001')).resolves.not.toThrow();
  });

  it('当 Redis 不可用时 getUsage 返回 null', async () => {
    const result = await service.getUsage('t001');
    expect(result).toBeNull();
  });

  it('当 Redis 不可用时 getRunnersCount 返回 0', async () => {
    const result = await service.getRunnersCount('t001');
    expect(result).toBe(0);
  });

  it('当 Redis 不可用时 checkAllQuotas 允许', async () => {
    const result = await service.checkAllQuotas('t001', DEFAULT_QUOTAS.standard);
    expect(result.allowed).toBe(true);
  });
});
