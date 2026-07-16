/**
 * MetricsController 单元测试 - 增强版
 */
import { MetricsController } from '../MetricsController';

function createMockReply() {
  const reply: any = {
    code: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

describe('MetricsController', () => {
  let controller: MetricsController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      record: jest.fn(),
      query: jest.fn(),
      getStats: jest.fn(),
    };
    controller = new MetricsController(mockService);
  });

  describe('record', () => {
    it('should record metric successfully', async () => {
      mockService.record.mockResolvedValue({
        id: 'm-1', tenantId: 't-1', name: 'cpu_usage', value: 75.5, unit: '%',
      });

      const request = {
        body: { tenantId: 't-1', name: 'cpu_usage', value: 75.5, unit: '%' },
      } as any;
      const reply = createMockReply();

      await controller.record(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'm-1' }),
      }));
    });

    it('should return 400 for missing tenantId', async () => {
      const request = { body: { name: 'cpu', value: 50, unit: '%' } } as any;
      const reply = createMockReply();

      await controller.record(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing name', async () => {
      const request = { body: { tenantId: 't-1', value: 50, unit: '%' } } as any;
      const reply = createMockReply();

      await controller.record(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing value', async () => {
      const request = { body: { tenantId: 't-1', name: 'cpu', unit: '%' } } as any;
      const reply = createMockReply();

      await controller.record(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing unit', async () => {
      const request = { body: { tenantId: 't-1', name: 'cpu', value: 50 } } as any;
      const reply = createMockReply();

      await controller.record(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockService.record.mockRejectedValue(new Error('db error'));

      const request = {
        body: { tenantId: 't-1', name: 'cpu', value: 50, unit: '%' },
      } as any;
      const reply = createMockReply();

      await controller.record(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });

  describe('query', () => {
    it('should query metrics successfully', async () => {
      mockService.query.mockResolvedValue([
        { id: 'm-1', name: 'cpu_usage', value: 75.5 },
      ]);

      const request = {
        body: { tenantId: 't-1', name: 'cpu_usage' },
      } as any;
      const reply = createMockReply();

      await controller.query(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array),
        total: 1,
      }));
    });

    it('should return 400 for missing tenantId', async () => {
      const request = { body: { name: 'cpu' } } as any;
      const reply = createMockReply();

      await controller.query(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for missing name', async () => {
      const request = { body: { tenantId: 't-1' } } as any;
      const reply = createMockReply();

      await controller.query(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getStats', () => {
    it('should return aggregated stats', async () => {
      mockService.getStats.mockResolvedValue({ avg: 50, min: 10, max: 90, count: 100 });

      const request = {
        body: { tenantId: 't-1', name: 'cpu_usage' },
      } as any;
      const reply = createMockReply();

      await controller.getStats(request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ avg: 50, min: 10, max: 90, count: 100 }),
      }));
    });

    it('should return 400 for missing tenantId', async () => {
      const request = { body: { name: 'cpu' } } as any;
      const reply = createMockReply();

      await controller.getStats(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockService.getStats.mockRejectedValue(new Error('aggregation error'));

      const request = {
        body: { tenantId: 't-1', name: 'cpu' },
      } as any;
      const reply = createMockReply();

      await controller.getStats(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
    });
  });
});
