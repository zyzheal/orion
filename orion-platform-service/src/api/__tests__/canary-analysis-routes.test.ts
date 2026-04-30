import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import canaryAnalysisRoutes from '../canary-analysis-routes';

describe('Canary Analysis Metric Discovery & Model Retraining', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(canaryAnalysisRoutes, { prefix: '/v1/canary-analysis' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/canary-analysis/metrics/discover', () => {
    it('returns available metrics', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/canary-analysis/metrics/discover' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('metrics');
      expect(Array.isArray(body.data.metrics)).toBe(true);
    });
  });

  describe('POST /v1/canary-analysis/models/retrain', () => {
    it('triggers model retraining', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/canary-analysis/models/retrain',
        payload: { modelName: 'canary-v2' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('jobId');
      expect(body.data.status).toBe('queued');
    });
  });
});
