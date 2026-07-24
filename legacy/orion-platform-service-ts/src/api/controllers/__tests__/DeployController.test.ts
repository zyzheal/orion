/**
 * DeployController 单元测试 - 增强版
 */
import { DeployController } from '../DeployController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('DeployController', () => {
  let controller: DeployController;
  let mockSmartDeployService: any;

  beforeEach(() => {
    mockSmartDeployService = {
      deploy: jest.fn(),
      getStatus: jest.fn(),
      getHistory: jest.fn(),
      getMetrics: jest.fn(),
      getAuditTrail: jest.fn(),
      rollback: jest.fn(),
      getRollbackHistory: jest.fn(),
      cancelDeployment: jest.fn(),
      getLatestDeployment: jest.fn(),
    };
    controller = new DeployController(mockSmartDeployService);
  });

  describe('deploy', () => {
    it('should create deployment successfully', async () => {
      mockSmartDeployService.deploy.mockResolvedValue({
        id: 'd-1', appName: 'myapp', version: '1.0', environment: 'dev',
        strategy: 'rolling', status: 'running',
        stages: [{ name: 'build', status: 'running', steps: [] }],
        startedAt: new Date().toISOString(),
      });

      const request = {
        body: { appName: 'myapp', version: '1.0', environment: 'dev', initiatedBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.deploy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 'd-1',
        appName: 'myapp',
      }));
    });

    it('should return 400 for missing required fields', async () => {
      const request = { body: { appName: 'myapp' } } as any;
      const reply = createMockReply();

      await controller.deploy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'VALIDATION_ERROR',
      }));
    });

    it('should return 400 for invalid environment', async () => {
      const request = {
        body: { appName: 'myapp', version: '1.0', environment: 'invalid', initiatedBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.deploy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid strategy', async () => {
      const request = {
        body: { appName: 'myapp', version: '1.0', environment: 'dev', strategy: 'invalid', initiatedBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.deploy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockSmartDeployService.deploy.mockRejectedValue(new Error('db error'));

      const request = {
        body: { appName: 'myapp', version: '1.0', environment: 'dev', initiatedBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.deploy(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getStatus', () => {
    it('should return deployment status', async () => {
      mockSmartDeployService.getStatus.mockResolvedValue({
        id: 'd-1', appName: 'myapp', version: '1.0', environment: 'dev',
        strategy: 'rolling', status: 'running', stages: [],
        currentStageIndex: 0, startedAt: '', initiatedBy: 'user-1',
      });

      const request = { params: { id: 'd-1' } } as any;
      const reply = createMockReply();

      await controller.getStatus(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }));
    });

    it('should return 404 when not found', async () => {
      mockSmartDeployService.getStatus.mockResolvedValue(null);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getStatus(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getHistory', () => {
    it('should return deployment history', async () => {
      mockSmartDeployService.getHistory.mockResolvedValue({
        data: [{ id: 'd-1', appName: 'myapp', version: '1.0', environment: 'dev', strategy: 'rolling', status: 'success', initiatedBy: 'user-1', startedAt: '', completedAt: '' }],
        total: 1, limit: 20, offset: 0,
      });

      const request = { query: {} } as any;
      const reply = createMockReply();

      await controller.getHistory(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.any(Array),
        total: 1,
      }));
    });
  });

  describe('rollback', () => {
    it('should rollback deployment successfully', async () => {
      mockSmartDeployService.rollback.mockResolvedValue({
        deployment: { id: 'd-1', status: 'rolled-back', rollbackInfo: {} },
        rollback: { id: 'r-1', status: 'success', reason: 'bug', targetVersion: '0.9', startedAt: '', completedAt: '' },
      });

      const request = {
        params: { id: 'd-1' },
        body: { reason: 'bug', triggeredBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.rollback(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        deployment: expect.any(Object),
        rollback: expect.any(Object),
      }));
    });

    it('should return 400 for missing reason', async () => {
      const request = {
        params: { id: 'd-1' },
        body: { triggeredBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.rollback(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when deployment not found', async () => {
      mockSmartDeployService.rollback.mockRejectedValue(new Error('not found'));

      const request = {
        params: { id: 'missing' },
        body: { reason: 'bug', triggeredBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.rollback(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('cancel', () => {
    it('should cancel deployment successfully', async () => {
      mockSmartDeployService.cancelDeployment.mockResolvedValue({
        id: 'd-1', status: 'cancelled', completedAt: '',
      });

      const request = {
        params: { id: 'd-1' },
        body: { cancelledBy: 'user-1' },
      } as any;
      const reply = createMockReply();

      await controller.cancel(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    });

    it('should return 400 for missing cancelledBy', async () => {
      const request = {
        params: { id: 'd-1' },
        body: {},
      } as any;
      const reply = createMockReply();

      await controller.cancel(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getLatestDeployment', () => {
    it('should return latest deployment', async () => {
      mockSmartDeployService.getLatestDeployment.mockResolvedValue({
        id: 'd-1', appName: 'myapp', version: '1.0', environment: 'dev',
        strategy: 'rolling', status: 'success', startedAt: '', completedAt: '',
      });

      const request = { params: { appName: 'myapp', environment: 'dev' } } as any;
      const reply = createMockReply();

      await controller.getLatestDeployment(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }));
    });

    it('should return 404 when no deployments found', async () => {
      mockSmartDeployService.getLatestDeployment.mockResolvedValue(null);

      const request = { params: { appName: 'myapp', environment: 'dev' } } as any;
      const reply = createMockReply();

      await controller.getLatestDeployment(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });
});
