import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import efficiencyRoutes from '../efficiency-routes';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, _reply: any) => {
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenantId: '1' };
  },
}));
jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: () => async (_req: any, _reply: any) => {},
}));

describe('Efficiency Score & Export Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(efficiencyRoutes, { prefix: '/v1/efficiency' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/efficiency/score', () => {
    it('calculates efficiency score', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/efficiency/score',
        payload: { teamId: 'team-1' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('score');
      expect(body.data).toHaveProperty('grade');
      expect(body.data).toHaveProperty('breakdown');
    });
  });

  describe('POST /v1/efficiency/export', () => {
    it('exports data as JSON by default', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/efficiency/export',
        payload: { format: 'json' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('format', 'json');
      expect(body.data).toHaveProperty('exportedAt');
    });

    it('exports data as CSV when requested', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/efficiency/export',
        payload: { format: 'csv' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });
});
