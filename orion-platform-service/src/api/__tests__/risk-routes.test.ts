import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import riskRoutes from '../risk-routes';

describe.skip('Risk Events & Health Check History', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(riskRoutes, { prefix: '/v1/risk' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/risk/events', () => {
    it('returns risk events list', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/risk/events' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('events');
      expect(body.data).toHaveProperty('total');
    });
  });

  describe('GET /v1/risk/health-check/history', () => {
    it('returns health check history', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/risk/health-check/history' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('checks');
    });
  });
});
