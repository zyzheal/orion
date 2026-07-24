/**
 * API Key Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getApiKeys, createApiKey, revokeApiKey, getApiKeyStats } from '../api-key';
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

describe('API Key API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get API keys', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await getApiKeys();
    expect(api.get).toHaveBeenCalledWith('/v1/api-keys');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should create an API key', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: '1', name: 'test' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await createApiKey({ name: 'test' });
    expect(api.post).toHaveBeenCalledWith('/v1/api-keys', { name: 'test' });
    expect(result.data.name).toBe('test');
  });

  it('should revoke an API key', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await revokeApiKey('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/api-keys/1');
  });

  it('should get API key stats', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { total: 10, active: 8, expired: 2 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await getApiKeyStats();
    expect(result.data.active).toBe(8);
  });
});
