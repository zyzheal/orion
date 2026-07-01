/**
 * GlobalParam - Cross-pipeline shared parameters
 *
 * Provides tenant-scoped, pipeline-scoped, or globally-scoped parameters
 * that can be shared across pipelines. Mirrors NeatLogic's global parameter pattern.
 */

export type GlobalParamScope = 'tenant' | 'pipeline' | 'global';

export interface GlobalParam {
  id: string;
  tenantId: string;
  key: string;
  value: string;
  description?: string;
  isSecret: boolean;
  scope: GlobalParamScope;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGlobalParam {
  tenantId: string;
  key: string;
  value: string;
  description?: string;
  isSecret?: boolean;
  scope?: GlobalParamScope;
  expiresAt?: Date;
}

export interface UpdateGlobalParam {
  value?: string;
  description?: string;
  isSecret?: boolean;
  scope?: GlobalParamScope;
  expiresAt?: Date;
}

export interface GlobalParamEntity {
  id: string;
  tenant_id: string;
  key: string;
  value: string;
  description?: string;
  is_secret: boolean;
  scope: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}
