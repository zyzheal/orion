/**
 * Capability API Client
 */

import { request } from '@/utils/request';

export const capabilityApi = {
  // List capabilities
  list: (category?: string) =>
    request.get('/capabilities', { params: { category } }),

  // Get capability tree
  getTree: () =>
    request.get('/capabilities/tree'),

  // Get capability by ID
  getById: (id: string) =>
    request.get(`/capabilities/${id}`),

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
  }) =>
    request.post('/capabilities', data),

  // Update capability
  update: (id: string, data: {
    name?: string;
    description?: string;
    risk_level?: number;
    requires_approval?: boolean;
    approval_role?: string;
  }) =>
    request.put(`/capabilities/${id}`, data),

  // Delete capability
  delete: (id: string) =>
    request.delete(`/capabilities/${id}`),

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
  }) =>
    request.post('/capabilities/commands/mapping', data),

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
  }) =>
    request.post('/capabilities/temporary', data),

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
  }) =>
    request.get('/capabilities/audit', { params }),

  // ==================== Permission Request ====================

  // Submit permission request
  requestPermission: (data: {
    capability_id: string;
    environment_suffix?: string;
    duration_hours: number;
    reason: string;
    user_id?: string;
    tenant_id?: string;
  }) =>
    request.post('/capabilities/request', data),

  // Get permission request by ticket
  getPermissionRequest: (ticketId: number) =>
    request.get(`/capabilities/request/${ticketId}`),

  // Cleanup expired permissions (admin)
  cleanup: () =>
    request.post('/capabilities/cleanup'),
};