/**
 * AlertStateService 单元测试
 *
 * 测试告警状态管理：已读/确认/忽略、批量操作、未读计数、资源所有权校验。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import { AlertStateService } from '../AlertStateService';

describe('AlertStateService', () => {
  let service: AlertStateService;
  let mockPool: any;

  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    service = new AlertStateService(mockPool);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== listByUserId ====================

  describe('listByUserId', () => {
    it('should return alert states for user', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'as-1',
          user_id: 'user-1',
          alert_id: 'alert-1',
          state: 'unread',
          read_at: null,
          dismissed_at: null,
          escalation_stopped: false,
          escalation_current_level: 0,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await service.listByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].alertId).toBe('alert-1');
      expect(result[0].state).toBe('unread');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM chatops_alert_states'),
        ['user-1']
      );
    });

    it('should return empty array when no alerts exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.listByUserId('user-1');

      expect(result).toHaveLength(0);
    });

    it('should map row fields correctly', async () => {
      const now = new Date();
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'as-1',
          user_id: 'user-1',
          alert_id: 'alert-1',
          state: 'acknowledged',
          read_at: now,
          dismissed_at: null,
          escalation_stopped: true,
          escalation_current_level: 3,
          created_at: now,
        }],
        rowCount: 1,
      });

      const result = await service.listByUserId('user-1');

      expect(result[0].state).toBe('acknowledged');
      expect(result[0].readAt).toEqual(now);
      expect(result[0].escalationStopped).toBe(true);
      expect(result[0].escalationCurrentLevel).toBe(3);
    });
  });

  // ==================== markAsRead ====================

  describe('markAsRead', () => {
    it('should mark alert as read when ownership is valid', async () => {
      // validateAlertOwnership: tenant check passes
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      // upsertState
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await service.markAsRead('user-1', 'alert-1');

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query.mock.calls[1][0]).toContain('INSERT INTO chatops_alert_states');
    });

    it('should throw OrionError when ownership validation fails', async () => {
      // tenant check fails
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      // user_resources check fails
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      // NODE_ENV = production -> validation fails
      process.env.NODE_ENV = 'production';

      await expect(service.markAsRead('user-1', 'alert-1')).rejects.toThrow('无权访问该告警');
    });

    it('should allow in development environment even without ownership', async () => {
      // tenant check fails
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      // user_resources check fails
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      // NODE_ENV = development -> fallback allows
      process.env.NODE_ENV = 'development';
      // upsertState
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await service.markAsRead('user-1', 'alert-1');

      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });
  });

  // ==================== markAsAcknowledged ====================

  describe('markAsAcknowledged', () => {
    it('should mark alert as acknowledged', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // ownership
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // upsert

      await service.markAsAcknowledged('user-1', 'alert-1');

      const upsertCall = mockPool.query.mock.calls[1];
      expect(upsertCall[1]).toContain('acknowledged');
    });
  });

  // ==================== markAsDismissed ====================

  describe('markAsDismissed', () => {
    it('should mark alert as dismissed', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // ownership
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // upsert

      await service.markAsDismissed('user-1', 'alert-1');

      const upsertCall = mockPool.query.mock.calls[1];
      expect(upsertCall[1]).toContain('dismissed');
    });
  });

  // ==================== batchMarkAsRead ====================

  describe('batchMarkAsRead', () => {
    it('should mark multiple alerts as read', async () => {
      // For each alert: ownership check + upsert
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await service.batchMarkAsRead('user-1', ['alert-1', 'alert-2', 'alert-3']);

      // 3 alerts * 2 calls each = 6
      expect(mockPool.query).toHaveBeenCalledTimes(6);
    });

    it('should skip alerts that fail ownership validation', async () => {
      // alert-1: ownership ok
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // upsert

      // alert-2: ownership fails (dev env fallback allows)
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      process.env.NODE_ENV = 'development';
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // upsert

      await service.batchMarkAsRead('user-1', ['alert-1', 'alert-2']);

      // Both should be processed in dev mode
      expect(mockPool.query).toHaveBeenCalledTimes(5);
    });

    it('should handle empty array', async () => {
      await service.batchMarkAsRead('user-1', []);

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  // ==================== getUnreadCount ====================

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ count: '5' }],
        rowCount: 1,
      });

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['user-1']
      );
    });

    it('should return 0 when no unread alerts', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ count: '0' }],
        rowCount: 1,
      });

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(0);
    });

    it('should handle missing count field', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{}],
        rowCount: 1,
      });

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(0);
    });
  });

  // ==================== validateAlertOwnership ====================

  describe('validateAlertOwnership - tenant-based', () => {
    it('should pass when alert belongs to user tenant', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      // Use markAsRead to test ownership
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      await service.markAsRead('user-1', 'alert-1');

      expect(mockPool.query.mock.calls[0][0]).toContain('user_tenants');
    });
  });

  describe('validateAlertOwnership - user_resources fallback', () => {
    it('should fall back to user_resources when tenant check fails', async () => {
      // Tenant check fails
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      // user_resources check passes
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
      // upsert
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await service.markAsRead('user-1', 'alert-1');

      expect(mockPool.query.mock.calls[0][0]).toContain('user_tenants');
      expect(mockPool.query.mock.calls[1][0]).toContain('user_resources');
    });
  });

  describe('validateAlertOwnership - production vs development', () => {
    it('should deny in production when both checks fail', async () => {
      process.env.NODE_ENV = 'production';
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await expect(service.markAsRead('user-1', 'alert-1')).rejects.toThrow('无权访问该告警');
    });

    it('should allow in development when both checks fail', async () => {
      process.env.NODE_ENV = 'development';
      // tenant check fails, user_resources check fails, then upsert succeeds
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 }) // tenant
        .mockResolvedValueOnce({ rowCount: 0 }) // user_resources
        .mockResolvedValueOnce({ rowCount: 1 }); // upsert

      await service.markAsRead('user-1', 'alert-1');

      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });
  });
});
