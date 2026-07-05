/**
 * Progressive Routes Tests
 *
 * Tests for the direct progressive deployment operations:
 * - POST /:id/advance
 * - POST /:id/cleanup
 * - GET /:id/traffic
 * - POST /:id/traffic
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
import progressiveRoutes from '../progressive-routes';

// Mock auth middleware
jest.mock('../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenant_id: 'tenant-1' };
  },
}));

jest.mock('../middleware/requirePermission', () => ({
  requirePermission: (_opts: any) => async (req: any, reply: any) => {},
}));

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'dev-fallback-secret-not-for-production',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'x-tenant-id': '1',
};

// In-memory mock DB for progressive_deployments
interface ProgressiveDeploymentRow {
  id: string;
  deployment_id: string;
  tenant_id: string;
  phase: string;
  strategy: string;
  current_traffic_percent: number;
  target_traffic_percent: number;
  error_rate: number;
  started_at: Date;
  last_increment_at: Date | null;
  completed_at: Date | null;
  config: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

let mockStore: ProgressiveDeploymentRow[] = [];
let mockIdCounter = 0;

function createMockDb() {
  return {
    query: async (text: string, params?: unknown[]) => {
      const sql = text.trim().toUpperCase();

      if (sql.startsWith('INSERT')) {
        const row: ProgressiveDeploymentRow = {
          id: params?.[0] as string || `pd-${++mockIdCounter}`,
          deployment_id: params?.[1] as string,
          tenant_id: (params?.[2] as string) || 'default',
          phase: (params?.[3] as string) || 'initial',
          strategy: (params?.[4] as string) || 'canary',
          current_traffic_percent: (params?.[5] as number) || 0,
          target_traffic_percent: (params?.[6] as number) || 100,
          error_rate: (params?.[7] as number) || 0,
          started_at: params?.[8] as Date || new Date(),
          last_increment_at: null,
          completed_at: null,
          config: (params?.[9] as Record<string, any>) || {},
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockStore.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (sql.startsWith('SELECT')) {
        let results = [...mockStore];

        if (sql.includes('WHERE')) {
          const whereStart = sql.indexOf('WHERE');
          const afterWhere = sql.substring(whereStart + 5);
          const orderIdx = afterWhere.search(/\s+ORDER\s+/i);
          const limitIdx = afterWhere.search(/\s+LIMIT\s+/i);
          let endIdx = afterWhere.length;
          if (orderIdx > 0) endIdx = Math.min(endIdx, orderIdx);
          if (limitIdx > 0) endIdx = Math.min(endIdx, limitIdx);
          const whereClause = afterWhere.substring(0, endIdx).trim();

          const conditions: string[] = [];
          let depth = 0;
          let current = '';
          for (let i = 0; i < whereClause.length; i++) {
            const ch = whereClause[i];
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (depth === 0 && whereClause.substring(i).match(/^\s+AND\s+/i)) {
              conditions.push(current.trim());
              current = '';
              i += whereClause.substring(i).match(/^\s+AND\s+/i)![0].length - 1;
            } else {
              current += ch;
            }
          }
          if (current.trim()) conditions.push(current.trim());

          for (const cond of conditions) {
            const eqMatch = cond.match(/^(\w+)\s*=\s*\$(\d+)$/);
            if (eqMatch && params) {
              const col = eqMatch[1];
              const idx = parseInt(eqMatch[2]) - 1;
              if (idx < params.length) {
                results = results.filter(r => r[col as keyof ProgressiveDeploymentRow] === params[idx]);
              }
              continue;
            }
            const inMatch = cond.match(/^(\w+)\s+IN\s*\(([^)]+)\)/i);
            if (inMatch && params) {
              const col = inMatch[1] as keyof ProgressiveDeploymentRow;
              const vals = inMatch[2].split(',').map(s => s.replace(/'/g, '').trim());
              results = results.filter(r => vals.includes(String(r[col])));
              continue;
            }
            const ltMatch = cond.match(/(\w+)\s*<\s*\$(\d+)/);
            if (ltMatch && params) {
              const col = ltMatch[1] as keyof ProgressiveDeploymentRow;
              const idx = parseInt(ltMatch[2]) - 1;
              if (idx < params.length && params[idx] instanceof Date) {
                results = results.filter(r => (r[col] as Date) < params[idx] as Date);
              }
              continue;
            }
            const nullMatch = cond.match(/^(\w+)\s+IS\s+NULL$/i);
            if (nullMatch) {
              const col = nullMatch[1] as keyof ProgressiveDeploymentRow;
              results = results.filter(r => r[col] === null || r[col] === undefined);
              continue;
            }
          }
        }

        const limitMatch = sql.match(/LIMIT\s*\$(\d+)/i);
        if (limitMatch && params) {
          const idx = parseInt(limitMatch[1]) - 1;
          results = results.slice(0, params[idx] as number);
        }
        return { rows: results, rowCount: results.length };
      }

      if (sql.startsWith('UPDATE')) {
        const whereMatch = text.match(/WHERE\s+(.+?)(?:RETURNING|$)/is);
        if (whereMatch && params) {
          const whereClause = whereMatch[1].trim();
          const eqMatch = whereClause.match(/(\w+)\s*=\s*\$(\d+)/);
          if (eqMatch) {
            const col = eqMatch[1];
            const idx = parseInt(eqMatch[2]) - 1;
            const key = params[idx] as string;
            const target = mockStore.find(r => r[col as keyof ProgressiveDeploymentRow] === key);
            if (target) {
              const setMatch = text.match(/SET\s+(.+?)\s+WHERE/is);
              if (setMatch) {
                const assignments = setMatch[1].split(',');
                for (const assignment of assignments) {
                  const colMatch = assignment.trim().match(/(\w+)\s*=\s*\$(\d+)/);
                  if (colMatch) {
                    const c = colMatch[1];
                    const pIdx = parseInt(colMatch[2]) - 1;
                    if (c !== 'updated_at' && pIdx < params.length) {
                      (target as any)[c] = params[pIdx];
                    }
                  }
                }
                target.updated_at = new Date();
              }
              return { rows: [target], rowCount: 1 };
            }
          }
        }
        return { rows: [], rowCount: 0 };
      }

      if (sql.startsWith('DELETE')) {
        const whereStart = text.indexOf('WHERE');
        if (whereStart > 0) {
          const whereClause = text.substring(whereStart + 5).trim();
          const simpleMatch = whereClause.match(/^(\w+)\s*=\s*\$(\d+)$/);
          if (simpleMatch && params) {
            const col = simpleMatch[1];
            const idx = parseInt(simpleMatch[2]) - 1;
            const key = params[idx] as string;
            const initialLen = mockStore.length;
            mockStore = mockStore.filter(r => r[col as keyof ProgressiveDeploymentRow] !== key);
            return { rows: [], rowCount: initialLen - mockStore.length };
          }
          const complexMatch = whereClause.match(/tenant_id\s*=\s*\$(\d+)\s+AND\s+phase\s+IN\s*\(([^)]+)\)/i);
          if (complexMatch && params) {
            const tenantIdx = parseInt(complexMatch[1]) - 1;
            const tenantId = params[tenantIdx] as string;
            const phases = complexMatch[2].split(',').map(s => s.replace(/'/g, '').trim());
            const initialLen = mockStore.length;
            mockStore = mockStore.filter(r => {
              if (r.tenant_id !== tenantId) return true;
              if (!phases.includes(r.phase)) return true;
              if (r.completed_at && new Date(r.completed_at) < new Date(params[2] as Date)) return true;
              if (!r.completed_at && r.started_at && new Date(r.started_at) < new Date(params[2] as Date)) return true;
              return false;
            });
            return { rows: [], rowCount: initialLen - mockStore.length };
          }
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    },
  };
}

describe('Progressive Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(progressiveRoutes, { database: createMockDb() as any });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockStore = [];
    mockIdCounter = 0;
  });

  describe('POST /:id/advance', () => {
    it('should advance traffic for existing deployment', async () => {
      // First create a deployment via the service logic directly in the DB
      const db = createMockDb();
      await db.query(`INSERT INTO progressive_deployments (id, deployment_id, tenant_id, phase, strategy, current_traffic_percent, target_traffic_percent, error_rate, started_at, config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        ['pd-advance-1', 'deploy-001', 'tenant-1', 'progressing', 'canary', 10, 100, 0, new Date(), { incrementPercent: 25, incrementIntervalSeconds: 0, autoRollback: true, rollbackThreshold: 5 }, new Date(), new Date()]
      );

      const response = await app.inject({
        method: 'POST',
        url: '/deploy-001/advance',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status.currentTrafficPercent).toBe(35);
      expect(body.status.phase).toBe('progressing');
    });

    it('should return 404 for non-existent deployment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/non-existent/advance',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject when tenant does not own deployment', async () => {
      const db = createMockDb();
      await db.query(`INSERT INTO progressive_deployments (id, deployment_id, tenant_id, phase, strategy, current_traffic_percent, target_traffic_percent, error_rate, started_at, config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        ['pd-advance-2', 'deploy-002', 'tenant-2', 'progressing', 'canary', 10, 100, 0, new Date(), { incrementPercent: 25, incrementIntervalSeconds: 0, autoRollback: true, rollbackThreshold: 5 }, new Date(), new Date()]
      );

      const response = await app.inject({
        method: 'POST',
        url: '/deploy-002/advance',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /:id/cleanup', () => {
    it('should cleanup completed deployments', async () => {
      const db = createMockDb();
      await db.query(`INSERT INTO progressive_deployments (id, deployment_id, tenant_id, phase, strategy, current_traffic_percent, target_traffic_percent, error_rate, started_at, completed_at, config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        ['pd-cleanup-1', 'deploy-001', 'tenant-1', 'complete', 'canary', 100, 100, 0, new Date(), new Date(), {}, new Date(), new Date()]
      );

      const response = await app.inject({
        method: 'POST',
        url: '/deploy-001/cleanup',
        headers: authHeaders,
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.deleted).toBe(1);
    });
  });

  describe('GET /:id/traffic', () => {
    it('should return traffic split for existing deployment', async () => {
      const db = createMockDb();
      await db.query(`INSERT INTO progressive_deployments (id, deployment_id, tenant_id, phase, strategy, current_traffic_percent, target_traffic_percent, error_rate, started_at, config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        ['pd-traffic-1', 'deploy-001', 'tenant-1', 'progressing', 'canary', 30, 100, 0, new Date(), {}, new Date(), new Date()]
      );

      const response = await app.inject({
        method: 'GET',
        url: '/deploy-001/traffic',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.currentTrafficPercent).toBe(30);
      expect(body.weights).toEqual({ stable: 70, canary: 30 });
    });

    it('should return 404 for non-existent deployment', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent/traffic',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /:id/traffic', () => {
    it('should set traffic percentage directly', async () => {
      const db = createMockDb();
      await db.query(`INSERT INTO progressive_deployments (id, deployment_id, tenant_id, phase, strategy, current_traffic_percent, target_traffic_percent, error_rate, started_at, config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        ['pd-settraffic-1', 'deploy-001', 'tenant-1', 'progressing', 'canary', 10, 100, 0, new Date(), {}, new Date(), new Date()]
      );

      const response = await app.inject({
        method: 'POST',
        url: '/deploy-001/traffic',
        headers: authHeaders,
        payload: { currentTrafficPercent: 60 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status.currentTrafficPercent).toBe(60);
      expect(body.message).toContain('60%');
    });

    it('should reject invalid traffic percentage', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/deploy-001/traffic',
        headers: authHeaders,
        payload: { currentTrafficPercent: 150 },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent deployment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/non-existent/traffic',
        headers: authHeaders,
        payload: { currentTrafficPercent: 50 },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
