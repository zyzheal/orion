/**
 * Unified Authentication Utilities for Sub-Applications
 *
 * All sub-application frontends should use this module for authentication.
 * It handles:
 *   - Token storage (localStorage + memory cache)
 *   - Axios request interceptor (inject Authorization header)
 *   - Axios response interceptor (401 → redirect to SSO login)
 *   - Orion-MF micro-frontend auth event communication
 *
 * Usage in sub-application:
 *   import { createAuthApiClient } from '@/utils/auth';
 *   const api = createAuthApiClient({ baseURL: '/api' });
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// ==================== Token Storage ====================

const TOKEN_KEY = 'orion_access_token';
const REFRESH_TOKEN_KEY = 'orion_refresh_token';
const TOKEN_EXPIRES_AT = 'orion_token_expires_at';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (ms)
}

/**
 * Get stored access token
 */
export function getToken(): string | null {
  const expiresAt = localStorage.getItem(TOKEN_EXPIRES_AT);
  if (expiresAt && Date.now() > parseInt(expiresAt, 10)) {
    // Token expired
    clearTokens();
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store tokens
 */
export function setTokens(tokens: TokenPair): void {
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(TOKEN_EXPIRES_AT, String(tokens.expiresAt));
}

/**
 * Clear all tokens
 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_AT);
}

/**
 * Check if user is authenticated (has valid token)
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

// ==================== API Client Factory ====================

export interface AuthApiClientOptions {
  /** Axios base URL (e.g., '/api') */
  baseURL: string;
  /** Redirect URL for SSO login (default: /auth/login) */
  loginUrl?: string;
  /** Whether to notify parent app on 401 (for micro-frontends) */
  notifyParent?: boolean;
  /** Custom refresh token handler */
  onRefreshToken?: () => Promise<TokenPair | null>;
}

/**
 * Create an authenticated API client with automatic token management
 */
export function createAuthApiClient(options: AuthApiClientOptions): AxiosInstance {
  const {
    baseURL,
    loginUrl = '/auth/login',
    notifyParent = true,
    onRefreshToken,
  } = options;

  const client = axios.create({ baseURL });

  // Request interceptor: inject Authorization header
  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: handle 401 → redirect to SSO login
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error) => {
      if (error.response?.status === 401) {
        // Clear expired tokens
        clearTokens();

        // Notify parent app (for micro-frontends running in Orion-MF)
        if (notifyParent && typeof window !== 'undefined' && window.__POWERED_BY_ORION__) {
          window.dispatchEvent(new CustomEvent('orion-subapp-need-auth', {
            detail: { redirectUrl: window.location.pathname },
          }));
        } else {
          // Redirect to SSO login page
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
          const redirectParam = encodeURIComponent(currentPath);
          if (typeof window !== 'undefined') {
            window.location.href = `${loginUrl}?redirect=${redirectParam}`;
          }
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

// ==================== SSO Login Helpers ====================

/**
 * Get SSO login URL with redirect
 */
export function getLoginUrl(redirect?: string): string {
  const redirectPath = redirect || (typeof window !== 'undefined' ? window.location.pathname : '/');
  return `/auth/login?redirect=${encodeURIComponent(redirectPath)}`;
}

/**
 * Get enabled SSO providers (for dynamic login page)
 */
export async function getSsoProviders(): Promise<Array<{
  name: string;
  type: string;
  display_name: string;
  display_icon?: string;
}>> {
  try {
    const response = await axios.get('/api/v1/auth/sso/providers-enabled');
    return response.data.data || [];
  } catch {
    // Fallback to default providers
    return [
      { name: 'local', type: 'local', display_name: '账号密码登录', display_icon: 'user' },
    ];
  }
}

// ==================== Logout ====================

/**
 * Logout and clear all tokens
 *
 * Calls the backend logout endpoint to:
 *   1. Delete refresh token
 *   2. Blacklist access token (single sign-out)
 *   3. Clear local tokens
 *   4. Redirect to login
 */
export async function logout(): Promise<void> {
  const accessToken = getToken();
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  try {
    await axios.post('/api/v1/auth/logout', {
      accessToken,
      refreshToken,
    });
  } catch {
    // Continue logout even if backend call fails
  }

  clearTokens();

  // Notify all sub-apps (micro-frontend)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('orion-logout', {
      detail: { timestamp: Date.now() },
    }));

    // Redirect to login
    window.location.href = '/auth/login';
  }
}

// ==================== Export Default ====================

export default {
  getToken,
  setTokens,
  clearTokens,
  isAuthenticated,
  createAuthApiClient,
  getLoginUrl,
  getSsoProviders,
  logout,
};
