import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '../auth';
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

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should login with credentials', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { accessToken: 'token123', refreshToken: 'rftoken', expiresAt: 1700000000 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await auth.login({ username: 'admin', password: 'pass123' });
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'pass123',
    });
    expect(result).toEqual({
      accessToken: 'token123',
      refreshToken: 'rftoken',
      expiresAt: 1700000000,
    });
  });

  it('should logout with access and refresh tokens', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await auth.logout('at-123', 'rt-456');
    expect(api.post).toHaveBeenCalledWith('/auth/logout', {
      accessToken: 'at-123',
      refreshToken: 'rt-456',
    });
  });

  it('should logout with undefined tokens when none provided', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await auth.logout();
    expect(api.post).toHaveBeenCalledWith('/auth/logout', {
      accessToken: undefined,
      refreshToken: undefined,
    });
  });

  it('should refresh token', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { accessToken: 'new-token', refreshToken: 'new-rftoken', expiresAt: 1700100000 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await auth.refreshToken('old-rf-token');
    expect(api.post).toHaveBeenCalledWith('/auth/refresh', {
      refreshToken: 'old-rf-token',
    });
    expect(result).toEqual({
      accessToken: 'new-token',
      refreshToken: 'new-rftoken',
      expiresAt: 1700100000,
    });
  });

  it('should refresh auth token and compute fallback expiresAt', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { accessToken: 'new-token', refreshToken: 'new-rftoken', expiresAt: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const before = Date.now();
    const result = await auth.refreshAuthTokenApi('old-rf');

    expect(result.accessToken).toBe('new-token');
    expect(result.refreshToken).toBe('new-rftoken');
    // When expiresAt is 0/falsy, fallback is Date.now() + 24h
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 5000);
    expect(result.expiresAt).toBeLessThanOrEqual(before + 24 * 60 * 60 * 1000 + 5000);
  });

  it('should get current user', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { id: 'u1', username: 'admin', email: 'admin@example.com', role: 'admin' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await auth.getCurrentUser();
    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual({
      id: 'u1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    });
  });

  it('should get enabled SSO providers', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { name: 'google', type: 'oauth', display_name: 'Google' },
        { name: 'github', type: 'oauth', display_name: 'GitHub' },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await auth.getEnabledSsoProviders();
    expect(api.get).toHaveBeenCalledWith('/auth/sso/providers-enabled');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('google');
  });

  it('should return empty array for null SSO providers response', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: null,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await auth.getEnabledSsoProviders();
    expect(result).toEqual([]);
  });

  it('should get SSO status', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ssoEnabled: true,
        ssoIssuer: 'https://sso.example.com',
        ssoScopes: ['openid', 'profile'],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await auth.getSsoStatus();
    expect(api.get).toHaveBeenCalledWith('/auth/sso/status');
    expect(result.ssoEnabled).toBe(true);
    expect(result.ssoIssuer).toBe('https://sso.example.com');
  });

  it('should get JWT key status', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        initialized: true,
        activeKeyId: 'key-v1',
        verificationKeyCount: 3,
        nextRotationDate: '2026-09-01',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await auth.getJwtKeyStatus();
    expect(api.get).toHaveBeenCalledWith('/auth/keys');
    expect(result.initialized).toBe(true);
    expect(result.activeKeyId).toBe('key-v1');
  });
});
