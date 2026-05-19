/**
 * Role Management API Service
 * Role CRUD and permission assignment (RBAC)
 */
import { api } from './client';

// ---- Types ----

export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system?: boolean;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateRoleInput {
  tenantId: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface RoleListResponse {
  success: boolean;
  data: Role[];
  total: number;
}

export interface RoleDetailResponse {
  success: boolean;
  data: Role;
}

// ---- Common permission definitions ----

/**
 * Predefined permission strings following the "resource:action" pattern.
 * These represent the common permissions available in the Orion platform.
 */
export const COMMON_PERMISSIONS = [
  // Pipeline
  { value: 'pipeline:read', label: '流水线 - 查看' },
  { value: 'pipeline:write', label: '流水线 - 编辑' },
  { value: 'pipeline:execute', label: '流水线 - 执行' },
  { value: 'pipeline:delete', label: '流水线 - 删除' },
  // Deployment
  { value: 'deployment:read', label: '部署 - 查看' },
  { value: 'deployment:write', label: '部署 - 编辑' },
  { value: 'deployment:execute', label: '部署 - 执行' },
  { value: 'deployment:delete', label: '部署 - 删除' },
  // Monitoring
  { value: 'monitoring:read', label: '监控 - 查看' },
  { value: 'monitoring:write', label: '监控 - 编辑' },
  // Alert
  { value: 'alert:read', label: '告警 - 查看' },
  { value: 'alert:write', label: '告警 - 编辑' },
  { value: 'alert:acknowledge', label: '告警 - 确认' },
  // Config
  { value: 'config:read', label: '配置 - 查看' },
  { value: 'config:write', label: '配置 - 编辑' },
  // Tenant
  { value: 'tenant:read', label: '租户 - 查看' },
  { value: 'tenant:write', label: '租户 - 编辑' },
  // User
  { value: 'user:read', label: '用户 - 查看' },
  { value: 'user:write', label: '用户 - 编辑' },
  { value: 'user:delete', label: '用户 - 删除' },
  // Role
  { value: 'role:read', label: '角色 - 查看' },
  { value: 'role:write', label: '角色 - 编辑' },
  { value: 'role:delete', label: '角色 - 删除' },
  // FinOps
  { value: 'finops:read', label: '成本 - 查看' },
  { value: 'finops:write', label: '成本 - 编辑' },
  // Artifact
  { value: 'artifact:read', label: '制品 - 查看' },
  { value: 'artifact:write', label: '制品 - 编辑' },
  { value: 'artifact:delete', label: '制品 - 删除' },
  // CMDB
  { value: 'cmdb:read', label: 'CMDB - 查看' },
  { value: 'cmdb:write', label: 'CMDB - 编辑' },
  // Audit
  { value: 'audit:read', label: '审计 - 查看' },
  // AI
  { value: 'ai:use', label: 'AI - 使用' },
  { value: 'ai:manage', label: 'AI - 管理' },
];

// Permission groups for display
export const PERMISSION_GROUPS = [
  {
    group: '流水线 (Pipeline)',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('pipeline:')),
  },
  {
    group: '部署 (Deployment)',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('deployment:')),
  },
  {
    group: '监控告警 (Monitoring & Alert)',
    permissions: COMMON_PERMISSIONS.filter(
      (p) => p.value.startsWith('monitoring:') || p.value.startsWith('alert:')
    ),
  },
  {
    group: '配置管理 (Config)',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('config:')),
  },
  {
    group: '租户管理 (Tenant)',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('tenant:')),
  },
  {
    group: '用户角色 (User & Role)',
    permissions: COMMON_PERMISSIONS.filter(
      (p) => p.value.startsWith('user:') || p.value.startsWith('role:')
    ),
  },
  {
    group: '成本优化 (FinOps)',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('finops:')),
  },
  {
    group: '制品管理 (Artifact)',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('artifact:')),
  },
  {
    group: 'CMDB',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('cmdb:')),
  },
  {
    group: '审计 (Audit)',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('audit:')),
  },
  {
    group: 'AI 服务',
    permissions: COMMON_PERMISSIONS.filter((p) => p.value.startsWith('ai:')),
  },
];

// ---- CRUD Operations ----

/**
 * List roles for a tenant
 * GET /api/v1/roles?tenantId=xxx
 */
export function getRoles(tenantId: string) {
  return api.get<Role[]>('/v1/roles', { params: { tenantId } });
}

/**
 * Get role detail
 * GET /api/v1/roles/:id
 */
export function getRole(id: string) {
  return api.get<Role>(`/v1/roles/${id}`);
}

/**
 * Create a new role
 * POST /api/v1/roles
 */
export function createRole(data: CreateRoleInput) {
  return api.post<Role>('/v1/roles', data);
}

/**
 * Delete a role
 * DELETE /api/v1/roles/:id
 */
export function deleteRole(id: string) {
  return api.delete(`/v1/roles/${id}`);
}
