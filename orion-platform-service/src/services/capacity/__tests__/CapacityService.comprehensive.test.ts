/**
 * Comprehensive tests for CapacityService
 * Covers: recordMetric, listMetrics, getLatestMetrics, generateForecast,
 *         listForecasts, listAlerts, deleteAlert, generateReport,
 *         listReports, getReport, analyzeBottlenecks
 */

// We use jest.resetModules() + dynamic require() because the Maps are
// module-level singletons that leak state between tests.

let CapacityService: any;

beforeEach(() => {
  jest.resetModules();
  jest.mock('uuid', () => ({ v4: () => `mock-uuid-${Date.now()}-${Math.random()}` }));
  ({ CapacityService } = require('../CapacityService'));
});

// ---------------------------------------------------------------------------
// recordMetric
// ---------------------------------------------------------------------------
describe('recordMetric', () => {
  it('should record a metric with correct utilization calculation', async () => {
    const svc = new CapacityService();
    const result = await svc.recordMetric(
      { resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 75, maxValue: 100, unit: '%' },
      'tenant-a',
    );

    expect(result.tenantId).toBe('tenant-a');
    expect(result.resourceType).toBe('compute');
    expect(result.resourceId).toBe('vm-1');
    expect(result.metricName).toBe('cpu');
    expect(result.currentValue).toBe(75);
    expect(result.maxValue).toBe(100);
    expect(result.unit).toBe('%');
    expect(result.utilizationPercent).toBe(75);
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  it('should return 0 utilization when maxValue is 0', async () => {
    const svc = new CapacityService();
    const result = await svc.recordMetric(
      { resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 50, maxValue: 0, unit: '%' },
      'tenant-a',
    );

    expect(result.utilizationPercent).toBe(0);
  });

  it('should round utilization to 2 decimal places', async () => {
    const svc = new CapacityService();
    const result = await svc.recordMetric(
      { resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 33, maxValue: 100, unit: '%' },
      'tenant-a',
    );

    // 33/100 * 100 = 33 => Math.round(33 * 100) / 100 = 33
    expect(result.utilizationPercent).toBe(33);

    const result2 = await svc.recordMetric(
      { resourceType: 'storage', resourceId: 'disk-2', metricName: 'disk', currentValue: 1, maxValue: 3, unit: '%' },
      'tenant-a',
    );

    // 1/3 * 100 = 33.333... => Math.round(33.333... * 100) / 100 = 33.33
    expect(result2.utilizationPercent).toBe(33.33);
  });

  it('should generate a unique id for each recorded metric', async () => {
    const svc = new CapacityService();
    const m1 = await svc.recordMetric(
      { resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' },
      't1',
    );
    const m2 = await svc.recordMetric(
      { resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 60, maxValue: 100, unit: '%' },
      't1',
    );

    expect(m1.id).not.toBe(m2.id);
  });

  it('should set timestamp as ISO string', async () => {
    const svc = new CapacityService();
    const before = new Date().toISOString();
    const result = await svc.recordMetric(
      { resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' },
      't1',
    );
    const after = new Date().toISOString();

    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });

  it('should calculate utilization over 100% when currentValue exceeds maxValue', async () => {
    const svc = new CapacityService();
    const result = await svc.recordMetric(
      { resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 150, maxValue: 100, unit: '%' },
      't1',
    );

    expect(result.utilizationPercent).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// listMetrics
// ---------------------------------------------------------------------------
describe('listMetrics', () => {
  it('should return empty array when no metrics exist', async () => {
    const svc = new CapacityService();
    const result = await svc.listMetrics('tenant-a');
    expect(result).toEqual([]);
  });

  it('should only return metrics for the specified tenant', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 'tenant-a');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 60, maxValue: 100, unit: '%' }, 'tenant-b');

    const result = await svc.listMetrics('tenant-a');
    expect(result).toHaveLength(1);
    expect(result[0].resourceId).toBe('vm-1');
  });

  it('should filter by resourceType', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 50, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.listMetrics('t1', { resourceType: 'compute' });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('compute');
  });

  it('should filter by metricName', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'memory', currentValue: 60, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.listMetrics('t1', { metricName: 'memory' });
    expect(result).toHaveLength(1);
    expect(result[0].metricName).toBe('memory');
  });

  it('should filter by both resourceType and metricName', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'memory', currentValue: 50, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.listMetrics('t1', { resourceType: 'compute', metricName: 'cpu' });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('compute');
    expect(result[0].metricName).toBe('cpu');
  });

  it('should sort results by timestamp descending', async () => {
    const svc = new CapacityService();
    const m1 = await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    const m2 = await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 60, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.listMetrics('t1');
    expect(result[0].timestamp >= result[1].timestamp).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getLatestMetrics
// ---------------------------------------------------------------------------
describe('getLatestMetrics', () => {
  it('should return empty map when no metrics exist', async () => {
    const svc = new CapacityService();
    const result = await svc.getLatestMetrics('t1');
    expect(result.size).toBe(0);
  });

  it('should return the latest metric for each unique resource combination', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');

    await new Promise((r) => setTimeout(r, 10));

    const latest = await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 80, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.getLatestMetrics('t1');
    expect(result.size).toBe(1);

    const key = 'compute:vm-1:cpu';
    expect(result.get(key)!.currentValue).toBe(80);
    expect(result.get(key)!.id).toBe(latest.id);
  });

  it('should keep separate entries for different resource combinations', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'memory', currentValue: 60, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 70, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.getLatestMetrics('t1');
    expect(result.size).toBe(3);
    expect(result.has('compute:vm-1:cpu')).toBe(true);
    expect(result.has('compute:vm-1:memory')).toBe(true);
    expect(result.has('storage:disk-1:disk')).toBe(true);
  });

  it('should not return metrics from other tenants', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 80, maxValue: 100, unit: '%' }, 't2');

    const result = await svc.getLatestMetrics('t1');
    expect(result.size).toBe(1);
    expect(result.has('compute:vm-1:cpu')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateForecast
// ---------------------------------------------------------------------------
describe('generateForecast', () => {
  it('should return empty array when no metrics exist', async () => {
    const svc = new CapacityService();
    const result = await svc.generateForecast('t1');
    expect(result).toEqual([]);
  });

  it('should generate a forecast for each latest metric', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 60, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.generateForecast('t1');
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('t1');
    expect(result[0].id).toBeDefined();
    expect(result[0].generatedAt).toBeDefined();
  });

  it('should set currentUtilization from the metric', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.generateForecast('t1');
    expect(result[0].currentUtilization).toBe(50);
  });

  it('should cap forecasts at 100', async () => {
    const svc = new CapacityService();
    // Record a metric with very high utilization
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 99, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.generateForecast('t1');
    expect(result[0].forecast30Days).toBeLessThanOrEqual(100);
    expect(result[0].forecast90Days).toBeLessThanOrEqual(100);
  });

  it('should generate warning alert for utilization >= 80% and < 90%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');

    await svc.generateForecast('t1');
    const alerts = await svc.listAlerts('t1', { severity: 'warning' });

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].threshold).toBe(80);
  });

  it('should generate critical alert for utilization >= 90%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 95, maxValue: 100, unit: '%' }, 't1');

    await svc.generateForecast('t1');
    const alerts = await svc.listAlerts('t1', { severity: 'critical' });

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].threshold).toBe(90);
  });

  it('should NOT generate alerts for utilization < 80%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');

    await svc.generateForecast('t1');
    const alerts = await svc.listAlerts('t1');

    expect(alerts).toHaveLength(0);
  });

  it('should set estimatedExhaustDate when forecast90 >= 90', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 95, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.generateForecast('t1');
    // With 95% utilization and growth, forecast90 should exceed 90
    expect(result[0].forecast90Days).toBeGreaterThanOrEqual(90);
    expect(result[0].estimatedExhaustDate).toBeDefined();
  });

  it('should set recommendedAction for high utilization metrics', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 95, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.generateForecast('t1');
    expect(result[0].recommendedAction).toBeDefined();
    expect(typeof result[0].recommendedAction).toBe('string');
  });

  it('should store forecasts that can be retrieved via listForecasts', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');

    await svc.generateForecast('t1');
    const forecasts = await svc.listForecasts('t1');
    expect(forecasts.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// listForecasts
// ---------------------------------------------------------------------------
describe('listForecasts', () => {
  it('should return empty array when no forecasts exist', async () => {
    const svc = new CapacityService();
    const result = await svc.listForecasts('t1');
    expect(result).toEqual([]);
  });

  it('should only return forecasts for the specified tenant', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 60, maxValue: 100, unit: '%' }, 't2');
    await svc.generateForecast('t1');
    await svc.generateForecast('t2');

    const result = await svc.listForecasts('t1');
    expect(result.every((f: any) => f.tenantId === 't1')).toBe(true);
  });

  it('should filter by resourceType', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 60, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    const result = await svc.listForecasts('t1', { resourceType: 'compute' });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('compute');
  });

  it('should sort by generatedAt descending', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 50, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 60, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    const result = await svc.listForecasts('t1');
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].generatedAt >= result[i + 1].generatedAt).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// listAlerts
// ---------------------------------------------------------------------------
describe('listAlerts', () => {
  it('should return empty array when no alerts exist', async () => {
    const svc = new CapacityService();
    const result = await svc.listAlerts('t1');
    expect(result).toEqual([]);
  });

  it('should only return alerts for the specified tenant', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 95, maxValue: 100, unit: '%' }, 't2');
    await svc.generateForecast('t1');
    await svc.generateForecast('t2');

    const result = await svc.listAlerts('t1');
    expect(result.every((a: any) => a.tenantId === 't1')).toBe(true);
  });

  it('should filter by severity', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 95, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    const warnings = await svc.listAlerts('t1', { severity: 'warning' });
    const criticals = await svc.listAlerts('t1', { severity: 'critical' });

    expect(warnings.every((a: any) => a.severity === 'warning')).toBe(true);
    expect(criticals.every((a: any) => a.severity === 'critical')).toBe(true);
  });

  it('should sort alerts by createdAt descending', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 92, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    const result = await svc.listAlerts('t1');
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].createdAt >= result[i + 1].createdAt).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// deleteAlert
// ---------------------------------------------------------------------------
describe('deleteAlert', () => {
  it('should delete an existing alert and return true', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    const alerts = await svc.listAlerts('t1');
    expect(alerts.length).toBeGreaterThanOrEqual(1);

    const deleted = await svc.deleteAlert(alerts[0].id);
    expect(deleted).toBe(true);

    const remaining = await svc.listAlerts('t1');
    expect(remaining.length).toBe(alerts.length - 1);
  });

  it('should return false for non-existent alert', async () => {
    const svc = new CapacityService();
    const deleted = await svc.deleteAlert('non-existent-id');
    expect(deleted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------
describe('generateReport', () => {
  it('should generate a report with correct structure', async () => {
    const svc = new CapacityService();
    const report = await svc.generateReport('Monthly Report', 't1');

    expect(report.id).toBeDefined();
    expect(report.tenantId).toBe('t1');
    expect(report.title).toBe('Monthly Report');
    expect(report.summary).toBeDefined();
    expect(report.alerts).toBeDefined();
    expect(report.forecasts).toBeDefined();
    expect(report.generatedAt).toBeDefined();
  });

  it('should return 100 score when there are no alerts', async () => {
    const svc = new CapacityService();
    const report = await svc.generateReport('Report', 't1');

    expect(report.summary.overallScore).toBe(100);
    expect(report.summary.totalResources).toBe(0);
    expect(report.summary.healthyCount).toBe(0);
    expect(report.summary.warningCount).toBe(0);
    expect(report.summary.criticalCount).toBe(0);
  });

  it('should calculate summary counts from alerts', async () => {
    const svc = new CapacityService();
    // Create 2 resources with high utilization to generate alerts
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 95, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    const report = await svc.generateReport('Report', 't1');
    expect(report.summary.warningCount).toBeGreaterThanOrEqual(1);
    expect(report.summary.criticalCount).toBeGreaterThanOrEqual(1);
    expect(report.summary.totalResources).toBeGreaterThanOrEqual(2);
  });

  it('should include alerts and forecasts lists in the report', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');
    await svc.generateForecast('t1');

    const report = await svc.generateReport('Report', 't1');
    expect(report.alerts.length).toBeGreaterThanOrEqual(1);
    expect(report.forecasts.length).toBeGreaterThanOrEqual(1);
  });

  it('should store the report for later retrieval', async () => {
    const svc = new CapacityService();
    const report = await svc.generateReport('Report', 't1');

    const retrieved = await svc.getReport(report.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.title).toBe('Report');
  });
});

// ---------------------------------------------------------------------------
// listReports
// ---------------------------------------------------------------------------
describe('listReports', () => {
  it('should return empty array when no reports exist', async () => {
    const svc = new CapacityService();
    const result = await svc.listReports('t1');
    expect(result).toEqual([]);
  });

  it('should only return reports for the specified tenant', async () => {
    const svc = new CapacityService();
    await svc.generateReport('Report A', 't1');
    await svc.generateReport('Report B', 't2');

    const result = await svc.listReports('t1');
    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe('t1');
  });

  it('should sort reports by generatedAt descending', async () => {
    const svc = new CapacityService();
    await svc.generateReport('Report 1', 't1');
    await new Promise((r) => setTimeout(r, 10));
    await svc.generateReport('Report 2', 't1');

    const result = await svc.listReports('t1');
    expect(result).toHaveLength(2);
    expect(result[0].generatedAt >= result[1].generatedAt).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getReport
// ---------------------------------------------------------------------------
describe('getReport', () => {
  it('should return a report by id', async () => {
    const svc = new CapacityService();
    const created = await svc.generateReport('Test Report', 't1');

    const found = await svc.getReport(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.title).toBe('Test Report');
  });

  it('should return undefined for non-existent report', async () => {
    const svc = new CapacityService();
    const found = await svc.getReport('non-existent-id');
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// analyzeBottlenecks
// ---------------------------------------------------------------------------
describe('analyzeBottlenecks', () => {
  it('should return empty array when no metrics exist', async () => {
    const svc = new CapacityService();
    const result = await svc.analyzeBottlenecks('t1');
    expect(result).toEqual([]);
  });

  it('should skip metrics with utilization < 50%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 30, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result).toEqual([]);
  });

  it('should include metrics with utilization >= 50%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 65, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result).toHaveLength(1);
    expect(result[0].resourceId).toBe('vm-1');
    expect(result[0].utilization).toBe(65);
  });

  it('should classify impact as high for utilization >= 80%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].impact).toBe('high');
  });

  it('should classify impact as medium for utilization >= 60% and < 80%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 70, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].impact).toBe('medium');
  });

  it('should classify impact as low for utilization >= 50% and < 60%', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 55, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].impact).toBe('low');
  });

  it('should recommend CPU scaling for high cpu utilization', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].recommendation).toContain('CPU');
  });

  it('should recommend memory investigation for high memory utilization', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'memory', currentValue: 85, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].recommendation).toContain('内存');
  });

  it('should recommend disk cleanup for high disk utilization', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 85, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].recommendation).toContain('磁盘');
  });

  it('should recommend IOPS optimization for high iops utilization', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'iops', currentValue: 85, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].recommendation).toContain('SSD');
  });

  it('should provide generic recommendation for other metric types', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'network', resourceId: 'nic-1', metricName: 'throughput', currentValue: 85, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].recommendation).toContain('throughput');
  });

  it('should provide generic recommendation for low/medium utilization', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 55, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result[0].recommendation).toContain('cpu');
  });

  it('should sort bottlenecks by utilization descending', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 60, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'memory', currentValue: 90, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 75, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result).toHaveLength(3);
    expect(result[0].utilization).toBe(90);
    expect(result[1].utilization).toBe(75);
    expect(result[2].utilization).toBe(60);
  });

  it('should only analyze latest metrics (not old ones)', async () => {
    const svc = new CapacityService();
    // Record old low metric then new high metric for same resource
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 40, maxValue: 100, unit: '%' }, 't1');
    await new Promise((r) => setTimeout(r, 10));
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 90, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result).toHaveLength(1);
    expect(result[0].utilization).toBe(90);
    expect(result[0].impact).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Edge cases & cross-method integration
