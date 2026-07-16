/**
 * CMDB Controller 单元测试 - Fastify 版本
 */

import Fastify from 'fastify';
import { CmdbController } from '../CmdbController';
import { CmdbService } from '../../../services/cmdb/CmdbService';

// 创建测试用的 Fastify 应用
async function createTestApp(cmdbService: CmdbService) {
  const app = Fastify();

  const controller = new CmdbController(cmdbService);

  app.post('/api/v1/cmdb/cis', async (request, reply) => controller.createCI(request, reply));
  app.get('/api/v1/cmdb/cis/:id', async (request, reply) => controller.getCI(request, reply));
  app.put('/api/v1/cmdb/cis/:id', async (request, reply) => controller.updateCI(request, reply));
  app.delete('/api/v1/cmdb/cis/:id', async (request, reply) => controller.deleteCI(request, reply));
  app.get('/api/v1/cmdb/cis', async (request, reply) => controller.listCIs(request, reply));
  app.get('/api/v1/cmdb/cis/:id/relations', async (request, reply) => controller.getCIRelations(request, reply));
  app.get('/api/v1/cmdb/cis/:id/versions', async (request, reply) => controller.getVersions(request, reply));
  app.post('/api/v1/cmdb/relations', async (request, reply) => controller.createRelation(request, reply));
  app.delete('/api/v1/cmdb/relations/:id', async (request, reply) => controller.deleteRelation(request, reply));

  return app;
}

// Helper function to inject requests
async function inject(app: Awaited<ReturnType<typeof createTestApp>>, options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  payload?: any;
}) {
  return app.inject({
    method: options.method,
    url: options.url,
    headers: options.headers,
    payload: options.payload,
  });
}

