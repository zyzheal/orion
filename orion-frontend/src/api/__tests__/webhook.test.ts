/**
 * Webhook API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, testWebhook, getWebhookLogs } from '../webhook';
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

describe('Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get webhooks', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { webhooks: [] } });

    const result = await getWebhooks();
    expect(api.get).toHaveBeenCalledWith('/v1/webhooks');
    expect(Array.isArray(result.data.webhooks)).toBe(true);
  });

  it('should create a webhook', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { webhook: { id: '1', url: 'https://example.com', events: ['test'], enabled: true } } });

    const result = await createWebhook({ url: 'https://example.com', events: ['test'] });
    expect(api.post).toHaveBeenCalledWith('/v1/webhooks', { url: 'https://example.com', events: ['test'] });
    expect(result.data.webhook.url).toBe('https://example.com');
  });

  it('should update a webhook', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { webhook: { id: '1' } } });

    await updateWebhook('1', { enabled: false });
    expect(api.put).toHaveBeenCalledWith('/v1/webhooks/1', { enabled: false });
  });

  it('should delete a webhook', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined });

    await deleteWebhook('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/webhooks/1');
  });

  it('should test a webhook', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: undefined });

    await testWebhook('1');
    expect(api.post).toHaveBeenCalledWith('/v1/webhooks/1/test');
  });

  it('should get webhook logs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { logs: [] } });

    await getWebhookLogs('1', 20);
    expect(api.get).toHaveBeenCalledWith('/v1/webhooks/1/logs?limit=20');
  });
});
