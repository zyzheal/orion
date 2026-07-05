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

  describe('GET /v1/efficiency/reports', () => {
    it('returns efficiency report', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/efficiency/reports',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('report');
    });
  });

  describe('GET /v1/efficiency/reports/history', () => {
    it('returns report history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/efficiency/reports/history',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('history');
      expect(body.data).toHaveProperty('total');
    });
  });

  describe('GET /v1/efficiency/dora', () => {
    it('returns DORA metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/efficiency/dora',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('dora');
    });
  });

  describe('GET /v1/efficiency/dora/trend', () => {
    it('returns DORA trend', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/efficiency/dora/trend',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('trend');
    });
  });

  describe('POST /v1/efficiency/compare', () => {
    it('returns 400 when periods are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/efficiency/compare',
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
