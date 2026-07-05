/**
 * SSO Providers Management API Service
 *
 * Aligned with backend /api/v1/auth/sso/providers/* routes (sso-providers-routes.ts)
 * Covers: provider CRUD, connection testing
 */
import { api } from './client';

// ==================== Interfaces ====================

export interface SsoProvider {
  id: string;
  name: string;
  type: 'oidc' | 'ldap' | 'wechat' | 'cas' | 'saml';
  enabled: boolean;
  display_name: string;
  display_icon?: string;
  config?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSsoProviderInput {
  name: string;
  type: 'oidc' | 'ldap' | 'wechat' | 'cas' | 'saml';
  enabled?: boolean;
  display_name?: string;
  display_icon?: string;
  config?: Record<string, any>;
}

export interface UpdateSsoProviderInput {
  enabled?: boolean;
  display_name?: string;
  display_icon?: string;
  config?: Record<string, any>;
}

export interface SsoProviderTestResult {
  success: boolean;
  message: string;
}

// ==================== Provider CRUD ====================

export const listSsoProviders = async (): Promise<SsoProvider[]> => {
  const response = await api.get<{ data: SsoProvider[] }>('/api/v1/auth/sso/providers');
  return response.data.data;
};

export const getSsoProvider = async (name: string): Promise<SsoProvider> => {
  const response = await api.get<{ data: SsoProvider }>(`/api/v1/auth/sso/providers/${name}`);
  return response.data.data;
};

export const createSsoProvider = async (data: CreateSsoProviderInput): Promise<void> => {
  await api.post('/api/v1/auth/sso/providers', data);
};

export const updateSsoProvider = async (name: string, data: UpdateSsoProviderInput): Promise<void> => {
  await api.patch(`/api/v1/auth/sso/providers/${name}`, data);
};

export const deleteSsoProvider = async (name: string): Promise<void> => {
  await api.delete(`/api/v1/auth/sso/providers/${name}`);
};

// ==================== Provider Testing ====================

export const testSsoProvider = async (name: string): Promise<SsoProviderTestResult> => {
  const response = await api.post<{ data: SsoProviderTestResult }>(`/api/v1/auth/sso/providers/${name}/test`);
  return response.data.data;
};
