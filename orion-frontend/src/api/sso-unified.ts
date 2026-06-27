/**
 * Unified SSO Authentication API Service
 *
 * Aligned with backend /api/v1/auth/sso/* routes (sso-unified-routes.ts)
 * Covers: unified SSO login, LDAP login, enabled providers listing
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface SsoProviderInfo {
  name: string;
  type: string;
  display_name: string;
  display_icon?: string;
}

export interface LdapLoginInput {
  username: string;
  password: string;
}

export interface SsoLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    userId: string;
    username: string;
    email: string;
    name: string;
    roles: string[];
  };
}

// ==================== Enabled Providers ====================

export const getEnabledSsoProviders = async (): Promise<SsoProviderInfo[]> => {
  const response = await api.get<{ data: SsoProviderInfo[] }>('/v1/auth/sso/providers-enabled');
  return response.data.data;
};

// ==================== LDAP Login ====================

export const ldapLogin = async (data: LdapLoginInput): Promise<SsoLoginResult> => {
  const response = await api.post<{ data: SsoLoginResult }>('/v1/auth/sso/ldap', data);
  return response.data.data;
};

// ==================== SSO Login URL ====================

/**
 * Get SSO login redirect URL for a specific provider.
 * In browser context, this typically redirects the user directly.
 */
export const getSsoLoginUrl = (provider: string): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${baseUrl}/v1/auth/sso/login/${provider}`;
};

/**
 * Get SSO callback URL for a specific provider.
 * This is used internally by the auth flow; typically not called directly from frontend.
 */
export const getSsoCallbackUrl = (provider: string): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${baseUrl}/v1/auth/sso/callback/${provider}`;
};
