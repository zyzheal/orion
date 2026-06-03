/**
 * CacheMonitorService 扩展单元测试
 *
 * 覆盖现有测试文件中缺失的场景:
 * - recordCacheEvent (hit/miss)
 * - recordCacheSize
 * - recordCacheEviction
 * - assessCacheHealth 全部边界条件
 * - analyzePerformanceImpact 边界条件
 * - getDashboard 完整测试
 * - updateMetrics 零请求边界
 * - 错误传播
 * - mapRow 边界字段
 */

import { CacheMonitorService, CacheMetricsRepository, CacheMonitorServiceError } from '../CacheMonitorService';

// Mock DatabasePool
const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
};

describe('CacheMonitorService Extended Tests', () => {
  let service: CacheMonitorService;
  let repository: CacheMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CacheMetricsRepository(mockPool as any);
    service = new CacheMonitorService(mockPool as any);
  });

  // ==================== CacheMetricsRepository ====================

  describe('CacheMetricsRepository', () => {
    describe('updateMetrics', () => {
      it('应该在零请求时计算 hit_rate 为 0', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.updateMetrics('c1', 'tenant1', 0, 0, 1024, 0, 0);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining([0.0]) // hitRate = 0/(0+0) = 0
        );
      });

      it('应该在全部未命中时计算 hit_rate 为 0', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.updateMetrics('c1', 'tenant1', 0, 100, 1024, 0, 0);

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs[4]).toBe(0); // hit_rate = 0/(0+100)
      });

      it('应该在全部命中时计算 hit_rate 为 1', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.updateMetrics('c1', 'tenant1', 100, 0, 1024, 0, 50);

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs[4]).toBe(1); // hit_rate = 100/(100+0)
      });

      it('应该传递正确的参数到 SQL 查询', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.updateMetrics('cache-abc', 'tenant-xyz', 42, 8, 2048, 3, 75);

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs).toEqual(['cache-abc', 'tenant-xyz', 42, 8, 0.84, 2048, 3, 75]);
      });

      it('应该在数据库错误时抛出异常', async () => {
        mockQuery.mockRejectedValue(new Error('Connection refused'));

        await expect(
          repository.updateMetrics('c1', 'tenant1', 1, 0, 0, 0, 0)
        ).rejects.toThrow('Connection refused');
      });
    });

    describe('getCacheMetrics', () => {
      it('应该正确映射完整数据行', async () => {
        const now = new Date();
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c-full',
            tenant_id: 't1',
            total_hits: 500,
            total_misses: 50,
            hit_rate: 0.909,
            total_size_bytes: 5368709120, // 5GB
            max_size_bytes: 10737418240,  // 10GB
            eviction_count: 25,
            avg_latency_saved_ms: 120,
            last_updated: now,
          }],
        });

        const result = await repository.getCacheMetrics('c-full');

        expect(result).not.toBeNull();
        expect(result!.cache_id).toBe('c-full');
        expect(result!.tenant_id).toBe('t1');
        expect(result!.total_hits).toBe(500);
        expect(result!.total_misses).toBe(50);
        expect(result!.hit_rate).toBeCloseTo(0.909, 3);
        expect(result!.total_size_bytes).toBe(5368709120);
        expect(result!.max_size_bytes).toBe(10737418240);
        expect(result!.utilization_percent).toBeCloseTo(50, 0);
        expect(result!.eviction_count).toBe(25);
        expect(result!.avg_latency_saved_ms).toBe(120);
        expect(result!.last_updated).toBe(now);
      });

      it('应该在数据库查询失败时抛出异常', async () => {
        mockQuery.mockRejectedValue(new Error('Table does not exist'));

        await expect(
          repository.getCacheMetrics('c1')
        ).rejects.toThrow('Table does not exist');
      });
    });

    describe('listTenantCaches', () => {
      it('应该在无缓存时返回空数组', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await repository.listTenantCaches('tenant-empty');

        expect(result).toEqual([]);
      });

      it('应该在数据库查询失败时抛出异常', async () => {
        mockQuery.mockRejectedValue(new Error('Timeout'));

        await expect(
          repository.listTenantCaches('t1')
        ).rejects.toThrow('Timeout');
      });
    });

    describe('getTenantSummary', () => {
      it('应该正确计算 estimated_cost_saved_cents', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            total_caches: '3',
            total_size: '3072',
            total_hits: '1000',
            total_misses: '200',
            avg_hit_rate: '0.833',
            avg_latency_saved: '80',
            total_latency_saved: '80000',
          }],
        });

        const result = await repository.getTenantSummary('t1');

        // estimated_cost_saved_cents = Math.floor(80000 * 0.001) = 80
        expect(result.estimated_cost_saved_cents).toBe(80);
        expect(result.total_caches).toBe(3);
        expect(result.total_size_bytes).toBe(3072);
        expect(result.total_hits).toBe(1000);
        expect(result.total_misses).toBe(200);
        expect(result.avg_hit_rate).toBeCloseTo(0.833, 3);
        expect(result.avg_latency_saved_ms).toBe(80);
      });

      it('应该在全部值为 null 时返回零值', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            total_caches: '0',
            total_size: null,
            total_hits: null,
            total_misses: null,
            avg_hit_rate: null,
            avg_latency_saved: null,
            total_latency_saved: null,
          }],
        });

        const result = await repository.getTenantSummary('t-empty');

        expect(result.total_caches).toBe(0);
        expect(result.total_size_bytes).toBe(0);
        expect(result.total_hits).toBe(0);
        expect(result.total_misses).toBe(0);
        expect(result.avg_hit_rate).toBe(0);
        expect(result.avg_latency_saved_ms).toBe(0);
        expect(result.estimated_cost_saved_cents).toBe(0);
      });

      it('应该在 total_latency_saved 为 null 时将 estimated_cost_saved_cents 设为 0', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            total_caches: '1',
            total_size: '100',
            total_hits: '50',
            total_misses: '50',
            avg_hit_rate: '0.5',
            avg_latency_saved: '50',
            total_latency_saved: null,
          }],
        });

        const result = await repository.getTenantSummary('t1');

        // parseInt(null) returns NaN, || 0 → 0, Math.floor(0 * 0.001) = 0
        expect(result.estimated_cost_saved_cents).toBe(0);
      });

      it('应该在 avg_hit_rate 为 null 时回退到计算值', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            total_caches: '2',
            total_size: '200',
            total_hits: '75',
            total_misses: '25',
            avg_hit_rate: null,
            avg_latency_saved: '60',
            total_latency_saved: '4500',
          }],
        });

        const result = await repository.getTenantSummary('t1');

        // avg_hit_rate null → parseFloat(null) = NaN || hitRate → hitRate = 75/(75+25) = 0.75
        expect(result.avg_hit_rate).toBeCloseTo(0.75, 2);
      });
    });

    describe('mapRow', () => {
      it('应该在 total_size_bytes 为 0 时返回 utilization 为 0', () => {
        const row = {
          cache_id: 'c-zero',
          tenant_id: 't1',
          total_hits: 0,
          total_misses: 0,
          hit_rate: 0,
          total_size_bytes: 0,
          max_size_bytes: 10240,
          eviction_count: 0,
          avg_latency_saved_ms: 0,
          last_updated: new Date(),
        };

        const result = repository.mapRow(row);

        expect(result.utilization_percent).toBe(0);
      });

      it('应该在 max_size_bytes 为 0 时使用默认值', () => {
        const row = {
          cache_id: 'c-zero-max',
          total_size_bytes: 1073741824,
          max_size_bytes: 0,
          eviction_count: 0,
        };

        const result = repository.mapRow(row);

        // max_size_bytes = 0 is falsy, so default 10GB is used
        expect(result.max_size_bytes).toBe(10737418240);
        expect(result.utilization_percent).toBeCloseTo(10, 0);
      });

      it('应该在 max_size_bytes 未定义时使用默认 10GB', () => {
        const row = {
          cache_id: 'c-undef',
          total_size_bytes: 10737418240,
          eviction_count: 0,
        };

        const result = repository.mapRow(row);

        expect(result.max_size_bytes).toBe(10737418240);
        expect(result.utilization_percent).toBeCloseTo(100, 0);
      });

      it('应该处理缺失的可选字段', () => {
        const row = {
          cache_id: 'c-minimal',
          total_size_bytes: 512,
          eviction_count: 0,
        };

        const result = repository.mapRow(row);

        expect(result.cache_id).toBe('c-minimal');
        expect(result.tenant_id).toBeUndefined();
        expect(result.total_hits).toBeUndefined();
        expect(result.total_misses).toBeUndefined();
        expect(result.hit_rate).toBeUndefined();
        expect(result.avg_latency_saved_ms).toBeUndefined();
        expect(result.last_updated).toBeUndefined();
      });
    });
  });

  // ==================== CacheMonitorService ====================

  describe('CacheMonitorService', () => {
    describe('recordCacheEvent', () => {
      it('应该记录缓存命中事件', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.recordCacheEvent('c1', 't1', 'hit', 150);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs[0]).toBe('c1');
        expect(callArgs[1]).toBe('t1');
        expect(callArgs[2]).toBe(1);   // hits = 1
        expect(callArgs[3]).toBe(0);   // misses = 0
        expect(callArgs[4]).toBe(1);   // hitRate = 1/(1+0) = 1
        expect(callArgs[5]).toBe(0);   // size = 0
        expect(callArgs[6]).toBe(0);   // evictions = 0
        expect(callArgs[7]).toBe(150); // latencySavedMs = 150
      });

      it('应该记录缓存未命中事件', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.recordCacheEvent('c1', 't1', 'miss');

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs[2]).toBe(0); // hits = 0
        expect(callArgs[3]).toBe(1); // misses = 1
        expect(callArgs[7]).toBe(0); // latencySavedMs = 0 for miss
      });

      it('应该在未提供 latencySavedMs 时默认为 0', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.recordCacheEvent('c1', 't1', 'hit');

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs[7]).toBe(0); // latencySavedMs defaults to 0
      });

      it('应该在数据库错误时传播异常', async () => {
        mockQuery.mockRejectedValue(new Error('Unique constraint violation'));

        await expect(
          service.recordCacheEvent('c1', 't1', 'hit', 50)
        ).rejects.toThrow('Unique constraint violation');
      });
    });

    describe('recordCacheSize', () => {
      it('应该记录缓存大小更新', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.recordCacheSize('c1', 't1', 2048);

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs).toEqual(['c1', 't1', 0, 0, 0, 2048, 0, 0]);
      });

      it('应该处理零大小', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.recordCacheSize('c1', 't1', 0);

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs[5]).toBe(0); // sizeBytes is at index 5
      });

      it('应该处理超大缓存大小', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const largeSize = 10 * 1024 * 1024 * 1024; // 10GB
        await service.recordCacheSize('c1', 't1', largeSize);

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs[5]).toBe(largeSize); // sizeBytes is at index 5
      });
    });

    describe('recordCacheEviction', () => {
      it('应该记录缓存驱逐事件', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.recordCacheEviction('c1', 't1', 15);

        const callArgs = mockQuery.mock.calls[0][1];
        expect(callArgs).toEqual(['c1', 't1', 0, 0, 0, 0, 15, 0]);
      });

      it('应该在数据库错误时传播异常', async () => {
        mockQuery.mockRejectedValue(new Error('Deadlock detected'));

        await expect(
          service.recordCacheEviction('c1', 't1', 10)
        ).rejects.toThrow('Deadlock detected');
      });
    });

    describe('assessCacheHealth', () => {
      it('应该在缓存未找到时返回 warning 状态', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.assessCacheHealth('nonexistent');

        expect(result.status).toBe('warning');
        expect(result.hit_rate).toBe(0);
        expect(result.utilization).toBe(0);
        expect(result.issues).toEqual([]);
        expect(result.recommendations).toContain('Cache not yet initialized or no metrics available');
      });

      it('应该在命中率极低 (<0.3) 时标记为 high 严重性', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.2,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 0,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('critical'); // high severity → critical
        const lowHitIssue = result.issues.find(i => i.type === 'low_hit_rate');
        expect(lowHitIssue).toBeDefined();
        expect(lowHitIssue!.severity).toBe('high');
        expect(lowHitIssue!.message).toContain('20%');
      });

      it('应该在命中率中等 (0.3-0.5) 时标记为 medium 严重性', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.4,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 0,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('warning');
        const lowHitIssue = result.issues.find(i => i.type === 'low_hit_rate');
        expect(lowHitIssue).toBeDefined();
        expect(lowHitIssue!.severity).toBe('medium');
      });

      it('应该在利用率 >95% 时标记为 high 严重性', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.95,
            total_size_bytes: 9800,
            max_size_bytes: 10000,
            eviction_count: 0,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('critical');
        const highUtilIssue = result.issues.find(i => i.type === 'high_utilization');
        expect(highUtilIssue).toBeDefined();
        expect(highUtilIssue!.severity).toBe('high');
        expect(highUtilIssue!.message).toContain('98%');
      });

      it('应该在利用率 90-95% 时标记为 medium 严重性', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.9,
            total_size_bytes: 9200,
            max_size_bytes: 10000,
            eviction_count: 0,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('warning');
        const highUtilIssue = result.issues.find(i => i.type === 'high_utilization');
        expect(highUtilIssue).toBeDefined();
        expect(highUtilIssue!.severity).toBe('medium');
      });

      it('应该在驱逐数 >1000 时标记 eviction_spike', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.95,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 2000,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('healthy'); // low severity doesn't affect overall status
        const evictionIssue = result.issues.find(i => i.type === 'eviction_spike');
        expect(evictionIssue).toBeDefined();
        expect(evictionIssue!.severity).toBe('low');
        expect(evictionIssue!.message).toContain('2000');
      });

      it('应该在无问题时推荐"Cache performance is optimal"', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.95,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 10,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('healthy');
        expect(result.issues).toEqual([]);
        expect(result.recommendations).toContain('Cache performance is optimal');
      });

      it('应该在同时有多个问题时正确计算状态', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.1,         // high severity low hit rate
            total_size_bytes: 9900, // high severity high utilization
            max_size_bytes: 10000,
            eviction_count: 5000,  // low severity eviction spike
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('critical'); // has high severity issues
        expect(result.issues.length).toBe(3); // low_hit_rate + high_utilization + eviction_spike
        expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
      });

      it('应该返回正确的 hit_rate 和 utilization', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.75,
            total_size_bytes: 5000,
            max_size_bytes: 20000,
            eviction_count: 0,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.hit_rate).toBe(0.75);
        expect(result.utilization).toBe(25); // 5000/20000 * 100
      });

      it('应该在命中率恰好 0.5 时不报告低命中率问题', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.5,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 0,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.issues.find(i => i.type === 'low_hit_rate')).toBeUndefined();
        expect(result.status).toBe('healthy');
      });

      it('应该在利用率恰好 90% 时不报告高利用率问题', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.9,
            total_size_bytes: 9000,
            max_size_bytes: 10000,
            eviction_count: 0,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.issues.find(i => i.type === 'high_utilization')).toBeUndefined();
        expect(result.status).toBe('healthy');
      });

      it('应该在驱逐数恰好 1000 时不报告驱逐尖峰', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_id: 'c1',
            hit_rate: 0.9,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 1000,
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.issues.find(i => i.type === 'eviction_spike')).toBeUndefined();
      });
    });

    describe('analyzePerformanceImpact', () => {
      it('应该正确计算性能提升百分比', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_enabled_runs: '20',
            cache_disabled_runs: '10',
            with_cache_avg: '1500',
            without_cache_avg: '3000',
          }],
        });

        const result = await service.analyzePerformanceImpact('p1');

        expect(result.pipeline_id).toBe('p1');
        expect(result.with_cache_avg_duration_ms).toBe(1500);
        expect(result.without_cache_avg_duration_ms).toBe(3000);
        expect(result.time_saved_ms).toBe(1500);
        expect(result.time_saved_percent).toBeCloseTo(50, 0);
        expect(result.cache_enabled_runs).toBe(20);
        expect(result.cache_disabled_runs).toBe(10);
      });

      it('应该在 without_cache 平均为 0 时返回 0 时间节省', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_enabled_runs: '5',
            cache_disabled_runs: '0',
            with_cache_avg: '1000',
            without_cache_avg: '0',
          }],
        });

        const result = await service.analyzePerformanceImpact('p1');

        expect(result.time_saved_ms).toBe(0);
        expect(result.time_saved_percent).toBe(0);
      });

      it('应该在缓存比无缓存更慢时返回 0 时间节省', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_enabled_runs: '5',
            cache_disabled_runs: '5',
            with_cache_avg: '4000',
            without_cache_avg: '3000',
          }],
        });

        const result = await service.analyzePerformanceImpact('p1');

        // timeSaved = 3000 - 4000 = -1000, Math.max(0, -1000) = 0
        expect(result.time_saved_ms).toBe(0);
        expect(result.time_saved_percent).toBe(0);
      });

      it('应该在所有值为 null 时返回零值', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            cache_enabled_runs: null,
            cache_disabled_runs: null,
            with_cache_avg: null,
            without_cache_avg: null,
          }],
        });

        const result = await service.analyzePerformanceImpact('p-empty');

        expect(result.with_cache_avg_duration_ms).toBe(0);
        expect(result.without_cache_avg_duration_ms).toBe(0);
        expect(result.time_saved_ms).toBe(0);
        expect(result.time_saved_percent).toBe(0);
        expect(result.cache_enabled_runs).toBe(0);
        expect(result.cache_disabled_runs).toBe(0);
      });

      it('应该在数据库错误时抛出异常', async () => {
        mockQuery.mockRejectedValue(new Error('Relation pipeline_runs does not exist'));

        await expect(
          service.analyzePerformanceImpact('p1')
        ).rejects.toThrow('Relation pipeline_runs does not exist');
      });
    });

    describe('getDashboard', () => {
      const mockTenantSummary = {
        total_caches: '2',
        total_size: '2048',
        total_hits: '200',
        total_misses: '20',
        avg_hit_rate: '0.91',
        avg_latency_saved: '100',
        total_latency_saved: '20000',
      };

      const mockCacheRows = [
        {
          cache_id: 'c-high',
          tenant_id: 't1',
          total_hits: 100,
          total_misses: 5,
          hit_rate: 0.95,
          total_size_bytes: 1024,
          max_size_bytes: 10240,
          eviction_count: 10,
          avg_latency_saved_ms: 50,
          last_updated: new Date(),
        },
        {
          cache_id: 'c-low',
          tenant_id: 't1',
          total_hits: 30,
          total_misses: 70,
          hit_rate: 0.3,
          total_size_bytes: 9800,
          max_size_bytes: 10000,
          eviction_count: 500,
          avg_latency_saved_ms: 10,
          last_updated: new Date(),
        },
      ];

      it('应该返回完整的仪表盘数据', async () => {
        mockQuery
          // getTenantSummary
          .mockResolvedValueOnce({ rows: [mockTenantSummary] })
          // listTenantCaches
          .mockResolvedValueOnce({ rows: mockCacheRows })
          // assessCacheHealth for c-high (healthy)
          .mockResolvedValueOnce({
            rows: [{
              cache_id: 'c-high',
              hit_rate: 0.95,
              total_size_bytes: 1024,
              max_size_bytes: 10240,
              eviction_count: 10,
            }],
          })
          // assessCacheHealth for c-low (warning: low hit rate + high utilization)
          .mockResolvedValueOnce({
            rows: [{
              cache_id: 'c-low',
              hit_rate: 0.3,
              total_size_bytes: 9800,
              max_size_bytes: 10000,
              eviction_count: 500,
            }],
          });

        const result = await service.getDashboard('t1');

        expect(result.summary.total_caches).toBe(2);
        expect(result.caches.length).toBe(2);
        expect(result.topCaches.length).toBe(2);
        // topCaches sorted by hit_rate descending
        expect(result.topCaches[0].cache_id).toBe('c-high');
        expect(result.topCaches[1].cache_id).toBe('c-low');
        // healthAlerts only non-healthy
        expect(result.healthAlerts.length).toBe(1);
        expect(result.healthAlerts[0].cache_id).toBe('c-low');
        expect(result.healthAlerts[0].status.status).toBe('critical'); // 98% utilization triggers critical
      });

      it('应该在无缓存时返回空列表和零汇总', async () => {
        mockQuery
          .mockResolvedValueOnce({
            rows: [{
              total_caches: '0',
              total_size: null,
              total_hits: null,
              total_misses: null,
              avg_hit_rate: null,
              avg_latency_saved: null,
              total_latency_saved: null,
            }],
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await service.getDashboard('t-empty');

        expect(result.summary.total_caches).toBe(0);
        expect(result.caches).toEqual([]);
        expect(result.topCaches).toEqual([]);
        expect(result.healthAlerts).toEqual([]);
      });

      it('应该限制 topCaches 为最多 5 个', async () => {
        const manyCaches = Array.from({ length: 10 }, (_, i) => ({
          cache_id: `c${i}`,
          tenant_id: 't1',
          total_hits: 100 - i,
          total_misses: i,
          hit_rate: (100 - i) / 100,
          total_size_bytes: 1024,
          max_size_bytes: 10240,
          eviction_count: 0,
          avg_latency_saved_ms: 50,
          last_updated: new Date(),
        }));

        mockQuery
          .mockResolvedValueOnce({ rows: [mockTenantSummary] })
          .mockResolvedValueOnce({ rows: manyCaches });

        // Mock 10 health checks (assessCacheHealth for each)
        for (let i = 0; i < 10; i++) {
          mockQuery.mockResolvedValueOnce({
            rows: [{
              cache_id: `c${i}`,
              hit_rate: (100 - i) / 100,
              total_size_bytes: 1024,
              max_size_bytes: 10240,
              eviction_count: 0,
            }],
          });
        }

        const result = await service.getDashboard('t1');

        expect(result.topCaches.length).toBe(5);
        // Should be the 5 highest hit rates
        expect(result.topCaches[0].cache_id).toBe('c0');
        expect(result.topCaches[4].cache_id).toBe('c4');
      });

      it('应该限制健康检查为最多 10 个缓存', async () => {
        const manyCaches = Array.from({ length: 15 }, (_, i) => ({
          cache_id: `c${i}`,
          tenant_id: 't1',
          total_hits: 100,
          total_misses: 0,
          hit_rate: 1.0,
          total_size_bytes: 1024,
          max_size_bytes: 10240,
          eviction_count: 0,
          avg_latency_saved_ms: 50,
          last_updated: new Date(),
        }));

        mockQuery
          .mockResolvedValueOnce({ rows: [mockTenantSummary] })
          .mockResolvedValueOnce({ rows: manyCaches });

        // Only 10 health checks (caches.slice(0, 10))
        for (let i = 0; i < 10; i++) {
          mockQuery.mockResolvedValueOnce({
            rows: [{
              cache_id: `c${i}`,
              hit_rate: 1.0,
              total_size_bytes: 1024,
              max_size_bytes: 10240,
              eviction_count: 0,
            }],
          });
        }

        const result = await service.getDashboard('t1');

        // All caches returned, but only first 10 health-checked
        expect(result.caches.length).toBe(15);
        // All healthy → no alerts
        expect(result.healthAlerts).toEqual([]);
      });

      it('应该过滤掉健康的缓存只返回非健康警报', async () => {
        const allHealthyCaches = [
          {
            cache_id: 'c1',
            tenant_id: 't1',
            total_hits: 100,
            total_misses: 5,
            hit_rate: 0.95,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 0,
            avg_latency_saved_ms: 50,
            last_updated: new Date(),
          },
          {
            cache_id: 'c2',
            tenant_id: 't1',
            total_hits: 100,
            total_misses: 5,
            hit_rate: 0.95,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 0,
            avg_latency_saved_ms: 50,
            last_updated: new Date(),
          },
        ];

        mockQuery
          .mockResolvedValueOnce({ rows: [mockTenantSummary] })
          .mockResolvedValueOnce({ rows: allHealthyCaches });

        // Both healthy
        for (let i = 0; i < 2; i++) {
          mockQuery.mockResolvedValueOnce({
            rows: [{
              cache_id: `c${i + 1}`,
              hit_rate: 0.95,
              total_size_bytes: 1024,
              max_size_bytes: 10240,
              eviction_count: 0,
            }],
          });
        }

        const result = await service.getDashboard('t1');

        expect(result.healthAlerts).toEqual([]);
      });
    });
  });

  // ==================== CacheMonitorServiceError ====================

  describe('CacheMonitorServiceError', () => {
    it('应该继承自 Error', () => {
      const error = new CacheMonitorServiceError('test', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CacheMonitorServiceError);
    });

    it('应该正确设置 stack trace', () => {
      const error = new CacheMonitorServiceError('test', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('CacheMonitorServiceError');
    });

    it('应该接受不同类型的错误码', () => {
      const codes = ['NOT_FOUND', 'INVALID_INPUT', 'DB_ERROR', 'PERMISSION_DENIED'];

      codes.forEach(code => {
        const error = new CacheMonitorServiceError(`Error: ${code}`, code);
        expect(error.code).toBe(code);
        expect(error.name).toBe('CacheMonitorServiceError');
      });
    });
  });
});
