/**
 * Capability API Client
 *
 * 后端 API 前缀: /api/v1/capabilities
 * 设计文档: docs/superpowers/specs/2026-05-19-capability-admin-pages-design.md
 */

import { request } from '@/utils/request';

// ==================== 类型定义 ====================

export interface Capability {
  id: string;
  capability_id: string;
  name: string;
  description?: string;
  category: string;
  risk_level: number;
  requires_approval: boolean;
  approval_role?: string;
  parent_capability_id?: string;
  enabled: boolean;
  child_count?: number;
  role_count?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  children?: Capability[];
}

export interface CapabilityTreeNode {
  id: string;
  capability_id: string;
  name: string;
  category: string;
  risk_level: number;
  children?: CapabilityTreeNode[];
}

export interface CreateCapabilityInput {
  capability_id: string;
  name: string;
  description?: string;
  category: string;
  parent_capability_id?: string;
  risk_level?: number;
  requires_approval?: boolean;
  approval_role?: string;
}

export interface UpdateCapabilityInput {
  name?: string;
  description?: string;
  risk_level?: number;
  requires_approval?: boolean;
  approval_role?: string;
}

export interface RoleCapability {
  role_id: string;
  role_name: string;
  capabilities: Array<{
    capability_id: string;
    capability_name?: string;
    granted: boolean;
    granted_at?: string;
  }>;
}

export interface UpdateRoleCapabilitiesInput {
  role_id: string;
  capabilities: Array<{
    capability_id: string;
    granted: boolean;
  }>;
}

export interface CapabilityMatrix {
  roles: Array<{
    role_id: string;
    role_name: string;
  }>;
  capabilities: Array<{
    capability_id: string;
    capability_name: string;
    category: string;
  }>;
  matrix: Record<string, boolean[]>;
}

export interface UserCapabilityOverride {
  id: string;
  user_id: string;
  user_name?: string;
  capability_id: string;
  capability_name?: string;
  granted: boolean;
  reason?: string;
  granted_by: string;
  granted_by_name?: string;
  expires_at: string | null;
  created_at: string;
}

export interface UserEffectiveCapabilities {
  user_id: string;
  user_name?: string;
  roles: string[];
  role_capabilities: string[];
  overrides: UserCapabilityOverride[];
  effective_capabilities: string[];
}

export interface GrantUserCapabilityInput {
  capability_id: string;
  granted: boolean;
  expires_in_hours?: number;
  reason?: string;
}

export interface CapabilityAuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name?: string;
  capability_id: string;
  capability_name?: string;
  action: 'check' | 'grant' | 'revoke' | 'approve' | 'deny';
  result: 'allowed' | 'denied' | 'pending_approval';
  reason?: string;
  request_ip?: string;
  user_agent?: string;
  risk_level: number;
  duration?: number;
}

export interface PermissionRequest {
  ticket_id: number;
  capability_id: string;
  capability_name?: string;
  user_id: string;
  user_name?: string;
  requested_at: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  duration_hours: number;
  expires_at?: string;
  approved_by?: string;
  approved_at?: string;
  reject_reason?: string;
}

export interface RequestPermissionInput {
  capability_id: string;
  reason: string;
  duration_hours: number;
  environment_suffix?: string;
  user_id?: string;
  tenant_id?: string;
}

export interface CheckPermissionResult {
  allowed: boolean;
  capability_id: string;
  reason?: string;
  requires_approval?: boolean;
}

export interface TemporaryPermission {
  id: number;
  user_id: string;
  user_name?: string;
  capability_id: string;
  capability_name?: string;
  tenant_id: string;
  granted_by: string;
  granted_by_name?: string;
  reason?: string;
  expires_at: string;
  created_at: string;
  revoked?: boolean;
  revoked_at?: string;
}

// ==================== API 客户端 ====================

