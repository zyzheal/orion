/**
 * CacheMonitorService 单元测试
 */

import { CacheMonitorService, CacheMetricsRepository, CacheMonitorServiceError } from '../CacheMonitorService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('CacheMonitorService', () => {
  let service: CacheMonitorService;
  let repository: CacheMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CacheMetricsRepository(mockPool as any);
    service = new CacheMonitorService(mockPool as any);
  });

  describe('CacheMetricsRepository', () => {
    describe('getCacheMetrics', () => {
      it('应该返回缓存指标', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            tenant_id: 'tenant1',
            total_hits: 100,
            total_misses: 10,
            hit_rate: 0.91,
          }],
        });

        const result = await repository.getCacheMetrics('c1');

        expect(result).not.toBeNull();
        expect(result!.hit_rate).toBe(0.91);
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.getCacheMetrics('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('listTenantCaches', () => {
      it('应该返回租户的所有缓存', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { cache_id: 'c1', hit_rate: 0.9 },
            { cache_id: 'c2', hit_rate: 0.85 },
          ],
        });

        const result = await repository.listTenantCaches('tenant1');

        expect(result.length).toBe(2);
      });
    });

    describe('updateMetrics', () => {
      it('应该更新缓存指标', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.updateMetrics('c1', 'tenant1', 50, 5, 1024, 0, 100);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining(['c1', 'tenant1', 50, 5])
        );
      });

      it('应该正确计算命中率', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await repository.updateMetrics('c1', 'tenant1', 90, 10, 1024, 0, 100);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('hit_rate'),
          expect.arrayContaining([0.9]) // hit rate = 90/(90+10)
        );
      });
    });

    describe('getTenantSummary', () => {
      it('应该返回租户缓存汇总', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            total_caches: '5',
            total_size: '5120',
            total_hits: '500',
            total_misses: '50',
            avg_hit_rate: '0.91',
            avg_latency_saved: '100',
            total_latency_saved: '50000',
          }],
        });

        const result = await repository.getTenantSummary('tenant1');

        expect(result.total_caches).toBe(5);
        expect(result.avg_hit_rate).toBeCloseTo(0.91, 2);
      });

      it('应该处理空结果', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            total_caches: '0',
            total_size: null,
            total_hits: null,
            total_misses: null,
          }],
        });

        const result = await repository.getTenantSummary('tenant1');

        expect(result.total_caches).toBe(0);
        expect(result.total_hits).toBe(0);
      });
    });

    describe('mapRow', () => {
      it('应该正确映射数据库行', () => {
        const row = {
          cache_id: 'c1',
          tenant_id: 'tenant1',
          total_hits: 100,
          total_misses: 10,
          hit_rate: 0.91,
          total_size_bytes: 1024,
          max_size_bytes: 10240,
          eviction_count: 5,
          avg_latency_saved_ms: 50,
          last_updated: new Date(),
        };

        const result = repository.mapRow(row);

        expect(result.cache_id).toBe('c1');
        expect(result.utilization_percent).toBeCloseTo(10, 1); // 1024/10240
      });

      it('应该使用默认最大大小', () => {
        const row = {
          cache_id: 'c1',
          total_size_bytes: 1073741824, // 1GB
          max_size_bytes: null,
          eviction_count: 0,
        };

        const result = repository.mapRow(row);

        expect(result.utilization_percent).toBeCloseTo(10, 1); // 1GB / 10GB
      });
    });
  });

  describe('CacheMonitorService', () => {
    describe('getCacheMetrics', () => {
      it('应该返回缓存指标', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ cache_id: 'c1', hit_rate: 0.9 }],
        });

        const result = await service.getCacheMetrics('c1');

        expect(result).not.toBeNull();
      });
    });

    describe('listTenantCaches', () => {
      it('应该返回租户缓存列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ cache_id: 'c1' }],
        });

        const result = await service.listTenantCaches('tenant1');

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getTenantSummary', () => {
      it('应该返回缓存汇总', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            total_caches: '5',
            total_hits: '100',
          }],
        });

        const result = await service.getTenantSummary('tenant1');

        expect(result).toHaveProperty('total_caches');
        expect(result).toHaveProperty('avg_hit_rate');
      });
    });

    describe('checkCacheHealth', () => {
      it('应该返回健康状态', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.95,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('healthy');
        expect(result.issues.length).toBe(0);
      });

      it('应该检测低命中率问题', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.4, // Below 0.5 threshold
            total_size_bytes: 1024,
            max_size_bytes: 10240,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('warning');
        expect(result.issues.some(i => i.type === 'low_hit_rate')).toBe(true);
      });

      it('应该检测高利用率问题', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.9,
            total_size_bytes: 10240,
            max_size_bytes: 10240,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.issues.some(i => i.type === 'high_utilization')).toBe(true);
      });
    });

    describe('getPerformanceImpact', () => {
      it('应该返回性能影响分析', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            cache_enabled_runs: '10',
            cache_disabled_runs: '5',
            with_cache_avg: '1000',
            without_cache_avg: '3000',
          }],
        });

        const result = await service.analyzePerformanceImpact('p1');

        expect(result).toHaveProperty('time_saved_ms');
        expect(result).toHaveProperty('time_saved_percent');
      });
    });

    describe('recordCacheEvent', () => {
      it('应该记录缓存命中', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await service.recordCacheEvent('c1', 'tenant1', 'hit', 50);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining(['c1', 'tenant1', 1, 0])
        );
      });

      it('应该记录缓存未命中', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await service.recordCacheEvent('c1', 'tenant1', 'miss');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining(['c1', 'tenant1', 0, 1])
        );
      });
    });
  });

  describe('CacheMonitorServiceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new CacheMonitorServiceError('Cache not found', 'CACHE_NOT_FOUND');

      expect(error.message).toBe('Cache not found');
      expect(error.code).toBe('CACHE_NOT_FOUND');
      expect(error.name).toBe('CacheMonitorServiceError');
    });
  });
});