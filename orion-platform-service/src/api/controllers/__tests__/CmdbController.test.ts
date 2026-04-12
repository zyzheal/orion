/**
 * CMDB Controller 单元测试
 */

import request from 'supertest';
import express from 'express';
import { CmdbController } from '../CmdbController';
import { CmdbService } from '../../../services/cmdb/CmdbService';

// 创建测试用的 Express 应用
function createTestApp(cmdbService: CmdbService) {
  const app = express();
  app.use(express.json());

  const controller = new CmdbController(cmdbService);

  app.post('/api/v1/cmdb/cis', (req, res) => controller.createCI(req, res));
  app.get('/api/v1/cmdb/cis/:id', (req, res) => controller.getCI(req, res));
  app.put('/api/v1/cmdb/cis/:id', (req, res) => controller.updateCI(req, res));
  app.delete('/api/v1/cmdb/cis/:id', (req, res) => controller.deleteCI(req, res));
  app.get('/api/v1/cmdb/cis', (req, res) => controller.listCIs(req, res));
  app.get('/api/v1/cmdb/cis/:id/relations', (req, res) => controller.getCIRelations(req, res));
  app.get('/api/v1/cmdb/cis/:id/versions', (req, res) => controller.getVersions(req, res));
  app.post('/api/v1/cmdb/relations', (req, res) => controller.createRelation(req, res));
  app.delete('/api/v1/cmdb/relations/:id', (req, res) => controller.deleteRelation(req, res));

  return app;
}