export const capabilityApi = {
  // List capabilities
  list: (category?: string) => request.get('/capabilities', { params: { category } }),

  // Get capability tree
  getTree: () => request.get('/capabilities/tree'),

  // Get capability by ID
  getById: (id: string) => request.get(`/capabilities/${id}`),

  // Create capability
  create: (data: {
    capability_id: string;
    name: string;
    description?: string;
    category: string;
    parent_capability_id?: string;
    risk_level?: number;
    requires_approval?: boolean;
    approval_role?: string;
  }) => request.post('/capabilities', data),

  // Update capability
  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      risk_level?: number;
      requires_approval?: boolean;
      approval_role?: string;
    }
  ) => request.put(`/capabilities/${id}`, data),

  // Delete capability
  delete: (id: string) => request.delete(`/capabilities/${id}`),

  // Grant capability to role
  grantToRole: (capabilityId: string, roleName: string) =>
    request.post(`/capabilities/${capabilityId}/roles`, { roleName }),

  // Revoke capability from role
  revokeFromRole: (capabilityId: string, roleName: string) =>
    request.delete(`/capabilities/${capabilityId}/roles/${roleName}`),

  // Grant capability to user
  grantToUser: (capabilityId: string, userId: string, expiresInHours?: number) =>
    request.post(`/capabilities/${capabilityId}/users`, { userId, expiresInHours }),

  // Revoke capability from user
  revokeFromUser: (capabilityId: string, userId: string) =>
    request.delete(`/capabilities/${capabilityId}/users/${userId}`),

  // Map command to capability
  mapCommand: (data: {
    command_name: string;
    command_action: string;
    capability_id: string;
    environment_suffix?: string;
  }) => request.post('/capabilities/commands/mapping', data),

  // Get capability for command
  getCommandCapability: (command: string, action: string, environment?: string) =>
    request.get(`/capabilities/commands/${command}/actions/${action}`, { params: { environment } }),

  // Check permission
  checkPermission: (userId: string, userRoles: string[], capabilityId: string) =>
    request.post('/capabilities/check', { userId, userRoles, capabilityId }),

  // ==================== Temporary Permissions ====================

  // Grant temporary permission (admin)
  grantTemporary: (data: {
    tenant_id: string;
    user_id: string;
    capability_id: string;
    environment_suffix?: string;
    reason?: string;
    expires_in_hours: number;
  }) => request.post('/capabilities/temporary', data),

  // Get user's active temporary permissions
  getUserTemporaryPermissions: (userId: string, tenantId?: string) =>
    request.get(`/capabilities/temporary/${userId}`, { params: { tenant_id: tenantId } }),

  // Revoke temporary permission
  revokeTemporary: (id: number, reason?: string) =>
    request.delete(`/capabilities/temporary/${id}`, { data: { reason } }),

  // ==================== Permission Audit ====================

  // Get audit logs
  getAuditLogs: (params?: {
    user_id?: string;
    capability_id?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) => request.get('/capabilities/audit', { params }),

  // ==================== Permission Request ====================

  // Submit permission request
  requestPermission: (data: {
    capability_id: string;
    environment_suffix?: string;
    duration_hours: number;
    reason: string;
    user_id?: string;
    tenant_id?: string;
  }) => request.post('/capabilities/request', data),

  // Get permission request by ticket
  getPermissionRequest: (ticketId: number) => request.get(`/capabilities/request/${ticketId}`),

  // Cleanup expired permissions (admin)
  cleanup: () => request.post('/capabilities/cleanup'),

  // ==================== 用户有效能力 ====================

  // 获取用户有效能力（角色 + 覆盖）
  getEffectiveCapabilities: (params?: { user_id?: string; roles?: string }) =>
    request.get('/capabilities/user/effective', { params }),

  // ==================== 角色能力管理 ====================

  // 获取角色的能力列表
  getRoleCapabilities: (roleId: string) => request.get(`/capabilities/roles/${roleId}`),

  // 批量更新角色能力
  updateRoleCapabilities: (data: UpdateRoleCapabilitiesInput) =>
    request.put('/capabilities/roles', data),

  // 获取权限矩阵（全部角色）
  getCapabilityMatrix: () => request.get('/capabilities/matrix'),

  // ==================== 用户能力覆盖 ====================

  // 获取用户能力覆盖列表
  getUserOverrides: (userId: string, params?: { tenant_id?: string }) =>
    request.get(`/capabilities/users/${userId}/overrides`, { params }),

  // 添加用户能力覆盖
  addUserOverride: (
    userId: string,
    data: {
      capability_id: string;
      granted: boolean;
      expires_in_hours?: number;
      reason?: string;
    }
  ) => request.post(`/capabilities/users/${userId}/overrides`, data),

  // 删除用户能力覆盖
  removeUserOverride: (userId: string, capabilityId: string) =>
    request.delete(`/capabilities/users/${userId}/overrides/${capabilityId}`),

  // 简化版：获取用户临时权限
  getUserPermissions: (userId: string, tenantId?: string) =>
    request.get(`/capabilities/temporary/${userId}`, { params: { tenant_id: tenantId } }),

  // 简化版：授予临时权限
  grantPermission: (data: {
    user_id: string;
    capability_id: string;
    duration_hours: number;
    reason?: string;
    environment_suffix?: string;
    tenant_id?: string;
  }) => request.post('/capabilities/grant', data),

  // 简化版：撤销临时权限
  revokePermission: (id: number) => request.delete(`/capabilities/grant/${id}`),

  // ==================== 权限申请审批 ====================

  // 简化版：申请权限
  submitPermissionRequest: (data: RequestPermissionInput) =>
    request.post('/capabilities/request/permission', data),

  // 获取用户的权限申请记录
  getUserPermissionRequests: (userId: string) =>
    request.get(`/capabilities/request/user/${userId}`),

  // 审批权限申请
  approveRequest: (ticketId: number, tenantId?: string) =>
    request.post(`/capabilities/request/${ticketId}/approve`, { tenant_id: tenantId }),

  // 拒绝权限申请
  rejectRequest: (ticketId: number, reason?: string) =>
    request.post(`/capabilities/request/${ticketId}/reject`, { reason }),
};
