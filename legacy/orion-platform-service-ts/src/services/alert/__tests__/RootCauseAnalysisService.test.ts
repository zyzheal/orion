/**
 * Tests for RootCauseAnalysisService
 */

import { RootCauseAnalysisService, RcaAlert, TimeWindow } from '../RootCauseAnalysisService';
import { AlertCorrelationService } from '../AlertCorrelationService';

/** Create a stateful in-memory mock DB for testing repositories */
function createMockDb() {
  const tables = new Map<string, Map<string, any>>();

  function getTable(name: string): Map<string, any> {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  const mock = {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      const p = params || [];

      // INSERT INTO <table> (...) VALUES (...)
      if (text.match(/INSERT\s+INTO\s+(\w+)/i)) {
        const tableMatch = text.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const columns = tableMatch[2].split(',').map((c: string) => c.trim());
          const table = getTable(tableName);
          const row: any = {};
          columns.forEach((col: string, i: number) => {
            row[col] = p[i] !== undefined ? p[i] : null;
          });
          const key = row.id || String(table.size);
          if (!row.id) row.id = key;
          table.set(key, row);
          return { rows: [row], rowCount: 1 };
        }
        // ON CONFLICT DO UPDATE (upsertDependency)
        if (text.includes('ON CONFLICT')) {
          const tableMatch = text.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            const columns = tableMatch[2].split(',').map((c: string) => c.trim());
            const table = getTable(tableName);
            const row: any = {};
            columns.forEach((col: string, i: number) => {
              row[col] = p[i] !== undefined ? p[i] : null;
            });
            const key = row.id || String(table.size);
            // Update existing or insert new
            const existing = table.get(key);
            if (existing) {
              Object.assign(existing, row);
              return { rows: [existing], rowCount: 1 };
            }
            if (!row.id) row.id = key;
            table.set(key, row);
            return { rows: [row], rowCount: 1 };
          }
        }
        return { rows: [{ id: 'mock' }], rowCount: 1 };
      }

      // SELECT ... FROM <table> WHERE id = $1
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+id\s*=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const row = table.get(p[0] as string);
          return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
      }

      // SELECT ... FROM <table> WHERE tenant_id = $1
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+\s+WHERE\s+tenant_id\s*=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values()).filter(r => r.tenant_id === p[0]);
          const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
          if (limitMatch) {
            rows = rows.slice(0, Number(p[parseInt(limitMatch[1]) - 1]) || rows.length);
          }
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT ... FROM <table> WHERE $1 = ANY(column)
      if (text.match(/WHERE\s+\$1\s*=\s*ANY/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const val = p[0] as string;
          const anyMatch = text.match(/ANY\((\w+)\)/i);
          if (anyMatch) {
            const col = anyMatch[1];
            const rows = Array.from(table.values()).filter(r => Array.isArray(r[col]) && r[col].includes(val));
            return { rows, rowCount: rows.length };
          }
        }
      }

      // SELECT ... FROM <table> WHERE deployment_id = $1
      if (text.match(/WHERE\s+deployment_id\s*=\s*\$1/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const rows = Array.from(table.values()).filter(r => r.deployment_id === p[0]);
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT ... FROM <table> WHERE ... ORDER BY ... LIMIT
      if (text.match(/SELECT\s+\*\s+FROM\s+\w+[\s\S]*ORDER\s+BY/i)) {
        const tableMatch = text.match(/SELECT\s+\*\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          let rows = Array.from(table.values());
          // Parse WHERE conditions
          const whereMatch = text.match(/WHERE\s+([\s\S]+?)\s+ORDER\s+BY/i);
          if (whereMatch) {
            const conditions = whereMatch[1].split(/\s+AND\s+/i);
            for (const cond of conditions) {
              // col >= $N
              const gteMatch = cond.match(/(\w+)\s*>=\s*\$(\d+)/i);
              if (gteMatch) {
                const col = gteMatch[1];
                const paramIdx = parseInt(gteMatch[2]) - 1;
                rows = rows.filter(r => r[col] >= p[paramIdx]);
              }
              // col = $N
              const eqMatch = cond.match(/(\w+)\s*=\s*\$(\d+)/i);
              if (eqMatch && !cond.match(/>=/)) {
                const col = eqMatch[1];
                const paramIdx = parseInt(eqMatch[2]) - 1;
                rows = rows.filter(r => r[col] === p[paramIdx]);
              }
            }
          }
          const limitMatch = text.match(/LIMIT\s+\$(\d+)/i);
          if (limitMatch) {
            rows = rows.slice(0, Number(p[parseInt(limitMatch[1]) - 1]) || rows.length);
          }
          return { rows, rowCount: rows.length };
        }
      }

      // SELECT COUNT(*) ... FROM <table>
      if (text.includes('COUNT(*)')) {
        const tableMatch = text.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          if (text.includes('SUM(count)')) {
            let totalAlerts = 0;
            for (const row of table.values()) totalAlerts += row.count || 0;
            return { rows: [{ total_groups: String(table.size), total_alerts: String(totalAlerts) }], rowCount: 1 };
          }
          return { rows: [{ count: String(table.size) }], rowCount: 1 };
        }
      }

      // DELETE FROM <table>
      if (text.match(/DELETE\s+FROM\s+(\w+)/i)) {
        const tableMatch = text.match(/DELETE\s+FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const whereMatch = text.match(/WHERE\s+(.+)$/i);
          if (whereMatch && p.length > 0) {
            if (whereMatch[1].match(/id\s*=\s*\$1/i)) {
              const deleted = table.has(p[0] as string) ? 1 : 0;
              table.delete(p[0] as string);
              return { rows: [], rowCount: deleted };
            }
            if (whereMatch[1].match(/tenant_id\s*=\s*\$1/i)) {
              let deleted = 0;
              for (const [key, row] of table.entries()) {
                if (row.tenant_id === p[0]) {
                  table.delete(key);
                  deleted++;
                }
              }
              return { rows: [], rowCount: deleted };
            }
            // deployment_id = $1
            if (whereMatch[1].match(/deployment_id\s*=\s*\$1/i)) {
              let deleted = 0;
              for (const [key, row] of table.entries()) {
                if (row.deployment_id === p[0]) {
                  table.delete(key);
                  deleted++;
                }
              }
              return { rows: [], rowCount: deleted };
            }
            // WHERE col < $1 (e.g. last_fired_at < $1)
            const ltMatch = whereMatch[1].match(/(\w+)\s*<\s*\$(\d+)/i);
            if (ltMatch) {
              const col = ltMatch[1];
              const paramIdx = parseInt(ltMatch[2]) - 1;
              const val = p[paramIdx];
              let deleted = 0;
              for (const [key, row] of table.entries()) {
                if (row[col] < val) {
                  table.delete(key);
                  deleted++;
                }
              }
              return { rows: [], rowCount: deleted };
            }
          }
          const count = table.size;
          table.clear();
          return { rows: [], rowCount: count };
        }
      }

      // UPDATE <table> SET ... WHERE id = $N
      if (text.match(/UPDATE\s+\w+\s+SET/i)) {
        const tableMatch = text.match(/UPDATE\s+(\w+)\s+SET/i);
        if (tableMatch) {
          const table = getTable(tableMatch[1]);
          const idIdx = p.length - 1;
          const id = p[idIdx] as string;
          const row = table.get(id);
          if (row) {
            const setMatch = text.match(/SET\s+(.+?)\s+WHERE/i);
            if (setMatch) {
              const assignments = setMatch[1].split(',');
              for (const assignment of assignments) {
                const assignMatch = assignment.trim().match(/(\w+)\s*=\s*\$(\d+)/i);
                if (assignMatch) {
                  const col = assignMatch[1];
                  const paramIdx = parseInt(assignMatch[2]) - 1;
                  let val = p[paramIdx];
                  // Auto-parse JSON strings (simulates PostgreSQL JSONB)
                  if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
                    try { val = JSON.parse(val); } catch {}
                  }
                  row[col] = col === 'updated_at' ? new Date() : val;
                }
                const literalMatch = assignment.trim().match(/(\w+)\s*=\s*'([^']+)'/i);
                if (literalMatch) row[literalMatch[1]] = literalMatch[2];
                if (assignment.includes('NOW()')) {
                  const colMatch = assignment.trim().match(/(\w+)\s*=\s*NOW\(\)/i);
                  if (colMatch) row[colMatch[1]] = new Date();
                }
              }
            }
            return { rows: [row], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
      }

      return { rows: [], rowCount: 0 };
    }),
  };
  return mock;
}

