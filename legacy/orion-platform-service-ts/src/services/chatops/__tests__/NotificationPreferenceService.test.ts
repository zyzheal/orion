/**
 * NotificationPreferenceService 单元测试
 *
 * 测试通知偏好 CRUD：listByUserId、upsert、delete。
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

import { NotificationPreferenceService } from '../NotificationPreferenceService';

describe('NotificationPreferenceService', () => {
  let service: NotificationPreferenceService;
  let mockPool: any;

  const sampleRow = {
    id: 'pref-1',
    user_id: 'user-1',
    alert_level: 'critical',
    channel_chatops: true,
    channel_email: false,
    channel_slack: true,
    channel_feishu: false,
    channel_dingtalk: false,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    service = new NotificationPreferenceService(mockPool);
  });

  describe('constructor', () => {
    it('should create service with pool', () => {
      expect(service).toBeDefined();
    });
  });

  describe('listByUserId', () => {
    it('should return preferences for user', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleRow] });

      const result = await service.listByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].alertLevel).toBe('critical');
      expect(result[0].channelChatops).toBe(true);
      expect(result[0].channelEmail).toBe(false);
      expect(result[0].channelSlack).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM chatops_notification_preferences'),
        ['user-1'],
      );
    });

    it('should return empty array when no preferences exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.listByUserId('user-1');

      expect(result).toHaveLength(0);
    });

    it('should map all channel fields correctly', async () => {
      const row = {
        ...sampleRow,
        alert_level: 'warning',
        channel_chatops: false,
        channel_email: true,
        channel_slack: false,
        channel_feishu: true,
        channel_dingtalk: true,
      };
      mockPool.query.mockResolvedValue({ rows: [row] });

      const result = await service.listByUserId('user-1');

      expect(result[0].alertLevel).toBe('warning');
      expect(result[0].channelChatops).toBe(false);
      expect(result[0].channelEmail).toBe(true);
      expect(result[0].channelSlack).toBe(false);
      expect(result[0].channelFeishu).toBe(true);
      expect(result[0].channelDingtalk).toBe(true);
    });

    it('should map timestamps correctly', async () => {
      const createdAt = new Date('2024-06-01T10:00:00Z');
      const updatedAt = new Date('2024-06-02T15:00:00Z');
      mockPool.query.mockResolvedValue({
        rows: [{ ...sampleRow, created_at: createdAt, updated_at: updatedAt }],
      });

      const result = await service.listByUserId('user-1');

      expect(result[0].createdAt).toEqual(createdAt);
      expect(result[0].updatedAt).toEqual(updatedAt);
    });
  });

  describe('upsert', () => {
    it('should upsert preference with defaults', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleRow] });

      const result = await service.upsert({
        userId: 'user-1',
        alertLevel: 'critical',
      });

      expect(result.userId).toBe('user-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_notification_preferences'),
        ['user-1', 'critical', true, false, false, false, false],
      );
    });

    it('should upsert with custom channel settings', async () => {
      const customRow = {
        ...sampleRow,
        channel_chatops: false,
        channel_email: true,
        channel_slack: true,
        channel_feishu: true,
        channel_dingtalk: true,
      };
      mockPool.query.mockResolvedValue({ rows: [customRow] });

      const result = await service.upsert({
        userId: 'user-1',
        alertLevel: 'critical',
        channelChatops: false,
        channelEmail: true,
        channelSlack: true,
        channelFeishu: true,
        channelDingtalk: true,
      });

      expect(result.channelChatops).toBe(false);
      expect(result.channelEmail).toBe(true);
      expect(result.channelSlack).toBe(true);
      expect(result.channelFeishu).toBe(true);
      expect(result.channelDingtalk).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chatops_notification_preferences'),
        ['user-1', 'critical', false, true, true, true, true],
      );
    });

    it('should use ON CONFLICT for upsert', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleRow] });

      await service.upsert({ userId: 'user-1', alertLevel: 'critical' });

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('ON CONFLICT');
      expect(query).toContain('DO UPDATE SET');
    });

    it('should use RETURNING *', async () => {
      mockPool.query.mockResolvedValue({ rows: [sampleRow] });

      await service.upsert({ userId: 'user-1', alertLevel: 'critical' });

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('RETURNING *');
    });
  });

  describe('delete', () => {
    it('should delete preference by userId and alertLevel', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await service.delete('user-1', 'critical');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM chatops_notification_preferences WHERE user_id = $1 AND alert_level = $2',
        ['user-1', 'critical'],
      );
    });

    it('should not throw when deleting non-existent preference', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.delete('user-1', 'unknown')).resolves.toBeUndefined();
    });
  });
});
