/**
 * EnvProfile - Environment-specific configuration profile
 *
 * Provides named variable sets per deployment environment.
 * Mirrors NeatLogic's Profile management pattern.
 */

export interface EnvProfile {
  id: string;
  tenantId: string;
  name: string;
  environment: string; // development | staging | production
  variables: Record<string, string>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEnvProfile {
  tenantId: string;
  name: string;
  environment: string;
  variables: Record<string, string>;
  description?: string;
}

export interface UpdateEnvProfile {
  name?: string;
  environment?: string;
  variables?: Record<string, string>;
  description?: string;
}

export interface EnvProfileEntity {
  id: string;
  tenant_id: string;
  name: string;
  environment: string;
  variables: Record<string, string>;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EnvProfileFilter {
  tenantId?: string;
  name?: string;
  environment?: string;
}
