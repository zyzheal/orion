/**
 * CapacityService - Capacity Planning Unit Tests
 *
 * Coverage: recordMetric, listMetrics, getLatestMetrics, generateForecast,
 *           listForecasts, listAlerts, deleteAlert, generateReport,
 *           listReports, getReport, analyzeBottlenecks
 *
 * Migrated to mock PostgreSQL Repository pattern (2026-06-26)
 */

import { CapacityService } from '../CapacityService';

// In-memory mock db that simulates PostgreSQL queries
function createMockDb() {
  const tables: Record<string, any[]> = {
    capacity_metrics: [],
    capacity_forecasts: [],
    capacity_alerts: [],
    capacity_reports: [],
  };

  const db = {
    async query(text: string, params: unknown[] = []) {
      const sql = text.trim();

      // INSERT
      if (sql.startsWith('INSERT INTO')) {
        const match = sql.match(/INSERT INTO (\w+)/);
        if (!match) return { rows: [], rowCount: 0 };
        const table = match[1];
        const row: any = {};
        // Parse columns from INSERT INTO table (col1, col2, ...) VALUES (...)
        const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
        if (colMatch) {
          const cols = colMatch[1].split(',').map(c => c.trim());
          cols.forEach((col, i) => {
            row[col] = params[i] ?? null;
          });
        }
        // Auto-add timestamp columns if not present (mimics DEFAULT NOW())
        if (!row.created_at) row.created_at = new Date();
        if (!row.generated_at && (table === 'capacity_forecasts' || table === 'capacity_reports')) {
          row.generated_at = new Date();
        }
        // Handle RETURNING
        if (sql.includes('RETURNING *')) {
          tables[table].push(row);
          return { rows: [row], rowCount: 1 };
        }
        tables[table].push(row);
        return { rows: [row], rowCount: 1 };
      }

      // SELECT COUNT
      if (sql.startsWith('SELECT COUNT')) {
        const match = sql.match(/FROM (\w+)/);
        if (!match) return { rows: [{ count: '0' }], rowCount: 1 };
        const table = match[1];
        let rows = tables[table] || [];
        // Apply WHERE
        if (sql.includes('WHERE') && params.length > 0) {
          rows = rows.filter(r => r.tenant_id === params[0]);
        }
        return { rows: [{ count: String(rows.length) }], rowCount: 1 };
      }

      // SELECT DISTINCT ON
      if (sql.includes('DISTINCT ON')) {
        const match = sql.match(/FROM (\w+)/);
        if (!match) return { rows: [], rowCount: 0 };
        const table = match[1];
        let rows = [...(tables[table] || [])];
        // Filter by tenant_id
        if (params.length > 0) {
          rows = rows.filter(r => r.tenant_id === params[0]);
        }
        // Deduplicate by resource_type, resource_id, metric_name
        const seen = new Set<string>();
        const deduped: any[] = [];
        for (const r of rows) {
          const key = `${r.resource_type}:${r.resource_id}:${r.metric_name}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(r);
          }
        }
        return { rows: deduped, rowCount: deduped.length };
      }

      // SELECT by id (must come before SELECT * to avoid false match)
      if (sql.startsWith('SELECT') && sql.includes('WHERE id =')) {
        const match = sql.match(/FROM (\w+)/);
        if (!match) return { rows: [], rowCount: 0 };
        const table = match[1];
        const row = (tables[table] || []).find(r => r.id === params[0]);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      // SELECT *
      if (sql.startsWith('SELECT *')) {
        const match = sql.match(/FROM (\w+)/);
        if (!match) return { rows: [], rowCount: 0 };
        const table = match[1];
        let rows = [...(tables[table] || [])];
        // Apply WHERE conditions
        if (sql.includes('WHERE') && params.length > 0) {
          rows = rows.filter(r => r.tenant_id === params[0]);
          let paramIdx = 1;
          if (sql.includes('resource_type') && params[paramIdx]) {
            rows = rows.filter(r => r.resource_type === params[paramIdx]);
            paramIdx++;
          }
          if (sql.includes('metric_name') && params[paramIdx]) {
            rows = rows.filter(r => r.metric_name === params[paramIdx]);
            paramIdx++;
          }
          if (sql.includes('severity') && params[paramIdx]) {
            rows = rows.filter(r => r.severity === params[paramIdx]);
          }
        }
        // ORDER BY
        if (sql.includes('ORDER BY')) {
          if (sql.includes('created_at DESC')) {
            rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          }
          if (sql.includes('generated_at DESC')) {
            rows.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
          }
        }
        // LIMIT
        const limitMatch = sql.match(/LIMIT (\d+)/);
        if (limitMatch) {
          rows = rows.slice(0, parseInt(limitMatch[1]));
        }
        return { rows, rowCount: rows.length };
      }

      // DELETE
      if (sql.startsWith('DELETE FROM')) {
        const match = sql.match(/DELETE FROM (\w+)/);
        if (!match) return { rows: [], rowCount: 0 };
        const table = match[1];
        const before = tables[table].length;
        tables[table] = tables[table].filter(r => r.id !== params[0]);
        return { rows: [], rowCount: before - tables[table].length };
      }

      return { rows: [], rowCount: 0 };
    },
  };

  return db;
}

describe('CapacityService', () => {
  let service: CapacityService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new CapacityService(mockDb as any);
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
      expect(result.size).toBe(1);
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

    it('should skip resources below 50% utilization', async () => {
      await service.recordMetric({
        resourceType: 'compute-low', resourceId: 'n-low', metricName: 'cpu-low',
        currentValue: 30, maxValue: 100, unit: '%',
      }, 't-low');

      const result = await service.analyzeBottlenecks('t-low');

      expect(result.every(b => b.resourceId !== 'n-low')).toBe(true);
    });

    it('should return empty for tenant with no metrics', async () => {
      const result = await service.analyzeBottlenecks('t-no-bottleneck');
      expect(result).toEqual([]);
    });
  });
});
