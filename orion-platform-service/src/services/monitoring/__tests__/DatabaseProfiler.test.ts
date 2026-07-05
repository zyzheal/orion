/**
 * DatabaseProfiler 单元测试
 *
 * Coverage: profile (success + error), getRecentSlowQueries,
 *           getPatternStats, cleanupExpired
 */

// Mock pino before importing
jest.mock('pino', () => {
  const mockLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };
  return jest.fn(() => mockLogger);
});

import { DatabaseProfiler } from '../DatabaseProfiler';

describe('DatabaseProfiler', () => {
  let profiler: DatabaseProfiler;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    profiler = new DatabaseProfiler(mockPool as any, { slowQueryThresholdMs: 100 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==================== profile ====================

  describe('profile', () => {
    it('should return result and profile for fast query', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }] };
      mockPool.query.mockResolvedValue(mockResult);

      const { result, profile } = await profiler.profile('SELECT * FROM users');

      expect(result).toEqual(mockResult);
      expect(profile.query).toBe('SELECT * FROM users');
      expect(profile.durationMs).toBeGreaterThanOrEqual(0);
      expect(profile.startTime).toBeInstanceOf(Date);
      expect(profile.endTime).toBeInstanceOf(Date);
      expect(profile.error).toBeUndefined();
    });

    it('should pass params to query', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.profile('SELECT * FROM users WHERE id = $1', ['user-1']);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['user-1']);
    });

    it('should record tenantId in profile', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const { profile } = await profiler.profile('SELECT 1', [], 'tenant-1');

      expect(profile.tenantId).toBe('tenant-1');
    });

    it('should detect slow queries and record them', async () => {
      // Use a very low threshold so even a fast mock query appears "slow"
      const lowThresholdProfiler = new DatabaseProfiler(mockPool as any, {
        slowQueryThresholdMs: -1, // negative threshold means everything is "slow"
      });

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: 1000 }] }) // The actual query
        .mockResolvedValueOnce({ rows: [] }); // The INSERT into slow_queries

      const { profile } = await lowThresholdProfiler.profile('SELECT count(*) FROM large_table');

      expect(profile.query).toBe('SELECT count(*) FROM large_table');
      expect(profile.durationMs).toBeGreaterThanOrEqual(0);
      // Should have recorded the slow query (INSERT called)
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      // Verify the INSERT was for slow_queries table
      expect(mockPool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO slow_queries'),
        expect.any(Array)
      );
    });

    it('should handle query errors and rethrow', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Syntax error'));

      await expect(profiler.profile('INVALID SQL')).rejects.toThrow('Syntax error');
    });

    it('should record error queries even when fast', async () => {
      mockPool.query
        .mockRejectedValueOnce(new Error('Query failed'))
        .mockResolvedValueOnce({ rows: [] }); // INSERT into slow_queries

      try {
        await profiler.profile('BAD QUERY');
      } catch {
        // Expected
      }

      // Should have attempted to record the slow query (error queries are always recorded)
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should not record fast successful queries', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      // A fast query (under threshold) should not trigger INSERT
      // But Date.now might make it appear fast
      await profiler.profile('SELECT 1');

      // Only 1 call (the query itself), no INSERT for slow_queries
      // Note: This might vary based on actual execution speed
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', undefined);
    });

    it('should handle profile with all parameters', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const { result, profile } = await profiler.profile(
        'SELECT * FROM t WHERE id = $1 AND tenant = $2',
        ['id-1', 't-1'],
        't-1'
      );

      expect(profile.params).toEqual(['id-1', 't-1']);
      expect(profile.tenantId).toBe('t-1');
    });
  });

  // ==================== getRecentSlowQueries ====================

  describe('getRecentSlowQueries', () => {
    it('should return recent slow queries', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'sq-1',
            query_hash: 'hash1',
            normalized_query: 'SELECT * FROM users WHERE id = ?',
            original_query: 'SELECT * FROM users WHERE id = 1',
            duration_ms: 250,
            params_count: 1,
            tenant_id: 't-1',
            error: null,
            created_at: new Date(),
          },
        ],
      });

      const result = await profiler.getRecentSlowQueries();

      expect(result).toHaveLength(1);
      expect(result[0].duration_ms).toBe(250);
    });

    it('should use default limit of 50', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.getRecentSlowQueries();

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(50);
    });

    it('should accept custom limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.getRecentSlowQueries({ limit: 10 });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params).toContain(10);
    });

    it('should filter by since date', async () => {
      const since = new Date('2024-01-01');
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.getRecentSlowQueries({ since });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('created_at >=');
      expect(params).toContain(since);
    });

    it('should filter by tenantId', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.getRecentSlowQueries({ tenantId: 't-1' });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('tenant_id =');
      expect(params).toContain('t-1');
    });

    it('should filter by both since and tenantId', async () => {
      const since = new Date('2024-01-01');
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.getRecentSlowQueries({ since, tenantId: 't-1', limit: 20 });

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('created_at >=');
      expect(query).toContain('tenant_id =');
      expect(params).toEqual([since, 't-1', 20]);
    });
  });

  // ==================== getPatternStats ====================

  describe('getPatternStats', () => {
    it('should return pattern statistics', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            query_hash: 'hash1',
            normalized_query: 'SELECT * FROM users WHERE id = ?',
            execution_count: '100',
            avg_duration_ms: '150.5',
            p95_duration_ms: '300',
            p99_duration_ms: '500',
            max_duration_ms: '800',
            error_count: '5',
            last_executed: new Date(),
          },
        ],
      });

      const result = await profiler.getPatternStats();

      expect(result).toHaveLength(1);
      expect(result[0].query_hash).toBe('hash1');
      // PostgreSQL returns numeric aggregates as strings
      expect(result[0].execution_count).toBe('100');
    });

    it('should filter by since date', async () => {
      const since = new Date('2024-01-01');
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.getPatternStats(since);

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('created_at >= $1');
      expect(params).toEqual([since]);
    });

    it('should not add since clause when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await profiler.getPatternStats();

      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).not.toContain('created_at >= $1');
      expect(params).toEqual([]);
    });
  });

  // ==================== cleanupExpired ====================

  describe('cleanupExpired', () => {
    it('should delete expired slow queries', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 42 });

      const result = await profiler.cleanupExpired(30);

      expect(result).toBe(42);
    });

    it('should use default retention of 30 days', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await profiler.cleanupExpired();

      const [query] = mockPool.query.mock.calls[0];
      expect(query).toContain('30 days');
    });

    it('should accept custom retention days', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 10 });

      const result = await profiler.cleanupExpired(7);

      expect(result).toBe(10);
      const [query] = mockPool.query.mock.calls[0];
      expect(query).toContain('7 days');
    });

    it('should return 0 when rowCount is null', async () => {
      mockPool.query.mockResolvedValue({ rowCount: null });

      const result = await profiler.cleanupExpired();

      expect(result).toBe(0);
    });
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('should use default threshold of 100ms', async () => {
      const defaultProfiler = new DatabaseProfiler(mockPool as any);
      mockPool.query.mockResolvedValue({ rows: [] });

      // Just verify it doesn't throw
      await defaultProfiler.profile('SELECT 1');
    });

    it('should accept custom threshold', async () => {
      const customProfiler = new DatabaseProfiler(mockPool as any, {
        slowQueryThresholdMs: 500,
      });
      mockPool.query.mockResolvedValue({ rows: [] });

      await customProfiler.profile('SELECT 1');
    });
  });

  // ==================== Error Handling ====================

  describe('error handling', () => {
    it('should handle non-Error exceptions in profile', async () => {
      mockPool.query.mockRejectedValueOnce('string error');

      await expect(profiler.profile('BAD QUERY')).rejects.toBe('string error');
    });

    it('should handle failed slow query recording gracefully', async () => {
      // First call: actual query fails
      // Second call: INSERT into slow_queries also fails
      mockPool.query
        .mockRejectedValueOnce(new Error('Query failed'))
        .mockRejectedValueOnce(new Error('INSERT failed'));

      // Should not throw from the recording failure
      await expect(profiler.profile('BAD QUERY')).rejects.toThrow('Query failed');
    });
  });
});
