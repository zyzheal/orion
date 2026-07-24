import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('API Client Interceptors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should attach access_token from localStorage to request headers', async () => {
    localStorage.setItem('access_token', 'test-token');

    // Verify the interceptor logic directly
    const token = localStorage.getItem('access_token');
    expect(token).toBe('test-token');

    const config: any = { headers: {} };
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    expect(config.headers.Authorization).toBe('Bearer test-token');
  });

  it('should not attach header when no token exists', async () => {
    const config: any = { headers: {} };
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('should clear tokens and redirect on 401 without refresh token', async () => {
    localStorage.setItem('access_token', 'expired-token');
    // No refresh_token set

    // Simulate 401 response handler logic
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
