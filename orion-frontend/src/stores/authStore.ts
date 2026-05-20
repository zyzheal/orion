import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { UserInfo } from '@/api/types';
import { refreshAuthTokenApi } from '@/api/auth';
import { injectAuthState } from '@/microfront/config';

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  setUser: (user: UserInfo | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  setTokens: (accessToken: string, refreshToken: string, expiresAt?: number) => void;
  getToken: () => Promise<string | null>;
  refreshAuthToken: () => Promise<string | null>;
  isTokenExpiring: () => boolean;
  logout: () => void;
}

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRES_KEY = 'token_expires_at';

// 从 localStorage 初始化 token
const initTokenFromStorage = (): {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
} => {
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const tokenExpiresAt = localStorage.getItem(TOKEN_EXPIRES_KEY);
  return {
    accessToken,
    refreshToken: refreshToken || null,
    tokenExpiresAt: tokenExpiresAt ? parseInt(tokenExpiresAt, 10) : null,
  };
};

const {
  accessToken: initAccessToken,
  refreshToken: initRefreshToken,
  tokenExpiresAt: initExpiresAt,
} = initTokenFromStorage();

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false, // 初始值为 false，表示没有在进行中的操作
    accessToken: initAccessToken,
    refreshToken: initRefreshToken,
    tokenExpiresAt: initExpiresAt,

    setUser: (user) => {
      set({ user });
      // 登录成功后注入认证状态到微前端
      injectAuthState();
    },

    setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

    setLoading: (loading) => set({ isLoading: loading }),

    setTokens: (accessToken, refreshToken, expiresAt) => {
      const expires = expiresAt || Date.now() + 24 * 60 * 60 * 1000; // 默认 24 小时
      set({
        accessToken,
        refreshToken,
        tokenExpiresAt: expires,
        isAuthenticated: true,
      });
      // 持久化到 localStorage
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(TOKEN_EXPIRES_KEY, String(expires));
      // 登录成功后注入认证状态到微前端
      injectAuthState();
    },

    getToken: async (): Promise<string | null> => {
      const { accessToken, tokenExpiresAt } = get();

      if (!accessToken) {
        return null;
      }

      // Token 未过期，直接返回
      if (tokenExpiresAt && tokenExpiresAt > Date.now()) {
        return accessToken;
      }

      // Token 已过期，尝试刷新
      return get().refreshAuthToken();
    },

    refreshAuthToken: async (): Promise<string | null> => {
      const { refreshToken } = get();

      if (!refreshToken) {
        console.warn('[Auth] No refresh token available');
        return null;
      }

      try {
        const response = await refreshAuthTokenApi(refreshToken);
        const { accessToken, refreshToken: newRefreshToken, expiresAt } = response;

        set({
          accessToken,
          refreshToken: newRefreshToken || refreshToken,
          tokenExpiresAt: expiresAt,
          isAuthenticated: true,
        });

        // 持久化
        localStorage.setItem(TOKEN_KEY, accessToken);
        if (newRefreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
        }
        localStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));

        // Token刷新后同步到微前端
        injectAuthState();

        return accessToken;
      } catch (error) {
        console.error('[Auth] Failed to refresh token:', error);
        get().logout();
        return null;
      }
    },

    isTokenExpiring: (): boolean => {
      const { tokenExpiresAt } = get();
      if (!tokenExpiresAt) return false;

      // 5 分钟内过期
      return tokenExpiresAt - Date.now() < 5 * 60 * 1000;
    },

    logout: () => {
      set({
        user: null,
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        isLoading: false,
      });
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRES_KEY);
    },
  }))
);
