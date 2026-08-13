/**
 * Workflow API Service
 * 低代码工作流设计器 API 客户端
 *
 * Backend routes: /api/v1/workflows
 */
import { api } from './client';

// ==================== 类型定义 ====================

export type WorkflowNodeType = 'start' | 'approval' | 'condition' | 'notification' | 'webhook' | 'task' | 'sub-workflow' | 'delay' | 'timer' | 'end';

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
/**
 * Normalize a workflow definition from backend format.
 * Backend stores nodes/edges as JSONB wrapped objects: {"nodes": [...], "edges": [...]}
 * Frontend expects arrays.
 */
function normalizeWorkflow(raw: unknown): WorkflowDefinition {
  const w = raw as Record<string, unknown>;
  return {
    id: (w.id || '') as string,
    tenantId: (w.tenantId || '') as string,
    name: (w.name || '') as string,
    description: (w.description as string) || undefined,
    version: typeof w.version === 'number' ? w.version : typeof w.version === 'string' ? parseInt(w.version, 10) || 1 : 1,
    enabled: w.enabled === true,
    nodes: Array.isArray(w.nodes) ? (w.nodes as WorkflowNode[]) :
      w.nodes && typeof w.nodes === 'object' && 'nodes' in w.nodes ? (w.nodes as { nodes?: WorkflowNode[] }).nodes || [] :
      [],
    edges: Array.isArray(w.edges) ? (w.edges as WorkflowEdge[]) :
      w.edges && typeof w.edges === 'object' && 'edges' in w.edges ? (w.edges as { edges?: WorkflowEdge[] }).edges || [] :
      [],
    createdBy: (w.createdBy as string) || '',
    createdAt: (w.createdAt as string) || '',
    updatedAt: (w.updatedAt as string) || '',
  };
}

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
  const response = await api.get<WorkflowDefinition[]>(`/api/v1/workflows${qs ? `?${qs}` : ''}`);
  const items = (response.data as { data?: WorkflowDefinition[] }).data ?? response.data;
  return (Array.isArray(items) ? items : []).map(normalizeWorkflow);
}

/**
 * 获取单个工作流定义
 */
export async function getWorkflow(id: string): Promise<WorkflowDefinition> {
  const response = await api.get<WorkflowDefinition>(`/api/v1/workflows/${id}`);
  return normalizeWorkflow(response.data as unknown);
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
  const response = await api.post<WorkflowDefinition>('/api/v1/workflows', data);
  // 拦截器已自动解包，response.data 直接是响应数据
  return response.data as WorkflowDefinition;
}

/**
 * 更新工作流
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
  const response = await api.put<WorkflowDefinition>(`/api/v1/workflows/${id}`, data);
  // 拦截器已自动解包，response.data 直接是响应数据
  return response.data as WorkflowDefinition;
}

/**
 * 删除工作流
 */
export async function deleteWorkflow(id: string): Promise<void> {
  await api.delete(`/api/v1/workflows/${id}`);
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
  const response = await api.post<WorkflowExecution>(`/api/v1/workflows/${id}/execute`, {
    triggeredBy: input?.triggeredBy || 'system',
    initialInput: input?.initialInput || {},
  });
  // 拦截器已自动解包，response.data 直接是响应数据
  return response.data as WorkflowExecution;
}

/**
 * 获取执行历史
 */
export async function getExecutionHistory(id: string): Promise<WorkflowExecution[]> {
  const response = await api.get<WorkflowExecution[]>(`/api/v1/workflows/${id}/executions`);
  // 拦截器已自动解包，response.data 直接是响应数据
  return (response.data as { data?: WorkflowExecution[] }).data ?? [];
}

/**
 * 获取执行详情
 */
export async function getExecutionDetail(executionId: string): Promise<WorkflowExecution> {
  const response = await api.get<WorkflowExecution>(`/api/v1/workflows/executions/${executionId}`);
  // 拦截器已自动解包，response.data 直接是响应数据
  return response.data as WorkflowExecution;
}

/**
 * 暂停工作流
 */
export async function suspendWorkflow(id: string): Promise<WorkflowDefinition> {
  const response = await api.post<WorkflowDefinition>(`/api/v1/workflows/${id}/pause`);
  // 拦截器已自动解包，response.data 直接是响应数据
  return response.data as WorkflowDefinition;
}

/**
 * 恢复工作流
 */
export async function resumeWorkflow(id: string): Promise<WorkflowDefinition> {
  const response = await api.post<WorkflowDefinition>(`/api/v1/workflows/${id}/resume`);
  // 拦截器已自动解包，response.data 直接是响应数据
  return response.data as WorkflowDefinition;
}

/**
 * 终止工作流
 * 注意：后端暂无 terminate 端点，预留接口
 */
export async function terminateWorkflow(_id: string): Promise<void> {
  // 后端暂未实现 terminate 端点
  console.warn('terminateWorkflow: backend endpoint not yet implemented');
}
