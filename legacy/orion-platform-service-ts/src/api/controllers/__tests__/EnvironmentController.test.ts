/**
 * EnvironmentController 单元测试 - 增强版
 */
import { EnvironmentController } from '../EnvironmentController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('EnvironmentController', () => {
  let controller: EnvironmentController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      createEnvironment: jest.fn(),
      listByProject: jest.fn(),
      listAll: jest.fn(),
      getEnvironment: jest.fn(),
      updateEnvironment: jest.fn(),
      deleteEnvironment: jest.fn(),
      updateStatus: jest.fn(),
      lockEnvironment: jest.fn(),
      unlockEnvironment: jest.fn(),
      getLockInfo: jest.fn(),
      checkDeploymentAllowed: jest.fn(),
    };
    controller = new EnvironmentController(mockService);
  });

  describe('create', () => {
    it('should create environment successfully', async () => {
      mockService.createEnvironment.mockResolvedValue({
        id: 'env-1', project_id: 'p-1', name: 'dev', type: 'development',
        cluster: 'k8s-dev', namespace: 'default', config: {}, status: 'active',
        created_at: '', updated_at: '',
      });

      const request = {
        body: { projectId: 'p-1', name: 'dev', type: 'development' },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 'env-1',
        name: 'dev',
      }));
    });

    it('should return 400 for missing projectId', async () => {
      const request = { body: { name: 'dev', type: 'development' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing name', async () => {
      const request = { body: { projectId: 'p-1', type: 'development' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing type', async () => {
      const request = { body: { projectId: 'p-1', name: 'dev' } } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockService.createEnvironment.mockRejectedValue(new Error('db error'));

      const request = {
        body: { projectId: 'p-1', name: 'dev', type: 'development' },
      } as any;
      const reply = createMockReply();

      await controller.create(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('list', () => {
    it('should list all environments', async () => {
      mockService.listAll.mockResolvedValue([
        { id: 'env-1', project_id: 'p-1', name: 'dev', type: 'development', status: 'active' },
      ]);

      const request = { query: {} } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'env-1' }),
      ]));
    });

    it('should list environments by project', async () => {
      mockService.listByProject.mockResolvedValue([
        { id: 'env-1', project_id: 'p-1', name: 'dev', type: 'development' },
      ]);

      const request = { query: { projectId: 'p-1' } } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(mockService.listByProject).toHaveBeenCalledWith('p-1');
    });

    it('should return 500 on service error', async () => {
      mockService.listAll.mockRejectedValue(new Error('db error'));

      const request = { query: {} } as any;
      const reply = createMockReply();

      await controller.list(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getById', () => {
    it('should return environment by id', async () => {
      mockService.getEnvironment.mockResolvedValue({
        id: 'env-1', project_id: 'p-1', name: 'dev', type: 'development',
        cluster: 'k8s-dev', namespace: 'default', config: {}, status: 'active',
        created_at: '', updated_at: '',
      });

      const request = { params: { id: 'env-1' } } as any;
      const reply = createMockReply();

      await controller.getById(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 'env-1',
        name: 'dev',
      }));
    });

    it('should return 500 on service error', async () => {
      mockService.getEnvironment.mockRejectedValue(new Error('not found'));

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getById(request, reply);

      expect(reply.status).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update environment successfully', async () => {
      mockService.updateEnvironment.mockResolvedValue({
        id: 'env-1', project_id: 'p-1', name: 'updated', type: 'development',
        cluster: 'k8s-dev', namespace: 'default', config: {}, status: 'active',
        created_at: '', updated_at: '',
      });

      const request = {
        params: { id: 'env-1' },
        body: { name: 'updated' },
      } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 'env-1',
        name: 'updated',
      }));
    });

    it('should return 500 on service error', async () => {
      mockService.updateEnvironment.mockRejectedValue(new Error('update failed'));

      const request = { params: { id: 'env-1' }, body: {} } as any;
      const reply = createMockReply();

      await controller.update(request, reply);

      expect(reply.status).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete environment successfully', async () => {
      mockService.deleteEnvironment.mockResolvedValue(undefined);

      const request = { params: { id: 'env-1' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.status).toHaveBeenCalledWith(204);
    });

    it('should return 500 on service error', async () => {
      mockService.deleteEnvironment.mockRejectedValue(new Error('delete failed'));

      const request = { params: { id: 'env-1' } } as any;
      const reply = createMockReply();

      await controller.delete(request, reply);

      expect(reply.status).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update environment status', async () => {
      mockService.updateStatus.mockResolvedValue({
        id: 'env-1', project_id: 'p-1', name: 'dev', type: 'development',
        status: 'inactive', updated_at: '',
      });

      const request = {
        params: { id: 'env-1' },
        body: { status: 'inactive' },
      } as any;
      const reply = createMockReply();

      await controller.updateStatus(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        status: 'inactive',
      }));
    });

    it('should return 400 for missing status', async () => {
      const request = {
        params: { id: 'env-1' },
        body: {},
      } as any;
      const reply = createMockReply();

      await controller.updateStatus(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('lockEnvironment', () => {
    it('should lock environment', async () => {
      mockService.lockEnvironment.mockResolvedValue({
        id: 'env-1', name: 'dev', locked: true, locked_by: 'admin',
        locked_at: '', locked_reason: 'maintenance', updated_at: '',
      });

      const request = {
        params: { id: 'env-1' },
        body: { reason: 'maintenance', lockedBy: 'admin' },
      } as any;
      const reply = createMockReply();

      await controller.lockEnvironment(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        locked: true,
      }));
    });

    it('should return 400 for missing reason', async () => {
      const request = {
        params: { id: 'env-1' },
        body: {},
      } as any;
      const reply = createMockReply();

      await controller.lockEnvironment(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('unlockEnvironment', () => {
    it('should unlock environment', async () => {
      mockService.unlockEnvironment.mockResolvedValue({
        id: 'env-1', name: 'dev', locked: false, updated_at: '',
      });

      const request = { params: { id: 'env-1' } } as any;
      const reply = createMockReply();

      await controller.unlockEnvironment(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        locked: false,
      }));
    });
  });
});
