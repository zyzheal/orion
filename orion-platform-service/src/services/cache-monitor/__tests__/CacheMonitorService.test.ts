/**
 * CacheMonitorService 单元测试
 *
 * Uses mock PostgreSQL db pattern
 */

import { CacheMonitorService, CacheMonitorServiceError } from '../CacheMonitorService';
import { CacheMetricsRepository } from '../../../repositories/CacheMonitorRepository';

// Mock PostgreSQL db
function createMockDb() {
  const tables: Record<string, any[]> = {
    build_cache_metrics: [],
  };

  const db = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      const upperSql = sql.toUpperCase().trim();

      // INSERT ... ON CONFLICT (upsert)
      if (upperSql.startsWith('INSERT INTO BUILD_CACHE_METRICS')) {
        const cacheId = params?.[0] as string;
        const tenantId = params?.[1] as string;
        const hits = params?.[2] as number;
        const misses = params?.[3] as number;
        const sizeBytes = params?.[5] as number;
        const evictions = params?.[6] as number;
        const latencySaved = params?.[7] as number;

        const existing = tables.build_cache_metrics.find(r => r.cache_id === cacheId);
        if (existing) {
          existing.total_hits = (parseInt(existing.total_hits) || 0) + hits;
          existing.total_misses = (parseInt(existing.total_misses) || 0) + misses;
          if (sizeBytes > 0) existing.total_size_bytes = sizeBytes;
          existing.eviction_count = (parseInt(existing.eviction_count) || 0) + evictions;
          const total = existing.total_hits + existing.total_misses;
          existing.hit_rate = total > 0 ? existing.total_hits / total : 0;
          existing.last_updated = new Date();
        } else {
          tables.build_cache_metrics.push({
            cache_id: cacheId,
            tenant_id: tenantId,
            total_hits: hits,
            total_misses: misses,
            hit_rate: (hits + misses) > 0 ? hits / (hits + misses) : 0,
            total_size_bytes: sizeBytes,
            max_size_bytes: 10737418240,
            eviction_count: evictions,
            avg_latency_saved_ms: latencySaved,
            last_updated: new Date(),
          });
        }
        return { rows: [], rowCount: 1 };
      }

      // SELECT with tenant summary
      if (upperSql.includes('COUNT(*)') && upperSql.includes('SUM(')) {
        const tenantId = params?.[0] as string;
        const tenantRows = tables.build_cache_metrics.filter(r => r.tenant_id === tenantId);
        const totalHits = tenantRows.reduce((s, r) => s + (parseInt(r.total_hits) || 0), 0);
        const totalMisses = tenantRows.reduce((s, r) => s + (parseInt(r.total_misses) || 0), 0);
        return {
          rows: [{
            total_caches: String(tenantRows.length),
            total_size: String(tenantRows.reduce((s, r) => s + (parseInt(r.total_size_bytes) || 0), 0)),
            total_hits: String(totalHits),
            total_misses: String(totalMisses),
            avg_hit_rate: tenantRows.length > 0 ? String(tenantRows.reduce((s, r) => s + (parseFloat(r.hit_rate) || 0), 0) / tenantRows.length) : '0',
            avg_latency_saved: tenantRows.length > 0 ? String(tenantRows.reduce((s, r) => s + (parseFloat(r.avg_latency_saved_ms) || 0), 0) / tenantRows.length) : '0',
          }],
        };
      }

      // SELECT by tenant
      if (upperSql.includes('WHERE TENANT_ID = $1')) {
        const tenantId = params?.[0] as string;
        const rows = tables.build_cache_metrics.filter(r => r.tenant_id === tenantId);
        return { rows };
      }

      // SELECT by cache_id
      if (upperSql.includes('WHERE CACHE_ID = $1')) {
        const cacheId = params?.[0] as string;
        const row = tables.build_cache_metrics.find(r => r.cache_id === cacheId);
        return { rows: row ? [row] : [] };
      }

      // pipeline_runs query (performance impact)
      if (upperSql.includes('PIPELINE_RUNS')) {
        return {
          rows: [{
            cache_enabled_runs: '10',
            cache_disabled_runs: '5',
            with_cache_avg: '1000',
            without_cache_avg: '3000',
          }],
        };
      }

      return { rows: [], rowCount: 0 };
    }),
  };

  return db;
}

