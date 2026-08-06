/**
 * Lowcode API Service
 * Low-code workflow/flow CRUD and execution
 */

import { api } from './client';

// ==================== Types ====================

export interface LowcodeFlow {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  nodeCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LowcodeWorkflowVersion {
  id: string;
  workflowId: string;
  version: string;
  changeLog?: string;
  snapshot?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface LowcodeTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  definition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  tags?: string[];
  usageCount?: number;
  createdBy: string;
  createdAt: string;
}

export interface LowcodeFlowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
}

export interface CreateFlowInput {
  name: string;
  description?: string;
  version?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
}

export interface UpdateFlowInput {
  name?: string;
  description?: string;
  version?: string;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  enabled?: boolean;
}

// ==================== LowcodeApi Object (for page components) ====================

/** 后端列表响应解包后的形状（axios interceptor 已解包 success.data） */
interface ListFlowsUnwrapped {
  data: LowcodeFlow[];
  total: number;
  limit: number;
  offset: number;
}

/** 执行流程响应 */
interface ExecuteFlowUnwrapped {
  success: boolean;
  data: LowcodeFlowExecution;
  message: string;
}

export const lowcodeApi = {
  /**
   * 列出所有流程
   * GET /api/v1/lowcode/flows
   * 返回 { flows: LowcodeFlow[] }
   */
  listFlows: async (): Promise<{ flows: LowcodeFlow[] }> => {
    const response = await api.get<ListFlowsUnwrapped>('/api/v1/lowcode/flows');
    return { flows: response.data.data || [] };
  },

  /**
   * 获取流程详情
   * GET /api/v1/lowcode/flows/:id
   */
  getFlow: async (id: string): Promise<LowcodeFlow> => {
    const response = await api.get<{ data: LowcodeFlow }>(`/api/v1/lowcode/flows/${id}`);
    return response.data.data;
  },

  /**
   * 创建流程
   * POST /api/v1/lowcode/flows
   */
  createFlow: async (data: { name: string; description?: string; type?: string }): Promise<LowcodeFlow> => {
    const response = await api.post<{ data: LowcodeFlow }>('/api/v1/lowcode/flows', {
      name: data.name,
      description: data.description || '',
      version: '1.0.0',
      nodes: [],
      edges: [],
    });
    return response.data.data;
  },

  /**
   * 更新流程
   * PUT /api/v1/lowcode/flows/:id
   */
  updateFlow: async (id: string, data: Record<string, unknown>): Promise<LowcodeFlow> => {
    const response = await api.put<{ data: LowcodeFlow }>(`/api/v1/lowcode/flows/${id}`, data);
    return response.data.data;
  },

  /**
   * 删除流程
   * DELETE /api/v1/lowcode/flows/:id
   */
  deleteFlow: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/lowcode/flows/${id}`);
  },

  /**
   * 发布流程
   * POST /api/v1/lowcode/flows/:id/publish
   */
  publishFlow: async (id: string): Promise<LowcodeFlow> => {
    const response = await api.post<{ data: LowcodeFlow }>(`/api/v1/lowcode/flows/${id}/publish`);
    return response.data.data;
  },

  /**
   * 执行流程
   * POST /api/v1/lowcode/flows/:id/execute
   * 返回执行结果摘要
   */
  executeFlow: async (id: string, input: Record<string, unknown> = {}): Promise<{ result: Record<string, unknown> }> => {
    const response = await api.post<ExecuteFlowUnwrapped>(`/api/v1/lowcode/flows/${id}/execute`, { input });
    const instance = response.data.data;
    return {
      result: {
        instanceId: instance.id,
        status: instance.status,
        output: instance.output || {},
      },
    };
  },

  /**
   * 创建版本快照
   * POST /api/v1/lowcode/workflows/:id/versions
   */
  createWorkflowVersion: async (workflowId: string, data?: { changeLog?: string; snapshot?: Record<string, unknown> }): Promise<LowcodeWorkflowVersion> => {
    const response = await api.post<{ data: LowcodeWorkflowVersion }>(`/api/v1/lowcode/workflows/${workflowId}/versions`, data);
    return response.data.data;
  },

  /**
   * 列出版本历史
   * GET /api/v1/lowcode/workflows/:id/versions
   * 返回 { versions: LowcodeWorkflowVersion[], total: number }
   */
  listWorkflowVersions: async (workflowId: string, params?: { limit?: number; offset?: number }): Promise<{ versions: LowcodeWorkflowVersion[]; total: number }> => {
    const response = await api.get<{ data: { versions: LowcodeWorkflowVersion[]; total: number; limit: number; offset: number } }>(`/api/v1/lowcode/workflows/${workflowId}/versions`, { params });
    const unwrapped = response.data.data;
    return { versions: unwrapped.versions || [], total: unwrapped.total || 0 };
  },

  /**
   * 导出流程
   * POST /api/v1/lowcode/workflows/:id/export
   */
  exportWorkflow: async (id: string): Promise<ExportWorkflowResponse> => {
    const response = await api.post<{ data: ExportWorkflowResponse }>(`/api/v1/lowcode/workflows/${id}/export`);
    return response.data.data;
  },

  /**
   * 导入流程
   * POST /api/v1/lowcode/workflows/import
   */
  importWorkflow: async (data: {
    name: string;
    description?: string;
    exportedAt: string;
    versions: LowcodeWorkflowVersion[];
    currentDefinition: {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
    };
  }): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; message: string; data: LowcodeFlow }>('/api/v1/lowcode/workflows/import', data);
    return { success: response.data.success, message: response.data.message };
  },

  /**
   * 列出模板
   * GET /api/v1/lowcode/templates
   * 返回模板数组（interceptor 已解包 success.data）
   */
  listTemplates: async (): Promise<LowcodeTemplate[]> => {
    const response = await api.get<LowcodeTemplate[]>('/api/v1/lowcode/templates');
    return response.data || [];
  },

  /**
   * 创建模板
   * POST /api/v1/lowcode/templates
   */
  createTemplate: async (data: {
    name: string;
    description?: string;
    category?: string;
    thumbnail?: string;
    definition: {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
    };
    tags?: string[];
  }): Promise<LowcodeTemplate> => {
    const response = await api.post<{ data: LowcodeTemplate }>('/api/v1/lowcode/templates', data);
    return response.data.data;
  },

  /**
   * 应用模板创建流程
   * POST /api/v1/lowcode/templates/:id/apply
   */
  applyTemplate: async (templateId: string, data: { workflowName: string; description?: string; variables?: Record<string, string> }): Promise<LowcodeFlow> => {
    const response = await api.post<{ data: LowcodeFlow; message: string }>(`/api/v1/lowcode/templates/${templateId}/apply`, data);
    return response.data.data;
  },
};

// ==================== Named exports (backward compatibility) ====================

export function listFlows(params?: { limit?: number; offset?: number; search?: string; enabled?: boolean }) {
  return api.get('/api/v1/lowcode/flows', { params });
}

export function getFlow(id: string) {
  return api.get(`/api/v1/lowcode/flows/${id}`);
}

export function createFlow(data: CreateFlowInput) {
  return api.post('/api/v1/lowcode/flows', data);
}

export function updateFlow(id: string, data: UpdateFlowInput) {
  return api.put(`/api/v1/lowcode/flows/${id}`, data);
}

export function deleteFlow(id: string) {
  return api.delete(`/api/v1/lowcode/flows/${id}`);
}

export function publishFlow(id: string) {
  return api.post(`/api/v1/lowcode/flows/${id}/publish`);
}

// ==================== Execution ====================

export function executeFlow(id: string, input?: Record<string, unknown>, triggeredBy?: string) {
  return api.post(`/api/v1/lowcode/flows/${id}/execute`, { input, triggeredBy });
}

export function getFlowExecution(executionId: string) {
  return api.get(`/api/v1/lowcode/executions/${executionId}`);
}

// ==================== Versions ====================

export function createWorkflowVersion(workflowId: string, data?: { changeLog?: string; snapshot?: Record<string, unknown> }) {
  return api.post(`/api/v1/lowcode/workflows/${workflowId}/versions`, data);
}

export function listWorkflowVersions(workflowId: string, params?: { limit?: number; offset?: number }) {
  return api.get(`/api/v1/lowcode/workflows/${workflowId}/versions`, { params });
}

// ==================== Import/Export ====================

export interface ExportWorkflowResponse {
  workflow: {
    id: string;
    name: string;
    description?: string;
    version: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  exportedAt: string;
  versions: LowcodeWorkflowVersion[];
}

export function exportWorkflow(id: string) {
  return api.post<ExportWorkflowResponse>(`/api/v1/lowcode/workflows/${id}/export`);
}

export function importWorkflow(data: {
  name: string;
  description?: string;
  exportedAt: string;
  versions: LowcodeWorkflowVersion[];
  currentDefinition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}) {
  return api.post('/api/v1/lowcode/workflows/import', data);
}

// ==================== Templates ====================

export function listTemplates() {
  return api.get('/api/v1/lowcode/templates');
}

export function createTemplate(data: {
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  definition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  tags?: string[];
}) {
  return api.post('/api/v1/lowcode/templates', data);
}

export function applyTemplate(templateId: string, data: { workflowName: string; description?: string; variables?: Record<string, string> }) {
  return api.post(`/api/v1/lowcode/templates/${templateId}/apply`, data);
}
