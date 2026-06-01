import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';
import sbomRoutes from '../sbom-routes';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, _reply: any) => {
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'], tenantId: '1' };
  },
}));
jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: () => async (_req: any, _reply: any) => {},
}));

describe.skip('SBOM Compliance & Provenance Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(sbomRoutes, { prefix: '/v1/sbom' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/sbom/compliance/report', () => {
    it('returns compliance data with 200', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/compliance/report' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(200);
      expect(body.data).toHaveProperty('totalSboms');
      expect(body.data).toHaveProperty('complianceRate');
    });
  });

  describe('GET /v1/sbom/compliance/eo14028', () => {
    it('returns EO 14028 compliance status', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/compliance/eo14028' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('compliant');
      expect(body.data).toHaveProperty('details');
    });
  });

  describe('GET /v1/sbom/compliance/eu-cra', () => {
    it('returns EU CRA compliance status', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/compliance/eu-cra' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('compliant');
    });
  });

  describe('POST /v1/sbom/provenance', () => {
    it('creates a provenance record with 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sbom/provenance',
        payload: {
          buildId: 'build-123',
          provenanceType: 'slsa',
          content: { builder: { id: 'builder-1' } },
          signature: 'sig-abc123def456',
          builderId: 'builder-1',
          buildTrigger: 'push',
          sourceUri: 'https://github.com/org/repo',
        },
      });
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('id');
      expect(body.data.buildId).toBe('build-123');
    });
  });

  describe('GET /v1/sbom/provenance', () => {
    it('lists provenance records', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/provenance' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('POST /v1/sbom/gate/evaluate', () => {
    it('evaluates gate for a build', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sbom/gate/evaluate',
        query: { buildId: 'build-123' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('passed');
      expect(body.data).toHaveProperty('checks');
    });

    it('returns 400 when buildId is missing', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/sbom/gate/evaluate' });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /v1/sbom/gate/history', () => {
    it('returns gate evaluation history', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/gate/history' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
