import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

// Mock refreshAuthToken API
vi.mock('@/api/auth', () => ({
  refreshAuthToken: vi.fn(),
}));

describe('authStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    });
    localStorage.clear();
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('should set user', () => {
    const mockUser = {
      id: '1',
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin',
    };

    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('should set authenticated state', () => {
    useAuthStore.getState().setAuthenticated(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().setAuthenticated(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should set loading state', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);

    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('should set tokens and persist to localStorage', () => {
    const mockToken = 'test-access-token';
    const mockRefreshToken = 'test-refresh-token';
    const expiresAt = Date.now() + 3600000; // 1 hour

    useAuthStore.getState().setTokens(mockToken, mockRefreshToken, expiresAt);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(mockToken);
    expect(state.refreshToken).toBe(mockRefreshToken);
    expect(state.tokenExpiresAt).toBe(expiresAt);

    // Verify localStorage persistence
    expect(localStorage.getItem('access_token')).toBe(mockToken);
    expect(localStorage.getItem('refresh_token')).toBe(mockRefreshToken);
    expect(localStorage.getItem('token_expires_at')).toBe(String(expiresAt));
  });

  it('should get token if not expired', async () => {
    const mockToken = 'test-access-token';
    const expiresAt = Date.now() + 3600000;

    useAuthStore.getState().setTokens(mockToken, 'refresh-token', expiresAt);

    const token = await useAuthStore.getState().getToken();
    expect(token).toBe(mockToken);
  });

  it('should return null if no token available', async () => {
    const token = await useAuthStore.getState().getToken();
    expect(token).toBeNull();
  });

  it('should detect expiring token', () => {
    const notExpiringAt = Date.now() + 3600000; // 1 hour
    const expiringAt = Date.now() + 60000; // 1 minute

    useAuthStore.getState().setTokens('token1', 'refresh1', notExpiringAt);
    expect(useAuthStore.getState().isTokenExpiring()).toBe(false);

    useAuthStore.getState().setTokens('token2', 'refresh2', expiringAt);
    expect(useAuthStore.getState().isTokenExpiring()).toBe(true);
  });

  it('should logout and clear tokens from localStorage', () => {
    useAuthStore.getState().setTokens('test-token', 'test-refresh', Date.now() + 3600000);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('token_expires_at')).toBeNull();
  });
});