describe('CmdbController', () => {
  let app: ReturnType<typeof createTestApp>;
  let cmdbService: CmdbService;

  beforeEach(() => {
    // 清空内存存储
    CmdbService.clearAll();
    cmdbService = new CmdbService();
    app = createTestApp(cmdbService);
  });

  describe('POST /api/v1/cmdb/cis', () => {
    it('should create CI successfully', async () => {
      const response = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .set('x-user-id', 'user-001')
        .send({
          ciId: 'test-app-001',
          ciType: 'APPLICATION',
          name: 'Test Application',
          description: 'Test Description',
          environment: 'dev',
          tags: ['test'],
        });

      expect(response.status).toBe(201);
      expect(response.body.ciId).toBe('test-app-001');
      expect(response.body.ciType).toBe('APPLICATION');
      expect(response.body.name).toBe('Test Application');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          name: 'Test Application',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate CI', async () => {
      const payload = {
        ciId: 'duplicate-app',
        ciType: 'APPLICATION',
        name: 'Duplicate App',
      };

      await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send(payload);

      const response = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send(payload);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('CONFLICT');
    });

    it('should return 400 for invalid ciType', async () => {
      const response = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'test-app',
          ciType: 'INVALID_TYPE',
          name: 'Test App',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/cmdb/cis/:id', () => {
    it('should get CI by id', async () => {
      const createResponse = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .set('x-user-id', 'user-001')
        .send({
          ciId: 'test-get-app',
          ciType: 'APPLICATION',
          name: 'Get Test App',
        });

      const response = await request(app)
        .get(`/api/v1/cmdb/cis/${createResponse.body.id}`)
        .set('x-tenant-id', '1');

      expect(response.status).toBe(200);
      expect(response.body.ciId).toBe('test-get-app');
      expect(response.body.name).toBe('Get Test App');
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await request(app)
        .get('/api/v1/cmdb/cis/non-existent-id')
        .set('x-tenant-id', '1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/cmdb/cis/:id', () => {
    it('should update CI successfully', async () => {
      const createResponse = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .set('x-user-id', 'user-001')
        .send({
          ciId: 'test-update-app',
          ciType: 'APPLICATION',
          name: 'Update Test App',
          description: 'Original Description',
        });

      const response = await request(app)
        .put(`/api/v1/cmdb/cis/${createResponse.body.id}`)
        .set('x-tenant-id', '1')
        .set('x-user-id', 'user-002')
        .send({
          description: 'Updated Description',
          status: 'INACTIVE',
        });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated Description');
      expect(response.body.status).toBe('INACTIVE');
      expect(response.body.version).toBe(2);
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await request(app)
        .put('/api/v1/cmdb/cis/non-existent-id')
        .set('x-tenant-id', '1')
        .send({ description: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/cmdb/cis/:id', () => {
    it('should delete CI successfully', async () => {
      const createResponse = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .set('x-user-id', 'user-001')
        .send({
          ciId: 'test-delete-app',
          ciType: 'APPLICATION',
          name: 'Delete Test App',
        });

      const response = await request(app)
        .delete(`/api/v1/cmdb/cis/${createResponse.body.id}`)
        .set('x-tenant-id', '1');

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await request(app)
        .delete('/api/v1/cmdb/cis/non-existent-id')
        .set('x-tenant-id', '1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/cmdb/cis', () => {
    it('should list CIs with filters', async () => {
      await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'list-app-1',
          ciType: 'APPLICATION',
          name: 'List App 1',
          environment: 'dev',
        });

      await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'list-app-2',
          ciType: 'APPLICATION',
          name: 'List App 2',
          environment: 'prod',
        });

      const response = await request(app)
        .get('/api/v1/cmdb/cis?environment=dev')
        .set('x-tenant-id', '1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].ciId).toBe('list-app-1');
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/cmdb/cis')
          .set('x-tenant-id', '1')
          .send({
            ciId: `list-pag-${i}`,
            ciType: 'APPLICATION',
            name: `List App ${i}`,
          });
      }

      const response = await request(app)
        .get('/api/v1/cmdb/cis?limit=2&offset=0')
        .set('x-tenant-id', '1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('GET /api/v1/cmdb/cis/:id/versions', () => {
    it('should get CI versions', async () => {
      const createResponse = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'version-app',
          ciType: 'APPLICATION',
          name: 'Version App',
        });

      await request(app)
        .put(`/api/v1/cmdb/cis/${createResponse.body.id}`)
        .set('x-tenant-id', '1')
        .send({ description: 'v2' });

      const response = await request(app)
        .get(`/api/v1/cmdb/cis/${createResponse.body.id}/versions`)
        .set('x-tenant-id', '1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].version).toBe(2);
    });
  });

  describe('POST /api/v1/cmdb/relations', () => {
    it('should create relation successfully', async () => {
      const fromCI = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'from-app',
          ciType: 'APPLICATION',
          name: 'From App',
        });

      const toCI = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'to-db',
          ciType: 'DATABASE',
          name: 'To DB',
        });

      const response = await request(app)
        .post('/api/v1/cmdb/relations')
        .set('x-tenant-id', '1')
        .send({
          fromCiId: 'from-app',
          toCiId: 'to-db',
          relationType: 'DEPENDS_ON',
        });

      expect(response.status).toBe(201);
      expect(response.body.fromCiId).toBe('from-app');
      expect(response.body.toCiId).toBe('to-db');
      expect(response.body.relationType).toBe('DEPENDS_ON');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/cmdb/relations')
        .set('x-tenant-id', '1')
        .send({
          fromCiId: 'from-app',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent CI', async () => {
      const response = await request(app)
        .post('/api/v1/cmdb/relations')
        .set('x-tenant-id', '1')
        .send({
          fromCiId: 'non-existent',
          toCiId: 'to-db',
          relationType: 'DEPENDS_ON',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/cmdb/relations/:id', () => {
    it('should delete relation successfully', async () => {
      const fromCI = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'del-from-app',
          ciType: 'APPLICATION',
          name: 'From App',
        });

      const toCI = await request(app)
        .post('/api/v1/cmdb/cis')
        .set('x-tenant-id', '1')
        .send({
          ciId: 'del-to-db',
          ciType: 'DATABASE',
          name: 'To DB',
        });

      const createResponse = await request(app)
        .post('/api/v1/cmdb/relations')
        .set('x-tenant-id', '1')
        .send({
          fromCiId: 'del-from-app',
          toCiId: 'del-to-db',
          relationType: 'DEPENDS_ON',
        });

      const response = await request(app)
        .delete(`/api/v1/cmdb/relations/${createResponse.body.id}`)
        .set('x-tenant-id', '1');

      expect(response.status).toBe(204);
    });
  });
});
