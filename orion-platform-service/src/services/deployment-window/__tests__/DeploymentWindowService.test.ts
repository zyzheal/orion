/**
 * DeploymentWindowService 单元测试
 */

import { DeploymentWindowService } from '../DeploymentWindowService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('DeploymentWindowService', () => {
  let service: DeploymentWindowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeploymentWindowService(mockPool as any);
  });

  describe('createWindow', () => {
    it('应该创建部署窗口', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w1',
          tenant_id: 'tenant1',
          name: 'weekday-business-hours',
          environment: 'production',
          start_time: '09:00',
          end_time: '17:00',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          timezone: 'UTC',
          blocking: true,
        }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant1',
        name: 'weekday-business-hours',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(result.name).toBe('weekday-business-hours');
      expect(result.days).toContain('mon');
    });

    it('应该使用默认工作日', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w1',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(result.days).toHaveLength(5);
    });

    it('应该使用默认时区 UTC', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w1', timezone: 'UTC' }],
      });

      const result = await service.createWindow({
        tenant_id: 'tenant1',
        name: 'window',
        environment: 'production',
        start_time: '09:00',
        end_time: '17:00',
      });

      expect(result.timezone).toBe('UTC');
    });
  });

  describe('listWindows', () => {
    it('应该返回窗口列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'w1', name: 'window1' },
          { id: 'w2', name: 'window2' },
        ],
      });

      const result = await service.listWindows('tenant1');

      expect(result.length).toBe(2);
    });

    it('应该支持按环境过滤', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'w1', environment: 'production' }],
      });

      await service.listWindows('tenant1', 'production');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('environment = $2'),
        ['tenant1', 'production']
      );
    });
  });

  describe('checkDeploymentAllowed', () => {
    it('应该允许在窗口内部署', async () => {
      // Create a window that includes current time
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w1',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start_time: '00:00',
          end_time: '23:59',
        }],
      });

      const result = await service.checkDeploymentAllowed('tenant1', 'production');

      expect(result.allowed).toBe(true);
    });

    it('应该拒绝在窗口外部署', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w1',
          days: ['sun'],
          start_time: '00:00',
          end_time: '23:59',
        }],
      });

      const result = await service.checkDeploymentAllowed('tenant1', 'production');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Outside deployment window');
    });

    it('应该返回下一个可用窗口', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w1',
          days: ['sun'],
          start_time: '00:00',
          end_time: '23:59',
        }],
      });

      const result = await service.checkDeploymentAllowed('tenant1', 'production');

      expect(result.nextWindow).toBeDefined();
    });

    it('应该支持指定时间检查', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'w1',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start_time: '09:00',
          end_time: '17:00',
        }],
      });

      // Monday 10:00 AM
      const scheduledTime = new Date('2024-01-08T10:00:00Z'); // Monday
      const result = await service.checkDeploymentAllowed('tenant1', 'production', scheduledTime);

      expect(result).toBeDefined();
    });

    it('应该处理空窗口列表', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkDeploymentAllowed('tenant1', 'production');

      expect(result.allowed).toBe(false);
    });
  });

  describe('createBlackout', () => {
    it('应该创建 blackout 期', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b1',
          tenant_id: 'tenant1',
          name: 'holiday-blackout',
          start_at: new Date('2024-01-01'),
          end_at: new Date('2024-01-02'),
          reason: 'New Year holiday',
          blocking: true,
        }],
      });

      const result = await service.createBlackout({
        tenant_id: 'tenant1',
        name: 'holiday-blackout',
        start_at: new Date('2024-01-01'),
        end_at: new Date('2024-01-02'),
        reason: 'New Year holiday',
      });

      expect(result.name).toBe('holiday-blackout');
      expect(result.reason).toBe('New Year holiday');
    });
  });

  describe('checkBlackout', () => {
    it('应该检测当前在 blackout 期内', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b1',
          start_at: new Date(now.getTime() - 1000),
          end_at: new Date(now.getTime() + 1000),
        }],
      });

      const result = await service.checkBlackout('tenant1');

      expect(result.blocked).toBe(true);
      expect(result.blackout).toBeDefined();
    });

    it('应该返回不在 blackout 期', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.checkBlackout('tenant1');

      expect(result.blocked).toBe(false);
      expect(result.blackout).toBeUndefined();
    });

    it('应该支持指定时间检查', async () => {
      const scheduledTime = new Date('2024-01-01T12:00:00Z');
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'b1',
          start_at: new Date('2024-01-01'),
          end_at: new Date('2024-01-02'),
        }],
      });

      const result = await service.checkBlackout('tenant1', scheduledTime);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('start_at <= $2 AND end_at >= $2'),
        ['tenant1', scheduledTime]
      );
    });
  });

  describe('isWithinWindow', () => {
    it('应该检测时间在窗口内', () => {
      const window = {
        days: ['mon'],
        start_time: '09:00',
        end_time: '17:00',
      };

      // Monday 10:00
      const time = new Date('2024-01-08T10:00:00Z'); // Monday
      const result = service.isWithinWindow(window as any, time);

      expect(result).toBe(true);
    });

    it('应该检测时间在窗口外（错误的日期）', () => {
      const window = {
        days: ['tue'],
        start_time: '09:00',
        end_time: '17:00',
      };

      // Monday
      const time = new Date('2024-01-08T10:00:00Z');
      const result = service.isWithinWindow(window as any, time);

      expect(result).toBe(false);
    });

    it('应该检测时间在窗口外（错误的时间）', () => {
      const window = {
        days: ['mon'],
        start_time: '09:00',
        end_time: '17:00',
      };

      // Monday 08:00 (before window)
      const time = new Date('2024-01-08T08:00:00Z');
      const result = service.isWithinWindow(window as any, time);

      expect(result).toBe(false);
    });
  });

  describe('findNextWindow', () => {
    it('应该找到下一个可用窗口', () => {
      const windows = [{
        days: ['mon'],
        start_time: '09:00',
        end_time: '17:00',
      }];

      const fromTime = new Date('2024-01-07T10:00:00Z'); // Sunday
      const result = service.findNextWindow(windows as any, fromTime);

      expect(result).toBeDefined();
    });
  });
});