// ---------------------------------------------------------------------------
describe('edge cases and integration', () => {
  it('should handle multiple tenants independently', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 'tenant-a');
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-2', metricName: 'cpu', currentValue: 30, maxValue: 100, unit: '%' }, 'tenant-b');

    await svc.generateForecast('tenant-a');

    const alertsA = await svc.listAlerts('tenant-a');
    const alertsB = await svc.listAlerts('tenant-b');

    expect(alertsA.length).toBeGreaterThanOrEqual(1);
    expect(alertsB).toHaveLength(0);
  });

  it('should handle empty tenantId gracefully', async () => {
    const svc = new CapacityService();
    const metrics = await svc.listMetrics('');
    expect(metrics).toEqual([]);
  });

  it('should correctly handle full workflow: record -> forecast -> report', async () => {
    const svc = new CapacityService();

    // Record metrics
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 85, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 95, maxValue: 100, unit: '%' }, 't1');

    // Generate forecasts (also creates alerts)
    const forecasts = await svc.generateForecast('t1');
    expect(forecasts.length).toBe(2);

    // Generate report
    const report = await svc.generateReport('Integration Test Report', 't1');
    expect(report.summary.totalResources).toBeGreaterThanOrEqual(2);
    expect(report.alerts.length).toBeGreaterThanOrEqual(2);
    expect(report.forecasts.length).toBe(2);

    // Verify report is stored
    const reports = await svc.listReports('t1');
    expect(reports.length).toBeGreaterThanOrEqual(1);
    expect(reports[0].title).toBe('Integration Test Report');
  });

  it('should handle bottleneck analysis with no qualifying metrics', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 10, maxValue: 100, unit: '%' }, 't1');
    await svc.recordMetric({ resourceType: 'storage', resourceId: 'disk-1', metricName: 'disk', currentValue: 20, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.analyzeBottlenecks('t1');
    expect(result).toEqual([]);
  });

  it('should handle forecast with zero utilization', async () => {
    const svc = new CapacityService();
    await svc.recordMetric({ resourceType: 'compute', resourceId: 'vm-1', metricName: 'cpu', currentValue: 0, maxValue: 100, unit: '%' }, 't1');

    const result = await svc.generateForecast('t1');
    expect(result).toHaveLength(1);
    expect(result[0].currentUtilization).toBe(0);
    expect(result[0].forecast30Days).toBe(0);
    expect(result[0].forecast90Days).toBe(0);
  });
});
