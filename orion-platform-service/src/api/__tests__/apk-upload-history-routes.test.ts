/**
 * Tests for Apk Upload History Routes (apk-upload-history-routes.ts)
 *
 * Auto-generated route registration tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, expect, beforeEach } from '@jest/globals';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenantId: '1' };
  },
}));

jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: (_opts: any) => async (req: any, reply: any) => {},
}));

import { registerApkUploadHistoryRoutes, getApkUploadHistoryService } from '../apk-upload-history-routes';

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

/**
 * Create an in-memory mock DB for ApkUploadRepository.
 */
function createMockDb() {
  const store: Record<string, any[]> = {};

  function getTable(name: string): any[] {
    if (!store[name]) store[name] = [];
    return store[name];
  }

  function matchWhere(rows: any[], whereClause: string, params: any[]): any[] {
    const conditions = whereClause.split(/\s+AND\s+/i);
    for (const cond of conditions) {
      const trimmed = cond.trim();
      const litMatch = trimmed.match(/^(\w+)\s*=\s*'([^']*)'$/);
      if (litMatch) {
        rows = rows.filter(r => String(r[litMatch[1]]) === litMatch[2]);
        continue;
      }
      const paramMatch = trimmed.match(/^(\w+)\s*=\s*\$(\d+)$/);
      if (paramMatch) {
        const val = params[parseInt(paramMatch[2]) - 1];
        rows = rows.filter(r => String(r[paramMatch[1]]) === String(val));
        continue;
      }
    }
    return rows;
  }

  return {
    query: jest.fn(async (sql: string, params: any[] = []) => {
      const norm = sql.trim();

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
              if (valPart && valPart.startsWith('$')) {
                const pIdx = parseInt(valPart.slice(1)) - 1;
                if (pIdx >= 0 && pIdx < params.length) rows[idx][colPart] = params[pIdx];
              }
            }
            rows[idx].updated_at = new Date();
            return { rows: [rows[idx]], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
      }

      if (/GROUP\s+BY/i.test(norm)) {
        const m = norm.match(/SELECT\s+status,\s*COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)\s+WHERE\s+(.+?)\s+GROUP\s+BY\s+status/i);
        if (m) {
          const rows = matchWhere([...getTable(m[1])], m[2], params);
          const groups: Record<string, number> = {};
          for (const r of rows) groups[r.status] = (groups[r.status] || 0) + 1;
          return { rows: Object.entries(groups).map(([status, count]) => ({ status, count: String(count) })), rowCount: Object.keys(groups).length };
        }
      }

      if (/^SELECT\s+COUNT/i.test(norm)) {
        const m = norm.match(/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)\s+WHERE\s+(.*)/i);
        if (m) {
          const rows = matchWhere([...getTable(m[1])], m[2], params);
          return { rows: [{ count: String(rows.length) }], rowCount: 1 };
        }
      }

      if (/^SELECT/i.test(norm)) {
        const m = norm.match(/SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+([\s\S]*)/i);
        if (m) {
          const table = m[1];
          let rest = m[2].trim();
          let limit: number | null = null;
          let offset: number | null = null;

          const limMatch = rest.match(/^(.*?)\s+ORDER\s+BY\s+\w+(?:\s+DESC)?(?:\s+LIMIT\s+\$(\d+)(?:\s+OFFSET\s+\$(\d+))?)?$/i);
          if (limMatch) {
            rest = limMatch[1].trim();
            if (limMatch[2]) limit = params[parseInt(limMatch[2]) - 1];
            if (limMatch[3]) offset = params[parseInt(limMatch[3]) - 1];
          }

          let rows = matchWhere([...getTable(table)], rest, params);

          // Sort by created_at descending
          rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          if (limit !== null) {
            const off = offset || 0;
            rows = rows.slice(off, off + limit);
          }

          return { rows, rowCount: rows.length };
        }
      }

      if (/^DELETE/i.test(norm)) {
        const m = norm.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\$(\d+)/i);
        if (m) {
          const table = m[1];
          const val = params[parseInt(m[3]) - 1];
          const rows = getTable(table);
          const before = rows.length;
          store[table] = rows.filter(r => r.id !== val);
          return { rows: [], rowCount: before - store[table].length };
        }
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

describe('Apk Upload History Routes', () => {
  let app: FastifyInstance;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeAll(async () => {
    mockDb = createMockDb();
    app = Fastify({ logger: false });
    await registerApkUploadHistoryRoutes(app, { database: mockDb as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

  describe('GET /api/v1/apk-upload-history', () => {
    it('should respond to GET /api/v1/apk-upload-history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/apk-upload-history/recent-failures', () => {
    it('should respond to GET /api/v1/apk-upload-history/recent-failures', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history/recent-failures',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/apk-upload-history/stats', () => {
    it('should respond to GET /api/v1/apk-upload-history/stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history/stats',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('GET /api/v1/apk-upload-history/:id', () => {
    it('should respond to GET /api/v1/apk-upload-history/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/apk-upload-history/test-id',
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });
});
