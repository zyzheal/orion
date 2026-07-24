/**
 * TASK-703: MetricCollector Unit Tests - PostgreSQL Repository pattern
 */

import { MetricCollector } from '../MetricCollector';

// Mock repository for testing
const createMockRepo = () => ({
  registerMetric: jest.fn().mockResolvedValue({}),
  unregisterMetric: jest.fn().mockResolvedValue(true),
  getAllRegisteredMetrics: jest.fn().mockResolvedValue([]),
  getMetricRegistry: jest.fn().mockResolvedValue(null),
  insertDataPoint: jest.fn().mockResolvedValue(undefined),
  queryMetricSeries: jest.fn().mockResolvedValue({
    name: '',
    dataPoints: [],
    aggregation: { avg: 0, max: 0, min: 0, p99: 0, p95: 0, count: 0, sum: 0 },
    windowStart: new Date(),
    windowEnd: new Date(),
  }),
  getLatestValue: jest.fn().mockResolvedValue(null),
  pruneExpired: jest.fn().mockResolvedValue(0),
  clearAll: jest.fn().mockResolvedValue(undefined),
});

describe('MetricCollector', () => {
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  // ==================== Constructor Validation ====================

  describe('constructor', () => {
    it('should throw when no repository provided', () => {
      expect(() => new MetricCollector()).toThrow('MetricStorageRepository is required for MetricCollector');
    });

    it('should throw when repository is undefined', () => {
      expect(() => new MetricCollector({ repository: undefined as any })).toThrow('MetricStorageRepository is required for MetricCollector');
    });

    it('should throw when repository is null', () => {
      expect(() => new MetricCollector({ repository: null as any })).toThrow('MetricStorageRepository is required for MetricCollector');
    });

    it('should accept a repository and initialize', () => {
      expect(() => new MetricCollector({ repository: mockRepo })).not.toThrow();
    });

    it('should use default retention period (24h) when not specified', () => {
      const collector = new MetricCollector({ repository: mockRepo });
      // Should not throw - collector initializes
      expect(collector).toBeDefined();
    });

    it('should allow custom retention period', () => {
      expect(() => new MetricCollector({ repository: mockRepo, retentionMs: 3600000 })).not.toThrow();
    });
  });

  // ==================== System Metrics ====================

  describe('collectSystemMetrics', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should collect system metrics', () => {
      const metrics = collector.collectSystemMetrics();

      expect(metrics.length).toBeGreaterThan(0);

      const names = metrics.map(m => m.name);
      expect(names).toContain('system.cpu.usage');
      expect(names).toContain('system.memory.usage');
      expect(names).toContain('system.memory.used');
      expect(names).toContain('system.memory.total');
      expect(names).toContain('system.load.1m');
      expect(names).toContain('system.load.5m');
      expect(names).toContain('system.load.15m');
    });

    it('should include host tag', () => {
      const metrics = collector.collectSystemMetrics();
      const cpuMetric = metrics.find(m => m.name === 'system.cpu.usage');

      expect(cpuMetric).toBeDefined();
      expect(cpuMetric!.tags.host).toBeDefined();
    });

    it('should have proper units', () => {
      const metrics = collector.collectSystemMetrics();
      const cpuMetric = metrics.find(m => m.name === 'system.cpu.usage');

      expect(cpuMetric!.unit).toBe('percent');
    });
  });

  // ==================== Custom Metric Registration ====================

  describe('registerMetric', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should register a custom metric', () => {
      collector.registerMetric({
        name: 'custom.requests',
        unit: 'count',
        defaultTags: { service: 'api' },
        description: 'Request count',
      });

      const metrics = collector.getRegisteredMetrics();
      expect(metrics).toContain('custom.requests');
    });

    it('should allow unregistering a metric', () => {
      collector.registerMetric({ name: 'temp.metric', unit: 'count' });
      collector.unregisterMetric('temp.metric');

      const metrics = collector.getRegisteredMetrics();
      expect(metrics).not.toContain('temp.metric');
    });

    it('should use default tags when not provided', () => {
      collector.registerMetric({ name: 'test.metric', unit: 'ms' });

      const metrics = collector.getRegisteredMetrics();
      expect(metrics).toContain('test.metric');
    });
  });

  // ==================== Metric Recording ====================

  describe('recordMetric', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should record a metric value', () => {
      collector.recordMetric('test.metric', 42, { env: 'prod' });

      const summary = collector.getMetricSummary('test.metric');
      expect(summary.count).toBe(1);
      expect(summary.avg).toBe(42);
      expect(summary.max).toBe(42);
      expect(summary.min).toBe(42);
    });

    it('should record multiple values and compute aggregation', () => {
      collector.recordMetric('latency', 100);
      collector.recordMetric('latency', 200);
      collector.recordMetric('latency', 150);
      collector.recordMetric('latency', 300);
      collector.recordMetric('latency', 50);

      const summary = collector.getMetricSummary('latency');
      expect(summary.count).toBe(5);
      expect(summary.avg).toBe(160);
      expect(summary.max).toBe(300);
      expect(summary.min).toBe(50);
      expect(summary.sum).toBe(800);
    });

    it('should store timestamps', () => {
      const customTime = new Date('2026-04-12T10:00:00Z');
      collector.recordMetric('test.metric', 10, {}, customTime);

      const series = collector.getMetricSeries({ name: 'test.metric' });
      expect(series.dataPoints[0].timestamp.getTime()).toBe(customTime.getTime());
    });
  });

  describe('recordLatency', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should record latency with endpoint tag', () => {
      collector.recordLatency('/api/users', 150, 200);

      const series = collector.getMetricSeries({
        name: 'app.http.latency',
        tags: { endpoint: '/api/users' },
      });

      expect(series.dataPoints.length).toBe(1);
      expect(series.dataPoints[0].value).toBe(150);
    });
  });

  describe('recordError', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should record an error', () => {
      collector.recordError('auth-service', 'TimeoutError');

      const series = collector.getMetricSeries({
        name: 'app.errors.count',
        tags: { service: 'auth-service', errorType: 'TimeoutError' },
      });

      expect(series.dataPoints.length).toBe(1);
    });
  });

  describe('recordThroughput', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should record throughput', () => {
      collector.recordThroughput('api-service', 5);

      const series = collector.getMetricSeries({
        name: 'app.throughput',
        tags: { service: 'api-service' },
      });

      expect(series.dataPoints.length).toBe(1);
      expect(series.dataPoints[0].value).toBe(5);
    });
  });

  describe('recordNatsMessageRate', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should record NATS message rate', () => {
      collector.recordNatsMessageRate('events.user.created', 3);

      const series = collector.getMetricSeries({
        name: 'nats.messages',
        tags: { subject: 'events.user.created' },
      });

      expect(series.dataPoints.length).toBe(1);
    });

    it('should track cumulative counts', () => {
      collector.recordNatsMessageRate('events.user', 2);
      collector.recordNatsMessageRate('events.user', 3);

      const counts = collector.getNatsMessageCounts();
      expect(counts.get('events.user')).toBe(5);
    });

    it('should reset counts', () => {
      collector.recordNatsMessageRate('events.test', 5);
      collector.resetNatsMessageCounts();

      expect(collector.getNatsMessageCounts().size).toBe(0);
    });
  });

  // ==================== Metric Retrieval ====================

  describe('getMetricSeries', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should return all data points', () => {
      collector.recordMetric('cpu', 10, {}, new Date('2026-04-12T08:00:00Z'));
      collector.recordMetric('cpu', 20, {}, new Date('2026-04-12T09:00:00Z'));
      collector.recordMetric('cpu', 30, {}, new Date('2026-04-12T10:00:00Z'));
      collector.recordMetric('cpu', 40, {}, new Date('2026-04-12T11:00:00Z'));
      collector.recordMetric('cpu', 50, {}, new Date('2026-04-12T12:00:00Z'));

      const series = collector.getMetricSeries({ name: 'cpu' });

      expect(series.name).toBe('cpu');
      expect(series.dataPoints.length).toBe(5);
    });

    it('should compute correct aggregation', () => {
      collector.recordMetric('cpu', 10, {}, new Date('2026-04-12T08:00:00Z'));
      collector.recordMetric('cpu', 20, {}, new Date('2026-04-12T09:00:00Z'));
      collector.recordMetric('cpu', 30, {}, new Date('2026-04-12T10:00:00Z'));
      collector.recordMetric('cpu', 40, {}, new Date('2026-04-12T11:00:00Z'));
      collector.recordMetric('cpu', 50, {}, new Date('2026-04-12T12:00:00Z'));

      const series = collector.getMetricSeries({ name: 'cpu' });

      expect(series.aggregation.avg).toBe(30);
      expect(series.aggregation.max).toBe(50);
      expect(series.aggregation.min).toBe(10);
      expect(series.aggregation.count).toBe(5);
    });

    it('should filter by time window', () => {
      collector.recordMetric('cpu', 10, {}, new Date('2026-04-12T08:00:00Z'));
      collector.recordMetric('cpu', 20, {}, new Date('2026-04-12T09:00:00Z'));
      collector.recordMetric('cpu', 30, {}, new Date('2026-04-12T10:00:00Z'));
      collector.recordMetric('cpu', 40, {}, new Date('2026-04-12T11:00:00Z'));
      collector.recordMetric('cpu', 50, {}, new Date('2026-04-12T12:00:00Z'));

      const series = collector.getMetricSeries({
        name: 'cpu',
        startTime: new Date('2026-04-12T10:00:00Z'),
        endTime: new Date('2026-04-12T11:00:00Z'),
      });

      expect(series.dataPoints.length).toBe(2);
    });

    it('should limit max points', () => {
      collector.recordMetric('cpu', 10, {}, new Date('2026-04-12T08:00:00Z'));
      collector.recordMetric('cpu', 20, {}, new Date('2026-04-12T09:00:00Z'));
      collector.recordMetric('cpu', 30, {}, new Date('2026-04-12T10:00:00Z'));
      collector.recordMetric('cpu', 40, {}, new Date('2026-04-12T11:00:00Z'));
      collector.recordMetric('cpu', 50, {}, new Date('2026-04-12T12:00:00Z'));

      const series = collector.getMetricSeries({ name: 'cpu', maxPoints: 3 });

      expect(series.dataPoints.length).toBeLessThanOrEqual(3);
    });

    it('should return empty series for unknown metric', () => {
      const series = collector.getMetricSeries({ name: 'unknown' });

      expect(series.dataPoints.length).toBe(0);
      expect(series.aggregation.count).toBe(0);
    });
  });

  describe('getMetricSummary', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should return summary with time window', () => {
      const now = Date.now();
      collector.recordMetric('mem', 70, {}, new Date(now - 60000));
      collector.recordMetric('mem', 80, {}, new Date(now - 30000));
      collector.recordMetric('mem', 90, {}, new Date(now));

      const summary = collector.getMetricSummary('mem', undefined, 120000);
      expect(summary.count).toBe(3);
    });

    it('should filter by tags', () => {
      collector.recordMetric('req.count', 1, { service: 'a' });
      collector.recordMetric('req.count', 2, { service: 'a' });
      collector.recordMetric('req.count', 5, { service: 'b' });

      const summaryA = collector.getMetricSummary('req.count', { service: 'a' });
      expect(summaryA.count).toBe(2);

      const summaryB = collector.getMetricSummary('req.count', { service: 'b' });
      expect(summaryB.count).toBe(1);
    });
  });

  describe('getLatestValue', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should return the latest recorded value', () => {
      collector.recordMetric('counter', 1);
      collector.recordMetric('counter', 2);
      collector.recordMetric('counter', 3);

      expect(collector.getLatestValue('counter')).toBe(3);
    });

    it('should return null for unknown metric', () => {
      expect(collector.getLatestValue('nonexistent')).toBeNull();
    });

    it('should filter by tags', () => {
      collector.recordMetric('val', 100, { env: 'prod' });
      collector.recordMetric('val', 200, { env: 'staging' });
      collector.recordMetric('val', 300, { env: 'prod' });

      expect(collector.getLatestValue('val', { env: 'prod' })).toBe(300);
      expect(collector.getLatestValue('val', { env: 'staging' })).toBe(200);
    });
  });

  // ==================== Maintenance ====================

  describe('pruneExpired', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo, retentionMs: 60000 }); // 1 minute
    });

    it('should prune data older than retention period', () => {
      collector.recordMetric('old', 1, {}, new Date(Date.now() - 120000));
      collector.recordMetric('new', 2);

      const pruned = collector.pruneExpired();
      expect(pruned).toBeGreaterThanOrEqual(1);
    });
  });

  describe('clearAll', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should clear all data', () => {
      collector.recordMetric('test', 1);
      collector.registerMetric({ name: 'registered', unit: 'count' });
      collector.recordNatsMessageRate('test', 5);

      collector.clearAll();

      expect(collector.getRegisteredMetrics()).toEqual([]);
      expect(collector.getLatestValue('test')).toBeNull();
      expect(collector.getNatsMessageCounts().size).toBe(0);
    });
  });

  // ==================== Percentile Calculation ====================

  describe('percentile calculation', () => {
    let collector: MetricCollector;

    beforeEach(() => {
      collector = new MetricCollector({ repository: mockRepo });
    });

    it('should compute p95 correctly', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordMetric('p95test', i);
      }

      const summary = collector.getMetricSummary('p95test');
      expect(summary.p95).toBeCloseTo(95, 0);
    });

    it('should compute p99 correctly', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordMetric('p99test', i);
      }

      const summary = collector.getMetricSummary('p99test');
      expect(summary.p99).toBeCloseTo(99, 0);
    });
  });
});
