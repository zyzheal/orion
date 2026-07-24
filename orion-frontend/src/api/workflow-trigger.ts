/**
 * Workflow Trigger API Service
 * 工作流触发器 API 客户端
 *
 * Backend routes: /api/v1/workflow-triggers
 */
import { api } from './client';

// ==================== 类型定义 ====================

export type WorkflowTriggerType = 'event' | 'cron' | 'manual' | 'webhook';

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  name: string;
  type: WorkflowTriggerType;
  enabled: boolean;
  eventType?: string;
  eventFilter?: Record<string, unknown>;
  cronExpression?: string;
  timezone?: string;
  webhookPath?: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowTriggerInput {
  workflowId: string;
  name: string;
  type: WorkflowTriggerType;
  enabled?: boolean;
  eventType?: string;
  eventFilter?: Record<string, unknown>;
  cronExpression?: string;
  timezone?: string;
  webhookPath?: string;
  description?: string;
}

export interface UpdateWorkflowTriggerInput {
  name?: string;
  type?: WorkflowTriggerType;
  enabled?: boolean;
  eventType?: string;
  eventFilter?: Record<string, unknown>;
  cronExpression?: string;
  timezone?: string;
  webhookPath?: string;
  description?: string;
}

export interface TriggerListResponse {
  success: boolean;
  data: WorkflowTrigger[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface TriggerResponse {
  success: boolean;
  data: WorkflowTrigger;
}

// ==================== API 方法 ====================

/**
 * 获取触发器列表
 */
export async function getTriggers(params?: {
  workflowId?: string;
  type?: WorkflowTriggerType;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}): Promise<TriggerListResponse> {
  const query = new URLSearchParams();
  if (params?.workflowId) query.set('workflowId', params.workflowId);
  if (params?.type) query.set('type', params.type);
  if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const response = await api.get(`/api/v1/workflow-triggers${query.toString() ? `?${query}` : ''}`);
  return response.data as unknown as TriggerListResponse;
}

/**
 * 获取单个触发器
 */
export async function getTrigger(id: string): Promise<WorkflowTrigger> {
  const response = await api.get(`/api/v1/workflow-triggers/${id}`);
  return (response.data as unknown as TriggerResponse).data;
}

/**
 * 创建触发器
 */
export async function createTrigger(data: CreateWorkflowTriggerInput): Promise<WorkflowTrigger> {
  const response = await api.post(`/api/v1/workflow-triggers`, data);
  return (response.data as unknown as TriggerResponse).data;
}

/**
 * 更新触发器
 */
export async function updateTrigger(id: string, data: UpdateWorkflowTriggerInput): Promise<WorkflowTrigger> {
  const response = await api.put(`/api/v1/workflow-triggers/${id}`, data);
  return (response.data as unknown as TriggerResponse).data;
}

/**
 * 删除触发器
 */
export async function deleteTrigger(id: string): Promise<void> {
  await api.delete(`/api/v1/workflow-triggers/${id}`);
}

/**
 * 启用触发器
 */
export async function enableTrigger(id: string): Promise<WorkflowTrigger> {
  const response = await api.post(`/api/v1/workflow-triggers/${id}/enable`);
  return (response.data as unknown as TriggerResponse).data;
}

/**
 * 禁用触发器
 */
export async function disableTrigger(id: string): Promise<WorkflowTrigger> {
  const response = await api.post(`/api/v1/workflow-triggers/${id}/disable`);
  return (response.data as unknown as TriggerResponse).data;
}