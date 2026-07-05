/**
 * NotificationChannelService Tests
 */

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'test-tenant'),
  getCurrentTraceId: jest.fn(() => ''),
}));

import { NotificationChannelService, ChannelSendResult, ChannelConfig } from '../NotificationChannelService';
import { Notification, CreateNotificationInput } from '../NotificationRepository';

describe('NotificationChannelService', () => {
  let mockRepository: jest.Mocked<{
    create(input: CreateNotificationInput): Promise<Notification>;
    markAsSent(id: string): Promise<Notification | null>;
  }>;
  let service: NotificationChannelService;
  let mockNotification: Notification;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      markAsSent: jest.fn(),
    };

    service = new NotificationChannelService(mockRepository);

    mockNotification = {
      id: 'notif-1',
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      type: 'alert',
      title: 'Test Alert',
      message: 'Test message',
      channel: 'in-app',
      status: 'pending',
      sent_at: null,
      read_at: null,
      created_at: new Date(),
    };
  });

  describe('send', () => {
    it('should return success for email channel', async () => {
      const channel: ChannelConfig = { type: 'email', host: 'smtp.test.com', port: 587, from: 'test@test.com' };

      const result: ChannelSendResult = await service.send(mockNotification, channel);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^email-notif-1-/);
    });

    it('should return success for webhook channel', async () => {
      const channel: ChannelConfig = {
        type: 'webhook',
        url: 'https://example.com/hook',
        method: 'POST',
      };

      // Mock fetch to avoid real network call
      const mockFetch = jest.fn(() =>
        Promise.resolve(new Response('OK', { status: 200 }))
      );
      (globalThis as any).fetch = mockFetch;

      const result: ChannelSendResult = await service.send(mockNotification, channel);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('webhook');
      expect(result.messageId).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({
          method: 'POST',
        })
      );

      delete (globalThis as any).fetch;
    });

    it('should return failure for webhook channel when HTTP status is not OK', async () => {
      const channel: ChannelConfig = {
        type: 'webhook',
        url: 'https://example.com/hook',
      };

      const mockFetch = jest.fn(() =>
        Promise.resolve(new Response('Error', { status: 500 }))
      );
      (globalThis as any).fetch = mockFetch;

      const result: ChannelSendResult = await service.send(mockNotification, channel);

      expect(result.success).toBe(false);
      expect(result.channel).toBe('webhook');
      expect(result.error).toBeDefined();

      delete (globalThis as any).fetch;
    });

    it('should return success for in-app channel', async () => {
      const channel: ChannelConfig = { type: 'in-app' };

      const result: ChannelSendResult = await service.send(mockNotification, channel);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('in-app');
      expect(result.messageId).toBeDefined();
    });

    it('should return success for slack channel', async () => {
      const channel: ChannelConfig = { type: 'slack' };

      const result: ChannelSendResult = await service.send(mockNotification, channel);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('slack');
    });

    it('should return success for dingtalk channel', async () => {
      const channel: ChannelConfig = { type: 'dingtalk' };

      const result: ChannelSendResult = await service.send(mockNotification, channel);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('dingtalk');
    });

    it('should return success for wechat channel', async () => {
      const channel: ChannelConfig = { type: 'wechat' };

      const result: ChannelSendResult = await service.send(mockNotification, channel);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('wechat');
    });
  });

  describe('sendBatch', () => {
    it('should send multiple notifications and return an array of results', async () => {
      const channel: ChannelConfig = { type: 'email', host: 'smtp.test.com', port: 25, from: 'test@test.com' };
      const notifications = [
        mockNotification,
        { ...mockNotification, id: 'notif-2', title: 'Second' },
        { ...mockNotification, id: 'notif-3', title: 'Third' },
      ];

      const results = await service.sendBatch(notifications, channel);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.map((r) => r.channel)).toEqual(['email', 'email', 'email']);
    });
  });

  describe('sendByChannel', () => {
    it('should filter and send notifications by channel type', async () => {
      const emailChannel: ChannelConfig = { type: 'email', host: 'smtp.test.com', port: 25, from: 'test@test.com' };
      const webhookChannel: ChannelConfig = { type: 'webhook', url: 'https://example.com/hook' };

      const mockFetch = jest.fn(() =>
        Promise.resolve(new Response('OK', { status: 200 }))
      );
      (globalThis as any).fetch = mockFetch;

      const notifications = [mockNotification];
      const results = await service.sendByChannel('tenant-1', 'webhook', notifications);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('webhook');

      delete (globalThis as any).fetch;
    });
  });
});
