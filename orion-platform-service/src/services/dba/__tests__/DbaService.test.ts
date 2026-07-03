/**
 * DbaService - DBA Service Unit Tests
 *
 * Coverage: listOrders, getOrder, createOrder, approveOrder, rejectOrder,
 *           executeOrder, listDataSources, getDataSource, createDataSource,
 *           updateDataSource, deleteDataSource, testConnection,
 *           listAuditRules, createAuditRule, updateAuditRule
 *
 * Migrated to mock PostgreSQL Repository pattern (2026-06-26)
 */

import { DbaService } from '../DbaService';

// Mock the db-connection module to avoid real network calls in tests
jest.mock('../db-connection');

import { testDatabaseConnection } from '../db-connection';

function createMockDb() {
  const tables: Record<string, any[]> = {
    dba_sql_orders: [],
    dba_data_sources: [],
    dba_audit_rules: [],
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
        const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
        if (colMatch) {
          const cols = colMatch[1].split(',').map(c => c.trim());
          cols.forEach((col, i) => {
            row[col] = params[i] ?? null;
          });
        }
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at && (table === 'dba_data_sources' || table === 'dba_audit_rules')) {
          row.updated_at = new Date();
        }
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
        if (sql.includes('WHERE') && params.length > 0) {
          rows = rows.filter(r => r.tenant_id === params[0]);
          if (sql.includes('status') && params[1]) {
            rows = rows.filter(r => r.status === params[1]);
          }
        }
        return { rows: [{ count: String(rows.length) }], rowCount: 1 };
      }

      // SELECT by id
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
        if (sql.includes('WHERE') && params.length > 0) {
          rows = rows.filter(r => r.tenant_id === params[0]);
          if (sql.includes('status') && params[1]) {
            rows = rows.filter(r => r.status === params[1]);
          }
        }
        if (sql.includes('ORDER BY') && sql.includes('created_at DESC')) {
          rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        const limitMatch = sql.match(/LIMIT (\d+)/);
        if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));
        return { rows, rowCount: rows.length };
      }

      // UPDATE
      if (sql.startsWith('UPDATE')) {
        const match = sql.match(/UPDATE (\w+)/);
        if (!match) return { rows: [], rowCount: 0 };
        const table = match[1];
        // Parse WHERE id = $N to find the id param index
        const whereMatch = sql.match(/WHERE id = \$(\d+)/);
        const idIdx = whereMatch ? parseInt(whereMatch[1]) - 1 : 0;
        const id = params[idIdx];
        const row = (tables[table] || []).find(r => r.id === id);
        if (!row) return { rows: [], rowCount: 0 };
        // Apply SET values (simplified: parse key = $N assignments)
        const setMatch = sql.match(/SET (.+?) WHERE/);
        if (setMatch) {
          const assignments = setMatch[1].split(',').map(s => s.trim());
          for (const assignment of assignments) {
            // Handle col = $N (parameterized)
            const paramMatch = assignment.match(/(\w+)\s*=\s*\$(\d+)/);
            if (paramMatch) {
              const col = paramMatch[1];
              const paramIdx = parseInt(paramMatch[2]) - 1;
              row[col] = params[paramIdx];
              continue;
            }
            // Handle col = NOW() (timestamp functions)
            const nowMatch = assignment.match(/(\w+)\s*=\s*NOW\(\)/);
            if (nowMatch) {
              row[nowMatch[1]] = new Date();
            }
          }
        }
        return { rows: [row], rowCount: 1 };
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

describe('DbaService', () => {
  let service: DbaService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new DbaService(mockDb as any);
    (testDatabaseConnection as jest.MockedFunction<any>).mockClear();
    (testDatabaseConnection as jest.MockedFunction<any>).mockResolvedValue({
      success: true,
      message: 'Connected',
      latency: 42,
      version: 'PostgreSQL 15.4 (mock)',
      poolStats: { total: 1, idle: 1, waiting: 0 },
    });
  });

  // ==================== Orders ====================

  describe('createOrder', () => {
    it('should create a SQL order', async () => {
      const result = await service.createOrder({
        database: 'mydb',
        sql: 'SELECT 1',
        comment: 'test',
      }, 'user-1', 't-1');

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('t-1');
      expect(result.userId).toBe('user-1');
      expect(result.database).toBe('mydb');
      expect(result.sql).toBe('SELECT 1');
      expect(result.status).toBe('pending');
    });
  });

  describe('listOrders', () => {
    it('should list orders for tenant', async () => {
      await service.createOrder({ database: 'db', sql: 'SELECT 1', comment: 'c' }, 'u1', 't-list');

      const result = await service.listOrders({ tenantId: 't-list' });

      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.data.every(o => o.tenantId === 't-list')).toBe(true);
    });

    it('should return empty when no tenantId', async () => {
      const result = await service.listOrders();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getOrder', () => {
    it('should get order by id', async () => {
      const created = await service.createOrder({ database: 'db', sql: 'SELECT 1', comment: 'c' }, 'u1', 't-get');

      const result = await service.getOrder(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
    });

    it('should return undefined for non-existent order', async () => {
      const result = await service.getOrder('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('approveOrder', () => {
    it('should approve an order', async () => {
      const created = await service.createOrder({ database: 'db', sql: 'SELECT 1', comment: 'c' }, 'u1', 't-approve');

      const result = await service.approveOrder(created.id, 'admin');

      expect(result).toBeDefined();
      expect(result!.status).toBe('approved');
      expect(result!.approvedBy).toBe('admin');
    });
  });

  describe('rejectOrder', () => {
    it('should reject an order', async () => {
      const created = await service.createOrder({ database: 'db', sql: 'SELECT 1', comment: 'c' }, 'u1', 't-reject');

      const result = await service.rejectOrder(created.id);

      expect(result).toBeDefined();
      expect(result!.status).toBe('rejected');
    });
  });

  describe('executeOrder', () => {
    it('should execute an order', async () => {
      const created = await service.createOrder({ database: 'db', sql: 'SELECT 1', comment: 'c' }, 'u1', 't-exec');

      const result = await service.executeOrder(created.id);

      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
    });
  });

  // ==================== Data Sources ====================

  describe('createDataSource', () => {
    it('should create a data source', async () => {
      const result = await service.createDataSource({
        name: 'primary-db',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'mydb',
      }, 't-ds');

      expect(result.id).toBeDefined();
      expect(result.name).toBe('primary-db');
      expect(result.type).toBe('postgresql');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(5432);
      expect(result.status).toBe('offline');
    });
  });

  describe('listDataSources', () => {
    it('should list data sources for tenant', async () => {
      await service.createDataSource({
        name: 'db1', type: 'mysql', host: 'h', port: 3306, database: 'd',
      }, 't-ds-list');

      const result = await service.listDataSources('t-ds-list');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(ds => ds.name === 'db1')).toBe(true);
    });

    it('should return empty when no tenantId', async () => {
      const result = await service.listDataSources();
      expect(result).toEqual([]);
    });
  });

  describe('getDataSource', () => {
    it('should get data source by id', async () => {
      const created = await service.createDataSource({
        name: 'db1', type: 'mysql', host: 'h', port: 3306, database: 'd',
      }, 't-ds-get');

      const result = await service.getDataSource(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
    });

    it('should return undefined for non-existent', async () => {
      const result = await service.getDataSource('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateDataSource', () => {
    it('should update a data source', async () => {
      const created = await service.createDataSource({
        name: 'db1', type: 'mysql', host: 'h', port: 3306, database: 'd',
      }, 't-ds-update');

      const result = await service.updateDataSource(created.id, { name: 'db-updated' });

      expect(result).toBeDefined();
      expect(result!.name).toBe('db-updated');
    });

    it('should return undefined for non-existent', async () => {
      const result = await service.updateDataSource('non-existent', { name: 'x' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteDataSource', () => {
    it('should delete a data source', async () => {
      const created = await service.createDataSource({
        name: 'db1', type: 'mysql', host: 'h', port: 3306, database: 'd',
      }, 't-ds-delete');

      const result = await service.deleteDataSource(created.id);
      expect(result).toBe(true);

      const afterDelete = await service.getDataSource(created.id);
      expect(afterDelete).toBeUndefined();
    });

    it('should return false for non-existent', async () => {
      const result = await service.deleteDataSource('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const created = await service.createDataSource({
        name: 'db1', type: 'mysql', host: 'myhost', port: 3306, database: 'd',
      }, 't-ds-test');

      const result = await service.testConnection(created.id);

      expect(result.success).toBe(true);
      expect(result.message).toContain('myhost');
    });

    it('should fail for non-existent data source', async () => {
      const result = await service.testConnection('non-existent');
      expect(result.success).toBe(false);
    });
  });

  // ==================== Audit Rules ====================

  describe('createAuditRule', () => {
    it('should create an audit rule', async () => {
      const result = await service.createAuditRule({
        name: 'no-drop',
        pattern: 'DROP TABLE',
        severity: 'error',
      }, 't-rule');

      expect(result.id).toBeDefined();
      expect(result.name).toBe('no-drop');
      expect(result.pattern).toBe('DROP TABLE');
      expect(result.severity).toBe('error');
      expect(result.enabled).toBe(true);
    });
  });

  describe('listAuditRules', () => {
    it('should list audit rules for tenant', async () => {
      await service.createAuditRule({ name: 'r1', pattern: 'p1' }, 't-rules');

      const result = await service.listAuditRules('t-rules');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every(r => r.tenantId === 't-rules')).toBe(true);
    });

    it('should return empty when no tenantId', async () => {
      const result = await service.listAuditRules();
      expect(result).toEqual([]);
    });
  });

  describe('updateAuditRule', () => {
    it('should update an audit rule', async () => {
      const created = await service.createAuditRule({ name: 'r1', pattern: 'p1' }, 't-rule-update');

      const result = await service.updateAuditRule(created.id, { name: 'r-updated' });

      expect(result).toBeDefined();
      expect(result!.name).toBe('r-updated');
    });

    it('should return undefined for non-existent', async () => {
      const result = await service.updateAuditRule('non-existent', { name: 'x' });
      expect(result).toBeUndefined();
    });
  });
});
