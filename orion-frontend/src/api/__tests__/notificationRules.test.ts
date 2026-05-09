/**
 * Notification Rules API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getIMNotificationRules,
  createIMNotificationRule,
  updateIMNotificationRule,
  deleteIMNotificationRule,
  toggleIMNotificationRule,
  testIMNotificationRule,
} from '../notificationRules';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Notification Rules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get IM notification rules', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [
          {
            id: '1',
            platform: 'dingtalk',
            name: '研发群',
            webhookUrl: 'https://oapi.dingtalk.com/robot/send',
            events: ['pipeline.complete'],
            enabled: true,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
      },
    } as any);

    const result = await getIMNotificationRules();
    expect(api.get).toHaveBeenCalledWith('/v1/notifications/im-rules');
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe('dingtalk');
  });

  it('should create an IM notification rule', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        data: {
          id: '1',
          platform: 'wecom',
          name: 'Test Rule',
          webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send',
          events: ['pipeline.failed'],
          enabled: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      },
    } as any);

    const result = await createIMNotificationRule({
      platform: 'wecom',
      name: 'Test Rule',
      webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send',
      events: ['pipeline.failed'],
    });
    expect(api.post).toHaveBeenCalledWith('/v1/notifications/im-rules', {
      platform: 'wecom',
      name: 'Test Rule',
      webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send',
      events: ['pipeline.failed'],
    });
    expect(result.name).toBe('Test Rule');
  });

  it('should update an IM notification rule', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { data: { id: '1', name: 'Updated' } },
    } as any);

    await updateIMNotificationRule('1', { name: 'Updated' });
    expect(api.put).toHaveBeenCalledWith('/v1/notifications/im-rules/1', { name: 'Updated' });
  });

  it('should delete an IM notification rule', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { data: undefined } } as any);

    await deleteIMNotificationRule('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/notifications/im-rules/1');
  });

  it('should toggle IM notification rule', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { data: { id: '1', enabled: false } },
    } as any);

    const result = await toggleIMNotificationRule('1', false);
    expect(api.put).toHaveBeenCalledWith('/v1/notifications/im-rules/1/toggle', { enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('should test an IM notification rule', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { success: true, message: 'OK' } },
    } as any);

    const result = await testIMNotificationRule('1');
    expect(api.post).toHaveBeenCalledWith('/v1/notifications/im-rules/1/test');
    expect(result.success).toBe(true);
  });
});
