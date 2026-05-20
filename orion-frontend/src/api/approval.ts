/**
 * Approval Flow Management API Client
 *
 * 后端 API 前缀: /api/v1/approvals
 * 覆盖: 审批流程配置、审批记录、审批模板、超时管理
 *
 * 后端路由: orion-platform-service/src/api/approval-routes.ts
 * 后端服务: MultiLevelApprovalService, ApprovalTemplateService, ApprovalFlowEngine
 */

import { api } from './client';

// ==================== 类型定义 ====================

// ---- 审批状态 ----
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'timeout';

// ---- 审批模式 ----
export type ApprovalMode = 'sequential' | 'parallel' | 'or_gate';

// ---- 风险等级 ----
export type RiskLevel = 1 | 2 | 3 | 4;

// ---- 环境 ----
export type Environment = 'dev' | 'staging' | 'prod';

// ---- 审批节点 ----
export interface ApprovalLevel {
  levelIndex: number;
  approverIds: string[];
  requiredApprovals: number;
  timeout_hours?: number;
}

// ---- 审批请求 ----
export interface ApprovalRequest {
  id: string;
  title: string;
  description?: string;
  requesterId: string;
  approverIds: string[];
  status: ApprovalStatus;
  approvals: string[];
  rejections: string[];
  requiredApprovals: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  comments?: ApprovalComment[];
}

// ---- 审批评论 ----
export interface ApprovalComment {
  userId: string;
  comment: string;
  action: 'approved' | 'rejected';
  createdAt: string;
}

// ---- 审批链详情 ----
export interface ApprovalStepDetail {
  stepIndex: number;
  levelIndex: number;
  approverId: string;
  status: 'pending' | 'approved' | 'rejected' | 'waiting' | 'timeout';
  comment?: string;
  actedAt?: string;
  timeoutAt?: string;
}

export interface ApprovalChainInfo {
  id: string;
  title: string;
  description?: string;
  requesterId: string;
  resourceType: string;
  resourceId: string;
  status: ApprovalStatus;
  totalLevels: number;
  steps: ApprovalStepDetail[];
  createdAt: string;
  updatedAt: string;
  mode?: ApprovalMode;
  metadata?: Record<string, unknown>;
}

