/**
 * Pipeline API 集成测试 (Fastify 版本)
 */

import Fastify from 'fastify';
import apiRoutes from '@/api/routes';
import { EventBusService } from '@/services/event-bus-service';

describe('Pipeline API', () => {
  let app: Fastify.FastifyInstance;
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
    await app.register(apiRoutes, { prefix: '/api/v1', eventBus: mockEventBus });
  }, 10000);

  afterEach(async () => {
    await app.close();
  }, 10000);

  describe('POST /api/v1/pipelines', () => {
    it('should create a pipeline', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'api-test-pipeline',
          version: '1.0.0',
          description: 'Test Pipeline',
          yamlDefinition: validPipelineYaml,
          createdBy: 'test-user',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('api-test-pipeline');
      expect(body.version).toBe('1.0.0');
    });

    it('should reject missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'incomplete-pipeline',
          // Missing version and yamlDefinition
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid YAML', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'invalid-yaml-pipeline',
          version: '1.0.0',
          yamlDefinition: 'invalid yaml content',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/pipelines', () => {
    it('should list pipelines', async () => {
      // First create a pipeline
      await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'list-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'list-test-pipeline'),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/pipelines',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/pipelines/:id', () => {
    it('should get pipeline by id', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'get-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'get-test-pipeline'),
        },
      });
      const createBody = JSON.parse(createResponse.body);
      const pipelineId = createBody.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/pipelines/${pipelineId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(pipelineId);
      expect(body.spec).toBeDefined();
    });

    it('should return 404 for non-existent pipeline', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/pipelines/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/pipelines/:id', () => {
    it('should update pipeline description', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'update-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'update-test-pipeline'),
        },
      });
      const createBody = JSON.parse(createResponse.body);
      const pipelineId = createBody.id;

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/pipelines/${pipelineId}`,
        payload: {
          description: 'Updated description',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/v1/pipelines/:id', () => {
    it('should delete pipeline', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'delete-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'delete-test-pipeline'),
        },
      });
      const createBody = JSON.parse(createResponse.body);
      const pipelineId = createBody.id;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/pipelines/${pipelineId}`,
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('POST /api/v1/pipelines/validate', () => {
    it('should validate correct pipeline YAML', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines/validate',
        payload: {
          yamlDefinition: validPipelineYaml,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(true);
      expect(body.errors).toEqual([]);
    });

    it('should detect invalid pipeline YAML', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines/validate',
        payload: {
          yamlDefinition: 'invalid: yaml',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Pipeline Execution', () => {
    it('should trigger pipeline execution', async () => {
      // Create a pipeline first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines',
        payload: {
          name: 'exec-test-pipeline',
          version: '1.0.0',
          yamlDefinition: validPipelineYaml.replace('api-test-pipeline', 'exec-test-pipeline'),
        },
      });
      const createBody = JSON.parse(createResponse.body);
      const pipelineId = createBody.id;

      // Trigger execution
      const execResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/pipelines/${pipelineId}/runs`,
        payload: {
          triggerType: 'manual',
          triggerBy: 'test-user',
        },
      });

      expect(execResponse.statusCode).toBe(201);
      const body = JSON.parse(execResponse.body);
      expect(body.id).toBeDefined();
      expect(body.pipelineId).toBe(pipelineId);
      expect(body.status).toBe('pending');
    });

    it('should return 404 for non-existent pipeline execution', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/pipelines/non-existent-id/runs',
        payload: {
          triggerType: 'manual',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});