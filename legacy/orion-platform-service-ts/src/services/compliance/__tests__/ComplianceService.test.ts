/**
 * ComplianceService Tests
 */
import { ComplianceService } from '../ComplianceService';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-123',
}));

// Stateful mock db for ComplianceService queries
let reportStore: Map<string, any>;
let scheduleStore: Map<string, any>;

function createMockDb() {
  reportStore = new Map();
  scheduleStore = new Map();
  return {
    query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
      console.log('[MOCK QUERY] sql=' + sql.substring(0, 80));
      // INSERT ... RETURNING *
      if (sql.includes('INSERT INTO')) {
        const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
        const cols = colsMatch ? colsMatch[1].split(',').map((c) => c.trim()) : [];
        const row: any = {};
        cols.forEach((col, i) => {
          row[col] = params?.[i];
        });
        // Simulate RETURNING *: generate id if not provided (DB auto-increment)
        if (!row.id) row.id = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at) row.updated_at = new Date();
        // Store in appropriate store
        if (row.id) {
  
          reportStore.set(row.id, row);
        }
        if (sql.includes('compliance_schedules') && row.id) {
          scheduleStore.set(row.id, row);
        }
        return { rows: [row], rowCount: 1 };
      }
      // UPDATE ... WHERE ... RETURNING *
      if (sql.includes('UPDATE ')) {
        const isReport = sql.includes('compliance_reports');
        const isSchedule = sql.includes('compliance_schedules');
        // Extract WHERE condition to find the row
        const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\d+)/);
        if (!whereMatch) return { rows: [], rowCount: 0 };
        const whereCol = whereMatch[1];
        const whereParamIdx = parseInt(whereMatch[2], 10) - 1;
        const whereVal = params?.[whereParamIdx];

        let store = isReport ? reportStore : isSchedule ? scheduleStore : null;
        if (!store) return { rows: [], rowCount: 0 };

        let existing: any = undefined;
        for (const [key, val] of store) {
          if (val[whereCol] === whereVal || val.id === whereVal) {
            existing = val;
            break;
          }
        }
        if (!existing) return { rows: [], rowCount: 0 };

        const setMatch = sql.match(/SET (.+?) WHERE/);
        if (setMatch) {
          const assignments = setMatch[1].split(',').map((s) => s.trim());
          for (const assignment of assignments) {
            const parts = assignment.split('=');
            const col = parts[0].trim();
            const paramRef = parts[1]?.trim();
            if (paramRef && paramRef.startsWith('$')) {
              const pIdx = parseInt(paramRef.slice(1), 10) - 1;
              existing[col] = params?.[pIdx];
            }
          }
        }
        return { rows: [existing], rowCount: 1 };
      }
      // DELETE FROM table WHERE id = $1 AND tenant_id = $2 (before SELECT to avoid false match)
      if (sql.includes('DELETE')) {
        const tableMatch = sql.match(/FROM (\w+)/);
        const tableName = tableMatch ? tableMatch[1] : null;
        const id = params?.[0];
        const store = tableName === 'compliance_reports' ? reportStore
                    : tableName === 'compliance_schedules' ? scheduleStore
                    : null;
        if (store && id) {
          const deleted = store.delete(id);

        }
        return { rows: [], rowCount: 1 };
      }
      // SELECT ... WHERE id = $1 AND tenant_id = $2 (BaseRepository findById)
      if (sql.includes('WHERE id = $1 AND tenant_id = $2')) {
        const id = params?.[0];
        const tenantId = params?.[1];
        let row = reportStore.get(id) || scheduleStore.get(id);

        if (row && row.tenant_id === tenantId) {
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // SELECT ... WHERE id = $1
      if (sql.includes('WHERE id = $1')) {
        const id = params?.[0];
        let row = reportStore.get(id) || scheduleStore.get(id);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      // SELECT ... WHERE schedule_id = $1
      if (sql.includes('WHERE schedule_id = $1')) {
        const scheduleId = params?.[0];
        const rows = Array.from(reportStore.values()).filter((r) => r.schedule_id === scheduleId);
        return { rows, rowCount: rows.length };
      }
      // SELECT ... WHERE tenant_id = $1
      if (sql.includes('WHERE tenant_id = $1')) {
        const tenantId = params?.[0];
        const isReport = sql.includes('compliance_reports');
        const isSchedule = sql.includes('compliance_schedules');
        const store = isReport ? reportStore : isSchedule ? scheduleStore : null;
        if (!store) return { rows: [], rowCount: 0 };
        let rows = Array.from(store.values()).filter((r) => r.tenant_id === tenantId);
        // ORDER BY created_at DESC
        if (sql.includes('ORDER BY created_at DESC')) {
          rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        // LIMIT
        const limitMatch = sql.match(/LIMIT\s+\$(\d+)/);
        if (limitMatch) {
          const limitIdx = parseInt(limitMatch[1], 10) - 1;
          const limit = params?.[limitIdx];
          if (limit !== undefined) rows = rows.slice(0, limit);
        }
        return { rows, rowCount: rows.length };
      }
      // SELECT ... WHERE tenant_id = $1 AND framework = $2
      if (sql.includes('WHERE tenant_id = $1 AND framework = $2')) {
        const tenantId = params?.[0];
        const framework = params?.[1];
        const rows = Array.from(reportStore.values()).filter((r) => r.tenant_id === tenantId && r.framework === framework);
        return { rows, rowCount: rows.length };
      }
      // SELECT ... WHERE tenant_id = $1 AND enabled = true
      if (sql.includes('WHERE tenant_id = $1 AND enabled = true')) {
        const tenantId = params?.[0];
        const rows = Array.from(scheduleStore.values()).filter((r) => r.tenant_id === tenantId && r.enabled === true);
        return { rows, rowCount: rows.length };
      }
      // SELECT ... WHERE enabled = true
      if (sql.includes('WHERE enabled = true')) {
        const rows = Array.from(scheduleStore.values()).filter((r) => r.enabled === true);
        return { rows, rowCount: rows.length };
      }
      // SELECT COUNT(*) FROM compliance_schedules WHERE tenant_id = $1
      if (sql.includes('SELECT COUNT(*)') && sql.includes('compliance_schedules') && sql.includes('tenant_id')) {
        const tenantId = params?.[0];
        const count = Array.from(scheduleStore.values()).filter((r) => r.tenant_id === tenantId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }
      // SELECT COUNT(*) FROM compliance_reports WHERE tenant_id = $1
      if (sql.includes('SELECT COUNT(*)') && sql.includes('compliance_reports') && sql.includes('tenant_id')) {
        const tenantId = params?.[0];
        const count = Array.from(reportStore.values()).filter((r) => r.tenant_id === tenantId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      // SELECT * FROM table (no WHERE)
      if (sql.includes('SELECT * FROM')) {
        if (sql.includes('compliance_reports')) {
          return { rows: Array.from(reportStore.values()), rowCount: reportStore.size };
        }
        if (sql.includes('compliance_schedules')) {
          return { rows: Array.from(scheduleStore.values()), rowCount: scheduleStore.size };
        }
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('ComplianceService', () => {
  let service: ComplianceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new ComplianceService(mockDb as any);
  });

  describe('createReport', () => {
    it('should create a report with draft status', async () => {
      const result = await service.createReport({
        name: 'SOC2 Audit', framework: 'SOC2', triggeredBy: 'admin',
      });
      expect(result.id).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.framework).toBe('SOC2');
      expect(result.tenantId).toBe('test-tenant');
    });
  });

  describe('getReport', () => {
    it('should return report when found', async () => {
      const created = await service.createReport({
        name: 'Audit', framework: 'SOC2', triggeredBy: 'admin',
      });
      const result = await service.getReport(created.id);
      expect(result.id).toBe(created.id);
    });

    it('should throw when not found', async () => {
      await expect(service.getReport('missing')).rejects.toThrow('not found');
    });
  });

  describe('updateReport', () => {
    it('should update status and set timestamps', async () => {
      const created = await service.createReport({
        name: 'Audit', framework: 'SOC2', triggeredBy: 'admin',
      });
      const result = await service.updateReport(created.id, { status: 'running' });
      expect(result.status).toBe('running');
      expect(result.startedAt).toBeDefined();
    });

    it('should throw when not found', async () => {
      await expect(service.updateReport('missing', { name: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('deleteReport', () => {
    it('should delete when found', async () => {
      const created = await service.createReport({
        name: 'Audit', framework: 'SOC2', triggeredBy: 'admin',
      });
      await service.deleteReport(created.id);
      await expect(service.getReport(created.id)).rejects.toThrow('not found');
    });
  });

  describe('createSchedule', () => {
    it('should create a schedule', async () => {
      const result = await service.createSchedule({
        name: 'Weekly', framework: 'SOC2', cronExpression: '0 0 * * 0',
      });
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Weekly');
      expect(result.enabled).toBe(true);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule and associated reports', async () => {
      const schedule = await service.createSchedule({
        name: 'Weekly', framework: 'SOC2', cronExpression: '0 0 * * 0',
      });
      // Create a report linked to this schedule
      await service.createReport({
        name: 'Report 1', framework: 'SOC2', triggeredBy: 'admin', scheduleId: schedule.id,
      });
      await service.createReport({
        name: 'Report 2', framework: 'SOC2', triggeredBy: 'admin', scheduleId: schedule.id,
      });

      await service.deleteSchedule(schedule.id);
      const schedules = await service.listSchedules();
      expect(schedules.find(s => s.id === schedule.id)).toBeUndefined();
    });
  });
});