// ---- 审批模板 ----
export interface ApprovalTemplate {
  id: string;
  name: string;
  description?: string;
  resourceType: string;
  levels: ApprovalLevel[];
  mode?: ApprovalMode;
  isDefault: boolean;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- 超时配置 ----
export interface ApprovalTimeoutConfig {
  id?: string;
  resourceType?: string;
  defaultTimeoutHours: number;
  escalationEnabled: boolean;
  escalationTarget?: string;
  autoRejectOnTimeout: boolean;
  reminderIntervalHours: number;
  createdAt?: string;
  updatedAt?: string;
}

// ---- 审批流程配置 (Flow Config) ----
export interface ApprovalFlowConfig {
  id: string;
  name: string;
  description?: string;
  capabilityId: string;
  environment: Environment;
  riskLevel: RiskLevel;
  levels: ApprovalLevel[];
  mode: ApprovalMode;
  enabled: boolean;
  timeoutHours?: number;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// ---- 输入类型 ----
export interface CreateApprovalFlowInput {
  name: string;
  description?: string;
  capabilityId: string;
  environment: Environment;
  riskLevel: RiskLevel;
  levels: ApprovalLevel[];
  mode: ApprovalMode;
  enabled?: boolean;
  timeoutHours?: number;
}

export interface UpdateApprovalFlowInput {
  name?: string;
  description?: string;
  levels?: ApprovalLevel[];
  mode?: ApprovalMode;
  enabled?: boolean;
  timeoutHours?: number;
}

export interface CreateApprovalInput {
  title: string;
  description?: string;
  requesterId: string;
  approverIds: string[];
  requiredApprovals?: number;
  metadata?: Record<string, unknown>;
}

export interface ApproveRejectInput {
  userId: string;
  comment?: string;
}

// ---- 响应类型 ----
export interface ApprovalListResponse {
  approvals: ApprovalRequest[];
}

export interface ApprovalTemplateListResponse {
  templates: ApprovalTemplate[];
}

// ==================== API 客户端 ====================

// ---- 审批流程配置 ----

/**
 * 获取审批流程列表
 * GET /api/v1/approvals/flows
 */
export function getApprovalFlows(params?: {
  capabilityId?: string;
  environment?: string;
  riskLevel?: number;
}) {
  return api.get<ApprovalFlowConfig[]>('/v1/approvals/flows', { params });
}

/**
 * 获取单个审批流程
 * GET /api/v1/approvals/flows/:id
 */
export function getApprovalFlow(id: string) {
  return api.get<ApprovalFlowConfig>(`/v1/approvals/flows/${id}`);
}

/**
 * 创建审批流程
 * POST /api/v1/approvals/flows
 */
export function createApprovalFlow(data: CreateApprovalFlowInput) {
  return api.post<ApprovalFlowConfig>('/v1/approvals/flows', data);
}

/**
 * 更新审批流程
 * PUT /api/v1/approvals/flows/:id
 */
export function updateApprovalFlow(id: string, data: UpdateApprovalFlowInput) {
  return api.put<ApprovalFlowConfig>(`/v1/approvals/flows/${id}`, data);
}

/**
 * 删除审批流程
 * DELETE /api/v1/approvals/flows/:id
 */
export function deleteApprovalFlow(id: string) {
  return api.delete(`/v1/approvals/flows/${id}`);
}

// ---- 审批记录 ----

/**
 * 获取所有待审批
 * GET /api/v1/approvals
 */
export function getApprovals() {
  return api.get<ApprovalListResponse>('/v1/approvals');
}

/**
 * 获取单个审批详情
 * GET /api/v1/approvals/requests/:id
 */
export function getApproval(id: string) {
  return api.get<ApprovalChainInfo>(`/v1/approvals/requests/${id}`);
}

/**
 * 提交审批请求
 * POST /api/v1/approvals/requests
 */
export function submitApprovalRequest(data: {
  title: string;
  description?: string;
  requesterId: string;
  resourceType: string;
  resourceId: string;
  levels: ApprovalLevel[];
  mode?: ApprovalMode;
  metadata?: Record<string, unknown>;
}) {
  return api.post<ApprovalChainInfo>('/v1/approvals/requests', data);
}

/**
 * 审批操作 (通用)
 * POST /api/v1/approvals/requests/:id/review
 */
export function reviewApproval(
  id: string,
  data: { reviewerId: string; action: 'approve' | 'reject'; comment?: string }
) {
  return api.post<ApprovalChainInfo>(`/v1/approvals/requests/${id}/review`, data);
}

/**
 * 审批通过
 * POST /api/v1/approvals/requests/:id/approve
 */
export function approveRequest(id: string, data: { reviewerId: string; comment?: string }) {
  return api.post<ApprovalChainInfo>(`/v1/approvals/requests/${id}/approve`, data);
}

/**
 * 审批拒绝
 * POST /api/v1/approvals/requests/:id/reject
 */
export function rejectRequest(id: string, data: { reviewerId: string; comment?: string }) {
  return api.post<ApprovalChainInfo>(`/v1/approvals/requests/${id}/reject`, data);
}

/**
 * 获取审批历史
 * GET /api/v1/approvals/requests/:id/history
 */
export function getApprovalHistory(id: string) {
  return api.get<{ requestId: string; title: string; status: string; totalLevels: number; history: ApprovalStepDetail[] }>(
    `/v1/approvals/requests/${id}/history`
  );
}

/**
 * 获取待审批列表 (按用户)
 * GET /api/v1/approvals/pending
 */
export function getPendingApprovals(params?: { userId?: string; tenantId?: string }) {
  return api.get<ApprovalChainInfo[]>('/v1/approvals/pending', { params });
}

// ---- 审批模板 ----

/**
 * 获取审批模板列表
 * GET /api/v1/approvals/templates
 */
export function getApprovalTemplates(params?: { tenantId?: string }) {
  return api.get<ApprovalTemplate[]>('/v1/approvals/templates', { params });
}

/**
 * 创建审批模板
 * POST /api/v1/approvals/templates
 */
export function createApprovalTemplate(data: {
  name: string;
  description?: string;
  resourceType: string;
  levels: ApprovalLevel[];
  mode?: ApprovalMode;
  isDefault?: boolean;
  tenantId?: string;
}) {
  return api.post<ApprovalTemplate>('/v1/approvals/templates', data);
}

// ---- 超时配置 ----

/**
 * 获取超时配置列表
 * GET /api/v1/approvals/timeout-configs
 */
export function getTimeoutConfigs(params?: { resourceType?: string }) {
  return api.get<ApprovalTimeoutConfig[]>('/v1/approvals/timeout-configs', { params });
}

/**
 * 创建超时配置
 * POST /api/v1/approvals/timeout-configs
 */
export function createTimeoutConfig(data: Omit<ApprovalTimeoutConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<ApprovalTimeoutConfig>('/v1/approvals/timeout-configs', data);
}

/**
 * 更新超时配置
 * PUT /api/v1/approvals/timeout-configs/:id
 */
export function updateTimeoutConfig(
  id: string,
  data: Partial<Omit<ApprovalTimeoutConfig, 'id' | 'createdAt' | 'updatedAt'>>
) {
  return api.put<ApprovalTimeoutConfig>(`/v1/approvals/timeout-configs/${id}`, data);
}

/**
 * 删除超时配置
 * DELETE /api/v1/approvals/timeout-configs/:id
 */
export function deleteTimeoutConfig(id: string) {
  return api.delete(`/v1/approvals/timeout-configs/${id}`);
}

// ---- 紧急审批 ----

/**
 * 紧急审批
 * POST /api/v1/approvals/emergency
 */
export function requestEmergencyApproval(data: {
  title: string;
  description: string;
  requesterId: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  impactDescription: string;
  approverIds: string[];
  metadata?: Record<string, unknown>;
}) {
  return api.post<ApprovalChainInfo>('/v1/approvals/emergency', data);
}

// ---- Agent 分析 ----

/**
 * Agent 自动分析
 * POST /api/v1/approvals/agent/analyze
 */
export function agentAnalyze(data: {
  requestId?: string;
  resourceType?: string;
  resourceId?: string;
  context?: Record<string, unknown>;
}) {
  return api.post('/v1/approvals/agent/analyze', data);
}