describe('CmdbController', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let cmdbService: CmdbService;

  beforeEach(async () => {
    // 清空内存存储
    CmdbService.clearAll();
    cmdbService = new CmdbService();
    app = await createTestApp(cmdbService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/cmdb/cis', () => {
    it('should create CI successfully', async () => {
      const response = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: {
          'x-tenant-id': '1',
          'x-user-id': 'user-001',
        },
        payload: {
          ciId: 'test-app-001',
          ciType: 'APPLICATION',
          name: 'Test Application',
          description: 'Test Description',
          environment: 'dev',
          tags: ['test'],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ciId).toBe('test-app-001');
      expect(body.ciType).toBe('APPLICATION');
      expect(body.name).toBe('Test Application');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: { name: 'Test Application' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate CI', async () => {
      const payload = {
        ciId: 'duplicate-app',
        ciType: 'APPLICATION',
        name: 'Duplicate App',
      };

      await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload,
      });

      const response = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload,
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('CONFLICT');
    });

    it('should return 400 for invalid ciType', async () => {
      const response = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'test-app',
          ciType: 'INVALID_TYPE',
          name: 'Test App',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/cmdb/cis/:id', () => {
    it('should get CI by id', async () => {
      const createResponse = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1', 'x-user-id': 'user-001' },
        payload: {
          ciId: 'test-get-app',
          ciType: 'APPLICATION',
          name: 'Get Test App',
        },
      });
      const createBody = JSON.parse(createResponse.body);

      const response = await inject(app, {
        method: 'GET',
        url: `/api/v1/cmdb/cis/${createBody.id}`,
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ciId).toBe('test-get-app');
      expect(body.name).toBe('Get Test App');
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await inject(app, {
        method: 'GET',
        url: '/api/v1/cmdb/cis/non-existent-id',
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/cmdb/cis/:id', () => {
    it('should update CI successfully', async () => {
      const createResponse = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1', 'x-user-id': 'user-001' },
        payload: {
          ciId: 'test-update-app',
          ciType: 'APPLICATION',
          name: 'Update Test App',
          description: 'Original Description',
        },
      });
      const createBody = JSON.parse(createResponse.body);

      const response = await inject(app, {
        method: 'PUT',
        url: `/api/v1/cmdb/cis/${createBody.id}`,
        headers: { 'x-tenant-id': '1', 'x-user-id': 'user-002' },
        payload: {
          description: 'Updated Description',
          status: 'INACTIVE',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe('Updated Description');
      expect(body.status).toBe('INACTIVE');
      expect(body.version).toBe(2);
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await inject(app, {
        method: 'PUT',
        url: '/api/v1/cmdb/cis/non-existent-id',
        headers: { 'x-tenant-id': '1' },
        payload: { description: 'Test' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/cmdb/cis/:id', () => {
    it('should delete CI successfully', async () => {
      const createResponse = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1', 'x-user-id': 'user-001' },
        payload: {
          ciId: 'test-delete-app',
          ciType: 'APPLICATION',
          name: 'Delete Test App',
        },
      });
      const createBody = JSON.parse(createResponse.body);

      const response = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/cmdb/cis/${createBody.id}`,
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await inject(app, {
        method: 'DELETE',
        url: '/api/v1/cmdb/cis/non-existent-id',
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/cmdb/cis', () => {
    it('should list CIs with filters', async () => {
      await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'list-app-1',
          ciType: 'APPLICATION',
          name: 'List App 1',
          environment: 'dev',
        },
      });

      await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'list-app-2',
          ciType: 'APPLICATION',
          name: 'List App 2',
          environment: 'prod',
        },
      });

      const response = await inject(app, {
        method: 'GET',
        url: '/api/v1/cmdb/cis?environment=dev',
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].ciId).toBe('list-app-1');
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await inject(app, {
          method: 'POST',
          url: '/api/v1/cmdb/cis',
          headers: { 'x-tenant-id': '1' },
          payload: {
            ciId: `list-pag-${i}`,
            ciType: 'APPLICATION',
            name: `List App ${i}`,
          },
        });
      }

      const response = await inject(app, {
        method: 'GET',
        url: '/api/v1/cmdb/cis?limit=2&offset=0',
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('GET /api/v1/cmdb/cis/:id/versions', () => {
    it('should get CI versions', async () => {
      const createResponse = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'version-app',
          ciType: 'APPLICATION',
          name: 'Version App',
        },
      });
      const createBody = JSON.parse(createResponse.body);

      await inject(app, {
        method: 'PUT',
        url: `/api/v1/cmdb/cis/${createBody.id}`,
        headers: { 'x-tenant-id': '1' },
        payload: { description: 'v2' },
      });

      const response = await inject(app, {
        method: 'GET',
        url: `/api/v1/cmdb/cis/${createBody.id}/versions`,
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].version).toBe(2);
    });
  });

  describe('POST /api/v1/cmdb/relations', () => {
    it('should create relation successfully', async () => {
      await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'from-app',
          ciType: 'APPLICATION',
          name: 'From App',
        },
      });

      await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'to-db',
          ciType: 'DATABASE',
          name: 'To DB',
        },
      });

      const response = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/relations',
        headers: { 'x-tenant-id': '1' },
        payload: {
          fromCiId: 'from-app',
          toCiId: 'to-db',
          relationType: 'DEPENDS_ON',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.fromCiId).toBe('from-app');
      expect(body.toCiId).toBe('to-db');
      expect(body.relationType).toBe('DEPENDS_ON');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/relations',
        headers: { 'x-tenant-id': '1' },
        payload: { fromCiId: 'from-app' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/relations',
        headers: { 'x-tenant-id': '1' },
        payload: {
          fromCiId: 'non-existent',
          toCiId: 'to-db',
          relationType: 'DEPENDS_ON',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/cmdb/relations/:id', () => {
    it('should delete relation successfully', async () => {
      await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'del-from-app',
          ciType: 'APPLICATION',
          name: 'From App',
        },
      });

      await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/cis',
        headers: { 'x-tenant-id': '1' },
        payload: {
          ciId: 'del-to-db',
          ciType: 'DATABASE',
          name: 'To DB',
        },
      });

      const createResponse = await inject(app, {
        method: 'POST',
        url: '/api/v1/cmdb/relations',
        headers: { 'x-tenant-id': '1' },
        payload: {
          fromCiId: 'del-from-app',
          toCiId: 'del-to-db',
          relationType: 'DEPENDS_ON',
        },
      });
      const createBody = JSON.parse(createResponse.body);

      const response = await inject(app, {
        method: 'DELETE',
        url: `/api/v1/cmdb/relations/${createBody.id}`,
        headers: { 'x-tenant-id': '1' },
      });

      expect(response.statusCode).toBe(204);
    });
  });
});