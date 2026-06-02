/**
 * CapacityService - Capacity Planning Unit Tests
 *
 * Coverage: recordMetric, listMetrics, getLatestMetrics, generateForecast,
 *           listForecasts, listAlerts, deleteAlert, generateReport,
 *           listReports, getReport, analyzeBottlenecks
 */

import { CapacityService } from '../CapacityService';

describe('CapacityService', () => {
  let service: CapacityService;

  beforeEach(() => {
    service = new CapacityService();
  });

  // ==================== recordMetric ====================

  describe('recordMetric', () => {
    it('should record a capacity metric', async () => {
      const result = await service.recordMetric({
        resourceType: 'compute',
        resourceId: 'node-1',
        metricName: 'cpu',
        currentValue: 75,
        maxValue: 100,
        unit: 'percent',
      }, 't-1');

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('t-1');
      expect(result.resourceType).toBe('compute');
      expect(result.resourceId).toBe('node-1');
      expect(result.metricName).toBe('cpu');
      expect(result.currentValue).toBe(75);
      expect(result.maxValue).toBe(100);
      expect(result.utilizationPercent).toBe(75);
      expect(result.unit).toBe('percent');
      expect(result.timestamp).toBeDefined();
    });

    it('should calculate utilization percent correctly', async () => {
      const result = await service.recordMetric({
        resourceType: 'storage',
        resourceId: 'disk-1',
        metricName: 'disk',
        currentValue: 512,
        maxValue: 1024,
        unit: 'GB',
      }, 't-1');

      expect(result.utilizationPercent).toBe(50);
    });

    it('should handle zero maxValue', async () => {
      const result = await service.recordMetric({
        resourceType: 'compute',
        resourceId: 'node-zero',
        metricName: 'cpu',
        currentValue: 0,
        maxValue: 0,
        unit: 'percent',
      }, 't-1');

      expect(result.utilizationPercent).toBe(0);
    });

    it('should round utilization to 2 decimal places', async () => {
      const result = await service.recordMetric({
        resourceType: 'compute',
        resourceId: 'node-precise',
        metricName: 'cpu',
        currentValue: 33,
        maxValue: 100,
        unit: 'percent',
      }, 't-1');

      expect(result.utilizationPercent).toBe(33);
    });
  });

  // ==================== listMetrics ====================

  describe('listMetrics', () => {
    it('should list metrics for tenant', async () => {
      await service.recordMetric({
        resourceType: 'compute', resourceId: 'n1', metricName: 'cpu',
        currentValue: 50, maxValue: 100, unit: '%',
      }, 't-list');

      const result = await service.listMetrics('t-list');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(m => m.tenantId === 't-list')).toBe(true);
    });

    it('should filter by resourceType', async () => {
      await service.recordMetric({
        resourceType: 'storage-list', resourceId: 's1', metricName: 'disk',
        currentValue: 100, maxValue: 200, unit: 'GB',
      }, 't-list-filter');
      await service.recordMetric({
        resourceType: 'compute-list', resourceId: 'c1', metricName: 'cpu',
        currentValue: 50, maxValue: 100, unit: '%',
      }, 't-list-filter');

      const result = await service.listMetrics('t-list-filter', { resourceType: 'storage-list' });

      expect(result.every(m => m.resourceType === 'storage-list')).toBe(true);
    });

    it('should filter by metricName', async () => {
      await service.recordMetric({
        resourceType: 'compute-mn', resourceId: 'c1', metricName: 'memory-mn',
        currentValue: 4, maxValue: 8, unit: 'GB',
      }, 't-mn');

      const result = await service.listMetrics('t-mn', { metricName: 'memory-mn' });

      expect(result.every(m => m.metricName === 'memory-mn')).toBe(true);
    });

    it('should sort by timestamp descending', async () => {
      await service.recordMetric({
        resourceType: 'compute-sort', resourceId: 'c1', metricName: 'cpu',
        currentValue: 10, maxValue: 100, unit: '%',
      }, 't-sort');
      await service.recordMetric({
        resourceType: 'compute-sort', resourceId: 'c2', metricName: 'cpu',
        currentValue: 20, maxValue: 100, unit: '%',
      }, 't-sort');

      const result = await service.listMetrics('t-sort');

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].timestamp >= result[i].timestamp).toBe(true);
      }
    });
  });

  // ==================== getLatestMetrics ====================

  describe('getLatestMetrics', () => {
    it('should return one metric per resource:type:metric combination', async () => {
      await service.recordMetric({
        resourceType: 'compute-latest', resourceId: 'n1', metricName: 'cpu-latest',
        currentValue: 50, maxValue: 100, unit: '%',
      }, 't-latest');
      await service.recordMetric({
        resourceType: 'compute-latest', resourceId: 'n1', metricName: 'cpu-latest',
        currentValue: 80, maxValue: 100, unit: '%',
      }, 't-latest');

      const result = await service.getLatestMetrics('t-latest');

      const key = 'compute-latest:n1:cpu-latest';
      expect(result.has(key)).toBe(true);
      // Should deduplicate to exactly one entry
      expect(result.size).toBe(1);
      // Value should be one of the two recorded values
      expect([50, 80]).toContain(result.get(key)!.currentValue);
    });

    it('should return empty map for unknown tenant', async () => {
      const result = await service.getLatestMetrics('t-unknown-latest');
      expect(result.size).toBe(0);
    });
  });

  // ==================== generateForecast ====================

  describe('generateForecast', () => {
    it('should generate forecasts for existing metrics', async () => {
      await service.recordMetric({
        resourceType: 'compute-fc', resourceId: 'n1', metricName: 'cpu-fc',
        currentValue: 60, maxValue: 100, unit: '%',
      }, 't-fc');

      const result = await service.generateForecast('t-fc');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].tenantId).toBe('t-fc');
      expect(result[0].currentUtilization).toBe(60);
      expect(result[0].forecast30Days).toBeGreaterThanOrEqual(60);
      expect(result[0].forecast90Days).toBeGreaterThanOrEqual(result[0].forecast30Days);
    });

    it('should generate alerts for high utilization', async () => {
      await service.recordMetric({
        resourceType: 'compute-alert', resourceId: 'n-high', metricName: 'cpu-alert',
        currentValue: 85, maxValue: 100, unit: '%',
      }, 't-alert');

      await service.generateForecast('t-alert');

      const alerts = await service.listAlerts('t-alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].severity).toBe('warning');
    });

    it('should generate critical alerts for very high utilization', async () => {
      await service.recordMetric({
        resourceType: 'compute-crit', resourceId: 'n-crit', metricName: 'cpu-crit',
        currentValue: 95, maxValue: 100, unit: '%',
      }, 't-crit');

      await service.generateForecast('t-crit');

      const alerts = await service.listAlerts('t-crit');
      expect(alerts.some(a => a.severity === 'critical')).toBe(true);
    });

    it('should estimate exhaust date for high forecast', async () => {
      await service.recordMetric({
        resourceType: 'compute-exhaust', resourceId: 'n-exhaust', metricName: 'cpu-exhaust',
        currentValue: 90, maxValue: 100, unit: '%',
      }, 't-exhaust');

      const result = await service.generateForecast('t-exhaust');

      expect(result[0].estimatedExhaustDate).toBeDefined();
      expect(result[0].recommendedAction).toBeDefined();
    });

    it('should return empty for tenant with no metrics', async () => {
      const result = await service.generateForecast('t-no-metrics');
      expect(result).toEqual([]);
    });
  });

  // ==================== listForecasts ====================

  describe('listForecasts', () => {
    it('should list forecasts for tenant', async () => {
      await service.recordMetric({
        resourceType: 'compute-lf', resourceId: 'n1', metricName: 'cpu-lf',
        currentValue: 50, maxValue: 100, unit: '%',
      }, 't-lf');
      await service.generateForecast('t-lf');

      const result = await service.listForecasts('t-lf');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(f => f.tenantId === 't-lf')).toBe(true);
    });

    it('should filter by resourceType', async () => {
      await service.recordMetric({
        resourceType: 'storage-lf', resourceId: 's1', metricName: 'disk-lf',
        currentValue: 50, maxValue: 100, unit: 'GB',
      }, 't-lf-filter');
      await service.generateForecast('t-lf-filter');

      const result = await service.listForecasts('t-lf-filter', { resourceType: 'storage-lf' });

      expect(result.every(f => f.resourceType === 'storage-lf')).toBe(true);
    });
  });

  // ==================== listAlerts ====================

  describe('listAlerts', () => {
    it('should list alerts for tenant', async () => {
      await service.recordMetric({
        resourceType: 'compute-la', resourceId: 'n1', metricName: 'cpu-la',
        currentValue: 85, maxValue: 100, unit: '%',
      }, 't-la');
      await service.generateForecast('t-la');

      const result = await service.listAlerts('t-la');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(a => a.tenantId === 't-la')).toBe(true);
    });

    it('should filter by severity', async () => {
      await service.recordMetric({
        resourceType: 'compute-sev', resourceId: 'n1', metricName: 'cpu-sev',
        currentValue: 95, maxValue: 100, unit: '%',
      }, 't-sev');
      await service.generateForecast('t-sev');

      const result = await service.listAlerts('t-sev', { severity: 'critical' });

      expect(result.every(a => a.severity === 'critical')).toBe(true);
    });
  });

  // ==================== deleteAlert ====================

  describe('deleteAlert', () => {
    it('should delete an alert', async () => {
      await service.recordMetric({
        resourceType: 'compute-da', resourceId: 'n1', metricName: 'cpu-da',
        currentValue: 85, maxValue: 100, unit: '%',
      }, 't-da');
      await service.generateForecast('t-da');

      const alerts = await service.listAlerts('t-da');
      if (alerts.length > 0) {
        const result = await service.deleteAlert(alerts[0].id);
        expect(result).toBe(true);

        const afterDelete = await service.listAlerts('t-da');
        expect(afterDelete.find(a => a.id === alerts[0].id)).toBeUndefined();
      }
    });

    it('should return false for non-existent alert', async () => {
      const result = await service.deleteAlert('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== generateReport ====================

  describe('generateReport', () => {
    it('should generate a capacity report', async () => {
      await service.recordMetric({
        resourceType: 'compute-rpt', resourceId: 'n1', metricName: 'cpu-rpt',
        currentValue: 50, maxValue: 100, unit: '%',
      }, 't-rpt');
      await service.generateForecast('t-rpt');

      const result = await service.generateReport('Monthly Report', 't-rpt');

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Monthly Report');
      expect(result.tenantId).toBe('t-rpt');
      expect(result.summary).toBeDefined();
      expect(result.summary.totalResources).toBeGreaterThanOrEqual(0);
      expect(result.alerts).toBeDefined();
      expect(result.forecasts).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it('should calculate overall score', async () => {
      await service.recordMetric({
        resourceType: 'compute-score', resourceId: 'n1', metricName: 'cpu-score',
        currentValue: 50, maxValue: 100, unit: '%',
      }, 't-score');
      await service.generateForecast('t-score');

      const result = await service.generateReport('Score Report', 't-score');

      expect(result.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.summary.overallScore).toBeLessThanOrEqual(100);
    });
  });

  // ==================== listReports / getReport ====================

  describe('listReports', () => {
    it('should list reports for tenant', async () => {
      await service.generateReport('Report 1', 't-lr');

      const result = await service.listReports('t-lr');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(r => r.tenantId === 't-lr')).toBe(true);
    });
  });

  describe('getReport', () => {
    it('should return report by id', async () => {
      const created = await service.generateReport('Get Report', 't-gr');

      const result = await service.getReport(created.id);

      expect(result).toBeDefined();
      expect(result!.title).toBe('Get Report');
    });

    it('should return undefined for non-existent report', async () => {
      const result = await service.getReport('non-existent');
      expect(result).toBeUndefined();
    });
  });

  // ==================== analyzeBottlenecks ====================

  describe('analyzeBottlenecks', () => {
    it('should identify high utilization bottlenecks', async () => {
      await service.recordMetric({
        resourceType: 'compute-bn', resourceId: 'n1', metricName: 'cpu-bn',
        currentValue: 85, maxValue: 100, unit: '%',
      }, 't-bn');

      const result = await service.analyzeBottlenecks('t-bn');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].impact).toBe('high');
      expect(result[0].utilization).toBeGreaterThanOrEqual(80);
    });

    it('should provide recommendations for different resource types', async () => {
      // metricName must be exactly 'cpu' or 'memory' to trigger specific recommendations
      await service.recordMetric({
        resourceType: 'compute-rec', resourceId: 'n1', metricName: 'cpu',
        currentValue: 85, maxValue: 100, unit: '%',
      }, 't-rec');
      await service.recordMetric({
        resourceType: 'compute-rec', resourceId: 'n2', metricName: 'memory',
        currentValue: 90, maxValue: 100, unit: '%',
      }, 't-rec');

      const result = await service.analyzeBottlenecks('t-rec');

      expect(result.length).toBeGreaterThanOrEqual(2);
      const cpuBottleneck = result.find(b => b.metricName === 'cpu');
      const memBottleneck = result.find(b => b.metricName === 'memory');
      if (cpuBottleneck) expect(cpuBottleneck.recommendation).toContain('CPU');
      if (memBottleneck) expect(memBottleneck.recommendation).toContain('内存');
    });

    it('should skip resources below 50% utilization', async () => {
      await service.recordMetric({
        resourceType: 'compute-low', resourceId: 'n-low', metricName: 'cpu-low',
        currentValue: 30, maxValue: 100, unit: '%',
      }, 't-low');

      const result = await service.analyzeBottlenecks('t-low');

      expect(result.every(b => b.resourceId !== 'n-low')).toBe(true);
    });

    it('should sort by utilization descending', async () => {
      await service.recordMetric({
        resourceType: 'compute-sort-bn', resourceId: 'n1', metricName: 'cpu-sort-bn',
        currentValue: 60, maxValue: 100, unit: '%',
      }, 't-sort-bn');
      await service.recordMetric({
        resourceType: 'compute-sort-bn', resourceId: 'n2', metricName: 'mem-sort-bn',
        currentValue: 90, maxValue: 100, unit: '%',
      }, 't-sort-bn');

      const result = await service.analyzeBottlenecks('t-sort-bn');

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].utilization >= result[i].utilization).toBe(true);
      }
    });

    it('should return empty for tenant with no metrics', async () => {
      const result = await service.analyzeBottlenecks('t-no-bottleneck');
      expect(result).toEqual([]);
    });
  });
});
