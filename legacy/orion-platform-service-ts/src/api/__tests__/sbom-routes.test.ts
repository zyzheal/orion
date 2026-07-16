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

describe('SBOM Document & Vulnerability Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(sbomRoutes, { prefix: '/v1/sbom' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/sbom/documents', () => {
    it('returns SBOM documents list', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/documents' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  describe('POST /v1/sbom/documents', () => {
    it('creates an SBOM document with 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sbom/documents',
        payload: {
          buildId: 'build-123',
          format: 'spdx-json',
          specVersion: '2.3',
          documentId: 'doc-001',
          content: { packages: [] },
          packageCount: 0,
        },
      });
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.buildId).toBe('build-123');
    });
  });

  describe('GET /v1/sbom/documents/:id', () => {
    it('returns 404 for unknown document', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/documents/nonexistent' });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /v1/sbom/vulnerabilities', () => {
    it('returns vulnerabilities list', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/vulnerabilities' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });
  });

  describe('GET /v1/sbom/waivers', () => {
    it('returns waivers list', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/sbom/waivers' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('waivers');
    });
  });

  describe('POST /v1/sbom/generate', () => {
    it('returns 503 when no database is configured', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sbom/generate',
        payload: {
          artifactId: 'art-123',
          format: 'spdx-json',
        },
      });
      expect(response.statusCode).toBe(503);
    });
  });
});
