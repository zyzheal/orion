/**
 * PipelineController 单元测试
 */

import { PipelineController } from '../PipelineController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('PipelineController', () => {
  let controller: PipelineController;
  let mockPipelineService: any;

  beforeEach(() => {
    mockPipelineService = {
      create: jest.fn(),
      list: jest.fn(),
      getById: jest.fn(),
      getVersions: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      validate: jest.fn(),
    };
    controller = new PipelineController(mockPipelineService);
  });

  describe('create', () => {
    it('should create pipeline successfully', async () => {
      const mockPipeline = {
        id: 'p-1',
        name: 'test-pipeline',
        version: '1.0.0',
        description: 'desc',
        status: 'active',
        created_at: new Date().toISOString(),
      };
      mockPipelineService.create.mockResolvedValue(mockPipeline);

      const request = {
        body: { name: 'test-pipeline', version: '1.0.0', yamlDefinition: 'stages: []' },
        headers: { 'x-tenant-id': 'tenant-1' },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 'p-1',
        name: 'test-pipeline',
      }));
    });

    it('should return 400 for missing required fields', async () => {
      const request = {
        body: { name: 'test-pipeline' },
        headers: {},
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'VALIDATION_ERROR',
      }));
    });

    it('should return 409 for duplicate pipeline', async () => {
      mockPipelineService.create.mockRejectedValue(new Error('already exists'));

      const request = {
        body: { name: 'dup', version: '1.0.0', yamlDefinition: 'stages: []' },
        headers: { 'x-tenant-id': 'tenant-1' },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(409);
    });

    it('should return 400 for validation error', async () => {
      mockPipelineService.create.mockRejectedValue(new Error('validation failed'));

      const request = {
        body: { name: 'test', version: '1.0.0', yamlDefinition: 'stages: []' },
        headers: { 'x-tenant-id': 'tenant-1' },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 for internal errors', async () => {
      mockPipelineService.create.mockRejectedValue(new Error('db connection failed'));

      const request = {
        body: { name: 'test', version: '1.0.0', yamlDefinition: 'stages: []' },
        headers: { 'x-tenant-id': 'tenant-1' },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('list', () => {
    it('should list pipelines successfully', async () => {
      mockPipelineService.list.mockResolvedValue([
        { id: 'p-1', name: 'pipeline-1', version: '1.0', description: '', status: 'active', created_at: '' },
      ]);

      const request = { query: {}, headers: { 'x-tenant-id': 'tenant-1' } } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.any(Array),
        total: 1,
      }));
    });

    it('should return 500 on service error', async () => {
      mockPipelineService.list.mockRejectedValue(new Error('db error'));

      const request = { query: {}, headers: { 'x-tenant-id': 'tenant-1' } } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getById', () => {
    it('should return pipeline by id', async () => {
      mockPipelineService.getById.mockResolvedValue({
        id: 'p-1', name: 'test', version: '1.0', description: '', yamlDefinition: '', status: 'active',
        spec: {}, created_by: 'user-1', created_at: '', updated_at: '',
      });

      const request = { params: { id: 'p-1' } } as any;
      const reply = createMockReply();

      await controller.getById(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1' }));
    });

    it('should return 404 when not found', async () => {
      mockPipelineService.getById.mockResolvedValue(null);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getById(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getVersions', () => {
    it('should return versions for existing pipeline', async () => {
      mockPipelineService.getById.mockResolvedValue({ id: 'p-1' });
      mockPipelineService.getVersions.mockResolvedValue([
        { id: 'v-1', name: 'v1', version: '1.0', description: '', status: 'active', createdAt: '' },
      ]);

      const request = { params: { id: 'p-1' }, headers: { 'x-tenant-id': 'tenant-1' } } as any;
      const reply = createMockReply();

      await controller.getVersions(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.any(Array),
      }));
    });

    it('should return 404 when pipeline not found', async () => {
      mockPipelineService.getById.mockResolvedValue(null);

      const request = { params: { id: 'missing' }, headers: {} } as any;
      const reply = createMockReply();

      await controller.getVersions(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('update', () => {
    it('should update pipeline successfully', async () => {
      mockPipelineService.update.mockResolvedValue({
        id: 'p-1', name: 'test', version: '1.0', description: 'updated', yamlDefinition: '', status: 'active', updated_at: '',
      });

      const request = { params: { id: 'p-1' }, body: { description: 'updated' } } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ description: 'updated' }));
    });

    it('should return 404 when pipeline not found', async () => {
      mockPipelineService.update.mockResolvedValue(null);

      const request = { params: { id: 'missing' }, body: {} } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for validation error', async () => {
      mockPipelineService.update.mockRejectedValue(new Error('validation failed'));

      const request = { params: { id: 'p-1' }, body: {} } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('delete', () => {
    it('should delete pipeline successfully', async () => {
      mockPipelineService.delete.mockResolvedValue(true);

      const request = { params: { id: 'p-1' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.status).toHaveBeenCalledWith(204);
    });

    it('should return 404 when pipeline not found', async () => {
      mockPipelineService.delete.mockResolvedValue(false);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('validate', () => {
    it('should validate yaml successfully', async () => {
      mockPipelineService.validate.mockResolvedValue({ valid: true, errors: [] });

      const request = { body: { yamlDefinition: 'stages: []' } } as any;
      const reply = createMockReply();

      await controller.validate(request, reply);

      expect(reply.send).toHaveBeenCalledWith({ valid: true, errors: [] });
    });

    it('should return 400 for missing yamlDefinition', async () => {
      const request = { body: {} } as any;
      const reply = createMockReply();

      await controller.validate(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });
});