describe('RootCauseAnalysisService', () => {
  let service: RootCauseAnalysisService;
  let correlation: AlertCorrelationService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    correlation = new AlertCorrelationService(undefined, mockDb as any);
    service = new RootCauseAnalysisService(correlation, mockDb as any);
  });

  const timeWindow: TimeWindow = {
    startTime: new Date(Date.now() - 30 * 60 * 1000),
    endTime: new Date(),
  };

  const sampleAlerts: RcaAlert[] = [
    {
      id: 'alert-1',
      name: 'Database Connection Pool Exhausted',
      service: 'postgres-primary',
      severity: 'critical',
      firedAt: new Date(Date.now() - 60 * 1000), // 1 min ago (within correlation window)
      message: 'Connection pool exhausted',
    },
    {
      id: 'alert-2',
      name: 'API Latency High',
      service: 'api-gateway',
      severity: 'warning',
      firedAt: new Date(Date.now() - 30 * 1000), // 30 sec ago
      message: 'P99 latency > 2s',
    },
    {
      id: 'alert-3',
      name: 'User Service Timeout',
      service: 'user-service',
      severity: 'critical',
      firedAt: new Date(), // now
      message: 'Request timeout to user-service',
    },
  ];

  // ==================== analyze ====================

  describe('analyze', () => {
    it('should perform RCA on multiple alerts', async () => {
      const result = await service.analyze(
        ['postgres-primary', 'api-gateway', 'user-service'],
        sampleAlerts,
        timeWindow,
      );

      expect(result.analysisId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.alertCount).toBe(3);
      expect(result.rootCause).not.toBeNull();
      expect(result.topRootCauses.length).toBeGreaterThan(0);
    });

    it('should identify the root cause', async () => {
      const result = await service.analyze(
        ['postgres-primary', 'api-gateway'],
        sampleAlerts,
        timeWindow,
      );

      expect(result.rootCause).not.toBeNull();
      expect(result.rootCause!.confidence).toBeGreaterThan(0);
      expect(result.rootCause!.confidence).toBeLessThanOrEqual(1);
    });

    it('should list affected services', async () => {
      const result = await service.analyze(
        ['postgres-primary', 'api-gateway', 'user-service'],
        sampleAlerts,
        timeWindow,
      );

      expect(result.affectedServices.length).toBeGreaterThan(0);
      const serviceNames = result.affectedServices.map((s) => s.name);
      expect(serviceNames).toContain('postgres-primary');
    });

    it('should return partial status when no groups found', async () => {
      const result = await service.analyze([], [], timeWindow);
      expect(result.status).toBe('partial');
      expect(result.rootCause).toBeNull();
    });

    it('should store analysis result', async () => {
      const result = await service.analyze(
        ['service-a'],
        [sampleAlerts[0]],
        timeWindow,
      );

      const retrieved = await service.getAnalysis(result.analysisId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.analysisId).toBe(result.analysisId);
    });
  });

  // ==================== getCorrelatedAlerts ====================

  describe('getCorrelatedAlerts', () => {
    it('should return correlated alerts for given IDs', async () => {
      await service.analyze(
        ['postgres-primary'],
        sampleAlerts,
        timeWindow,
      );

      const correlated = await service.getCorrelatedAlerts(['alert-1', 'alert-2']);
      expect(correlated.length).toBeGreaterThan(0);
    });

    it('should return empty for non-matching IDs', async () => {
      const correlated = await service.getCorrelatedAlerts(['non-existent']);
      expect(correlated).toEqual([]);
    });
  });

  // ==================== getTopRootCauses ====================

  describe('getTopRootCauses', () => {
    beforeEach(async () => {
      // Generate some analysis data
      await service.analyze(
        ['postgres-primary', 'api-gateway', 'user-service'],
        sampleAlerts,
        timeWindow,
      );
    });

    it('should return top root causes', async () => {
      const causes = await service.getTopRootCauses('default');
      expect(Array.isArray(causes)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const causes = await service.getTopRootCauses('default', undefined, 1);
      expect(causes.length).toBeLessThanOrEqual(1);
    });

    it('should return causes sorted by confidence', async () => {
      const causes = await service.getTopRootCauses('default');
      for (let i = 1; i < causes.length; i++) {
        expect(causes[i - 1].confidence).toBeGreaterThanOrEqual(causes[i].confidence);
      }
    });

    it('should filter by time window', async () => {
      const futureWindow: TimeWindow = {
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 2000),
      };
      const causes = await service.getTopRootCauses('default', futureWindow);
      expect(causes.length).toBe(0);
    });
  });

  // ==================== getAnalysis ====================

  describe('getAnalysis', () => {
    it('should return undefined for non-existent analysis', async () => {
      const result = await service.getAnalysis('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return the analysis by ID', async () => {
      const created = await service.analyze(['svc'], [sampleAlerts[0]], timeWindow);
      const retrieved = await service.getAnalysis(created.analysisId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.analysisId).toBe(created.analysisId);
    });
  });

  // ==================== getAllAnalyses ====================

  describe('getAllAnalyses', () => {
    it('should return all analyses', async () => {
      await service.analyze(['svc1'], [sampleAlerts[0]], timeWindow);
      await service.analyze(['svc2'], [sampleAlerts[1]], timeWindow);

      const all = await service.getAllAnalyses();
      expect(all.length).toBe(2);
    });

    it('should respect limit', async () => {
      await service.analyze(['svc1'], [sampleAlerts[0]], timeWindow);
      await service.analyze(['svc2'], [sampleAlerts[1]], timeWindow);

      const limited = await service.getAllAnalyses(1);
      expect(limited.length).toBe(1);
    });
  });
});
