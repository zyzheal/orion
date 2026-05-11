/**
 * Core type definitions for orion-platform-core
 */

// ==================== Tenant ====================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'active' | 'suspended' | 'deleted';
export type TenantPlan = 'free' | 'pro' | 'enterprise';

export interface TenantSettings {
  maxProjects: number;
  maxUsersPerProject: number;
  features: string[];
  metadata: Record<string, unknown>;
}

export type CreateTenantInput = {
  name: string;
  slug: string;
  plan?: TenantPlan;
  settings?: Partial<TenantSettings>;
};

export type UpdateTenantInput = Partial<{
  name: string;
  status: TenantStatus;
  plan: TenantPlan;
  settings: Partial<TenantSettings>;
}>;

// ==================== Project ====================

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 'active' | 'archived' | 'deleted';

export type CreateProjectInput = {
  name: string;
  slug: string;
  description?: string;
};

export type UpdateProjectInput = Partial<{
  name: string;
  description: string | null;
  status: ProjectStatus;
}>;

// ==================== User ====================

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type UserStatus = 'active' | 'disabled' | 'deleted';

export type CreateUserInput = {
  email: string;
  name?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateUserInput = Partial<{
  name: string;
  avatarUrl: string | null;
  status: UserStatus;
  metadata: Record<string, unknown>;
}>;

// ==================== Service Registry ====================

export interface ServiceInfo {
  id: string;
  serviceName: string;
  serviceUrl: string;
  version: string | null;
  status: ServiceStatus;
  healthUrl: string | null;
  metadata: Record<string, unknown>;
  lastHeartbeat: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}

export type ServiceStatus = 'active' | 'inactive' | 'maintenance';

export type RegisterServiceInput = {
  serviceName: string;
  serviceUrl: string;
  version?: string;
  healthUrl?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateServiceInput = Partial<{
  serviceUrl: string;
  version: string;
  status: ServiceStatus;
  healthUrl: string | null;
  metadata: Record<string, unknown>;
}>;

// ==================== RBAC ====================

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

export type RoleAssignment = {
  userId: string;
  roleId: string;
  scope: string;
  grantedAt: Date;
};

export type CreateRoleInput = {
  name: string;
  description?: string;
  permissions: string[];
};

export type UpdatePermissionsInput = {
  permissions: string[];
};

// ==================== API Key ====================

export interface ApiKey {
  id: string;
  tenantId: string | null;
  projectId: string | null;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export type CreateApiKeyInput = {
  name: string;
  tenantId?: string;
  projectId?: string;
  scopes: string[];
  expiresAt?: Date;
};

export type ApiKeyResponse = Omit<ApiKey, 'keyHash'> & {
  key?: string;
};

// ==================== System Config ====================

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  scope: ConfigScope;
  tenantId: string | null;
  projectId: string | null;
  isEncrypted: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConfigScope = 'global' | 'tenant' | 'project';

export type CreateConfigInput = {
  key: string;
  value: string;
  scope?: ConfigScope;
  tenantId?: string;
  projectId?: string;
  isEncrypted?: boolean;
  description?: string;
};

export type UpdateConfigInput = {
  value: string;
  description?: string;
};

// ==================== API Response ====================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

// ==================== Events ====================

export type PlatformEvent = {
  type: string;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  timestamp: Date;
  payload: Record<string, unknown>;
};

export const PlatformEvents = {
  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  TENANT_SUSPENDED: 'tenant.suspended',
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DISABLED: 'user.disabled',
  API_KEY_CREATED: 'apikey.created',
  API_KEY_REVOKED: 'apikey.revoked',
  ROLE_UPDATED: 'role.updated',
  CONFIG_CHANGED: 'config.changed',
  SERVICE_REGISTERED: 'service.registered',
  SERVICE_DEREGISTERED: 'service.deregistered',
  SERVICE_HEARTBEAT: 'service.heartbeat',
} as const;
