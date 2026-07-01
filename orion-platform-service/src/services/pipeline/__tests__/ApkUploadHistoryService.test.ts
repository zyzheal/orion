/**
 * ApkUploadHistoryService Unit Tests
 */

import { ApkUploadHistoryService, ApkUploadRecordCreateInput } from '../ApkUploadHistoryService';

/**
 * Create an in-memory mock DB that simulates PostgreSQL query behavior
 * for the ApkUploadRepository patterns.
 */
function createMockDb() {
  const store: Record<string, any[]> = {};

  function getTable(name: string): any[] {
    if (!store[name]) store[name] = [];
    return store[name];
  }

  function matchWhere(rows: any[], whereClause: string, params: any[]): any[] {
    // Split by AND (simple parsing)
    const conditions = whereClause.split(/\s+AND\s+/i);
    for (const cond of conditions) {
      const trimmed = cond.trim();
      // column = 'literal' (supports plain columns only)
      const litMatch = trimmed.match(/^(\w+)\s*=\s*'([^']*)'$/);
      if (litMatch) {
        rows = rows.filter(r => String(r[litMatch[1]]) === litMatch[2]);
        continue;
      }
      // column = $N (supports plain columns only)
      const paramMatch = trimmed.match(/^(\w+)\s*=\s*\$(\d+)$/);
      if (paramMatch) {
        const val = params[parseInt(paramMatch[2]) - 1];
        rows = rows.filter(r => String(r[paramMatch[1]]) === String(val));
        continue;
      }
      // metadata->>'field' = $N (JSONB extraction)
      const jsonParamMatch = trimmed.match(/^\w+\s*->>'(\w+)'?\s*=\s*\$(\d+)$/);
      if (jsonParamMatch) {
        const jsonField = jsonParamMatch[1];
        const val = params[parseInt(jsonParamMatch[2]) - 1];
        rows = rows.filter(r => {
          const meta = r.metadata;
          if (typeof meta === 'string') {
            try { return JSON.parse(meta)[jsonField] === String(val); } catch { return false; }
          }
          if (typeof meta === 'object' && meta !== null) {
            return String(meta[jsonField]) === String(val);
          }
          return false;
        });
        continue;
      }
      // metadata->>'field' = 'literal'
      const jsonObjLitMatch = trimmed.match(/^\w+\s*->>'(\w+)'?\s*=\s*'([^']*)'$/);
      if (jsonObjLitMatch) {
        const jsonField = jsonObjLitMatch[1];
        const val = jsonObjLitMatch[2];
        rows = rows.filter(r => {
          const meta = r.metadata;
          if (typeof meta === 'string') {
            try { return JSON.parse(meta)[jsonField] === val; } catch { return false; }
          }
          if (typeof meta === 'object' && meta !== null) {
            return String(meta[jsonField]) === String(val);
          }
          return false;
        });
        continue;
      }
    }
    return rows;
  }

  return {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      const norm = sql.trim();

      // INSERT INTO ... RETURNING *
      if (/^INSERT\s+INTO/i.test(norm)) {
        const m = norm.match(/INSERT\s+INTO\s+(\w+)\s+\(([^)]+)\)\s+VALUES\s+\(([^)]+)\)\s+RETURNING\s+\*/i);
        if (m) {
          const table = m[1];
          const cols = m[2].split(',').map(c => c.trim());
          const row: any = {};
          cols.forEach((col, i) => { row[col] = params[i] ?? null; });
          if (!row.created_at) row.created_at = new Date();
          if (!row.updated_at) row.updated_at = new Date();
          getTable(table).push(row);
          return { rows: [row], rowCount: 1 };
        }
      }

      // UPDATE ... SET ... WHERE id = $N RETURNING *
      if (/^UPDATE/i.test(norm)) {
        const m = norm.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\$(\d+)\s+RETURNING\s+\*/i);
        if (m) {
          const table = m[1];
          const setClause = m[2];
          const idParamIdx = parseInt(m[3]) - 1;
          const idVal = params[idParamIdx];
          const rows = getTable(table);
          const idx = rows.findIndex(r => r.id === idVal);
          if (idx >= 0) {
            const assignments = setClause.split(',');
            for (const a of assignments) {
              const [colPart, valPart] = a.split('=').map(s => s.trim());
              const col = colPart;
              if (valPart && valPart.startsWith('$')) {
                const pIdx = parseInt(valPart.slice(1)) - 1;
                if (pIdx >= 0 && pIdx < params.length) rows[idx][col] = params[pIdx];
              } else if (/NOW\(\)/i.test(valPart)) {
                rows[idx][col] = new Date();
              }
            }
            rows[idx].updated_at = new Date();
            return { rows: [rows[idx]], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
      }

      // SELECT COUNT(*) ... GROUP BY status
      if (/GROUP\s+BY/i.test(norm)) {
        const m = norm.match(/SELECT\s+status,\s*COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)\s+WHERE\s+(.+?)\s+GROUP\s+BY\s+status/i);
        if (m) {
          const rows = matchWhere([...getTable(m[1])], m[2], params);
          const groups: Record<string, number> = {};
          for (const r of rows) groups[r.status] = (groups[r.status] || 0) + 1;
          return { rows: Object.entries(groups).map(([status, count]) => ({ status, count: String(count) })), rowCount: Object.keys(groups).length };
        }
      }

      // SELECT COUNT(*) ... (no group by)
      if (/^SELECT\s+COUNT/i.test(norm)) {
        const m = norm.match(/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)\s+WHERE\s+(.*)/i);
        if (m) {
          const rows = matchWhere([...getTable(m[1])], m[2], params);
          return { rows: [{ count: String(rows.length) }], rowCount: 1 };
        }
      }

      // SELECT * FROM ... WHERE ...
      if (/^SELECT/i.test(norm)) {
        const m = norm.match(/SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+([\s\S]*)/i);
        if (m) {
          const table = m[1];
          let rest = m[2].trim();
          let limit: number | null = null;
          let offset: number | null = null;
          let orderByDesc = false;

          // Strip ORDER BY
          const obMatch = rest.match(/^(.*?)\s+ORDER\s+BY\s+(\w+)(\s+DESC)?(.*)$/i);
          if (obMatch) {
            rest = obMatch[1].trim();
            orderByDesc = !!obMatch[3];
            const afterOrder = obMatch[4].trim();
            // Parse LIMIT / OFFSET from the rest after ORDER BY
            const limMatch = afterOrder.match(/LIMIT\s+\$(\d+)(?:\s+OFFSET\s+\$(\d+))?/i);
            if (limMatch) {
              limit = params[parseInt(limMatch[1]) - 1];
              if (limMatch[2]) offset = params[parseInt(limMatch[2]) - 1];
            }
          } else {
            // No ORDER BY, check for LIMIT in the where clause
            const limMatch2 = rest.match(/^(.*?)\s+LIMIT\s+\$(\d+)(?:\s+OFFSET\s+\$(\d+))?$/i);
            if (limMatch2) {
              rest = limMatch2[1].trim();
              limit = params[parseInt(limMatch2[2]) - 1];
              if (limMatch2[3]) offset = params[parseInt(limMatch2[3]) - 1];
            }
          }

          let rows = matchWhere([...getTable(table)], rest, params);

          if (orderByDesc) {
            rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          }

          if (limit !== null) {
            const off = offset || 0;
            rows = rows.slice(off, off + limit);
          }

          return { rows, rowCount: rows.length };
        }
      }

      // DELETE FROM ... WHERE ...
      if (/^DELETE/i.test(norm)) {
        const m = norm.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\$(\d+)/i);
        if (m) {
          const table = m[1];
          const col = m[2];
          const val = params[parseInt(m[3]) - 1];
          const rows = getTable(table);
          const before = rows.length;
          store[table] = rows.filter(r => r[col] !== val);
          return { rows: [], rowCount: before - store[table].length };
        }
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('ApkUploadHistoryService', () => {
  let service: ApkUploadHistoryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new ApkUploadHistoryService(mockDb);
  });

  const createInput: ApkUploadRecordCreateInput = {
    tenantId: 'tenant-1',
    market: 'huawei',
    packageName: 'com.example.app',
    apkPath: '/path/app.apk',
    status: 'pending',
  };

  // ==================== create ====================

  describe('create', () => {
    it('should create a record', async () => {
      const record = await service.create(createInput);

      expect(record.id).toMatch(/^apk-upload-/);
      expect(record.tenantId).toBe('tenant-1');
      expect(record.market).toBe('huawei');
      expect(record.packageName).toBe('com.example.app');
      expect(record.status).toBe('pending');
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', async () => {
      const r1 = await service.create(createInput);
      const r2 = await service.create(createInput);

      expect(r1.id).not.toBe(r2.id);
    });

    it('should store optional fields', async () => {
      const input: ApkUploadRecordCreateInput = {
        ...createInput,
        pipelineRunId: 'run-1',
        pipelineId: 'pipe-1',
        pipelineName: 'Build Pipeline',
        versionName: '1.0.0',
        versionCode: 100,
        uploadUrl: 'https://example.com',
        uploadId: 'upload-1',
        durationMs: 5000,
        progress: 100,
      };

      const record = await service.create(input);

      expect(record.pipelineRunId).toBe('run-1');
      expect(record.pipelineId).toBe('pipe-1');
      expect(record.pipelineName).toBe('Build Pipeline');
      expect(record.versionName).toBe('1.0.0');
      expect(record.versionCode).toBe(100);
      expect(record.uploadUrl).toBe('https://example.com');
      expect(record.uploadId).toBe('upload-1');
      expect(record.durationMs).toBe(5000);
      expect(record.progress).toBe(100);
    });

    it('should persist to repository when db provided', async () => {
      const db2 = createMockDb();
      const svc = new ApkUploadHistoryService(db2);
      const record = await svc.create(createInput);

      expect(record).toBeDefined();
      expect(record.id).toMatch(/^apk-upload-/);
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update an existing record', async () => {
      const created = await service.create(createInput);

      const updated = await service.update(created.id, {
        status: 'uploading',
        progress: 50,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('uploading');
      expect(updated!.progress).toBe(50);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should return null for non-existent record', async () => {
      const result = await service.update('nonexistent', { status: 'failed' });

      expect(result).toBeNull();
    });

    it('should preserve unmodified fields', async () => {
      const created = await service.create(createInput);

      const updated = await service.update(created.id, { progress: 75 });

      expect(updated!.tenantId).toBe('tenant-1');
      expect(updated!.market).toBe('huawei');
      expect(updated!.packageName).toBe('com.example.app');
    });
  });

  // ==================== findById ====================

  describe('findById', () => {
    it('should find a record by ID', async () => {
      const created = await service.create(createInput);

      const found = await service.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findById('nonexistent');

      expect(found).toBeNull();
    });
  });

  // ==================== findByIdAndTenant ====================

  describe('findByIdAndTenant', () => {
    it('should find a record by ID and tenant', async () => {
      const created = await service.create(createInput);

      const found = await service.findByIdAndTenant(created.id, 'tenant-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null when tenant does not match', async () => {
      const created = await service.create(createInput);

      const found = await service.findByIdAndTenant(created.id, 'wrong-tenant');

      expect(found).toBeNull();
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findByIdAndTenant('nonexistent', 'tenant-1');

      expect(found).toBeNull();
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    it('should find records by tenant', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const records = await service.findByTenant('tenant-1');

      expect(records).toHaveLength(2);
    });

    it('should return empty for different tenant', async () => {
      await service.create(createInput);

      const records = await service.findByTenant('other-tenant');

      expect(records).toHaveLength(0);
    });

    it('should sort by createdAt descending', async () => {
      const r1 = await service.create(createInput);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
      const r2 = await service.create({ ...createInput, market: 'xiaomi' });

      const records = await service.findByTenant('tenant-1');

      expect(records[0].id).toBe(r2.id);
      expect(records[1].id).toBe(r1.id);
    });

    it('should filter by market', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const records = await service.findByTenant('tenant-1', { market: 'huawei' });

      expect(records).toHaveLength(1);
      expect(records[0].market).toBe('huawei');
    });

    it('should filter by status', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, status: 'failed' });

      const records = await service.findByTenant('tenant-1', { status: 'pending' });

      expect(records).toHaveLength(1);
    });

    it('should apply limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ ...createInput, market: `market-${i}` });
      }

      const page1 = await service.findByTenant('tenant-1', { limit: 2, offset: 0 });
      const page2 = await service.findByTenant('tenant-1', { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should use default limit of 50', async () => {
      for (let i = 0; i < 55; i++) {
        await service.create({ ...createInput, market: `market-${i}` });
      }

      const records = await service.findByTenant('tenant-1');

      expect(records).toHaveLength(50);
    });
  });

  // ==================== findByPipelineRun ====================

  describe('findByPipelineRun', () => {
    it('should find records by pipeline run ID', async () => {
      await service.create({ ...createInput, pipelineRunId: 'run-1' });
      await service.create({ ...createInput, pipelineRunId: 'run-1', market: 'xiaomi' });
      await service.create({ ...createInput, pipelineRunId: 'run-2' });

      const records = await service.findByPipelineRun('run-1');

      expect(records).toHaveLength(2);
    });

    it('should return empty for non-existent run', async () => {
      const records = await service.findByPipelineRun('nonexistent');

      expect(records).toHaveLength(0);
    });

    it('should sort by createdAt descending', async () => {
      await service.create({ ...createInput, pipelineRunId: 'run-1' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await service.create({ ...createInput, pipelineRunId: 'run-1', market: 'xiaomi' });

      const records = await service.findByPipelineRun('run-1');

      expect(records[0].market).toBe('xiaomi');
    });
  });

  // ==================== countByTenant ====================

  describe('countByTenant', () => {
    it('should count records for a tenant', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const count = await service.countByTenant('tenant-1');

      expect(count).toBe(2);
    });

    it('should count with market filter', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, market: 'xiaomi' });

      const count = await service.countByTenant('tenant-1', { market: 'huawei' });

      expect(count).toBe(1);
    });

    it('should count with status filter', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, status: 'failed' });

      const count = await service.countByTenant('tenant-1', { status: 'pending' });

      expect(count).toBe(1);
    });

    it('should return 0 for non-existent tenant', async () => {
      await service.create(createInput);

      const count = await service.countByTenant('other-tenant');

      expect(count).toBe(0);
    });
  });

  // ==================== getRecentFailures ====================

  describe('getRecentFailures', () => {
    it('should return failed records', async () => {
      await service.create(createInput);
      await service.create({ ...createInput, status: 'failed', error: 'Network error' });

      const failures = await service.getRecentFailures('tenant-1');

      expect(failures).toHaveLength(1);
      expect(failures[0].status).toBe('failed');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ ...createInput, status: 'failed', error: `Error ${i}` });
      }

      const failures = await service.getRecentFailures('tenant-1', 3);

      expect(failures).toHaveLength(3);
    });

    it('should use default limit of 10', async () => {
      for (let i = 0; i < 15; i++) {
        await service.create({ ...createInput, status: 'failed' });
      }

      const failures = await service.getRecentFailures('tenant-1');

      expect(failures).toHaveLength(10);
    });

    it('should sort by createdAt descending', async () => {
      await service.create({ ...createInput, status: 'failed', error: 'First' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await service.create({ ...createInput, status: 'failed', error: 'Second' });

      const failures = await service.getRecentFailures('tenant-1');

      expect(failures[0].error).toBe('Second');
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats grouped by status', async () => {
      await service.create(createInput); // pending
      await service.create({ ...createInput, status: 'published' });
      await service.create({ ...createInput, status: 'failed' });
      await service.create({ ...createInput, status: 'uploading' });
      await service.create({ ...createInput, status: 'submitted' });

      const stats = await service.getStats('tenant-1');

      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1);
      expect(stats.published).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.uploading).toBe(1);
      expect(stats.submitted).toBe(1);
    });

    it('should return zeroed stats for empty tenant', async () => {
      const stats = await service.getStats('empty-tenant');

      expect(stats.total).toBe(0);
      expect(stats.published).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.uploading).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.submitted).toBe(0);
    });
  });
});
