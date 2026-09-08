/**
 * AuthConfig types
 * 抽取自 index.tsx (P2-9 Phase 203)
 */

export type ProviderType = 'oauth2' | 'oidc' | 'sso_saml' | 'ldap' | 'mfa';
export type ProviderStatus = 'active' | 'inactive' | 'error';

export interface AuthProvider {
  id: string;
  name: string;
  type: ProviderType;
  status: ProviderStatus;
  users: number;
  lastSync: string;
  config?: Record<string, unknown>;
}

export interface AuthPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scope: string;
}

export interface CreateProviderFormValues {
  name: string;
  type: ProviderType;
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;
}
