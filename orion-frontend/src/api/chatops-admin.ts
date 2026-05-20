/**
 * ChatOps Admin API Client
 *
 * 后端 API 前缀: /api/v1/chatops/admin
 * 对应后端路由: orion-platform-service/src/api/chatops-routes.ts
 *
 * 功能:
 * - 命令-Capability 映射管理 (CRUD)
 * - 审批配置管理
 * - 审批人管理
 * - 审计日志
 */

import { api } from './client';

// ==================== 类型定义 ====================

/** 命令-Capability 映射 */
export interface CapabilityMapping {
  id: string;
  command_id: string;
  capability_id: string;
  environment?: string;
  risk_level: number;
  requires_approval: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface CreateCapabilityMappingInput {
  command_id: string;
  capability_id: string;
  environment?: string;
  risk_level: number;
  requires_approval: boolean;
}

export interface UpdateCapabilityMappingInput {
  command_id?: string;
  capability_id?: string;
  environment?: string;
  risk_level?: number;
  requires_approval?: boolean;
}

/** 审批配置 */
export interface ApprovalConfig {
  id: string;
  capability: string;
  enabled: boolean;
  approvers: string[];
  threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateApprovalConfigInput {
  enabled?: boolean;
  approvers?: string[];
  threshold?: number;
}

/** 批量更新审批配置 */
export interface BatchApprovalConfigInput {
  capability: string;
  enabled: boolean;
  approvers: string[];
  threshold: number;
}

/** 审批人 */
export interface Approver {
  user_id: string;
  user_name: string;
  email?: string;
  role?: string;
  is_on_duty?: boolean;
}

/** 审批人排班 */
export interface ApproverScheduleEntry {
  user_id: string;
  start_time: string;
  end_time: string;
}

/** 全局审批配置 */
export interface GlobalApprovalConfig {
  enabled: boolean;
  mode: string;
}

/** 审计日志 */
export interface ChatOpsAuditLog {
  id: string;
  actor: { userId: string; platform?: string } | string;
  action: { command: string; params?: Record<string, unknown> } | string;
  timestamp: string;
  result?: 'success' | 'failed';
  details?: string;
}

export interface AuditLogParams {
  command?: string;
  userId?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

// ==================== API 客户端 ====================

export const chatopsAdminApi = {
  // ---- Capability Mappings ----

  /** 获取命令-Capability 映射列表 */
  getCapabilityMappings: (environment?: string) =>
    api.get<CapabilityMapping[]>('/v1/chatops/admin/capability-mappings', {
      params: { environment },
    }),

  /** 创建命令-Capability 映射 */
  createCapabilityMapping: (data: CreateCapabilityMappingInput) =>
    api.post<CapabilityMapping>('/v1/chatops/admin/capability-mappings', data),

  /** 更新命令-Capability 映射 */
  updateCapabilityMapping: (id: string, data: UpdateCapabilityMappingInput) =>
    api.put<CapabilityMapping>(`/v1/chatops/admin/capability-mappings/${id}`, data),

  /** 删除命令-Capability 映射 */
  deleteCapabilityMapping: (id: string) =>
    api.delete(`/v1/chatops/admin/capability-mappings/${id}`),

  // ---- Approval Configs ----

  /** 获取审批配置列表 */
  getApprovalConfigs: () =>
    api.get<ApprovalConfig[]>('/v1/chatops/admin/approval-configs'),

  /** 批量更新审批配置 */
  batchUpdateApprovalConfigs: (data: BatchApprovalConfigInput[]) =>
    api.put<ApprovalConfig[]>('/v1/chatops/admin/approval-configs', data),

  /** 获取单个能力域审批配置 */
  getApprovalConfig: (capability: string) =>
    api.get<ApprovalConfig>(`/v1/chatops/admin/approval-configs/${capability}`),

  /** 更新单个能力域审批配置 */
  updateApprovalConfig: (capability: string, data: UpdateApprovalConfigInput) =>
    api.put<ApprovalConfig>(`/v1/chatops/admin/approval-configs/${capability}`, data),

  // ---- Approver Management ----

  /** 获取审批人列表 */
  getApprovers: () =>
    api.get<Approver[]>('/v1/chatops/admin/approvers'),

  /** 获取审批人值班表 */
  getApproverSchedule: () =>
    api.get<ApproverScheduleEntry[]>('/v1/chatops/admin/approvers/schedule'),

  /** 更新审批人值班表 */
  updateApproverSchedule: (data: ApproverScheduleEntry[]) =>
    api.put('/v1/chatops/admin/approvers/schedule', data),

  // ---- Global Approval Config ----

  /** 获取全局审批配置 */
  getGlobalApprovalConfig: () =>
    api.get<GlobalApprovalConfig>('/v1/chatops/admin/approval-global-config'),

  /** 更新全局审批配置 */
  updateGlobalApprovalConfig: (data: { enabled: boolean; mode: string }) =>
    api.put('/v1/chatops/admin/approval-global-config', data),

  // ---- Permission Management ----

  /** 获取角色列表 */
  getRoles: () =>
    api.get('/v1/chatops/admin/roles'),

  /** 创建角色 */
  createRole: (data: { name: string; description?: string; permissions?: string[] }) =>
    api.post('/v1/chatops/admin/roles', data),

  /** 更新角色 */
  updateRole: (id: string, data: { name?: string; description?: string; permissions?: string[] }) =>
    api.put(`/v1/chatops/admin/roles/${id}`, data),

  /** 删除角色 */
  deleteRole: (id: string) =>
    api.delete(`/v1/chatops/admin/roles/${id}`),

  /** 获取命令权限列表 */
  getCommandPermissions: () =>
    api.get('/v1/chatops/admin/command-permissions'),

  /** 创建命令权限 */
  createCommandPermission: (data: { command: string; description?: string; capability: string; risk_level?: number; requires_approval?: boolean; role_ids?: string[] }) =>
    api.post('/v1/chatops/admin/command-permissions', data),

  /** 更新命令权限 */
  updateCommandPermission: (id: string, data: { description?: string; capability?: string; risk_level?: number; requires_approval?: boolean; role_ids?: string[] }) =>
    api.put(`/v1/chatops/admin/command-permissions/${id}`, data),

  /** 删除命令权限 */
  deleteCommandPermission: (id: string) =>
    api.delete(`/v1/chatops/admin/command-permissions/${id}`),

  /** 获取环境权限列表 */
  getEnvironmentPermissions: () =>
    api.get('/v1/chatops/admin/environment-permissions'),

  /** 创建环境权限 */
  createEnvironmentPermission: (data: { environment: string; description?: string; rate_limit?: number; require_approval?: boolean; allowed_commands?: string[]; denied_commands?: string[]; role_ids?: string[] }) =>
    api.post('/v1/chatops/admin/environment-permissions', data),

  /** 更新环境权限 */
  updateEnvironmentPermission: (id: string, data: { description?: string; rate_limit?: number; require_approval?: boolean; allowed_commands?: string[]; denied_commands?: string[]; role_ids?: string[] }) =>
    api.put(`/v1/chatops/admin/environment-permissions/${id}`, data),

  /** 删除环境权限 */
  deleteEnvironmentPermission: (id: string) =>
    api.delete(`/v1/chatops/admin/environment-permissions/${id}`),

  // ---- Command Version Management ----

  /** 获取所有命令版本 */
  getCommandVersions: (params?: { page?: number; perPage?: number }) =>
    api.get('/v1/chatops/admin/command-versions', { params }),

  /** 获取指定命令的版本历史 */
  getCommandVersionsByCommand: (commandId: string) =>
    api.get(`/v1/chatops/admin/command-versions/${commandId}`),

  /** 创建新版本 */
  createCommandVersion: (data: { command_id: string; command_text: string; parameters?: Record<string, unknown>; description?: string; changelog?: string }) =>
    api.post('/v1/chatops/admin/command-versions', data),

  /** 回滚到指定版本 */
  rollbackCommandVersion: (commandId: string, version: number) =>
    api.post(`/v1/chatops/admin/command-versions/${commandId}/rollback/${version}`),

  /** 添加标签 */
  addCommandVersionTag: (versionId: string, tagName: string) =>
    api.post(`/v1/chatops/admin/command-versions/${versionId}/tags`, { tag_name: tagName }),

  /** 删除标签 */
  removeCommandVersionTag: (versionId: string, tagName: string) =>
    api.delete(`/v1/chatops/admin/command-versions/${versionId}/tags/${tagName}`),

  /** 删除版本 */
  deleteCommandVersion: (id: string) =>
    api.delete(`/v1/chatops/admin/command-versions/${id}`),

  // ---- Rate Limit Management ----

  /** 获取限流配置列表 */
  getRateLimits: () =>
    api.get('/v1/chatops/admin/rate-limits'),

  /** 创建限流配置 */
  createRateLimit: (data: { target_type: string; target_id?: string; command_name?: string; limit_type: string; limit_count: number; window_seconds: number; description?: string }) =>
    api.post('/v1/chatops/admin/rate-limits', data),

  /** 更新限流配置 */
  updateRateLimit: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/chatops/admin/rate-limits/${id}`, data),

  /** 删除限流配置 */
  deleteRateLimit: (id: string) =>
    api.delete(`/v1/chatops/admin/rate-limits/${id}`),

  // ---- Webhook Management ----

  /** 获取 Webhook 列表 */
  getWebhooks: () =>
    api.get('/v1/chatops/admin/webhooks'),

  /** 创建 Webhook */
  createWebhook: (data: { name: string; url: string; events: string[]; secret_key?: string; enabled?: boolean; retry_count?: number; timeout_seconds?: number; headers?: Record<string, string>; description?: string }) =>
    api.post('/v1/chatops/admin/webhooks', data),

  /** 更新 Webhook */
  updateWebhook: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/chatops/admin/webhooks/${id}`, data),

  /** 删除 Webhook */
  deleteWebhook: (id: string) =>
    api.delete(`/v1/chatops/admin/webhooks/${id}`),

  /** 测试 Webhook */
  testWebhook: (id: string) =>
    api.post(`/v1/chatops/admin/webhooks/${id}/test`),

  /** 获取 Webhook 执行日志 */
  getWebhookLogs: (id: string, limit?: number) =>
    api.get(`/v1/chatops/admin/webhooks/${id}/logs`, { params: { limit } }),
};
