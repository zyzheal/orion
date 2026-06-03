/**
 * TaskController 单元测试 - 增强版
 */
import { TaskController } from '../TaskController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('TaskController', () => {
  let controller: TaskController;
  let mockRunService: any;

  beforeEach(() => {
    mockRunService = {
      getTask: jest.fn(),
      updateTask: jest.fn(),
    };
    controller = new TaskController(mockRunService);
  });

  describe('getById', () => {
    it('should return task by id', async () => {
      mockRunService.getTask.mockResolvedValue({
        id: 't-1', stageId: 's-1', name: 'build', type: 'shell',
        sequence: 1, status: 'success', config: {}, parameters: {},
        resourceQuota: {}, retryCount: 0, maxRetries: 3, timeoutSeconds: 300,
        startedAt: '', completedAt: '', durationMs: 1000, result: {},
        log: 'output', error: null, createdAt: '',
      });

      const request = { params: { id: 't-1' } } as any;
      const reply = createMockReply();

      await controller.getById(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 't-1',
        name: 'build',
        status: 'success',
      }));
    });

    it('should return 404 when task not found', async () => {
      mockRunService.getTask.mockResolvedValue(null);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getById(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'NOT_FOUND',
      }));
    });

    it('should return 500 on service error', async () => {
      mockRunService.getTask.mockRejectedValue(new Error('db error'));

      const request = { params: { id: 't-1' } } as any;
      const reply = createMockReply();

      await controller.getById(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getLog', () => {
    it('should return task log', async () => {
      mockRunService.getTask.mockResolvedValue({
        id: 't-1', log: 'build output line 1\nline 2',
      });

      const request = { params: { id: 't-1' } } as any;
      const reply = createMockReply();

      await controller.getLog(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 't-1',
        log: 'build output line 1\nline 2',
      }));
    });

    it('should return empty log when task has no log', async () => {
      mockRunService.getTask.mockResolvedValue({ id: 't-1', log: null });

      const request = { params: { id: 't-1' } } as any;
      const reply = createMockReply();

      await controller.getLog(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        log: '',
      }));
    });

    it('should return 404 when task not found', async () => {
      mockRunService.getTask.mockResolvedValue(null);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.getLog(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe('retry', () => {
    it('should retry failed task', async () => {
      mockRunService.getTask.mockResolvedValue({
        id: 't-1', status: 'failed', retryCount: 1, maxRetries: 3,
      });
      mockRunService.updateTask.mockResolvedValue(undefined);

      const request = { params: { id: 't-1' } } as any;
      const reply = createMockReply();

      await controller.retry(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        id: 't-1',
        status: 'pending',
        retryCount: 2,
      }));
    });

    it('should return 404 when task not found', async () => {
      mockRunService.getTask.mockResolvedValue(null);

      const request = { params: { id: 'missing' } } as any;
      const reply = createMockReply();

      await controller.retry(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 when task is not in failed state', async () => {
      mockRunService.getTask.mockResolvedValue({
        id: 't-1', status: 'success', retryCount: 0, maxRetries: 3,
      });

      const request = { params: { id: 't-1' } } as any;
      const reply = createMockReply();

      await controller.retry(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'INVALID_STATE',
      }));
    });

    it('should return 400 when max retries exceeded', async () => {
      mockRunService.getTask.mockResolvedValue({
        id: 't-1', status: 'failed', retryCount: 3, maxRetries: 3,
      });

      const request = { params: { id: 't-1' } } as any;
      const reply = createMockReply();

      await controller.retry(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'MAX_RETRIES_EXCEEDED',
      }));
    });
  });
});