describe('CacheMonitorService', () => {
  let db: ReturnType<typeof createMockDb>;
  let service: CacheMonitorService;
  let repo: CacheMetricsRepository;

  beforeEach(() => {
    db = createMockDb();
    service = new CacheMonitorService(db as any);
    repo = new CacheMetricsRepository(db as any);
  });

  describe('CacheMetricsRepository', () => {
    describe('findByCacheId', () => {
      it('应该返回缓存指标', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            cache_id: 'c1',
            tenant_id: 't1',
            total_hits: 100,
            total_misses: 10,
            hit_rate: 0.91,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 5,
            avg_latency_saved_ms: 50,
            last_updated: new Date(),
          }],
        });

        const result = await repo.findByCacheId('c1');

        expect(result).not.toBeNull();
        expect(result!.id).toBe('c1');
        expect(result!.hitRate).toBe(0.91);
      });

      it('应该返回 null 如果未找到', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await repo.findByCacheId('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('findByTenant', () => {
      it('应该返回租户的所有缓存', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { cache_id: 'c1', tenant_id: 't1', total_hits: 100, total_misses: 10, hit_rate: 0.9 },
            { cache_id: 'c2', tenant_id: 't1', total_hits: 50, total_misses: 5, hit_rate: 0.91 },
          ],
        });

        const result = await repo.findByTenant('t1');

        expect(result.length).toBe(2);
        expect(result[0].id).toBe('c1');
      });
    });

    describe('recordEvent', () => {
      it('应该插入新缓存指标', async () => {
        await repo.recordEvent('c1', 't1', 50, 5, 1024, 0, 100);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO build_cache_metrics'),
          expect.arrayContaining(['c1', 't1', 50, 5]),
        );
      });
    });

    describe('getTenantSummary', () => {
      it('应该返回租户缓存汇总', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            total_caches: '5',
            total_size: '5120',
            total_hits: '500',
            total_misses: '50',
            avg_hit_rate: '0.91',
            avg_latency_saved: '100',
          }],
        });

        const result = await repo.getTenantSummary('t1');

        expect(result.totalCaches).toBe(5);
        expect(result.avgHitRate).toBeCloseTo(0.91, 2);
      });

      it('应该处理空结果', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            total_caches: '0',
            total_size: null,
            total_hits: null,
            total_misses: null,
            avg_hit_rate: null,
            avg_latency_saved: null,
          }],
        });

        const result = await repo.getTenantSummary('t1');

        expect(result.totalCaches).toBe(0);
        expect(result.totalHits).toBe(0);
      });
    });
  });

  describe('CacheMonitorService', () => {
    describe('getCacheMetrics', () => {
      it('应该返回缓存指标 DTO', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            cache_id: 'c1',
            tenant_id: 't1',
            total_hits: 100,
            total_misses: 10,
            hit_rate: 0.91,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 5,
            avg_latency_saved_ms: 50,
            last_updated: new Date(),
          }],
        });

        const result = await service.getCacheMetrics('c1');

        expect(result).not.toBeNull();
        expect(result!.cache_id).toBe('c1');
        expect(result!.utilization_percent).toBeCloseTo(10, 1); // 1024/10240
      });
    });

    describe('listTenantCaches', () => {
      it('应该返回租户缓存列表', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{ cache_id: 'c1', tenant_id: 't1', total_hits: 100, total_misses: 10, hit_rate: 0.9 }],
        });

        const result = await service.listTenantCaches('t1');

        expect(result.length).toBe(1);
        expect(result[0].cache_id).toBe('c1');
      });
    });

    describe('getTenantSummary', () => {
      it('应该返回缓存汇总 DTO', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            total_caches: '3',
            total_size: '3072',
            total_hits: '300',
            total_misses: '30',
            avg_hit_rate: '0.91',
            avg_latency_saved: '80',
          }],
        });

        const result = await service.getTenantSummary('t1');

        expect(result).toHaveProperty('total_caches');
        expect(result).toHaveProperty('avg_hit_rate');
        expect(result).toHaveProperty('estimated_cost_saved_cents');
        expect(result.total_caches).toBe(3);
      });
    });

    describe('assessCacheHealth', () => {
      it('应该返回健康状态', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            cache_id: 'c1',
            tenant_id: 't1',
            total_hits: 950,
            total_misses: 50,
            hit_rate: 0.95,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 0,
            avg_latency_saved_ms: 50,
            last_updated: new Date(),
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('healthy');
        expect(result.issues.length).toBe(0);
      });

      it('应该检测低命中率问题', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            cache_id: 'c1',
            tenant_id: 't1',
            total_hits: 40,
            total_misses: 60,
            hit_rate: 0.4,
            total_size_bytes: 1024,
            max_size_bytes: 10240,
            eviction_count: 0,
            avg_latency_saved_ms: 50,
            last_updated: new Date(),
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.status).toBe('warning');
        expect(result.issues.some(i => i.type === 'low_hit_rate')).toBe(true);
      });

      it('应该检测高利用率问题', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            cache_id: 'c1',
            tenant_id: 't1',
            total_hits: 900,
            total_misses: 100,
            hit_rate: 0.9,
            total_size_bytes: 10240,
            max_size_bytes: 10240,
            eviction_count: 0,
            avg_latency_saved_ms: 50,
            last_updated: new Date(),
          }],
        });

        const result = await service.assessCacheHealth('c1');

        expect(result.issues.some(i => i.type === 'high_utilization')).toBe(true);
      });

      it('应该返回 warning 如果缓存不存在', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const result = await service.assessCacheHealth('nonexistent');

        expect(result.status).toBe('warning');
        expect(result.recommendations[0]).toContain('not yet initialized');
      });
    });

    describe('analyzePerformanceImpact', () => {
      it('应该返回性能影响分析', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            cache_enabled_runs: '10',
            cache_disabled_runs: '5',
            with_cache_avg: '1000',
            without_cache_avg: '3000',
          }],
        });

        const result = await service.analyzePerformanceImpact(db as any, 'p1');

        expect(result).toHaveProperty('time_saved_ms');
        expect(result).toHaveProperty('time_saved_percent');
        expect(result.time_saved_ms).toBe(2000);
        expect(result.time_saved_percent).toBeCloseTo(66.67, 1);
      });
    });

    describe('recordCacheEvent', () => {
      it('应该记录缓存命中', async () => {
        await service.recordCacheEvent('c1', 't1', 'hit', 50);

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining(['c1', 't1', 1, 0]),
        );
      });

      it('应该记录缓存未命中', async () => {
        await service.recordCacheEvent('c1', 't1', 'miss');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining(['c1', 't1', 0, 1]),
        );
      });
    });

    describe('getDashboard', () => {
      it('应该返回完整仪表盘数据', async () => {
        // First call: getTenantSummary
        db.query.mockResolvedValueOnce({
          rows: [{
            total_caches: '2',
            total_size: '2048',
            total_hits: '200',
            total_misses: '20',
            avg_hit_rate: '0.9',
            avg_latency_saved: '50',
          }],
        });
        // Second call: findByTenant
        db.query.mockResolvedValueOnce({
          rows: [
            { cache_id: 'c1', tenant_id: 't1', total_hits: 150, total_misses: 10, hit_rate: 0.94, total_size_bytes: 1024, max_size_bytes: 10240, eviction_count: 0, avg_latency_saved_ms: 50, last_updated: new Date() },
            { cache_id: 'c2', tenant_id: 't1', total_hits: 50, total_misses: 10, hit_rate: 0.83, total_size_bytes: 512, max_size_bytes: 10240, eviction_count: 0, avg_latency_saved_ms: 50, last_updated: new Date() },
          ],
        });
        // Third call: assessCacheHealth for c1
        db.query.mockResolvedValueOnce({
          rows: [{ cache_id: 'c1', tenant_id: 't1', total_hits: 150, total_misses: 10, hit_rate: 0.94, total_size_bytes: 1024, max_size_bytes: 10240, eviction_count: 0, avg_latency_saved_ms: 50, last_updated: new Date() }],
        });
        // Fourth call: assessCacheHealth for c2
        db.query.mockResolvedValueOnce({
          rows: [{ cache_id: 'c2', tenant_id: 't1', total_hits: 50, total_misses: 10, hit_rate: 0.83, total_size_bytes: 512, max_size_bytes: 10240, eviction_count: 0, avg_latency_saved_ms: 50, last_updated: new Date() }],
        });

        const result = await service.getDashboard('t1');

        expect(result.summary).toHaveProperty('total_caches');
        expect(result.caches.length).toBe(2);
        expect(result.topCaches.length).toBe(2);
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
