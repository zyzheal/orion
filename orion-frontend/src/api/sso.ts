/**
 * SSO Authentication API Service
 *
 * Aligned with backend /api/v1/auth/sso/* routes (sso-routes.ts)
 * Covers: SSO login redirect, callback, status, config
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface SsoStatus {
  ssoEnabled: boolean;
  ssoIssuer: string | null;
  ssoScopes: string[];
}

export interface SsoConfig {
  configured: boolean;
  issuerUrl?: string;
  clientId?: string;
  redirectUri?: string;
  scopes?: string[];
  enabled?: boolean;
}

// ==================== SSO Status & Config ====================

export const getSsoStatus = async (): Promise<SsoStatus> => {
  const response = await api.get<{ data: SsoStatus }>('/v1/auth/sso/status');
  return response.data.data;
};

export const getSsoConfig = async (): Promise<SsoConfig> => {
  const response = await api.get<{ data: SsoConfig }>('/v1/auth/sso/config');
  return response.data.data;
};

// ==================== SSO Login ====================

/**
 * Get SSO login redirect URL.
 * Note: In browser context, this typically redirects the user directly.
 * This function returns the URL for programmatic use (e.g., popup/iframe).
 */
export const getSsoLoginUrl = async (): Promise<string> => {
  // SSO login is a redirect endpoint; we construct the URL for frontend use
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${baseUrl}/v1/auth/sso/login`;
};
