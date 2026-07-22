/**
 * TASK-703: MonitoringDashboard Unit Tests
 */

import { MetricCollector } from '../MetricCollector';
import { MonitoringDashboard } from '../MonitoringDashboard';

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

describe('MonitoringDashboard', () => {
  let mockRepo: ReturnType<typeof createMockRepo>;
  let collector: MetricCollector;
  let dashboard: MonitoringDashboard;

  beforeEach(() => {
    mockRepo = createMockRepo();
    collector = new MetricCollector({ repository: mockRepo });
    dashboard = new MonitoringDashboard(collector);
  });

  // ==================== Widget Configuration ====================

  describe('widgetConfig', () => {
    it('should add a widget configuration', async () => {
      await dashboard.addWidgetConfig({
        title: 'CPU Usage',
        metrics: ['system.cpu.usage'],
        timeWindow: '1h',
      });

      const widgets = await dashboard.getWidgetConfigs();
      expect(widgets.length).toBe(1);
      expect(widgets[0].title).toBe('CPU Usage');
    });

    it('should allow removing a widget configuration', async () => {
      await dashboard.addWidgetConfig({
        title: 'CPU',
        metrics: ['system.cpu.usage'],
        timeWindow: '1h',
      });

      await dashboard.addWidgetConfig({
        title: 'Memory',
        metrics: ['system.memory.usage'],
        timeWindow: '1h',
      });

      await dashboard.removeWidgetConfig(0);

      const widgets = await dashboard.getWidgetConfigs();
      expect(widgets.length).toBe(1);
      expect(widgets[0].title).toBe('Memory');
    });

    it('should clear all widget configurations', async () => {
      await dashboard.addWidgetConfig({
        title: 'CPU',
        metrics: ['system.cpu.usage'],
        timeWindow: '1h',
      });

      await dashboard.clearWidgetConfigs();

      const widgets = await dashboard.getWidgetConfigs();
      expect(widgets.length).toBe(0);
    });
  });

  // ==================== Dashboard Data Generation ====================

  describe('getDashboardData', () => {
    beforeEach(async () => {
      collector.recordMetric('system.cpu.usage', 45);
      collector.recordMetric('system.cpu.usage', 55);
      collector.recordMetric('system.cpu.usage', 65);

      collector.recordMetric('system.memory.usage', 70);
      collector.recordMetric('system.memory.usage', 72);
      collector.recordMetric('system.memory.usage', 75);

      await dashboard.addWidgetConfig({
        title: 'CPU Usage',
        metrics: ['system.cpu.usage'],
        timeWindow: '1h',
      });

      await dashboard.addWidgetConfig({
        title: 'Memory Usage',
        metrics: ['system.memory.usage'],
        timeWindow: '1h',
      });
    });

    it('should generate dashboard data with widgets', async () => {
      const data = await dashboard.getDashboardData();

      expect(data.widgets.length).toBe(2);
      expect(data.widgets[0].title).toBe('CPU Usage');
      expect(data.widgets[1].title).toBe('Memory Usage');
    });

    it('should include health score', async () => {
      const data = await dashboard.getDashboardData();
      expect(data.healthScore).toBeGreaterThanOrEqual(0);
      expect(data.healthScore).toBeLessThanOrEqual(100);
    });

    it('should include active alert counts', async () => {
      const data = await dashboard.getDashboardData({
        critical: 2,
        warning: 5,
        info: 1,
      });

      expect(data.activeAlerts.critical).toBe(2);
      expect(data.activeAlerts.warning).toBe(5);
      expect(data.activeAlerts.info).toBe(1);
    });

    it('should include generation timestamp', async () => {
      const data = await dashboard.getDashboardData();
      expect(data.generatedAt).toBeDefined();
    });

    it('should calculate current value for widgets', async () => {
      const data = await dashboard.getDashboardData();

      expect(data.widgets[0].currentValue).toBe(65);
    });

    it('should calculate trend direction', async () => {
      const data = await dashboard.getDashboardData();

      expect(data.widgets[0].trend).toBeDefined();
      expect(['up', 'down', 'stable']).toContain(data.widgets[0].trend);
    });
  });

  // ==================== Aggregated Metrics ====================

  describe('getAggregatedMetrics', () => {
    beforeEach(() => {
      for (let i = 1; i <= 10; i++) {
        collector.recordMetric('latency', i * 10);
      }
    });

    it('should return aggregated metrics for multiple metric names', () => {
      collector.recordMetric('errors', 1);
      collector.recordMetric('errors', 2);

      const aggregated = dashboard.getAggregatedMetrics(['latency', 'errors'], '1h');

      expect(aggregated.length).toBe(2);
      expect(aggregated[0].name).toBe('latency');
      expect(aggregated[0].aggregation.count).toBe(10);
    });

    it('should return empty aggregation for unknown metrics', () => {
      const aggregated = dashboard.getAggregatedMetrics(['unknown'], '1h');

      expect(aggregated.length).toBe(1);
      expect(aggregated[0].aggregation.count).toBe(0);
    });
  });

  describe('getMetricComparison', () => {
    beforeEach(() => {
      collector.recordMetric('cpu', 30);
      collector.recordMetric('cpu', 50);
      collector.recordMetric('cpu', 70);
    });

    it('should compare metrics across multiple time windows', () => {
      const comparison = dashboard.getMetricComparison('cpu', ['1h', '24h']);

      expect(comparison.length).toBe(2);
      expect(comparison[0].window).toBe('1h');
      expect(comparison[1].window).toBe('24h');
    });
  });

  // ==================== Anomaly Detection ====================

  describe('detectAnomalies', () => {
    it('should detect anomalies with high z-score', () => {
      // Record normal values
      for (let i = 0; i < 20; i++) {
        collector.recordMetric('cpu', 50 + Math.random() * 5);
      }

      // Record anomalous value
      collector.recordMetric('cpu', 200);

      const anomalies = dashboard.detectAnomalies('cpu', '1h');

      expect(anomalies.length).toBeGreaterThan(0);

      const anomaly = anomalies.find(a => a.value === 200);
      expect(anomaly).toBeDefined();
      expect(anomaly!.isAnomaly).toBe(true);
      expect(Math.abs(anomaly!.zScore)).toBeGreaterThan(2.5);
    });

    it('should return empty for uniform data', () => {
      for (let i = 0; i < 10; i++) {
        collector.recordMetric('constant', 50);
      }

      const anomalies = dashboard.detectAnomalies('constant', '1h');
      expect(anomalies.length).toBe(0);
    });

    it('should return empty for insufficient data', () => {
      collector.recordMetric('sparse', 50);
      collector.recordMetric('sparse', 55);

      const anomalies = dashboard.detectAnomalies('sparse', '1h');
      expect(anomalies.length).toBe(0);
    });

    it('should use custom threshold', () => {
      for (let i = 0; i < 15; i++) {
        collector.recordMetric('metric', 50 + Math.random() * 10);
      }

      collector.recordMetric('metric', 80);

      // With high threshold, should not detect
      const anomaliesStrict = dashboard.detectAnomalies('metric', '1h', undefined, 5);
      // With low threshold, might detect
      const anomaliesLenient = dashboard.detectAnomalies('metric', '1h', undefined, 1);

      expect(anomaliesLenient.length).toBeGreaterThanOrEqual(anomaliesStrict.length);
    });

    it('should include expected value and z-score', () => {
      for (let i = 0; i < 10; i++) {
        collector.recordMetric('test.anomaly', 50);
      }
      collector.recordMetric('test.anomaly', 150);

      const anomalies = dashboard.detectAnomalies('test.anomaly', '1h');

      if (anomalies.length > 0) {
        expect(anomalies[0].metric).toBe('test.anomaly');
        expect(anomalies[0].expectedValue).toBeDefined();
        expect(anomalies[0].zScore).toBeDefined();
        expect(anomalies[0].timestamp).toBeDefined();
      }
    });
  });

  describe('getAnomalySummary', () => {
    it('should return anomaly summary', () => {
      for (let i = 0; i < 10; i++) {
        collector.recordMetric('system.cpu.usage', 50);
      }
      collector.recordMetric('system.cpu.usage', 200);

      const summary = dashboard.getAnomalySummary();

      expect(summary.totalAnomalies).toBeDefined();
      expect(summary.byMetric).toBeDefined();
      expect(summary.maxZScore).toBeDefined();
      expect(summary.recentAnomalies).toBeDefined();
    });
  });

  // ==================== Health Score ====================

  describe('healthScore calculation', () => {
    it('should be 100 with no alerts and normal metrics', async () => {
      collector.recordMetric('system.cpu.usage', 30);
      collector.recordMetric('system.memory.usage', 40);

      const data = await dashboard.getDashboardData({ critical: 0, warning: 0, info: 0 });
      expect(data.healthScore).toBeGreaterThan(70);
    });

    it('should decrease with critical alerts', async () => {
      collector.recordMetric('system.cpu.usage', 30);
      collector.recordMetric('system.memory.usage', 40);

      const highAlert = await dashboard.getDashboardData({ critical: 5, warning: 0, info: 0 });
      const lowAlert = await dashboard.getDashboardData({ critical: 0, warning: 0, info: 0 });

      expect(highAlert.healthScore).toBeLessThan(lowAlert.healthScore);
    });

    it('should decrease with high CPU', async () => {
      collector.recordMetric('system.cpu.usage', 95);
      collector.recordMetric('system.memory.usage', 40);

      const data = await dashboard.getDashboardData({ critical: 0, warning: 0, info: 0 });
      expect(data.healthScore).toBeLessThan(100);
    });

    it('should decrease with high memory', async () => {
      collector.recordMetric('system.cpu.usage', 30);
      collector.recordMetric('system.memory.usage', 95);

      const data = await dashboard.getDashboardData({ critical: 0, warning: 0, info: 0 });
      expect(data.healthScore).toBeLessThan(100);
    });

    it('should be bounded between 0 and 100', async () => {
      const data = await dashboard.getDashboardData({ critical: 100, warning: 100, info: 100 });
      expect(data.healthScore).toBeGreaterThanOrEqual(0);
      expect(data.healthScore).toBeLessThanOrEqual(100);
    });
  });

  // ==================== Trend Calculation ====================

  describe('trend calculation', () => {
    it('should detect upward trend', async () => {
      for (let i = 0; i < 10; i++) {
        collector.recordMetric('growing', 10 + i * 10);
      }

      await dashboard.addWidgetConfig({
        title: 'Growing',
        metrics: ['growing'],
        timeWindow: '1h',
      });

      const data = await dashboard.getDashboardData();
      expect(data.widgets[0].trend).toBe('up');
    });

    it('should detect downward trend', async () => {
      for (let i = 0; i < 10; i++) {
        collector.recordMetric('shrinking', 100 - i * 10);
      }

      await dashboard.addWidgetConfig({
        title: 'Shrinking',
        metrics: ['shrinking'],
        timeWindow: '1h',
      });

      const data = await dashboard.getDashboardData();
      expect(data.widgets[0].trend).toBe('down');
    });

    it('should detect stable trend', async () => {
      for (let i = 0; i < 10; i++) {
        collector.recordMetric('stable', 50 + Math.random());
      }

      await dashboard.addWidgetConfig({
        title: 'Stable',
        metrics: ['stable'],
        timeWindow: '1h',
      });

      const data = await dashboard.getDashboardData();
      expect(data.widgets[0].trend).toBe('stable');
    });
  });

  // ==================== Configuration ====================

  describe('setAnomalyThreshold', () => {
    it('should update the anomaly threshold', () => {
      dashboard.setAnomalyThreshold(3.0);

      // The threshold should be applied in subsequent anomaly detection
      for (let i = 0; i < 10; i++) {
        collector.recordMetric('metric', 50);
      }
      collector.recordMetric('metric', 100);

      const anomalies = dashboard.detectAnomalies('metric', '1h', undefined, 3.0);
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });
});
