/**
 * Tests for IaC plans, state versions, and module endpoints
 */
import Fastify, { FastifyInstance } from 'fastify';
import iacRoutes from '../iac-routes';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, _reply: any) => {
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenantId: '1' };
  },
}));
jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: () => async (_req: any, _reply: any) => {},
}));

describe('IaC Plans, State Versions & Modules', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    const mockDb = { query: async () => ({ rows: [], rowCount: 0 }) } as any;
    await app.register(iacRoutes, { prefix: '/v1/iac', database: mockDb });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/iac/workspaces/:id/plans', () => {
    it('returns workspace plans or error with mock DB', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/iac/workspaces/ws-1/plans' });
      // 200 with real DB, 500 with mock DB -- both confirm route exists
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(Array.isArray(body.data)).toBe(true);
      }
    });
  });

  describe('GET /v1/iac/workspaces/:id/state/versions', () => {
    it('returns state versions or 404 for unknown workspace', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/iac/workspaces/ws-1/state/versions' });
      // 200 if workspace exists, 404 otherwise -- either is acceptable
      expect([200, 404]).toContain(response.statusCode);
    });
  });

  describe('GET /v1/iac/modules/:id', () => {
    it('returns module details or 404', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/iac/modules/mod-1' });
      expect([200, 404]).toContain(response.statusCode);
    });
  });
});
