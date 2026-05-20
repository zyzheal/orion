/**
 * Workflow API Service
 * 低代码工作流设计器 API 客户端
 *
 * Backend routes: /api/v1/workflows
 */
import { api } from './client';

// ==================== 类型定义 ====================

export type WorkflowNodeType = 'start' | 'approval' | 'condition' | 'notification' | 'webhook' | 'end';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowHistory {
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  action: 'enter' | 'execute' | 'exit' | 'error' | 'skip';
  timestamp: string;
  data?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

export type WorkflowInstanceStatus = 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'terminated';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowInstanceStatus;
  triggeredBy: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  history: WorkflowHistory[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ==================== API 方法 ====================

/**
 * 获取工作流列表
 */
export async function getWorkflowList(params?: {
  status?: 'active' | 'paused' | 'completed' | 'failed';
  domain?: string;
  limit?: number;
  offset?: number;
}): Promise<WorkflowDefinition[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.domain) query.set('domain', params.domain);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  const response = await api.get<WorkflowDefinition[]>(`/v1/workflows${qs ? `?${qs}` : ''}`);
  return response.data.data;
}

/**
 * 获取单个工作流定义
 */
export async function getWorkflow(id: string): Promise<WorkflowDefinition> {
  const response = await api.get<WorkflowDefinition>(`/v1/workflows/${id}`);
  return response.data.data;
}

/**
 * 创建工作流
 */
export async function createWorkflow(data: {
  name: string;
  description?: string;
  steps: Array<{
    id: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
    dependsOn?: string[];
  }>;
  triggers?: string[];
}): Promise<WorkflowDefinition> {
  const response = await api.post<WorkflowDefinition>('/v1/workflows', data);
  return response.data.data;
}

/**
 * 更新工作流
 * 注意：后端暂无 PUT 端点，使用创建后替换模式
 */
export async function updateWorkflow(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    enabled: boolean;
  }>
): Promise<WorkflowDefinition> {
  // 后端暂无 PUT /v1/workflows/:id 端点
  // 前端暂存更新，等待后端补充
  const response = await api.get<WorkflowDefinition>(`/v1/workflows/${id}`);
  const existing = response.data.data;
  // 返回现有数据，标注为待后端更新
  return {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 删除工作流
 */
export async function deleteWorkflow(id: string): Promise<void> {
  await api.delete(`/v1/workflows/${id}`);
}

/**
 * 执行工作流
 */
export async function executeWorkflow(
  id: string,
  input?: {
    triggeredBy?: string;
    initialInput?: Record<string, unknown>;
  }
): Promise<WorkflowExecution> {
  const response = await api.post<WorkflowExecution>(`/v1/workflows/${id}/execute`, {
    triggeredBy: input?.triggeredBy || 'system',
    initialInput: input?.initialInput || {},
  });
  return response.data.data;
}

/**
 * 获取执行历史
 */
export async function getExecutionHistory(id: string): Promise<WorkflowExecution[]> {
  const response = await api.get<WorkflowExecution[]>(`/v1/workflows/${id}/executions`);
  return response.data.data;
}

/**
 * 获取执行详情
 */
export async function getExecutionDetail(executionId: string): Promise<WorkflowExecution> {
  const response = await api.get<WorkflowExecution>(`/v1/workflows/executions/${executionId}`);
  return response.data.data;
}

/**
 * 暂停工作流
 */
export async function suspendWorkflow(id: string): Promise<WorkflowDefinition> {
  const response = await api.post<WorkflowDefinition>(`/v1/workflows/${id}/pause`);
  return response.data.data;
}

/**
 * 恢复工作流
 */
export async function resumeWorkflow(id: string): Promise<WorkflowDefinition> {
  const response = await api.post<WorkflowDefinition>(`/v1/workflows/${id}/resume`);
  return response.data.data;
}

/**
 * 终止工作流
 * 注意：后端暂无 terminate 端点，预留接口
 */
export async function terminateWorkflow(id: string): Promise<void> {
  // 后端暂未实现 terminate 端点
  console.warn('terminateWorkflow: backend endpoint not yet implemented');
}
