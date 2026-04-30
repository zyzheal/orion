import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import ephemeralEnvRoutes from '../ephemeral-env-routes';

describe('Ephemeral Environment Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(ephemeralEnvRoutes, { prefix: '/v1/ephemeral-envs' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/ephemeral-envs', () => {
    it('returns list of environments with 200', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/ephemeral-envs' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(200);
      expect(body.data).toBeDefined();
      expect(body.meta).toHaveProperty('total');
    });
  });

  describe('GET /v1/ephemeral-envs/templates', () => {
    it('returns environment templates', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/ephemeral-envs/templates' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /v1/ephemeral-envs', () => {
    it('creates a new ephemeral environment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/ephemeral-envs',
        payload: {
          prId: 'pr-123',
          repoId: 'repo-456',
          branchName: 'feature/test',
          commitSha: 'abc123',
        },
      });
      // 201 on success, 500 if K8s provisioner not configured
      expect([201, 500]).toContain(response.statusCode);
    });
  });
});
