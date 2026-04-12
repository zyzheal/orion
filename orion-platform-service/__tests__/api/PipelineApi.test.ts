/**
 * Pipeline API 集成测试 (Fastify 版本)
 */

import Fastify from 'fastify';
// @ts-ignore - supertest types may not be available
import request from 'supertest';
import { registerApiRoutes } from '@/api/routes';
import { EventBusService } from '@/services/event-bus-service';

describe('Pipeline API', () => {
  let app: ReturnType<typeof Fastify>;
  let mockEventBus: EventBusService;

  const validPipelineYaml = `
apiVersion: orion.io/v1
kind: Pipeline
metadata:
  name: api-test-pipeline
  version: "1.0.0"
  description: API Test Pipeline
spec:
  triggers:
    - type: api
  stages:
    - name: build
      runsOn: linux
      steps:
        - name: checkout
          uses: git/checkout@v1
        - name: compile
          uses: npm/run@v1
          with:
            command: build
    - name: test
      runsOn: linux
      dependsOn: [build]
      steps:
        - name: unit-test
          uses: npm/test@v1
  `;

  beforeEach(async () => {
    // Mock EventBus
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as EventBusService;

    app = Fastify();
    await app.register(registerApiRoutes, { prefix: '/api/v1', eventBus: mockEventBus });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/pipelines', () => {
    it('should create a pipeline', async () => {
      const response = await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'api-test-pipeline',
          version: '1.0.0',
          description: 'Test Pipeline',
          yamlDefinition: validPipelineYaml,
          createdBy: 'test-user',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('api-test-pipeline');
      expect(response.body.version).toBe('1.0.0');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'incomplete-pipeline',
          // Missing version and yamlDefinition
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid YAML', async () => {
      const response = await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'invalid-yaml-pipeline',
          version: '1.0.0',
          yamlDefinition: 'invalid yaml content',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/pipelines', () => {
    it('should list pipelines', async () => {
      // First create a pipeline
      await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'list-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'list-test-pipeline'),
        });

      const response = await request(app.server).get('/api/v1/pipelines');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/pipelines/:id', () => {
    it('should get pipeline by id', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'get-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'get-test-pipeline'),
        });

      const pipelineId = createResponse.body.id;

      const response = await request(app.server).get(`/api/v1/pipelines/${pipelineId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(pipelineId);
      expect(response.body.spec).toBeDefined();
    });

    it('should return 404 for non-existent pipeline', async () => {
      const response = await request(app.server).get('/api/v1/pipelines/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/pipelines/:id', () => {
    it('should update pipeline description', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'update-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'update-test-pipeline'),
        });

      const pipelineId = createResponse.body.id;

      const response = await request(app.server)
        .put(`/api/v1/pipelines/${pipelineId}`)
        .send({
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/v1/pipelines/:id', () => {
    it('should delete pipeline', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'delete-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'delete-test-pipeline'),
        });

      const pipelineId = createResponse.body.id;

      const response = await request(app.server).delete(`/api/v1/pipelines/${pipelineId}`);

      expect(response.status).toBe(204);
    });
  });

  describe('POST /api/v1/pipelines/validate', () => {
    it('should validate correct pipeline YAML', async () => {
      const response = await request(app.server)
        .post('/api/v1/pipelines/validate')
        .send({
          yamlDefinition: validPipelineYaml,
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.errors).toEqual([]);
    });

    it('should detect invalid pipeline YAML', async () => {
      const response = await request(app.server)
        .post('/api/v1/pipelines/validate')
        .send({
          yamlDefinition: 'invalid: yaml',
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Pipeline Execution', () => {
    it('should trigger pipeline execution', async () => {
      // Create a pipeline first
      const createResponse = await request(app.server)
        .post('/api/v1/pipelines')
        .send({
          name: 'exec-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'exec-test-pipeline'),
        });

      const pipelineId = createResponse.body.id;

      // Trigger execution
      const execResponse = await request(app.server)
        .post(`/api/v1/pipelines/${pipelineId}/runs`)
        .send({
          triggerType: 'manual',
          triggerBy: 'test-user',
        });

      expect(execResponse.status).toBe(201);
      expect(execResponse.body.id).toBeDefined();
      expect(execResponse.body.pipelineId).toBe(pipelineId);
      expect(execResponse.body.status).toBe('pending');
    });

    it('should return 404 for non-existent pipeline execution', async () => {
      const response = await request(app.server)
        .post('/api/v1/pipelines/non-existent-id/runs')
        .send({
          triggerType: 'manual',
        });

      expect(response.status).toBe(404);
    });
  });
});